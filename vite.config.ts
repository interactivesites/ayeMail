import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: './', // Use relative paths for Electron file:// protocol
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './renderer'),
      '@shared': resolve(__dirname, './shared')
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'pinia'],
          'editor-vendor': ['@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/extension-image', '@tiptap/extension-bubble-menu'],
          'ui-vendor': ['@floating-ui/dom', '@heroicons/vue', 'vue-tailwind-datepicker'],
          'utils-vendor': ['dayjs', 'gsap']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096
  }
})

