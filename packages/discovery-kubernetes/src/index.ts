import yaml from 'js-yaml';
import {
  emptyResult,
  type DiscoveryAdapter,
  type DiscoveryResult,
} from '@infralens/discovery-core';
import { createEvidence, redactValue } from '@infralens/evidence-model';
import { stableId, type ResourceKind } from '@infralens/graph-model';
import { inferEnvironment, makeEdge, makeResource } from '@infralens/shared';

const WORKLOAD_KINDS = new Set([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'Pod',
  'DeploymentConfig',
]);

const KIND_MAP: Record<string, ResourceKind> = {
  Deployment: 'workload',
  StatefulSet: 'workload',
  DaemonSet: 'workload',
  Job: 'workload',
  CronJob: 'workload',
  Pod: 'workload',
  Service: 'service',
  Ingress: 'ingress',
  Gateway: 'gateway',
  HTTPRoute: 'route',
  ConfigMap: 'config',
  Secret: 'secret-ref',
  PersistentVolumeClaim: 'volume',
  NetworkPolicy: 'network-policy',
  ServiceAccount: 'service-account',
  Role: 'policy',
  RoleBinding: 'policy',
  ClusterRole: 'policy',
  ClusterRoleBinding: 'policy',
  HorizontalPodAutoscaler: 'workload',
  PodDisruptionBudget: 'policy',
};

