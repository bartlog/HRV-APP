import { defineConfig } from 'vite';

export default defineConfig({
  base: '/HRV-APP/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
