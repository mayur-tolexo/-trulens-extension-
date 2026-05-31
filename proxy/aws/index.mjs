// TruLens free-AI proxy — AWS Lambda (Function URL) + DynamoDB rate limiter.
// The MiniMax key is provided as the MINIMAX_API_KEY env var at deploy time
// (never committed). DynamoDB holds only a per-user/day request counter.
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE;
const LIMIT = parseInt(process.env.DAILY_LIMIT || '40', 10);
const MODEL = process.env.MODEL || 'MiniMax-M2';
const KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_URL = 'https://api.minimax.io/v1/chat/completions';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-trulens-client',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (method !== 'POST') return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  const headers = event.headers || {};
  const client = headers['x-trulens-client'] || event?.requestContext?.http?.sourceIp || 'anon';
  const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const id = `${client}:${day}`;

  // Atomic per-user/day increment with a 2-day TTL.
  let count = 1;
  try {
    const res = await ddb.send(new UpdateItemCommand({
      TableName: TABLE,
      Key: { id: { S: id } },
      UpdateExpression: 'ADD cnt :one SET exp = if_not_exists(exp, :exp)',
      ExpressionAttributeValues: {
        ':one': { N: '1' },
        ':exp': { N: String(Math.floor(Date.now() / 1000) + 172800) },
      },
      ReturnValues: 'UPDATED_NEW',
    }));
    count = parseInt(res.Attributes?.cnt?.N || '1', 10);
  } catch (e) {
    console.error('rate-limit store error (failing open):', e);
  }
  if (count > LIMIT) {
    return {
      statusCode: 429,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'daily_limit', limit: LIMIT }),
    };
  }

  let body = {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}');
    body = JSON.parse(raw);
  } catch { body = {}; }

  const upstream = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, max_tokens: body.max_tokens ?? 1024, messages: body.messages || [] }),
  });
  const text = await upstream.text();
  return {
    statusCode: upstream.status,
    headers: { ...cors, 'content-type': 'application/json', 'x-ratelimit-remaining': String(Math.max(0, LIMIT - count)) },
    body: text,
  };
};
