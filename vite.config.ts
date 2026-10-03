import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Lets tunnels (ngrok / cloudflared) reach the dev server so a phone wallet can load the manifest.
    allowedHosts: true,
  },
});
