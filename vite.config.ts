import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localFirebaseFunctionsPlugin(enabled: boolean): Plugin {
  return {
    name: 'local-firebase-emulator-functions',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return;
      server.config.logger.info('Local Firebase emulator function routes enabled.');
      server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next) => {
        const path = new URL(request.url || '/', 'http://localhost').pathname;
        if (path.startsWith('/.netlify/functions/')) server.config.logger.info(`Local Firebase function request: ${request.method} ${path}`);
        if (path !== '/.netlify/functions/bootstrap-admin' && path !== '/.netlify/functions/staff') {
          next();
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          const body = Buffer.concat(chunks).toString('utf8');
          const headers = Object.fromEntries(
            Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]),
          );
          const event = {
            httpMethod: request.method || 'GET',
            headers,
            body,
            queryStringParameters: Object.fromEntries(new URL(request.url || '/', 'http://localhost').searchParams.entries()),
          };
          const result = path.endsWith('/bootstrap-admin')
            ? await (await import('./netlify/functions/bootstrap-admin')).handler(event)
            : await (await import('./netlify/functions/staff')).handler(event);
          response.writeHead(result.statusCode, result.headers);
          response.end(result.body);
        } catch (error) {
          server.config.logger.error('Local Firebase emulator function failed.', { error });
          response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify({ error: 'Local Firebase emulator function failed.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localFirebaseFunctionsPlugin(mode === 'firebase-emulator')],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@firebase/') || id.includes('/node_modules/firebase/')) return 'firebase-vendor';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        },
      },
    },
  },
}));
