import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    svgr({ svgrOptions: { exportType: 'named', ref: true } }),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@carbon/icons-react')) {
              // Further split icons to keep chunks under 500kB
              if (id.includes('es/')) {
                const parts = id.split('es/')[1].split('/');
                if (parts.length > 0) {
                  return `vendor-icons-${parts[0].charAt(0).toLowerCase()}`;
                }
              }
              return 'vendor-icons';
            }
            if (id.includes('@carbon/react') || id.includes('@carbon/styles') || id.includes('@carbon/layout')) {
              return 'vendor-carbon';
            }
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react')) {
              return 'vendor-react-core';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
