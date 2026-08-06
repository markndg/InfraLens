import type { EvidenceGraph, ResourceNode } from '@infralens/graph-model';
import { assignLane } from './lanes';

export type AppRole = 'frontend' | 'backend' | 'worker' | 'service' | 'platform' | 'network';

export interface TechStackInfo {
  role: AppRole;
  /** Display label, e.g. "React", "Spring Boot", "Node.js" */
  tech: string;
  /** Stable key for grouping */
  techKey: string;
  /** Short chip text, e.g. "Frontend · React" */
  label: string;
  confidence: number;
  evidence: string[];
}

const FRONTEND_DEPS = /\b(react|react-dom|next|vue|nuxt|svelte|angular|vite|webpack)\b/i;
const NODE_DEPS = /\b(express|fastify|koa|nest|hapi|@nestjs)\b/i;
const JAVA_DEPS = /\b(spring|spring-boot|quarkus|micronaut)\b/i;

export function inferTechStack(resource: ResourceNode, graph: EvidenceGraph): TechStackInfo | null {
  if (isNetworkResource(resource)) {
    return {
      role: 'network',
      tech: networkTechLabel(resource),
      techKey: 'network',
      label: `Network · ${networkTechLabel(resource)}`,
      confidence: 0.9,
      evidence: ['network-kind'],
    };
  }

  if (isPlatformControl(resource)) {
    const plat = platformLabel(resource);
    return {
      role: 'platform',
      tech: plat,
      techKey: platformKey(resource),
      label: `Platform · ${plat}`,
      confidence: 0.85,
      evidence: ['platform-kind'],
    };
  }

  const related = relatedApplicationSignals(resource, graph);
  const lane = assignLane(resource, graph);
  const role = roleFromLane(lane, resource);
  if (!role) return null;

  const fromMeta = related.declaredStack
    ? {
        tech: related.declaredStack.tech,
        techKey: related.declaredStack.techKey,
        confidence: 0.96,
        evidence: ['declared techStack'],
      }
    : null;
  const fromDeps = techFromDependencies(related.dependencies, related.scripts);
  const fromConfig = techFromConfigSignals(related.configKeys, related.sourceUris);
  const fromImage = techFromImages(resource);
  const fromName = techFromName(resource);

  const picked = pickBest([fromMeta, fromDeps, fromConfig, fromImage, fromName]);
  if (!picked) {
    return {
      role,
      tech: defaultTechForRole(role),
      techKey: role,
      label: `${title(role)} · ${defaultTechForRole(role)}`,
      confidence: 0.4,
      evidence: ['role-heuristic'],
    };
  }

  return {
    role,
    tech: picked.tech,
    techKey: picked.techKey,
    label: `${title(role)} · ${picked.tech}`,
    confidence: picked.confidence,
    evidence: picked.evidence,
  };
}

export function isNetworkResource(resource: ResourceNode): boolean {
  return [
    'vpc',
    'subnet',
    'network',
    'security-group',
    'load-balancer',
    'network-policy',
    'dns',
    'gateway',
  ].includes(resource.kind);
}

export function isPlatformControl(resource: ResourceNode): boolean {
  return [
    'cluster',
    'namespace',
    'account',
    'iam-role',
    'iam-policy',
    'service-account',
    'secret-ref',
    'config',
    'policy',
    'build',
    'monitoring',
  ].includes(resource.kind);
}

export function platformLabel(resource: ResourceNode): string {
  const p = (resource.platform || resource.provider || 'platform').toLowerCase();
  if (p === 'openshift' || resource.provider === 'openshift') return 'OpenShift';
  if (p === 'kubernetes' || resource.provider === 'kubernetes') {
    // OpenShift manifests often surface as kubernetes provider for Deployments
    if (resource.tags?.includes('openshift') || /openshift/i.test(String(resource.metadata.apiVersion ?? ''))) {
      return 'OpenShift';
    }
    return 'Kubernetes';
  }
  if (p === 'aws' || p === 'terraform' || resource.provider === 'aws') {
    return resource.region ? `AWS (${resource.region})` : 'AWS';
  }
  if (p === 'application') return 'Application config';
  return title(p);
}

export function platformKey(resource: ResourceNode): string {
  const p = (resource.platform || resource.provider || 'platform').toLowerCase();
  if (p === 'openshift' || resource.provider === 'openshift') return 'openshift';
  if (p === 'kubernetes' || resource.provider === 'kubernetes') return 'kubernetes';
  if (p === 'aws' || p === 'terraform' || resource.provider === 'aws') return 'aws';
  return p;
}

