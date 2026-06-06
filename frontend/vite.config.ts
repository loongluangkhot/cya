import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Render a PWA manifest with an env-aware suffix on `name` /
// `short_name` so the home-screen icon makes it obvious which deploy
// you're looking at. Production builds leave VITE_APP_LABEL unset and
// get no suffix.
function manifestPlugin(label: string): Plugin {
  const suffix = label ? `-${label}` : '';
  const manifest = JSON.stringify(
    {
      name: `cya${suffix}`,
      short_name: `cya${suffix}`,
      start_url: '/',
      display: 'standalone',
      theme_color: '#f6f5f1',
      background_color: '#f6f5f1',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  );
  return {
    name: 'cya-manifest',
    configureServer(server) {
      server.middlewares.use('/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: manifest,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), manifestPlugin(env.VITE_APP_LABEL ?? '')],
    server: {
      allowedHosts: true, // allows all hosts
    },
  };
});
