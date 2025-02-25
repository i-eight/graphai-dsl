import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';
import pkg from './package.json';

const executable = 'graphai-dsl';

const shebangPlugin = (shebang = '#!/usr/bin/env node') => ({
  name: 'vite-plugin-shebang',
  renderChunk(code, chunk) {
    if (chunk.fileName === executable) {
      return {
        code: `${shebang}\n${code}`,
        map: null,
      };
    }
    return null;
  },
});

export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
      fileName: () => executable,
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
  plugins: [shebangPlugin('#!/usr/bin/env node')],
});
