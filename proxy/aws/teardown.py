#!/usr/bin/env python3
"""
Tear down ALL AWS resources created by deploy.py for the TruLens proxy:
  - API Gateway HTTP API  (trulens-proxy)
  - Lambda function       (trulens-proxy)  + its Function URL config
  - DynamoDB table        (trulens-rl)
  - IAM role              (trulens-proxy-role)

WARNING: this disables the free-AI tier for everyone using the published
extension. Only run it to decommission or rebuild the proxy.

Reads AWS creds from the environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
AWS_DEFAULT_REGION). Idempotent — safe to re-run; missing resources are skipped.
"""
import os
import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
FN = "trulens-proxy"
TABLE = "trulens-rl"
ROLE = "trulens-proxy-role"

iam = boto3.client("iam", region_name=REGION)
ddb = boto3.client("dynamodb", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)
gw = boto3.client("apigatewayv2", region_name=REGION)

def skip(e, *codes):
    if e.response["Error"]["Code"] not in codes:
        raise

# 1) API Gateway --------------------------------------------------------------
try:
    for a in gw.get_apis().get("Items", []):
        if a["Name"] == FN:
            gw.delete_api(ApiId=a["ApiId"])
            print(f"API Gateway: deleted {a['ApiId']}")
            break
    else:
        print("API Gateway: none found")
except ClientError as e:
    skip(e, "NotFoundException")

# 2) Lambda (removes Function URL config + resource policies with it) ----------
try:
    try:
        lam.delete_function_url_config(FunctionName=FN)
        print("Lambda: Function URL config deleted")
    except ClientError as e:
        skip(e, "ResourceNotFoundException")
    lam.delete_function(FunctionName=FN)
    print("Lambda: function deleted")
except ClientError as e:
    skip(e, "ResourceNotFoundException")

# 3) DynamoDB -----------------------------------------------------------------
try:
    ddb.delete_table(TableName=TABLE)
    print("DynamoDB: table deleting...")
    ddb.get_waiter("table_not_exists").wait(TableName=TABLE)
    print("DynamoDB: table deleted")
except ClientError as e:
    skip(e, "ResourceNotFoundException")

# 4) IAM role (detach/delete policies first) ----------------------------------
try:
    for p in iam.list_attached_role_policies(RoleName=ROLE).get("AttachedPolicies", []):
        iam.detach_role_policy(RoleName=ROLE, PolicyArn=p["PolicyArn"])
    for name in iam.list_role_policies(RoleName=ROLE).get("PolicyNames", []):
        iam.delete_role_policy(RoleName=ROLE, PolicyName=name)
    iam.delete_role(RoleName=ROLE)
    print("IAM: role deleted")
except ClientError as e:
    skip(e, "NoSuchEntity")

print("Teardown complete.")
