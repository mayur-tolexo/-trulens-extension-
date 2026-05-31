#!/usr/bin/env python3
"""
Deploy the TruLens free-AI proxy to AWS without SAM/CloudFormation.
Creates: a DynamoDB rate-limit table, an IAM execution role, a Node.js Lambda
(from index.mjs), and a public Lambda Function URL with CORS. Idempotent.

Reads from environment:
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION (boto3 picks up)
  MINIMAX_API_KEY   (required) — stored as a Lambda env var, never printed
  DAILY_LIMIT       (default 40)
  MODEL             (default MiniMax-M2)
Outputs the Function URL on a line starting with 'PROXY_URL='.
"""
import io, json, os, sys, time, zipfile
import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
KEY = os.environ.get("MINIMAX_API_KEY")
LIMIT = os.environ.get("DAILY_LIMIT", "40")
MODEL = os.environ.get("MODEL", "MiniMax-M2")
FN = "trulens-proxy"
TABLE = "trulens-rl"
ROLE = "trulens-proxy-role"

if not KEY:
    sys.exit("MINIMAX_API_KEY env var is required")

iam = boto3.client("iam", region_name=REGION)
ddb = boto3.client("dynamodb", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)
acct = boto3.client("sts", region_name=REGION).get_caller_identity()["Account"]
print(f"Account {acct}, region {REGION}")

# 1) DynamoDB table -----------------------------------------------------------
try:
    ddb.create_table(
        TableName=TABLE, BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
        KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
    )
    print("DynamoDB: creating table...")
    ddb.get_waiter("table_exists").wait(TableName=TABLE)
except ClientError as e:
    if e.response["Error"]["Code"] != "ResourceInUseException":
        raise
    print("DynamoDB: table already exists")
try:
    ddb.update_time_to_live(
        TableName=TABLE,
        TimeToLiveSpecification={"Enabled": True, "AttributeName": "exp"},
    )
    print("DynamoDB: TTL on 'exp' enabled")
except ClientError as e:
    if "TimeToLive is already enabled" not in str(e):
        print("DynamoDB: TTL note:", e.response["Error"]["Code"])
table_arn = f"arn:aws:dynamodb:{REGION}:{acct}:table/{TABLE}"

# 2) IAM role -----------------------------------------------------------------
trust = {"Version": "2012-10-17", "Statement": [{
    "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"}]}
try:
    role = iam.create_role(RoleName=ROLE, AssumeRolePolicyDocument=json.dumps(trust),
                           Description="TruLens proxy Lambda execution role")
    role_arn = role["Role"]["Arn"]
    print("IAM: role created")
    time.sleep(10)  # allow role to propagate
except ClientError as e:
    if e.response["Error"]["Code"] != "EntityAlreadyExists":
        raise
    role_arn = iam.get_role(RoleName=ROLE)["Role"]["Arn"]
    print("IAM: role already exists")
iam.attach_role_policy(RoleName=ROLE,
    PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")
iam.put_role_policy(RoleName=ROLE, PolicyName="trulens-ddb", PolicyDocument=json.dumps({
    "Version": "2012-10-17", "Statement": [{
        "Effect": "Allow",
        "Action": ["dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:PutItem"],
        "Resource": table_arn}]}))
print("IAM: policies attached")

# 3) Package the Lambda code --------------------------------------------------
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    z.write("index.mjs", "index.mjs")
    z.write("package.json", "package.json")
code = buf.getvalue()

env = {"Variables": {"MINIMAX_API_KEY": KEY, "DAILY_LIMIT": LIMIT, "MODEL": MODEL, "TABLE": TABLE}}

# 4) Lambda function (create or update) ---------------------------------------
def create_fn():
    for attempt in range(6):
        try:
            lam.create_function(
                FunctionName=FN, Runtime="nodejs20.x", Role=role_arn,
                Handler="index.handler", Code={"ZipFile": code},
                Timeout=30, MemorySize=256, Environment=env, Publish=True)
            return
        except ClientError as e:
            msg = str(e)
            if "cannot be assumed" in msg or "InvalidParameterValueException" in e.response["Error"]["Code"]:
                print(f"Lambda: waiting for role to propagate (try {attempt+1})...")
                time.sleep(8)
                continue
            raise
    raise SystemExit("Lambda: role never became assumable")

try:
    create_fn()
    print("Lambda: function created")
except ClientError as e:
    if e.response["Error"]["Code"] != "ResourceConflictException":
        raise
    lam.update_function_code(FunctionName=FN, ZipFile=code, Publish=True)
    lam.get_waiter("function_updated").wait(FunctionName=FN)
    lam.update_function_configuration(FunctionName=FN, Environment=env, Timeout=30, MemorySize=256)
    print("Lambda: function updated")
lam.get_waiter("function_active_v2").wait(FunctionName=FN)

# 5) API Gateway HTTP API ------------------------------------------------------
# (Used instead of a Lambda Function URL: many AWS accounts/orgs block public
#  Function URLs via SCP, which returns 403. API Gateway is not subject to that.)
gw = boto3.client("apigatewayv2", region_name=REGION)
fn_arn = lam.get_function(FunctionName=FN)["Configuration"]["FunctionArn"]
api = next((a for a in gw.get_apis()["Items"] if a["Name"] == FN), None)
if not api:
    api = gw.create_api(
        Name=FN, ProtocolType="HTTP", Target=fn_arn,
        CorsConfiguration={"AllowOrigins": ["*"], "AllowMethods": ["POST", "OPTIONS"],
                           "AllowHeaders": ["content-type", "x-trulens-client"]})
    print("API Gateway: created")
else:
    print("API Gateway: already exists")
api_id = api["ApiId"]
try:
    lam.add_permission(FunctionName=FN, StatementId="apigw-invoke",
        Action="lambda:InvokeFunction", Principal="apigateway.amazonaws.com",
        SourceArn=f"arn:aws:execute-api:{REGION}:{acct}:{api_id}/*/*")
    print("API Gateway: invoke permission added")
except ClientError as e:
    if e.response["Error"]["Code"] != "ResourceConflictException":
        raise
    print("API Gateway: invoke permission already present")

print(f"PROXY_URL={api['ApiEndpoint']}/")
