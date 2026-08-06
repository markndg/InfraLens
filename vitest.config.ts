import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'fixtures/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@infralens/edition-capabilities': path.resolve('packages/edition-capabilities/src'),
      '@infralens/evidence-model': path.resolve('packages/evidence-model/src'),
      '@infralens/graph-model': path.resolve('packages/graph-model/src'),
      '@infralens/shared': path.resolve('packages/shared/src'),
      '@infralens/icons': path.resolve('packages/icons/src'),
      '@infralens/discovery-core/walk': path.resolve('packages/discovery-core/src/walk.ts'),
      '@infralens/discovery-core': path.resolve('packages/discovery-core/src'),
      '@infralens/discovery-terraform': path.resolve('packages/discovery-terraform/src'),
      '@infralens/discovery-kubernetes': path.resolve('packages/discovery-kubernetes/src'),
      '@infralens/discovery-openshift': path.resolve('packages/discovery-openshift/src'),
      '@infralens/discovery-app-config': path.resolve('packages/discovery-app-config/src'),
      '@infralens/discovery-aws': path.resolve('packages/discovery-aws/src'),
      '@infralens/reconciliation': path.resolve('packages/reconciliation/src'),
      '@infralens/reachability': path.resolve('packages/reachability/src'),
      '@infralens/policy-engine': path.resolve('packages/policy-engine/src'),
      '@infralens/reporting': path.resolve('packages/reporting/src'),
      '@infralens/architecture-intelligence': path.resolve('packages/architecture-intelligence/src'),
      '@infralens/scanner': path.resolve('packages/scanner/src'),
      '@infralens/test-fixtures': path.resolve('packages/test-fixtures/src'),
    },
  },
});
