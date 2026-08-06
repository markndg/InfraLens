import type { ProjectFile } from '@infralens/discovery-core';
import awsInventory from '../../../../fixtures/serverless-aws/.infralens/aws-inventory.json';
import mainTf from '../../../../fixtures/serverless-aws/infra/main.tf?raw';
import adr from '../../../../fixtures/serverless-aws/docs/adr/0001-serverless-checkout.md?raw';

export const serverlessAwsSnapshots = { awsInventory };

export const serverlessAwsFiles: ProjectFile[] = [
  { path: 'infra/main.tf', content: mainTf },
  { path: 'docs/adr/0001-serverless-checkout.md', content: adr },
];
