import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';
import pkg from './package.json';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['cjs', 'es'],
      fileName: format => (format === 'cjs' ? 'index.js' : 'index.mjs'),
    },
    outDir: 'dist',
    rollupOptions: {
      external: [...builtinModules, ...Object.keys(pkg.dependencies)],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    },
  },
  plugins: [
    dts({
      entryRoot: 'src',
    }),
  ],
});
