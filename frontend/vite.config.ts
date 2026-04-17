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
    alias: [
      { find: /^~\//, replacement: path.resolve(__dirname, 'src') + '/' },
      { find: /^~(?!\/)/, replacement: path.resolve(__dirname, 'node_modules') + '/' },
    ],
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
                  const key = parts[0].replace(/^@/, '').charAt(0).toLowerCase();
                  return `vendor-icons-${key || 'other'}`;
                }
              }
              return 'vendor-icons';
            }
            if (id.includes('@carbon/react') || id.includes('@carbon/styles') || id.includes('@carbon/layout')) {
              return 'vendor-carbon';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})
