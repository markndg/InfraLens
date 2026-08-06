import type { ResourceKind } from '@infralens/graph-model';

const TYPE_MAP: Record<string, { kind: ResourceKind; subtype: string }> = {
  aws_vpc: { kind: 'vpc', subtype: 'vpc' },
  aws_subnet: { kind: 'subnet', subtype: 'subnet' },
  aws_route_table: { kind: 'network', subtype: 'route-table' },
  aws_nat_gateway: { kind: 'network', subtype: 'nat' },
  aws_internet_gateway: { kind: 'network', subtype: 'internet-gateway' },
  aws_lb: { kind: 'load-balancer', subtype: 'alb' },
  aws_alb: { kind: 'load-balancer', subtype: 'alb' },
  aws_lb_listener: { kind: 'load-balancer', subtype: 'listener' },
  aws_lb_target_group: { kind: 'load-balancer', subtype: 'target-group' },
  aws_security_group: { kind: 'security-group', subtype: 'security-group' },
  aws_security_group_rule: { kind: 'security-group', subtype: 'security-group-rule' },
  aws_db_instance: { kind: 'relational-database', subtype: 'rds' },
  aws_rds_cluster: { kind: 'relational-database', subtype: 'aurora' },
  aws_dynamodb_table: { kind: 'storage', subtype: 'dynamodb' },
  aws_s3_bucket: { kind: 'bucket', subtype: 's3' },
  aws_sqs_queue: { kind: 'queue', subtype: 'sqs' },
  aws_sns_topic: { kind: 'topic', subtype: 'sns' },
  aws_lambda_function: { kind: 'function', subtype: 'lambda' },
  aws_ecs_service: { kind: 'workload', subtype: 'ecs-service' },
  aws_ecs_cluster: { kind: 'cluster', subtype: 'ecs' },
  aws_eks_cluster: { kind: 'cluster', subtype: 'eks' },
  aws_iam_role: { kind: 'iam-role', subtype: 'role' },
  aws_iam_policy: { kind: 'iam-policy', subtype: 'policy' },
  aws_iam_role_policy: { kind: 'iam-policy', subtype: 'inline-policy' },
  aws_iam_role_policy_attachment: { kind: 'iam-policy', subtype: 'attachment' },
  aws_route53_record: { kind: 'dns', subtype: 'route53' },
  aws_secretsmanager_secret: { kind: 'secret-ref', subtype: 'secrets-manager' },
  aws_cloudwatch_log_group: { kind: 'monitoring', subtype: 'cloudwatch' },
  aws_api_gateway_rest_api: { kind: 'gateway', subtype: 'api-gateway' },
  aws_apigatewayv2_api: { kind: 'gateway', subtype: 'api-gateway-v2' },
  aws_cloudfront_distribution: { kind: 'cdn' as ResourceKind, subtype: 'cloudfront' },
};

// Fix cloudfront mapping - cdn isn't in ResourceKind. Use gateway or external.
TYPE_MAP.aws_cloudfront_distribution = { kind: 'gateway', subtype: 'cloudfront' };

export function mapTerraformType(type: string): { kind: ResourceKind; subtype: string; provider: string } {
  const mapped = TYPE_MAP[type];
  if (mapped) {
    return {
      kind: mapped.kind,
      subtype: mapped.subtype,
      provider: type.startsWith('aws_') ? 'aws' : 'terraform',
    };
  }
  if (type.startsWith('aws_')) {
    return {
      kind: 'unknown',
      subtype: type.replace(/^aws_/, ''),
      provider: 'aws',
    };
  }
  return { kind: 'unknown', subtype: type, provider: 'terraform' };
}

export function displayNameFromConfig(type: string, logical: string, cfg: Record<string, unknown>): string {
  for (const key of ['bucket', 'name', 'identifier', 'function_name', 'cluster_identifier', 'queue_name', 'topic_name']) {
    const v = cfg[key];
    if (typeof v === 'string' && !v.includes('${')) return v;
  }
  return logical;
}
