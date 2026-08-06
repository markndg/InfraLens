import type { ProjectFile } from '@infralens/discovery-core';
import manifests from '../../../../fixtures/k8s-microservices/deploy/manifests.yaml?raw';
import adr from '../../../../fixtures/k8s-microservices/docs/adr/0001-namespace-isolation.md?raw';

export const k8sMicroservicesSnapshots = {};

export const k8sMicroservicesFiles: ProjectFile[] = [
  { path: 'deploy/manifests.yaml', content: manifests },
  { path: 'docs/adr/0001-namespace-isolation.md', content: adr },
];