export function networkGroupKey(resource: ResourceNode): { id: string; label: string } | null {
  if (!isNetworkResource(resource) && resource.kind !== 'internet') return null;
  const vpcRef = String(resource.metadata?.vpc_id ?? resource.metadata?.vpcId ?? '');
  const vpcName =
    vpcRef.match(/aws_vpc\.([a-zA-Z0-9_-]+)/)?.[1] ||
    (resource.kind === 'vpc' ? resource.name : undefined) ||
    (resource.boundary && /vpc/i.test(resource.boundary) ? resource.boundary : undefined);
  if (vpcName) {
    return { id: `b-net-vpc-${vpcName}`, label: `VPC ${vpcName}` };
  }
  if (resource.region) {
    return { id: `b-net-region-${resource.region}`, label: `Network · ${resource.region}` };
  }
  if (resource.provider === 'aws' || resource.platform === 'terraform') {
    return { id: 'b-net-aws', label: 'AWS network' };
  }
  if (resource.kind === 'network-policy' || resource.namespace) {
    return {
      id: `b-net-ns-${resource.namespace ?? 'cluster'}`,
      label: `Cluster network · ${resource.namespace ?? 'default'}`,
    };
  }
  return null;
}

function networkTechLabel(resource: ResourceNode): string {
  if (resource.kind === 'vpc') return 'VPC';
  if (resource.kind === 'subnet') return 'Subnet';
  if (resource.kind === 'security-group') return 'Security group';
  if (resource.kind === 'load-balancer') return 'Load balancer';
  if (resource.kind === 'dns') return 'DNS';
  if (resource.kind === 'network-policy') return 'Network policy';
  return 'Network';
}

function roleFromLane(
  lane: string,
  resource: ResourceNode,
): Exclude<AppRole, 'platform' | 'network'> | null {
  if (!['workload', 'service', 'application', 'function'].includes(resource.kind)) return null;
  if (lane === 'frontend' || lane === 'routing') return 'frontend';
  if (lane === 'processing') return 'worker';
  if (lane === 'application') return 'backend';
  if (resource.kind === 'service') return 'service';
  return 'backend';
}

function relatedApplicationSignals(
  resource: ResourceNode,
  graph: EvidenceGraph,
): {
  dependencies: string[];
  scripts: string[];
  configKeys: string[];
  sourceUris: string[];
  declaredStack?: { tech: string; techKey: string; role?: string };
} {
  const name = resource.name.toLowerCase();
  const apps = graph.resources.filter(
    (r) =>
      r.kind === 'application' &&
      (r.name.toLowerCase() === name ||
        r.name.toLowerCase().includes(name) ||
        name.includes(r.name.toLowerCase())),
  );
  const dependencies = apps.flatMap((a) =>
    Array.isArray(a.metadata.dependencies) ? (a.metadata.dependencies as string[]) : [],
  );
  const scripts = apps.flatMap((a) => {
    const s = a.metadata.scripts;
    if (s && typeof s === 'object') {
      const rec = s as Record<string, unknown>;
      return [...Object.keys(rec), ...Object.values(rec).map(String)];
    }
    return [];
  });

  let declaredStack: { tech: string; techKey: string; role?: string } | undefined;
  for (const a of apps) {
    const t = a.metadata.techStack;
    if (t && typeof t === 'object' && !Array.isArray(t) && 'tech' in (t as object)) {
      const obj = t as { tech?: string; techKey?: string; role?: string };
      if (obj.tech && obj.techKey) {
        declaredStack = { tech: obj.tech, techKey: obj.techKey, role: obj.role };
        break;
      }
    }
  }

  const configKeys = graph.resources
    .filter((r) => r.kind === 'config' || r.kind === 'secret-ref')
    .filter((r) => {
      const uri = String(r.metadata.configFile ?? '').toLowerCase();
      return uri.includes(name) || uri.includes(`/${name}/`) || uri.includes(`apps/${name}`);
    })
    .map((r) => String(r.metadata.key ?? r.name));

  const sourceUris = [
    ...apps.map((a) => String(a.metadata.sourceUri ?? a.metadata.configFile ?? '')),
    ...graph.evidence
      .filter((e) => {
        const uri = (e.sourceUri ?? '').toLowerCase();
        return uri.includes(name) || uri.includes(`apps/${name}`);
      })
      .map((e) => e.sourceUri),
  ];

  return { dependencies, scripts, configKeys, sourceUris, declaredStack };
}

