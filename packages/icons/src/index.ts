import { ICON_SVG, type IconKey } from './svgs.js';
import { themeForIcon, type EntityTheme } from './themes.js';

export type { IconKey } from './svgs.js';
export { ICON_SVG } from './svgs.js';
export {
  themeForFamily,
  themeForIcon,
  LEGEND_FAMILIES,
  type EntityFamily,
  type EntityTheme,
} from './themes.js';

export interface IconInput {
  kind: string;
  provider?: string;
  subtype?: string;
  platform?: string;
  name?: string;
  /** Inferred app tech key: react, spring, node, next, vue, python, go, java */
  techKey?: string;
  techLabel?: string;
}

interface MatchCtx {
  kind: string;
  provider: string;
  platform: string;
  subtype: string;
  rawSubtype: string;
  blob: string;
}

function ctxOf(input: IconInput): MatchCtx {
  const kind = (input.kind ?? '').toLowerCase();
  const provider = (input.provider ?? '').toLowerCase();
  const platform = (input.platform ?? '').toLowerCase();
  const rawSubtype = (input.subtype ?? '').toLowerCase();
  const subtype = rawSubtype.replace(/^aws::/, '').replace(/::/g, '/');
  return {
    kind,
    provider,
    platform,
    subtype,
    rawSubtype,
    blob: [kind, provider, platform, rawSubtype, input.name ?? ''].join(' ').toLowerCase(),
  };
}

function subtypeIs(ctx: MatchCtx, ...values: string[]): boolean {
  return values.some((v) => {
    const needle = v.toLowerCase();
    return (
      ctx.subtype === needle ||
      ctx.rawSubtype === needle ||
      ctx.rawSubtype.endsWith(`::${needle}`) ||
      ctx.rawSubtype.endsWith(`/${needle}`) ||
      ctx.subtype.endsWith(`/${needle}`)
    );
  });
}

function subtypeHas(ctx: MatchCtx, ...fragments: string[]): boolean {
  return fragments.some((f) => ctx.rawSubtype.includes(f.toLowerCase()) || ctx.subtype.includes(f.toLowerCase()));
}

