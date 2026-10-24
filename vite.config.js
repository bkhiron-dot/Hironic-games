import { defineConfig } from 'vite';

// GitHub Pages serves this repo from a sub-path (/Hironic-games/), so asset links
// must be relative rather than starting at the site root.
export default defineConfig({
  base: './',
});
