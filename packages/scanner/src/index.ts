import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { InfraLensEdition } from '@infralens/edition-capabilities';
import type { DiscoveryInput, ProjectFile } from '@infralens/discovery-core';
import { walkProject } from '@infralens/discovery-core/walk';
import type { ScanBundle } from '@infralens/graph-model';
import { scanFiles } from './scanFiles.js';

export { scanFiles };
export type { ProjectFile };

export async function scanPath(
  rootPath: string,
  options?: {
    project?: string;
    /** @deprecated Ignored; not used for gating or stamping. */
    edition?: InfraLensEdition;
    awsSnapshotPath?: string;
    clusterSnapshotPath?: string;
    terraformPlanPath?: string;
    terraformStatePath?: string;
    policyDir?: string;
    includeLive?: boolean;
  },
): Promise<ScanBundle> {
  const { files, warnings } = await walkProject(rootPath);
  const snapshots: DiscoveryInput['snapshots'] = {};
  if (options?.awsSnapshotPath) {
    snapshots.awsInventory = JSON.parse(await readFile(options.awsSnapshotPath, 'utf8'));
  }
  if (options?.clusterSnapshotPath) {
    snapshots.clusterInventory = JSON.parse(await readFile(options.clusterSnapshotPath, 'utf8'));
  }
  if (options?.terraformPlanPath) {
    snapshots.terraformPlan = JSON.parse(await readFile(options.terraformPlanPath, 'utf8'));
  }
  if (options?.terraformStatePath) {
    snapshots.terraformState = JSON.parse(await readFile(options.terraformStatePath, 'utf8'));
  }

  const autoAws = path.join(rootPath, '.infralens', 'aws-inventory.json');
  const autoCluster = path.join(rootPath, '.infralens', 'cluster-inventory.json');
  try {
    if (!snapshots.awsInventory) snapshots.awsInventory = JSON.parse(await readFile(autoAws, 'utf8'));
  } catch {
    /* optional */
  }
  try {
    if (!snapshots.clusterInventory)
      snapshots.clusterInventory = JSON.parse(await readFile(autoCluster, 'utf8'));
  } catch {
    /* optional */
  }

  const bundle = await scanFiles(files, {
    project: options?.project ?? path.basename(rootPath),
    edition: options?.edition,
    snapshots,
    includeLive: options?.includeLive,
    policyDir: options?.policyDir,
  });
  bundle.graph.scan.warnings.push(...warnings);
  return bundle;
}

export { walkProject } from '@infralens/discovery-core/walk';
