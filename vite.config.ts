import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/** Where the game is expected to live. Share cards need absolute links. */
const DEFAULT_SITE_URL = 'https://solar-system-simulator.grok.me';

export default defineConfig(({ mode }) => {
  const siteUrl = (loadEnv(mode, '.', 'VITE_').VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return {
    base: './',
    plugins: [
      {
        name: 'site-url',
        transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', siteUrl),
      },
    ],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
