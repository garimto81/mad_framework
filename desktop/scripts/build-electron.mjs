#!/usr/bin/env node
/**
 * Electron Main Process Build Script
 * ESM/CJS 호환성 문제를 해결하기 위해 esbuild로 번들링
 */

import * as esbuild from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: [resolve(rootDir, 'electron/main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: resolve(rootDir, 'dist/main/electron/main.js'),
  format: 'cjs', // CommonJS for Electron
  external: [
    'electron',
    'better-sqlite3',
    // Node.js built-in modules
    'path',
    'fs',
    'os',
    'url',
    'util',
    'events',
    'stream',
    'crypto',
    'http',
    'https',
    'net',
    'tls',
    'child_process',
  ],
  sourcemap: true,
  minify: false,
  treeShaking: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('👀 Watching for changes...');
    } else {
      const result = await esbuild.build(buildOptions);
      console.log('✅ Electron main process built successfully');
      if (result.errors.length > 0) {
        console.error('Build errors:', result.errors);
      }
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
