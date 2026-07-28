import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest + @supabase/* (CJS) can resolve `tslib` to `tslib.es6.mjs` via the
 * "module" export condition; Node then fails on `require()`. Prefer Node/
 * require conditions and force the CJS entry; setup also patches Node's
 * Module resolver for any remaining externalized requires.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['lib/**/*.{test,spec}.ts', 'lib/**/*.{test,spec}.tsx'],
    setupFiles: [
      path.resolve(__dirname, 'lib/test-stubs/tslib-cjs-resolve.ts'),
    ],
    server: {
      deps: {
        inline: [
          '@supabase/supabase-js',
          '@supabase/functions-js',
          '@supabase/postgrest-js',
          '@supabase/auth-js',
          '@supabase/realtime-js',
          '@supabase/storage-js',
          '@supabase/ssr',
          'tslib',
          '@react-email/render',
          '@react-email/body',
          '@react-email/button',
          '@react-email/container',
          '@react-email/head',
          '@react-email/heading',
          '@react-email/hr',
          '@react-email/html',
          '@react-email/img',
          '@react-email/link',
          '@react-email/preview',
          '@react-email/section',
          '@react-email/text',
          '@react-email/row',
          '@react-email/column',
        ],
      },
    },
  },
  resolve: {
    conditions: ['require', 'node', 'default'],
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'lib/test-stubs/server-only.ts'),
      tslib: path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
      'prettier/standalone': path.resolve(
        __dirname,
        'lib/test-stubs/prettier-standalone.ts'
      ),
      'prettier/plugins/html': path.resolve(
        __dirname,
        'lib/test-stubs/prettier-html.ts'
      ),
    },
  },
});
