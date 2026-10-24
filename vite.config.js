import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = name => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  // GitHub Pages serves this repo from a sub-path (/Hironic-games/), so asset links
  // must be relative rather than starting at the site root.
  base: './',
  build: {
    // The game is the home page. v1 (the reference build) and the old v2.html link are
    // copied as they are from public/.
    rollupOptions: {
      input: { main: page('./index.html') },
    },
  },
});
