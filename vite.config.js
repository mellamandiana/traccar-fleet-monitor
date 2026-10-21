import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const servers = ['demo', 'demo2', 'demo3', 'demo4'];

// Proxy de desarrollo: /proxy/demo4/api/... → https://demo4.traccar.org/api/...
const proxy = Object.fromEntries(
  servers.map((id) => [
    `/proxy/${id}`,
    {
      target: `https://${id}.traccar.org`,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(new RegExp(`^/proxy/${id}`), ''),
      // La cookie de sesión debe quedar en localhost, no en *.traccar.org
      cookieDomainRewrite: '',
      cookiePathRewrite: { '*': '/' },
      // Servidor inalcanzable → 502 (como haría Vercel/Netlify), no un 500 genérico.
      configure: (p) =>
        p.on('error', (_err, _req, res) => {
          if (res.headersSent || !res.writeHead) return;
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Bad gateway');
        }),
    },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
