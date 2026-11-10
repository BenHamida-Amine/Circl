import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { selectAdvisorQuestion } from './advisor-server.mjs';
import { createSandboxCheckout } from './paypal-server.mjs';

const root = new URL('./', import.meta.url);
try {
  process.loadEnvFile?.(fileURLToPath(new URL('.env.local', root)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const port = Number(process.env.PORT || 4173);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };
const configuredKey = process.env.OPENAI_API_KEY?.trim() ?? '';
const key = /^sk-[A-Za-z0-9_-]{20,}$/.test(configuredKey) ? configuredKey : undefined;
const paypal = createSandboxCheckout({
  clientId: process.env.PAYPAL_SANDBOX_CLIENT_ID?.trim(),
  secret: process.env.PAYPAL_SANDBOX_SECRET?.trim(),
});

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function allowedLocalOrigin(request) {
  const { host, origin } = request.headers;
  return /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host ?? '') && (!origin || origin === 'http://' + host);
}

async function requestJson(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw Object.assign(new Error('Send a JSON body.'), { status: 415 });
  }
  let body = '';
  for await (const part of request) {
    body += part;
    if (body.length > 2048) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  }
  const data = JSON.parse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
  return data;
}

let requestWindow = 0;
let advisorRequests = 0;
async function advisorEndpoint(request, response) {
  if (!allowedLocalOrigin(request)) return json(response, 403, { error: 'Origin not allowed.' });
  if (request.method === 'GET') return json(response, 200, { enabled: Boolean(key) });
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
  if (!key) return json(response, 503, { error: 'Live AI is not configured.' });
  if (Date.now() >= requestWindow + 60000) {
    requestWindow = Date.now();
    advisorRequests = 0;
  }
  if (advisorRequests >= 24) return json(response, 429, { error: 'Try again in a minute.' });
  let input;
  try {
    input = await requestJson(request);
  } catch (error) {
    return json(response, error.status ?? 400, { error: error.status ? error.message : 'Invalid advisor request.' });
  }
  advisorRequests++;
  try {
    const result = await selectAdvisorQuestion(input, { key, model: process.env.OPENAI_ADVISOR_MODEL || undefined });
    return json(response, 200, result);
  } catch (error) {
    if (error.status) console.error('Advisor model request failed with HTTP status', error.status);
    return json(response, 502, { error: 'Live AI is unavailable.' });
  }
}

async function paypalEndpoint(request, response, path) {
  if (!allowedLocalOrigin(request)) return json(response, 403, { error: 'Origin not allowed.' });
  if (request.method === 'GET' && path === '/api/paypal') {
    return json(response, 200, { enabled: paypal.enabled, clientId: paypal.clientId });
  }
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
  if (path !== '/api/paypal/order' && path !== '/api/paypal/capture') {
    return json(response, 404, { error: 'Checkout route not found.' });
  }
  let input;
  try {
    input = await requestJson(request);
  } catch (error) {
    return json(response, error.status ?? 400, { error: error.status ? error.message : 'Invalid checkout request.' });
  }
  try {
    const result = path === '/api/paypal/order' ? await paypal.createOrder(input.circleId) :
      await paypal.captureOrder(input.orderId, input.token);
    return json(response, 200, result);
  } catch (error) {
    return json(response, error.status ?? 502, { error: error.status ? error.message : 'PayPal Sandbox is unavailable.' });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/advisor') return advisorEndpoint(request, response);
  if (url.pathname === '/api/paypal' || url.pathname.startsWith('/api/paypal/')) return paypalEndpoint(request, response, url.pathname);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/(?:index\.html|styles\.css|(?:app|data|views|dialogs|account|account-config|advisor|advisor-ui|paypal-ui)\.js|assets\/[a-z-]+\.svg)$/.test(path)) {
    response.writeHead(404).end('Page not found');
    return;
  }

  try {
    const body = await readFile(new URL(path.slice(1), root));
    response.writeHead(200, { 'Content-Type': types[path.split('.').at(-1)] + '; charset=utf-8' });
    response.end(body);
  } catch {
    response.writeHead(404).end('File not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Circl preview: http://127.0.0.1:${port}/`));