function techFromDependencies(
  deps: string[],
  scripts: string[],
): { tech: string; techKey: string; confidence: number; evidence: string[] } | null {
  const blob = [...deps, ...scripts].join(' ');
  if (!blob) return null;
  if (FRONTEND_DEPS.test(blob)) {
    if (/\bnext\b/i.test(blob)) return { tech: 'Next.js', techKey: 'next', confidence: 0.95, evidence: ['package.json'] };
    if (/\bvue|nuxt\b/i.test(blob)) return { tech: 'Vue', techKey: 'vue', confidence: 0.92, evidence: ['package.json'] };
    if (/\bvite\b/i.test(blob) || /\breact\b/i.test(blob)) {
      return { tech: 'React', techKey: 'react', confidence: 0.93, evidence: ['package.json'] };
    }
  }
  if (JAVA_DEPS.test(blob)) return { tech: 'Spring', techKey: 'spring', confidence: 0.9, evidence: ['package.json'] };
  if (NODE_DEPS.test(blob)) return { tech: 'Node.js', techKey: 'node', confidence: 0.9, evidence: ['package.json'] };
  if (/\bnode\b/i.test(blob) || deps.some((d) => d.startsWith('@aws-sdk'))) {
    return { tech: 'Node.js', techKey: 'node', confidence: 0.72, evidence: ['package.json'] };
  }
  return null;
}

function techFromConfigSignals(
  keys: string[],
  uris: string[],
): { tech: string; techKey: string; confidence: number; evidence: string[] } | null {
  const blob = [...keys, ...uris].join(' ');
  if (/spring/i.test(blob) || /application\.(ya?ml|properties)/i.test(blob) || /jdbc:/i.test(blob)) {
    return { tech: 'Spring Boot', techKey: 'spring', confidence: 0.92, evidence: ['application config'] };
  }
  if (/express|fastify|nestjs/i.test(blob)) {
    return { tech: 'Node.js', techKey: 'node', confidence: 0.8, evidence: ['application config'] };
  }
  if (/vite|react/i.test(blob)) {
    return { tech: 'React', techKey: 'react', confidence: 0.85, evidence: ['application config'] };
  }
  return null;
}

function techFromImages(
  resource: ResourceNode,
): { tech: string; techKey: string; confidence: number; evidence: string[] } | null {
  const images = JSON.stringify(resource.metadata.images ?? resource.metadata.image ?? '').toLowerCase();
  if (!images || images === '""' || images === 'null') return null;
  if (/openjdk|java|tomcat|spring|jre|jdk/.test(images)) {
    return { tech: 'Java / Spring', techKey: 'spring', confidence: 0.75, evidence: ['container image'] };
  }
  if (/node|npm|yarn/.test(images)) return { tech: 'Node.js', techKey: 'node', confidence: 0.75, evidence: ['container image'] };
  if (/nginx|caddy|httpd/.test(images)) return { tech: 'Web / nginx', techKey: 'web', confidence: 0.7, evidence: ['container image'] };
  if (/python|django|flask|fastapi/.test(images)) {
    return { tech: 'Python', techKey: 'python', confidence: 0.75, evidence: ['container image'] };
  }
  if (/golang|go-/.test(images)) return { tech: 'Go', techKey: 'go', confidence: 0.75, evidence: ['container image'] };
  return null;
}

function techFromName(
  resource: ResourceNode,
): { tech: string; techKey: string; confidence: number; evidence: string[] } | null {
  const n = resource.name.toLowerCase();
  if (/storefront|frontend|web-ui|portal/.test(n)) {
    return { tech: 'Web UI', techKey: 'web-ui', confidence: 0.45, evidence: ['name'] };
  }
  if (/worker|consumer|processor/.test(n)) {
    return { tech: 'Worker', techKey: 'worker', confidence: 0.45, evidence: ['name'] };
  }
  return null;
}

function pickBest(
  options: Array<{ tech: string; techKey: string; confidence: number; evidence: string[] } | null>,
) {
  return options.filter(Boolean).sort((a, b) => b!.confidence - a!.confidence)[0] ?? null;
}

function defaultTechForRole(role: string): string {
  if (role === 'frontend') return 'Web UI';
  if (role === 'worker') return 'Async worker';
  if (role === 'service') return 'Service';
  return 'Service';
}

function title(s: string): string {
  return s.replace(/(^|[-_\s])([a-z])/g, (_, _p, c) => ` ${c.toUpperCase()}`).trim();
}
