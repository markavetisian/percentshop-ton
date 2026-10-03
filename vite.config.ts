import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const APP_NAME = 'Percent Shop TON Demo';

/**
 * Serves /tonconnect-manifest.json with `url` / `iconUrl` pointing at wherever the app is hosted.
 * Build: TONCONNECT_APP_URL, else Vercel's production domain. Dev: the request's own origin.
 */
function tonConnectManifest(): Plugin {
  const manifest = (appUrl: string) =>
    JSON.stringify({ url: appUrl, name: APP_NAME, iconUrl: `${appUrl}/icon.png` }, null, 2);

  return {
    name: 'tonconnect-manifest',
    configureServer(server) {
      server.middlewares.use('/tonconnect-manifest.json', (req, res) => {
        const proto = req.headers['x-forwarded-proto'] ?? 'http';
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(manifest(`${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`));
      });
    },
    generateBundle() {
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      const appUrl = (process.env.TONCONNECT_APP_URL || (vercel ? `https://${vercel}` : 'https://example.com')).replace(/\/$/, '');
      this.emitFile({ type: 'asset', fileName: 'tonconnect-manifest.json', source: manifest(appUrl) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tonConnectManifest()],
  server: {
    // Lets tunnels (ngrok / cloudflared) reach the dev server so a phone wallet can load the manifest.
    allowedHosts: true,
  },
});
