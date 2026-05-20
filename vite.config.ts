import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Two modes: `core` builds the self-contained IIFE; `chunks` builds ESM lazy chunks.
export default defineConfig(({ mode }) => {
  const isChunks = mode === 'chunks';
  return {
    plugins: [svelte()],
    build: {
      emptyOutDir: !isChunks, // core build clears dist; chunks build appends
      cssCodeSplit: false,
      minify: 'esbuild',
      lib: isChunks
        ? {
            entry: { greeting: 'src/features/greeting.lazy.ts' },
            formats: ['es'],
            fileName: (_f, name) => `chunks/${name}.esm.js`,
          }
        : {
            entry: 'src/core/iife.ts',
            name: 'MyWidget',
            formats: ['iife'],
            fileName: () => 'widget.iife.js',
          },
    },
  };
});
