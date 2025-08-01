import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],
    
    base: '/',

    define: {
      'import.meta.env.VITE_STUN_SERVER': JSON.stringify(env.VITE_STUN_SERVER),
      'import.meta.env.VITE_TURN_SERVER': JSON.stringify(env.VITE_TURN_SERVER),
      'import.meta.env.VITE_TURN_USERNAME': JSON.stringify(env.VITE_TURN_USERNAME),
      'import.meta.env.VITE_TURN_CREDENTIAL': JSON.stringify(env.VITE_TURN_CREDENTIAL),
      'import.meta.env.VITE_GOOGLE_STUN': JSON.stringify(env.VITE_GOOGLE_STUN)
    },

    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true,
          changeOrigin: true
        }
      }
    },
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
  };
});