export const kubernetesAdapter: DiscoveryAdapter = {
  id: 'kubernetes',
  async supports(input) {
    const matched = input.files
      .filter((f) => /\.ya?ml$/i.test(f.path) || /\.yml$/i.test(f.path))
      .map((f) => f.path);
    return {
      supported: matched.length > 0 || !!input.snapshots?.clusterInventory,
      confidence: matched.length ? 0.9 : 0,
      reason: matched.length ? 'YAML manifests present' : 'No YAML',
      matchedFiles: matched,
    };
  },
  async discover(input) {
    const started = Date.now();
    const result = emptyResult(this.id, started);
    let keysRedacted = 0;

    for (const file of input.files) {
      if (!/\.ya?ml$/i.test(file.path) && !/\.yml$/i.test(file.path)) continue;
      try {
        const docs: Record<string, unknown>[] = [];
        let count = 0;
        yaml.loadAll(file.content, (doc) => {
          if (!doc || typeof doc !== 'object') return;
          count++;
          if (count > 500) throw new Error('YAML document limit exceeded');
          docs.push(doc as Record<string, unknown>);
        });
        for (const doc of docs) {
          ingestManifest(file.path, doc, result, () => {
            keysRedacted++;
          });
        }
      } catch (err) {
        result.warnings.push(`${file.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (input.snapshots?.clusterInventory) {
      const inv = input.snapshots.clusterInventory as { items?: Record<string, unknown>[] };
      for (const item of inv.items ?? []) {
        ingestManifest('snapshot:cluster', item, result, () => undefined);
      }
    }

    resolveSelectors(result);
    result.redactionSummary = { keysRedacted, valuesRedacted: keysRedacted };
    result.durationMs = Date.now() - started;
    return result;
  },
};

function ingestManifest(
  path: string,
  doc: Record<string, unknown>,
  result: DiscoveryResult,
  _onRedact: () => void,
) {
  const kind = String(doc.kind ?? '');
  const apiVersion = String(doc.apiVersion ?? '');
  if (!kind || kind.startsWith('Route') || apiVersion.startsWith('route.openshift')) return;
  if (apiVersion.startsWith('apps.openshift') || apiVersion.startsWith('build.openshift') || apiVersion.startsWith('image.openshift')) {
    return; // handled by openshift adapter
  }
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  const name = String(metadata.name ?? '');
  if (!name) return;
  const namespace = String(metadata.namespace ?? 'default');
  const spec = (doc.spec ?? {}) as Record<string, unknown>;
  const template = (spec.template ?? {}) as Record<string, unknown>;
  const podSpec = (template.spec ?? spec) as Record<string, unknown>;
  const containers = ((podSpec.containers as unknown[]) ?? []) as Array<Record<string, unknown>>;

  const env: Record<string, unknown> = {};
  for (const c of containers) {
    for (const e of (c.env as Array<Record<string, unknown>>) ?? []) {
      const key = String(e.name ?? '');
      if (!key) continue;
      if (e.valueFrom) {
        env[key] = '[reference]';
      } else {
        const redacted = redactValue(key, e.value);
        env[key] = redacted.value;
      }
    }
  }

  const kindMapped = KIND_MAP[kind] ?? 'unknown';
  const labels = (metadata.labels ?? {}) as Record<string, string>;
  const selector =
    (spec.selector as Record<string, unknown>) ??
    (spec.podSelector as Record<string, unknown>) ??
    {};

  const { resource, evidenceId } = makeResource({
    provider: 'kubernetes',
    platform: 'kubernetes',
    kind: kindMapped,
    subtype: kind,
    name,
    namespace,
    environment: inferEnvironment(namespace),
    boundary: `ns:${namespace}`,
    cluster: 'local',
    truthState: path.startsWith('snapshot:') ? 'observed' : 'rendered',
    metadata: {
      apiVersion,
      kind,
      namespace,
      labels,
      selector,
      replicas: spec.replicas,
      ports: spec.ports ?? containers.flatMap((c) => (c.ports as unknown[]) ?? []),
      images: containers.map((c) => c.image),
      env,
      resources: containers.map((c) => c.resources),
      probes: containers.map((c) => ({
        liveness: c.livenessProbe ? true : false,
        readiness: c.readinessProbe ? true : false,
      })),
      host: (spec as { rules?: unknown }).rules ? undefined : (spec as { host?: string }).host,
      rules: (spec as { rules?: unknown }).rules,
      policyTypes: (spec as { policyTypes?: string[] }).policyTypes,
      ingress: (spec as { ingress?: unknown }).ingress,
      egress: (spec as { egress?: unknown }).egress,
      to: (spec as { to?: unknown }).to,
    },
    tags: ['kubernetes', kind.toLowerCase()],
    confidence: 0.98,
    reasons: [`Kubernetes ${kind} from ${path}`],
    adapter: 'kubernetes',
    sourceUri: path,
    sourceType: path.startsWith('snapshot:') ? 'cluster-snapshot' : 'rendered-manifest',
    location: { yamlPath: `${kind}/${namespace}/${name}` },
  });

  const evidence = createEvidence({
    id: evidenceId,
    adapter: 'kubernetes',
    sourceType: path.startsWith('snapshot:') ? 'cluster-snapshot' : 'rendered-manifest',
    sourceUri: path,
    location: { yamlPath: `${kind}/${namespace}/${name}` },
    extractedValue: { kind, name, namespace },
    confidence: 0.98,
    truthState: resource.truthStates[0],
    redacted: Object.values(env).includes('[REDACTED]'),
  });
  result.evidence.push(evidence);
  result.resources.push(resource);

  if (kind === 'Ingress') {
    const rules = (spec.rules as Array<Record<string, unknown>>) ?? [];
    for (const rule of rules) {
      const http = (rule.http ?? {}) as { paths?: Array<Record<string, unknown>> };
      for (const p of http.paths ?? []) {
        const backend = (p.backend ?? {}) as { service?: { name?: string } };
        const svc = backend.service?.name;
        if (!svc) continue;
        const local = result.resources.find(
          (r) =>
            r.kind === 'service' &&
            r.name === svc &&
            (r.namespace === namespace || !r.namespace),
        );
        const targetId =
          local?.id ?? stableId('kubernetes', 'kubernetes', namespace, 'service', svc);
        const edge = makeEdge({
          source: resource.id,
          target: targetId,
          relation: 'ingress-route',
          label: String(rule.host ?? p.path ?? 'HTTP'),
          protocol: 'HTTP',
          truthState: resource.truthStates[0],
          confidence: 0.95,
          reasons: [`Ingress path routes to service ${svc}`],
          evidenceIds: [evidenceId],
          effectiveState: 'allowed',
        });
        result.relationships.push(edge);
      }
    }
  }
}

function resolveSelectors(result: DiscoveryResult) {
  const services = result.resources.filter((r) => r.subtype === 'Service' || r.kind === 'service');
  const workloads = result.resources.filter((r) => WORKLOAD_KINDS.has(String(r.subtype)));
  for (const svc of services) {
    const sel = ((svc.metadata.selector as { matchLabels?: Record<string, string> })?.matchLabels ??
      svc.metadata.selector) as Record<string, string>;
    if (!sel || typeof sel !== 'object') continue;
    const entries = Object.entries(sel).filter(([k]) => k !== 'matchLabels');
    for (const w of workloads) {
      if (w.namespace !== svc.namespace) continue;
      const labels =
        ((w.metadata.selector as { matchLabels?: Record<string, string> })?.matchLabels as Record<
          string,
          string
        >) ??
        (w.metadata.labels as Record<string, string>) ??
        {};
      if (entries.length && entries.every(([k, v]) => labels[k] === v)) {
        const evId = svc.evidence[0];
        result.relationships.push(
          makeEdge({
            source: svc.id,
            target: w.id,
            relation: 'service-to-workload',
            label: 'selects pods',
            truthState: 'rendered',
            confidence: 0.96,
            reasons: [`Service selector matches workload labels`],
            evidenceIds: [evId],
            effectiveState: 'allowed',
          }),
        );
      }
    }
  }
}

export function matchSelector(
  selector: Record<string, string>,
  labels: Record<string, string>,
): boolean {
  const entries = Object.entries(selector);
  return entries.length > 0 && entries.every(([k, v]) => labels[k] === v);
}
