import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hrv-app/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
