import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/IntersectionSumsSudoku/' : '/',
  build: { rollupOptions: { input: ['index.html', 'techniques/index.html', 'custom-build/index.html', 'simulation/index.html', 'verify/index.html'] } },
}));
