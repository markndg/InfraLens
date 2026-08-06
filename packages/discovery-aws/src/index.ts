import {
  emptyResult,
  type DiscoveryAdapter,
} from '@infralens/discovery-core';
import { createEvidence } from '@infralens/evidence-model';
import { stableId, type ResourceKind } from '@infralens/graph-model';
import { inferEnvironment, makeResource } from '@infralens/shared';

export interface AwsInventoryResource {
  type: string;
  id: string;
  name?: string;
  arn?: string;
  region?: string;
  account?: string;
  tags?: Record<string, string>;
  attributes?: Record<string, unknown>;
}

export interface AwsInventorySnapshot {
  observedAt: string;
  account: string;
  region: string;
  resources: AwsInventoryResource[];
}

const TYPE_KIND: Record<string, ResourceKind> = {
  'AWS::S3::Bucket': 'bucket',
  'AWS::RDS::DBInstance': 'relational-database',
  'AWS::SQS::Queue': 'queue',
  'AWS::EC2::SecurityGroup': 'security-group',
  'AWS::EC2::VPC': 'vpc',
  'AWS::EC2::Subnet': 'subnet',
  'AWS::ElasticLoadBalancingV2::LoadBalancer': 'load-balancer',
  'AWS::IAM::Role': 'iam-role',
  'AWS::Route53::RecordSet': 'dns',
};

/**
 * Snapshot-backed AWS connector. Live SDK calls are never performed from the browser.
 * Credentials are referenced by name only when a future live mode is enabled.
 */
export const awsSnapshotAdapter: DiscoveryAdapter = {
  id: 'aws-snapshot',
  async supports(input) {
    const has = !!input.snapshots?.awsInventory;
    return {
      supported: has,
      confidence: has ? 1 : 0,
      reason: has ? 'AWS inventory snapshot provided' : 'No AWS snapshot',
      matchedFiles: [],
    };
  },
  async discover(input, _context) {
    const started = Date.now();
    const result = emptyResult(this.id, started);

    // Live mode is gated on includeLive + credentials only (no edition gate).
    // This adapter remains snapshot-backed; snapshot import is always allowed.
    if (input.options?.includeLive && !input.options.credentialRef) {
      result.errors.push(
        'Live AWS discovery requires credentials (credentialRef). Snapshot import continues without live mode.',
      );
    }

    const snap = input.snapshots?.awsInventory as AwsInventorySnapshot | undefined;
    if (!snap) {
      result.durationMs = Date.now() - started;
      return result;
    }

    for (const item of snap.resources) {
      const kind = TYPE_KIND[item.type] ?? 'unknown';
      const name = item.name ?? item.id;
      const { resource, evidenceId } = makeResource({
        provider: 'aws',
        platform: 'aws',
        kind,
        subtype: item.type,
        name,
        logicalId: stableId('aws-observed', item.arn ?? item.id),
        environment: inferEnvironment(name + JSON.stringify(item.tags ?? {})),
        account: item.account ?? snap.account,
        region: item.region ?? snap.region,
        boundary: `AWS ${item.region ?? snap.region}`,
        truthState: 'observed',
        metadata: {
          arn: item.arn,
          providerId: item.id,
          tags: item.tags ?? {},
          ...(item.attributes ?? {}),
        },
        tags: ['aws', 'observed'],
        confidence: 0.97,
        reasons: [`Observed in AWS inventory snapshot at ${snap.observedAt}`],
        adapter: 'aws-snapshot',
        sourceUri: `aws-snapshot://${snap.account}/${snap.region}`,
        sourceType: 'cloud-snapshot',
      });
      result.evidence.push(
        createEvidence({
          id: evidenceId,
          adapter: 'aws-snapshot',
          sourceType: 'cloud-snapshot',
          sourceUri: `aws-snapshot://${snap.account}/${snap.region}`,
          observedAt: snap.observedAt,
          extractedValue: { type: item.type, id: item.id, arn: item.arn },
          confidence: 0.97,
          truthState: 'observed',
          rationale: 'Read-only inventory snapshot',
        }),
      );
      result.resources.push(resource);
    }

    result.metadata = { account: snap.account, region: snap.region, observedAt: snap.observedAt };
    result.durationMs = Date.now() - started;
    return result;
  },
};

export function loadAwsSnapshot(json: unknown): AwsInventorySnapshot {
  const snap = json as AwsInventorySnapshot;
  if (!snap || !Array.isArray(snap.resources)) {
    throw new Error('Invalid AWS inventory snapshot');
  }
  return snap;
}
