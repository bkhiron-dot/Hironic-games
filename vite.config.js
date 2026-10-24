import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = name => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  // GitHub Pages serves this repo from a sub-path (/Hironic-games/), so asset links
  // must be relative rather than starting at the site root.
  base: './',
  build: {
    // Two pages: the home page, and v2 while it is being built. v1 is copied from public/.
    rollupOptions: {
      input: {
        main: page('./index.html'),
        v2: page('./v2.html'),
      },
    },
  },
});
