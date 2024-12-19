import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.1
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import compression from 'vite-plugin-compression'; // ^0.5.1
import { visualizer } from 'rollup-plugin-visualizer'; // ^5.9.0
import { resolve } from 'path';

// Environment-specific configurations
const isProd = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  // Base configuration
  base: '/',

  // Plugin configurations
  plugins: [
    // React plugin with Fast Refresh and Emotion support
    react({
      fastRefresh: true,
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),

    // TypeScript path resolution
    tsconfigPaths(),

    // Compression plugins for production builds
    ...(isProd ? [
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240, // Only compress files > 10KB
        deleteOriginFile: false,
      }),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ] : []),
  ],

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: parseInt(process.env.VITE_API_TIMEOUT || '30000'),
      },
    },
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' http://localhost:8080",
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: isProd ? 'hidden' : true,
    minify: isProd ? 'terser' : false,
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk configuration
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // UI library chunk
          ui: [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
          ],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: isProd,
        drop_debugger: isProd,
        pure_funcs: isProd ? ['console.log', 'console.debug'] : [],
      },
    },
  },

  // Path resolution configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@services': resolve(__dirname, './src/services'),
      '@utils': resolve(__dirname, './src/utils'),
      '@assets': resolve(__dirname, './src/assets'),
      '@types': resolve(__dirname, './src/types'),
    },
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase',
      scopeBehaviour: 'local',
      generateScopedName: isDev
        ? '[name]__[local]___[hash:base64:5]'
        : '[hash:base64:8]',
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/assets/styles/theme.scss";',
        javascriptEnabled: true,
      },
    },
    devSourcemap: true,
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
    ],
    exclude: [
      '@testing-library/react',
      'vitest',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },

  // Environment variable configuration
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __DEV__: JSON.stringify(isDev),
    __PROD__: JSON.stringify(isProd),
  },

  // Preview server configuration (for production builds)
  preview: {
    port: 3000,
    host: true,
    strictPort: true,
  },
});