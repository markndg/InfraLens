import type { ProjectFile } from '@infralens/discovery-core';
import { demoFiles, demoSnapshots } from '../demoEstate';
import { k8sMicroservicesFiles, k8sMicroservicesSnapshots } from './k8sMicroservices';
import { legacyHybridFiles, legacyHybridSnapshots } from './legacyHybrid';
import { serverlessAwsFiles, serverlessAwsSnapshots } from './serverlessAws';

export type ReferenceEstateId =
  | 'retail-saas'
  | 'serverless-aws'
  | 'k8s-microservices'
  | 'legacy-hybrid';

export interface ReferenceEstate {
  id: ReferenceEstateId;
  label: string;
  project: string;
  bundled: boolean;
  files: ProjectFile[];
  snapshots: Record<string, unknown>;
  /** Retail-only baseline for timeline / invalidation demo. */
  retailBaseline?: boolean;
}

export const REFERENCE_ESTATES: readonly ReferenceEstate[] = [
  {
    id: 'retail-saas',
    label: 'Retail SaaS',
    project: 'Retail SaaS reference estate',
    bundled: true,
    files: demoFiles,
    snapshots: demoSnapshots,
    retailBaseline: true,
  },
  {
    id: 'serverless-aws',
    label: 'Serverless AWS',
    project: 'Serverless AWS reference estate',
    bundled: true,
    files: serverlessAwsFiles,
    snapshots: serverlessAwsSnapshots,
  },
  {
    id: 'k8s-microservices',
    label: 'Kubernetes Microservices',
    project: 'Kubernetes Microservices reference estate',
    bundled: true,
    files: k8sMicroservicesFiles,
    snapshots: k8sMicroservicesSnapshots,
  },
  {
    id: 'legacy-hybrid',
    label: 'Legacy Hybrid',
    project: 'Legacy Hybrid reference estate',
    bundled: true,
    files: legacyHybridFiles,
    snapshots: legacyHybridSnapshots,
  },
] as const;

export function getReferenceEstate(id: ReferenceEstateId): ReferenceEstate {
  return REFERENCE_ESTATES.find((e) => e.id === id) ?? REFERENCE_ESTATES[0];
}