export function resolveIcon(input: IconInput): IconKey {
  const c = ctxOf(input);
  const tech = (input.techKey ?? '').toLowerCase();
  const techBlob = `${tech} ${input.techLabel ?? ''}`.toLowerCase();

  // Prefer concrete application technology marks on workloads/services/apps
  if (
    ['workload', 'service', 'application', 'function'].includes(c.kind) ||
    tech
  ) {
    const techIcon = iconFromTech(tech, techBlob);
    if (techIcon) return techIcon;
  }

  // AWS services (subtype-first)
  if (c.kind === 'bucket' || subtypeIs(c, 's3') || subtypeHas(c, 's3::bucket', 's3_bucket')) return 'aws-s3';
  if (
    c.kind === 'relational-database' ||
    subtypeIs(c, 'rds', 'aurora') ||
    subtypeHas(c, 'rds::', 'dbinstance', 'db_instance')
  ) {
    return 'aws-rds';
  }
  if (c.kind === 'queue' || subtypeIs(c, 'sqs') || subtypeHas(c, 'sqs::', 'sqs_queue')) return 'aws-sqs';
  if (c.kind === 'topic' || subtypeIs(c, 'sns') || subtypeHas(c, 'sns::', 'sns_topic')) return 'aws-sns';
  if (c.kind === 'dns' || subtypeIs(c, 'route53') || subtypeHas(c, 'route53')) return 'aws-route53';
  if (c.kind === 'vpc' || subtypeIs(c, 'vpc')) return 'aws-vpc';
  if (c.kind === 'subnet' || subtypeIs(c, 'subnet')) return 'aws-subnet';
  if (
    c.kind === 'load-balancer' ||
    subtypeIs(c, 'alb', 'listener', 'target-group') ||
    subtypeHas(c, 'elasticloadbalancing', 'aws_lb', 'aws_alb')
  ) {
    return 'aws-alb';
  }
  if (c.kind === 'security-group' || subtypeHas(c, 'securitygroup', 'security_group', 'security-group')) {
    return 'aws-sg';
  }
  if (c.kind === 'iam-role' || c.kind === 'iam-policy' || subtypeHas(c, 'iam::', 'iam_role', 'iam_policy', 'inline-policy')) {
    return 'aws-iam';
  }
  if (c.kind === 'function' || subtypeIs(c, 'lambda') || subtypeHas(c, 'lambda')) return 'aws-lambda';
  if (c.kind === 'secret-ref' || subtypeIs(c, 'secrets-manager') || subtypeHas(c, 'secretsmanager', 'secrets-manager')) {
    return 'aws-secrets';
  }
  if (c.kind === 'monitoring' || subtypeIs(c, 'cloudwatch') || subtypeHas(c, 'cloudwatch')) return 'aws-cloudwatch';
  if (subtypeHas(c, 'elasticache') || c.kind === 'cache') return 'aws-elasticache';
  if (subtypeIs(c, 'dynamodb') || subtypeHas(c, 'dynamodb')) return 'aws-dynamodb';
  if (subtypeIs(c, 'internet-gateway') || subtypeHas(c, 'internet_gateway', 'internet-gateway')) return 'aws-igw';
  if (subtypeIs(c, 'nat') || subtypeHas(c, 'nat_gateway', 'nat-gateway')) return 'aws-nat';

  // OpenShift / Kubernetes
  // Prefer the OpenShift brand mark for routes so they read as platform ingress, not a generic arrow
  if (c.kind === 'route' || subtypeIs(c, 'route') || c.blob.includes('route.openshift')) {
    return c.provider === 'openshift' || c.platform === 'openshift' || c.blob.includes('openshift')
      ? 'openshift'
      : 'openshift-route';
  }
  if (c.kind === 'network-policy' || subtypeIs(c, 'networkpolicy')) return 'k8s-network-policy';
  if (c.kind === 'service-account' || subtypeIs(c, 'serviceaccount')) return 'k8s-service-account';
  if (c.kind === 'service' && c.provider !== 'external') return 'k8s-service';
  if (c.kind === 'workload') {
    if (subtypeIs(c, 'compose-service')) return 'config';
    if (subtypeIs(c, 'deployment', 'deploymentconfig', 'ecs-service') || c.provider === 'kubernetes' || c.provider === 'openshift') {
      return 'k8s-deployment';
    }
    return 'workload';
  }
  if (c.provider === 'openshift' || c.platform === 'openshift' || subtypeHas(c, 'deploymentconfig', 'imagestream')) {
    return 'openshift';
  }
  if (c.provider === 'kubernetes' || c.platform === 'kubernetes') return 'kubernetes';

  // Platforms
  if (c.provider === 'terraform' || c.platform === 'terraform') return 'terraform';
  if (c.provider === 'aws' || c.platform === 'aws') return 'aws';

  // Architecture / governance
  if (c.kind === 'business-capability' || c.kind === 'platform-system') return 'capability';
  if (c.kind === 'data-asset') return 'data-asset';
  if (c.kind === 'team') return 'users';
  if (c.kind === 'trust-zone') return 'trust-boundary';
  if (c.kind === 'adr' || c.kind === 'architectural-decision') return 'decision';
  if (c.kind === 'intent') return 'intent';
  if (c.kind === 'assumption') return 'assumption';
  if (c.kind === 'architecture-contract') return 'contract';
  if (c.kind === 'obligation') return 'obligation';

  // Generic
  if (c.kind === 'internet') return 'internet';
  if (c.kind === 'user') return 'users';
  if (c.kind === 'external-system' || c.provider === 'external') return 'external';
  if (c.kind === 'ingress' || c.kind === 'gateway' || subtypeHas(c, 'cloudfront', 'api-gateway')) return 'ingress';
  if (c.kind === 'storage' || c.kind === 'volume') return 'storage';
  if (c.kind === 'network') return 'network';
  if (c.kind === 'config' || subtypeIs(c, 'config-reference', 'compose-service')) return 'config';
  if (c.kind === 'application') return 'workload';
  if (c.kind === 'policy') return 'security';

  return 'unknown';
}

function iconFromTech(techKey: string, techBlob: string): IconKey | null {
  if (techKey === 'next' || /\bnext\.?js\b/.test(techBlob)) return 'nextjs';
  if (techKey === 'react' || /\breact\b/.test(techBlob)) return 'react';
  if (techKey === 'vue' || /\bvue\b/.test(techBlob)) return 'vue';
  if (techKey === 'spring' || /\bspring\b/.test(techBlob)) return 'spring';
  if (techKey === 'java' || /\bjava\b/.test(techBlob)) return 'java';
  if (techKey === 'node' || techKey === 'nodejs' || /\bnode\.?js\b/.test(techBlob)) return 'nodejs';
  if (techKey === 'python' || /\bpython\b/.test(techBlob)) return 'python';
  if (techKey === 'go' || techKey === 'golang' || /\bgolang\b|\b go \b/.test(` ${techBlob} `)) return 'golang';
  return null;
}

export function resolveEntityVisual(input: IconInput): { icon: IconKey; theme: EntityTheme; svg: string } {
  const icon = resolveIcon(input);
  const theme = themeForIcon(icon, input.provider, input.kind);
  return { icon, theme, svg: ICON_SVG[icon] };
}
