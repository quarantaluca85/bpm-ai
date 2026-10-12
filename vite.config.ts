import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const DIAGRAMS_DIR = path.resolve(__dirname, 'public/diagrams');

/** Notifies the page when a .bpmn file in public/diagrams is written, so it reloads it. */
function watchDiagrams(): Plugin {
  return {
    name: 'watch-diagrams',
    configureServer(server) {
      server.watcher.add(DIAGRAMS_DIR);
      const notify = (file: string) => {
        if (path.dirname(path.resolve(file)) !== DIAGRAMS_DIR || !file.endsWith('.bpmn')) return;
        server.ws.send({
          type: 'custom',
          event: 'bpmn:changed',
          data: { name: path.basename(file, '.bpmn') }
        });
      };
      server.watcher.on('add', notify);
      server.watcher.on('change', notify);
    }
  };
}

export default defineConfig({
  plugins: [watchDiagrams()],
  server: {
    port: 5173,
    // scripts/open-bpmn.mjs opens the browser itself
    open: !process.env.BPMN_NO_AUTO_OPEN
  },
  build: {
    // bpmn-js alone is ~580 kB minified
    chunkSizeWarningLimit: 1000
  }
});
