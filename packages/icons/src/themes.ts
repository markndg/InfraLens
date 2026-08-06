import type { IconKey } from './svgs.js';

export type EntityFamily =
  | 'aws'
  | 'openshift'
  | 'kubernetes'
  | 'terraform'
  | 'data'
  | 'queue'
  | 'storage'
  | 'compute'
  | 'network'
  | 'edge'
  | 'security'
  | 'identity'
  | 'observability'
  | 'external'
  | 'internet'
  | 'capability'
  | 'ownership'
  | 'trust'
  | 'governance'
  | 'intent'
  | 'assumption'
  | 'contract'
  | 'config'
  | 'react'
  | 'spring'
  | 'nodejs'
  | 'default';

export interface EntityTheme {
  family: EntityFamily;
  /** Left border / primary accent */
  accent: string;
  /** Soft card wash */
  tint: string;
  /** Icon chip background */
  iconBg: string;
}

const THEMES: Record<EntityFamily, EntityTheme> = {
  aws: { family: 'aws', accent: '#E8790D', tint: '#FFF7ED', iconBg: '#FFEDD5' },
  openshift: { family: 'openshift', accent: '#C9190B', tint: '#FEF2F2', iconBg: '#FEE2E2' },
  kubernetes: { family: 'kubernetes', accent: '#326CE5', tint: '#EFF6FF', iconBg: '#DBEAFE' },
  terraform: { family: 'terraform', accent: '#7B42BC', tint: '#F5F3FF', iconBg: '#EDE9FE' },
  data: { family: 'data', accent: '#0F766E', tint: '#F0FDFA', iconBg: '#CCFBF1' },
  queue: { family: 'queue', accent: '#DB2777', tint: '#FDF2F8', iconBg: '#FCE7F3' },
  storage: { family: 'storage', accent: '#15803D', tint: '#F0FDF4', iconBg: '#DCFCE7' },
  compute: { family: 'compute', accent: '#1D4ED8', tint: '#EFF6FF', iconBg: '#DBEAFE' },
  network: { family: 'network', accent: '#7C3AED', tint: '#F5F3FF', iconBg: '#EDE9FE' },
  edge: { family: 'edge', accent: '#0369A1', tint: '#F0F9FF', iconBg: '#E0F2FE' },
  security: { family: 'security', accent: '#B91C1C', tint: '#FEF2F2', iconBg: '#FEE2E2' },
  identity: { family: 'identity', accent: '#BE123C', tint: '#FFF1F2', iconBg: '#FFE4E6' },
  observability: { family: 'observability', accent: '#C026D3', tint: '#FDF4FF', iconBg: '#FAE8FF' },
  external: { family: 'external', accent: '#57534E', tint: '#FAFAF9', iconBg: '#F5F5F4' },
  internet: { family: 'internet', accent: '#0284C7', tint: '#F0F9FF', iconBg: '#E0F2FE' },
  capability: { family: 'capability', accent: '#B45309', tint: '#FFFBEB', iconBg: '#FEF3C7' },
  ownership: { family: 'ownership', accent: '#15803D', tint: '#F0FDF4', iconBg: '#DCFCE7' },
  trust: { family: 'trust', accent: '#DC2626', tint: '#FEF2F2', iconBg: '#FEE2E2' },
  governance: { family: 'governance', accent: '#6D28D9', tint: '#F5F3FF', iconBg: '#EDE9FE' },
  intent: { family: 'intent', accent: '#7C3AED', tint: '#F5F3FF', iconBg: '#EDE9FE' },
  assumption: { family: 'assumption', accent: '#D97706', tint: '#FFFBEB', iconBg: '#FEF3C7' },
  contract: { family: 'contract', accent: '#5B21B6', tint: '#F5F3FF', iconBg: '#EDE9FE' },
  config: { family: 'config', accent: '#64748B', tint: '#F8FAFC', iconBg: '#E2E8F0' },
  react: { family: 'react', accent: '#0891B2', tint: '#ECFEFF', iconBg: '#CFFAFE' },
  spring: { family: 'spring', accent: '#4D7C0F', tint: '#F7FEE7', iconBg: '#ECFCCB' },
  nodejs: { family: 'nodejs', accent: '#15803D', tint: '#F0FDF4', iconBg: '#DCFCE7' },
  default: { family: 'default', accent: '#7A00E6', tint: '#FAF7FF', iconBg: '#F3E8FF' },
};

