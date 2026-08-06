import type { ProjectFile } from '@infralens/discovery-core';
import awsInventory from '../../../../fixtures/legacy-hybrid/.infralens/aws-inventory.json';
import mainTf from '../../../../fixtures/legacy-hybrid/infra/main.tf?raw';
import appConfig from '../../../../fixtures/legacy-hybrid/app/config.yaml?raw';
import adr from '../../../../fixtures/legacy-hybrid/docs/adr/0001-batch-window.md?raw';

export const legacyHybridSnapshots = { awsInventory };

export const legacyHybridFiles: ProjectFile[] = [
  { path: 'infra/main.tf', content: mainTf },
  { path: 'app/config.yaml', content: appConfig },
  { path: 'docs/adr/0001-batch-window.md', content: adr },
];
