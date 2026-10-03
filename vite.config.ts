/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Vite 8 bundles with Rolldown: group vendor code into separate, long-cacheable chunks
    // (it changes far less often than app code). Higher priority wins when tests overlap.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'vendor-dnd', test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/, priority: 30 },
            { name: 'vendor-redux', test: /[\\/]node_modules[\\/](@reduxjs|redux|react-redux|immer|reselect|redux-thunk)[\\/]/, priority: 30 },
            { name: 'vendor-ui', test: /[\\/]node_modules[\\/](@headlessui|@floating-ui|@react-aria|@tanstack)[\\/]/, priority: 20 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