/** Prefer service-specific colour when the icon is a known AWS/service mark. */
const ICON_FAMILY: Partial<Record<IconKey, EntityFamily>> = {
  aws: 'aws',
  'aws-s3': 'storage',
  'aws-rds': 'data',
  'aws-sqs': 'queue',
  'aws-sns': 'queue',
  'aws-route53': 'edge',
  'aws-vpc': 'network',
  'aws-subnet': 'network',
  'aws-alb': 'edge',
  'aws-iam': 'identity',
  'aws-sg': 'security',
  'aws-lambda': 'compute',
  'aws-secrets': 'security',
  'aws-cloudwatch': 'observability',
  'aws-elasticache': 'data',
  'aws-dynamodb': 'storage',
  'aws-igw': 'network',
  'aws-nat': 'network',
  openshift: 'openshift',
  'openshift-route': 'openshift',
  kubernetes: 'kubernetes',
  'k8s-deployment': 'kubernetes',
  'k8s-service': 'kubernetes',
  'k8s-network-policy': 'security',
  'k8s-service-account': 'identity',
  terraform: 'terraform',
  react: 'react',
  nextjs: 'react',
  spring: 'spring',
  java: 'spring',
  nodejs: 'nodejs',
  vue: 'react',
  python: 'compute',
  golang: 'compute',
  database: 'data',
  bucket: 'storage',
  queue: 'queue',
  storage: 'storage',
  cache: 'data',
  workload: 'compute',
  service: 'compute',
  function: 'compute',
  ingress: 'edge',
  dns: 'edge',
  network: 'network',
  security: 'security',
  monitoring: 'observability',
  config: 'config',
  external: 'external',
  internet: 'internet',
  users: 'ownership',
  'trust-boundary': 'trust',
  capability: 'capability',
  'data-asset': 'data',
  decision: 'governance',
  intent: 'intent',
  assumption: 'assumption',
  contract: 'contract',
  obligation: 'contract',
};

export function themeForFamily(family: EntityFamily): EntityTheme {
  return THEMES[family] ?? THEMES.default;
}

export function themeForIcon(icon: IconKey, provider?: string, kind?: string): EntityTheme {
  const fromIcon = ICON_FAMILY[icon];
  if (fromIcon) return THEMES[fromIcon];

  if (provider === 'openshift') return THEMES.openshift;
  if (provider === 'kubernetes') return THEMES.kubernetes;
  if (provider === 'aws') return THEMES.aws;
  if (provider === 'terraform') return THEMES.terraform;
  if (provider === 'external') return THEMES.external;

  if (kind === 'business-capability' || kind === 'platform-system') return THEMES.capability;
  if (kind === 'data-asset') return THEMES.data;
  if (kind === 'team') return THEMES.ownership;
  if (kind === 'trust-zone') return THEMES.trust;
  if (kind === 'adr' || kind === 'architectural-decision') return THEMES.governance;
  if (kind === 'intent') return THEMES.intent;
  if (kind === 'assumption') return THEMES.assumption;
  if (kind === 'architecture-contract' || kind === 'obligation') return THEMES.contract;

  return THEMES.default;
}

/** Families shown in the graph legend */
export const LEGEND_FAMILIES: Array<{ family: EntityFamily; label: string }> = [
  { family: 'aws', label: 'AWS' },
  { family: 'openshift', label: 'OpenShift' },
  { family: 'kubernetes', label: 'Kubernetes' },
  { family: 'data', label: 'Data / DB' },
  { family: 'storage', label: 'Object storage' },
  { family: 'queue', label: 'Messaging' },
  { family: 'network', label: 'Network' },
  { family: 'edge', label: 'Edge / DNS' },
  { family: 'security', label: 'Security' },
  { family: 'capability', label: 'Capability' },
  { family: 'governance', label: 'Governance' },
];
