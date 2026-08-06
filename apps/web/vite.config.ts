import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packages = [
  'edition-capabilities',
  'evidence-model',
  'graph-model',
  'shared',
  'icons',
  'discovery-core',
  'discovery-terraform',
  'discovery-kubernetes',
  'discovery-openshift',
  'discovery-app-config',
  'discovery-aws',
  'reconciliation',
  'reachability',
  'policy-engine',
  'reporting',
  'architecture-intelligence',
  'scanner',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@infralens/scanner/browser': path.resolve(__dirname, '../../packages/scanner/src/browser.ts'),
      '@infralens/scanner': path.resolve(__dirname, '../../packages/scanner/src/browser.ts'),
      ...Object.fromEntries(
        packages
          .filter((name) => name !== 'scanner')
          .map((name) => [
            `@infralens/${name}`,
            path.resolve(__dirname, `../../packages/${name}/src`),
          ]),
      ),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  optimizeDeps: {
    exclude: packages.map((p) => `@infralens/${p}`),
  },
});
