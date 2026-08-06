import type { ResourceNode } from '@infralens/graph-model';

export function scopeLabel(resource: ResourceNode): string {
  if (resource.namespace) return resource.namespace;
  if (resource.region && resource.provider === 'aws') return resource.region;
  if (resource.account) return `acct ${resource.account}`;
  if (resource.environment) return resource.environment;
  if (resource.boundary) return resource.boundary;
  return 'unscoped';
}

export function kindLabel(resource: ResourceNode): string {
  if (resource.provider === 'aws' && resource.subtype) {
    const map: Record<string, string> = {
      rds: 'Amazon RDS',
      s3: 'Amazon S3',
      sqs: 'Amazon SQS',
      'security-group': 'Security group',
    };
    return map[resource.subtype] ?? `AWS ${resource.subtype}`;
  }
  if (resource.subtype && resource.subtype !== resource.kind) {
    return `${resource.subtype}`;
  }
  return resource.kind.replace(/-/g, ' ');
}
