import yaml from 'js-yaml';
import {
  emptyResult,
  type DiscoveryAdapter,
  type DiscoveryResult,
} from '@infralens/discovery-core';
import { createEvidence } from '@infralens/evidence-model';
import { stableId, type ResourceKind } from '@infralens/graph-model';
import { inferEnvironment, makeEdge, makeResource } from '@infralens/shared';

const OPENSHIFT_KINDS: Record<string, ResourceKind> = {
  Route: 'route',
  DeploymentConfig: 'workload',
  BuildConfig: 'build',
  ImageStream: 'image-stream',
  Template: 'config',
};

function isOpenShift(doc: Record<string, unknown>): boolean {
  const apiVersion = String(doc.apiVersion ?? '');
  const kind = String(doc.kind ?? '');
  return (
    apiVersion.startsWith('route.openshift') ||
    apiVersion.startsWith('apps.openshift') ||
    apiVersion.startsWith('build.openshift') ||
    apiVersion.startsWith('image.openshift') ||
    apiVersion.startsWith('template.openshift') ||
    kind in OPENSHIFT_KINDS
  );
}

export const openshiftAdapter: DiscoveryAdapter = {
  id: 'openshift',
  async supports(input) {
    const matched: string[] = [];
    for (const file of input.files) {
      if (!/\.ya?ml$/i.test(file.path)) continue;
      if (/openshift|route\.openshift|DeploymentConfig|ImageStream/i.test(file.content)) {
        matched.push(file.path);
      }
    }
    return {
      supported: matched.length > 0,
      confidence: matched.length ? 0.95 : 0,
      reason: matched.length ? 'OpenShift resources detected' : 'No OpenShift resources',
      matchedFiles: matched,
    };
  },
  async discover(input) {
    const started = Date.now();
    const result = emptyResult(this.id, started);

    for (const file of input.files) {
      if (!/\.ya?ml$/i.test(file.path)) continue;
      try {
        const docs: Record<string, unknown>[] = [];
        yaml.loadAll(file.content, (doc) => {
          if (doc && typeof doc === 'object') docs.push(doc as Record<string, unknown>);
        });
        for (const doc of docs) {
          if (!isOpenShift(doc)) continue;
          ingest(file.path, doc, result);
        }
      } catch (err) {
        result.warnings.push(`${file.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    result.durationMs = Date.now() - started;
    return result;
  },
};

function ingest(path: string, doc: Record<string, unknown>, result: DiscoveryResult) {
  const kind = String(doc.kind ?? '');
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  const name = String(metadata.name ?? '');
  if (!name) return;
  const namespace = String(metadata.namespace ?? 'default');
  const spec = (doc.spec ?? {}) as Record<string, unknown>;
  const mapped = OPENSHIFT_KINDS[kind] ?? 'unknown';

  const { resource, evidenceId } = makeResource({
    provider: 'openshift',
    platform: 'openshift',
    kind: mapped,
    subtype: kind,
    name,
    namespace,
    environment: inferEnvironment(namespace),
    boundary: `ns:${namespace}`,
    truthState: 'rendered',
    metadata: {
      apiVersion: doc.apiVersion,
      kind,
      namespace,
      host: spec.host,
      to: spec.to,
      tls: spec.tls,
      port: spec.port,
      replicas: spec.replicas,
      selector: spec.selector,
    },
    tags: ['openshift', kind.toLowerCase()],
    confidence: 0.98,
    reasons: [`OpenShift ${kind} from ${path}`],
    adapter: 'openshift',
    sourceUri: path,
    sourceType: 'rendered-manifest',
    location: { yamlPath: `${kind}/${namespace}/${name}` },
  });

  result.evidence.push(
    createEvidence({
      id: evidenceId,
      adapter: 'openshift',
      sourceType: 'rendered-manifest',
      sourceUri: path,
      location: { yamlPath: `${kind}/${namespace}/${name}` },
      extractedValue: { kind, name, namespace, host: spec.host },
      confidence: 0.98,
      truthState: 'rendered',
    }),
  );
  result.resources.push(resource);

  if (kind === 'Route') {
    const to = (spec.to ?? {}) as { kind?: string; name?: string };
    if (to.name) {
      // Match kubernetes/OpenShift Service IDs from makeResource(provider, platform, namespace, kind, name)
      const local = result.resources.find(
        (r) =>
          r.kind === 'service' &&
          r.name === to.name &&
          (r.namespace === namespace || !r.namespace),
      );
      const targetId =
        local?.id ??
        stableId('kubernetes', 'kubernetes', namespace, 'service', to.name);
      result.relationships.push(
        makeEdge({
          source: resource.id,
          target: targetId,
          relation: 'routes-to',
          label: `TLS ${((spec.tls as { termination?: string }) ?? {}).termination ?? 'unknown'}`,
          protocol: 'HTTPS',
          truthState: 'rendered',
          confidence: 0.97,
          reasons: [`OpenShift Route targets Service ${to.name}`],
          evidenceIds: [evidenceId],
          effectiveState: 'allowed',
        }),
      );
    }
  }
}
