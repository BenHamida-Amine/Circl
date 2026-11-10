import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { selectAdvisorQuestion } from './advisor-server.mjs';

const root = new URL('./', import.meta.url);
try {
  process.loadEnvFile?.(fileURLToPath(new URL('.env.local', root)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const port = Number(process.env.PORT || 4173);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };
const key = process.env.OPENAI_API_KEY?.trim();

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

let requestWindow = 0;
let advisorRequests = 0;
async function advisorEndpoint(request, response) {
  if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(request.headers.host ?? '') ||
      (request.headers.origin && request.headers.origin !== 'http://' + request.headers.host)) {
    return json(response, 403, { error: 'Origin not allowed.' });
  }
  if (request.method === 'GET') return json(response, 200, { enabled: Boolean(key) });
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed.' });
  if (!key) return json(response, 503, { error: 'Live AI is not configured.' });
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    return json(response, 415, { error: 'Send a JSON body.' });
  }
  if (Date.now() >= requestWindow + 60000) {
    requestWindow = Date.now();
    advisorRequests = 0;
  }
  if (advisorRequests >= 24) return json(response, 429, { error: 'Try again in a minute.' });
  let body = '';
  try {
    for await (const part of request) {
      body += part;
      if (body.length > 2048) return json(response, 413, { error: 'Request is too large.' });
    }
  } catch {
    return json(response, 400, { error: 'Could not read the request.' });
  }
  let input;
  try {
    input = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
  } catch {
    return json(response, 400, { error: 'Invalid advisor request.' });
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/advisor') return advisorEndpoint(request, response);
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/(?:index\.html|styles\.css|(?:app|data|views|dialogs|account|account-config|advisor|advisor-ui)\.js|assets\/[a-z-]+\.svg)$/.test(path)) {
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
