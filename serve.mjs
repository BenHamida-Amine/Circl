import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const port = Number(process.env.PORT || 4173);
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!/^\/(?:index\.html|styles\.css|(?:app|data|views|dialogs)\.js|assets\/[a-z-]+\.svg)$/.test(path)) {
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
