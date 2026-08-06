import yaml from 'js-yaml';
import {
  emptyResult,
  type DiscoveryAdapter,
  type DiscoveryResult,
} from '@infralens/discovery-core';
import { createEvidence, redactValue } from '@infralens/evidence-model';
import { stableId, type RelationKind, type ResourceNode } from '@infralens/graph-model';
import { inferEnvironment, makeEdge, makeResource } from '@infralens/shared';

const REF_KEY =
  /(HOST|URL|URI|ENDPOINT|BUCKET|QUEUE|TOPIC|DB_|DATABASE|JDBC|REDIS|BROKER|DSN|CONNECTION)/i;

export const appConfigAdapter: DiscoveryAdapter = {
  id: 'app-config',
  async supports(input) {
    const matched = input.files
      .filter((f) =>
        /(\.env|application\.(ya?ml|properties|toml)|package\.json|docker-compose|config\.(ts|js|json)|settings\.(py|toml))$/i.test(
          f.path,
        ),
      )
      .map((f) => f.path);
    return {
      supported: matched.length > 0 || input.files.some((f) => /env:/i.test(f.content)),
      confidence: 0.85,
      reason: 'Application configuration candidates present',
      matchedFiles: matched,
    };
  },
  async discover(input) {
    const started = Date.now();
    const result = emptyResult(this.id, started);
    let valuesRedacted = 0;

    // Extract env refs from already-discovered workload metadata by re-scanning YAML env blocks
    // and standalone config files. Graph merge happens in orchestrator.
    for (const file of input.files) {
      try {
        if (/package\.json$/i.test(file.path)) {
          const pkg = JSON.parse(file.content) as {
            name?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            scripts?: Record<string, string>;
          };
          const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
          const techStack = detectJsTechStack(dependencies, pkg.scripts ?? {});
          const { resource, evidenceId } = makeResource({
            provider: 'application',
            kind: 'application',
            name: pkg.name ?? file.path,
            boundary: 'Source',
            environment: inferEnvironment(file.path),
            truthState: 'declared',
            metadata: {
              dependencies,
              scripts: pkg.scripts ?? {},
              techStack,
              role: techStack?.role,
            },
            adapter: 'app-config',
            sourceUri: file.path,
            sourceType: 'application-config',
            confidence: 0.9,
            reasons: ['Application package manifest'],
            tags: techStack ? [`tech:${techStack.techKey}`, `role:${techStack.role}`] : undefined,
          });
          result.evidence.push(
            createEvidence({
              id: evidenceId,
              adapter: 'app-config',
              sourceType: 'application-config',
              sourceUri: file.path,
              confidence: 0.9,
              truthState: 'declared',
              extractedValue: { name: pkg.name },
            }),
          );
          result.resources.push(resource);
        }

        if (/docker-compose/i.test(file.path)) {
          const doc = yaml.load(file.content) as { services?: Record<string, Record<string, unknown>> };
          for (const [name, svc] of Object.entries(doc.services ?? {})) {
            const { resource, evidenceId } = makeResource({
              provider: 'application',
              kind: 'workload',
              subtype: 'compose-service',
              name,
              environment: 'development',
              boundary: 'docker-compose',
              truthState: 'declared',
              metadata: { image: svc.image, ports: svc.ports },
              adapter: 'app-config',
              sourceUri: file.path,
              sourceType: 'application-config',
              confidence: 0.88,
              reasons: ['Docker Compose service'],
            });
            result.evidence.push(
              createEvidence({
                id: evidenceId,
                adapter: 'app-config',
                sourceType: 'application-config',
                sourceUri: file.path,
                location: { yamlPath: `services.${name}` },
                confidence: 0.88,
                truthState: 'declared',
                extractedValue: { name },
              }),
            );
            result.resources.push(resource);
          }
        }

        if (/application\.(ya?ml|yml|properties)$/i.test(file.path) && /spring\s*:/i.test(file.content)) {
          const appName =
            file.path.match(/apps\/([^/]+)\//i)?.[1] ||
            file.path.match(/([^/]+)\/application\./i)?.[1] ||
            'spring-app';
          const { resource, evidenceId } = makeResource({
            provider: 'application',
            kind: 'application',
            name: appName,
            boundary: 'Source',
            environment: inferEnvironment(file.path),
            truthState: 'declared',
            metadata: {
              techStack: { role: 'backend', tech: 'Spring Boot', techKey: 'spring' },
              role: 'backend',
              framework: 'spring-boot',
              configFile: file.path,
            },
            adapter: 'app-config',
            sourceUri: file.path,
            sourceType: 'application-config',
            confidence: 0.9,
            reasons: ['Spring application configuration'],
            tags: ['tech:spring', 'role:backend'],
          });
          result.evidence.push(
            createEvidence({
              id: evidenceId,
              adapter: 'app-config',
              sourceType: 'application-config',
              sourceUri: file.path,
              confidence: 0.9,
              truthState: 'declared',
              extractedValue: { name: appName, framework: 'spring-boot' },
            }),
          );
          result.resources.push(resource);
        }

        if (/\.env$/i.test(file.path) || /application\.(ya?ml|yml|properties)$/i.test(file.path)) {
          const pairs = extractPairs(file.path, file.content);
          for (const [key, rawValue] of pairs) {
            const redacted = redactValue(key, rawValue);
            if (redacted.redacted) valuesRedacted++;
            if (!REF_KEY.test(key)) continue;
            const value = String(redacted.value);
            if (!value || value === '[REDACTED]' || value === '[reference]') continue;

            const ev = createEvidence({
              adapter: 'app-config',
              sourceType: 'application-config',
              sourceUri: file.path,
              location: { jsonPath: key },
              extractedValue: { key, value: redacted.redacted ? '[REDACTED]' : value },
              redacted: redacted.redacted,
              confidence: 0.8,
              truthState: 'declared',
              rationale: `Configuration key ${key}`,
            });
            result.evidence.push(ev);

            // Store as pending reference metadata resource for later linking in post-processor
            result.resources.push({
              ...makeResource({
                provider: 'application',
                kind: 'config',
                subtype: 'config-reference',
                name: `${key}`,
                logicalId: stableId('config-ref', file.path, key),
                environment: inferEnvironment(file.path),
                boundary: 'Application config',
                truthState: 'declared',
                metadata: { key, value, configFile: file.path },
                adapter: 'app-config',
                sourceUri: file.path,
                sourceType: 'application-config',
                confidence: 0.8,
                reasons: [`Config reference ${key}`],
              }).resource,
              evidence: [ev.id],
            });
          }
        }

        // Source-code hostname/URL heuristics
        if (/\.(ts|js|py|java|go|rs|cs)$/i.test(file.path)) {
          const urls = file.content.match(/https?:\/\/[a-zA-Z0-9._:-]+/g) ?? [];
          for (const url of [...new Set(urls)].slice(0, 20)) {
            let host: string;
            try {
              host = new URL(url).hostname;
            } catch {
              continue;
            }
            const { resource, evidenceId } = makeResource({
              provider: 'external',
              kind: 'external-system',
              name: host,
              environment: 'external',
              boundary: 'Internet',
              truthState: 'inferred',
              metadata: { url },
              adapter: 'app-config',
              sourceUri: file.path,
              sourceType: 'source-code',
              confidence: 0.6,
              reasons: [`URL reference in source ${file.path}`],
              missingEvidence: ['ownership metadata', 'confirmed runtime dependency'],
            });
            result.evidence.push(
              createEvidence({
                id: evidenceId,
                adapter: 'app-config',
                sourceType: 'source-code',
                sourceUri: file.path,
                extractedValue: { url: host },
                confidence: 0.6,
                truthState: 'inferred',
                rationale: 'Hostname extracted from source code',
              }),
            );
            result.resources.push(resource);
          }
        }
      } catch (err) {
        result.warnings.push(`${file.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    result.redactionSummary = { keysRedacted: valuesRedacted, valuesRedacted };
    result.durationMs = Date.now() - started;
    return result;
  },
};

function extractPairs(path: string, content: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  if (/\.env$/i.test(path) || /\.properties$/i.test(path)) {
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*[=:]\s*(.*)$/);
      if (m) pairs.push([m[1], m[2].replace(/^["']|["']$/g, '')]);
    }
    return pairs;
  }
  if (/\.ya?ml$/i.test(path)) {
    try {
      const doc = yaml.load(content) as unknown;
      flatten(doc, '', pairs);
    } catch {
      /* ignore */
    }
  }
  return pairs;
}

function flatten(value: unknown, prefix: string, out: Array<[string, string]>) {
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (prefix) out.push([prefix, String(value)]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

/** Link workload env vars and config refs onto discovered infrastructure resources. */
export function linkConfigReferences(resultGraph: {
  resources: import('@infralens/graph-model').ResourceNode[];
  edges: import('@infralens/graph-model').ResourceEdge[];
  evidence: import('@infralens/evidence-model').EvidenceRecord[];
  findings: import('@infralens/graph-model').Finding[];
}, now: string) {
  const workloads = resultGraph.resources.filter(
    (r) => r.kind === 'workload' || r.subtype === 'Deployment' || r.subtype === 'StatefulSet',
  );
  for (const w of workloads) {
    const env = (w.metadata.env as Record<string, string>) ?? {};
    for (const [key, val] of Object.entries(env)) {
      if (!val || val === '[reference]' || val === '[REDACTED]') continue;
      const link = resolveTarget(resultGraph.resources, key, val);
      const ev = createEvidence({
        adapter: 'app-config',
        sourceType: 'inference',
        sourceUri: w.evidence[0] ?? w.id,
        extractedValue: { key, value: val, workload: w.name },
        confidence: link?.confidence ?? 0.55,
        truthState: 'inferred',
        rationale: link?.reason ?? `Unresolved reference ${key}`,
        redacted: false,
      });
      resultGraph.evidence.push(ev);

      if (link?.target) {
        resultGraph.edges.push(
          makeEdge({
            source: w.id,
            target: link.target.id,
            relation: link.relation,
            label: key,
            protocol: link.protocol,
            port: link.port,
            truthState: 'inferred',
            confidence: link.confidence,
            reasons: [link.reason],
            missingEvidence: link.missing,
            evidenceIds: [ev.id],
            effectiveState: 'unknown',
          }),
        );
      } else if (REF_KEY.test(key)) {
        if (/^https?:\/\//.test(val)) {
          let host: string;
          try {
            host = new URL(val).hostname;
          } catch {
            continue;
          }
          const { resource, evidenceId } = makeResource({
            provider: 'external',
            kind: 'external-system',
            name: host,
            environment: 'external',
            boundary: 'Internet',
            truthState: 'inferred',
            metadata: { url: val },
            adapter: 'app-config',
            sourceUri: String(w.metadata.namespace ?? w.id),
            sourceType: 'inference',
            confidence: 0.72,
            reasons: [`External URL from ${w.name} env ${key}`],
            missingEvidence: ['ownership', 'contract'],
          });
          // reuse evidence
          resource.evidence = [ev.id];
          if (!resultGraph.resources.some((r) => r.id === resource.id)) {
            resultGraph.resources.push(resource);
          }
          resultGraph.edges.push(
            makeEdge({
              source: w.id,
              target: resource.id,
              relation: 'connects',
              label: key,
              protocol: 'HTTPS',
              truthState: 'inferred',
              confidence: 0.72,
              reasons: [`Env ${key} points to external host`],
              evidenceIds: [ev.id, evidenceId],
            }),
          );
        } else {
          resultGraph.findings.push({
            id: stableId('finding', 'unresolved', w.id, key),
            severity: 'medium',
            title: 'Unresolved infrastructure reference',
            rationale: `${w.name} declares ${key}=${val}, but no matching resource was discovered.`,
            impact: 'Architecture connectivity may be incomplete.',
            remediation: 'Add the missing resource definition or live inventory.',
            affectedResources: [w.id],
            evidence: [ev.id],
            status: 'open',
            firstSeen: now,
            lastSeen: now,
            blocksSignOff: false,
          });
        }
      }
    }
  }

  // Link spring datasource style config refs to the owning application
  for (const cfg of resultGraph.resources.filter((r) => r.subtype === 'config-reference')) {
    const key = String(cfg.metadata.key ?? '');
    const val = String(cfg.metadata.value ?? '');
    const link = resolveTarget(resultGraph.resources, key, val);
    if (!link?.target) continue;
    const configFile = String(cfg.metadata.configFile ?? '');
    const app = owningApplication(resultGraph.resources, configFile, cfg.name);
    if (!app) continue;
    resultGraph.edges.push(
      makeEdge({
        source: app.id,
        target: link.target.id,
        relation: link.relation,
        label: key,
        protocol: link.protocol,
        port: link.port,
        truthState: 'declared',
        confidence: link.confidence,
        reasons: [link.reason],
        evidenceIds: cfg.evidence,
      }),
    );
  }
}

function owningApplication(
  resources: import('@infralens/graph-model').ResourceNode[],
  configFile: string,
  configName: string,
): import('@infralens/graph-model').ResourceNode | undefined {
  const apps = resources.filter((r) => r.kind === 'application');
  const fromPath =
    configFile.match(/apps\/([^/]+)\//i)?.[1] ||
    configFile.match(/([^/]+)\/application\./i)?.[1];
  if (fromPath) {
    const hit = apps.find((a) => a.name === fromPath || a.name.includes(fromPath));
    if (hit) return hit;
  }
  const bySource = apps.find((a) => configFile && String(a.evidence?.[0] ?? '').includes(a.name));
  if (bySource && configFile.includes(bySource.name)) return bySource;
  return apps.find((a) => configFile.includes(a.name) || configName.includes(a.name));
}

function detectJsTechStack(
  dependencies: string[],
  scripts: Record<string, string>,
): { role: string; tech: string; techKey: string } | undefined {
  const blob = [...dependencies, ...Object.keys(scripts), ...Object.values(scripts)].join(' ');
  if (/\b(next)\b/i.test(blob)) return { role: 'frontend', tech: 'Next.js', techKey: 'next' };
  if (/\b(react|react-dom|vite)\b/i.test(blob)) return { role: 'frontend', tech: 'React', techKey: 'react' };
  if (/\b(vue|nuxt)\b/i.test(blob)) return { role: 'frontend', tech: 'Vue', techKey: 'vue' };
  if (/\b(@nestjs\/core|nestjs|express|fastify|koa)\b/i.test(blob)) {
    return { role: 'backend', tech: 'Node.js', techKey: 'node' };
  }
  if (dependencies.length > 0 || /node|npm|tsx|ts-node/i.test(blob)) {
    return { role: 'service', tech: 'Node.js', techKey: 'node' };
  }
  return undefined;
}

function resolveTarget(
  resources: import('@infralens/graph-model').ResourceNode[],
  key: string,
  val: string,
): {
  target?: import('@infralens/graph-model').ResourceNode;
  relation: RelationKind;
  protocol?: string;
  port?: number;
  confidence: number;
  reason: string;
  missing: string[];
} | null {
  let relation: RelationKind = 'configuration-reference';
  let protocol: string | undefined;
  let port: number | undefined;
  if (/BUCKET/i.test(key)) relation = /WRITE|UPLOAD/i.test(key) ? 'data-write' : 'data-read';
  if (/QUEUE|SQS|TOPIC/i.test(key)) relation = /CONSUME|WORKER/i.test(key) ? 'event-consume' : 'event-publish';
  if (/DB_|DATABASE|JDBC|POSTGRES|MYSQL/i.test(key)) {
    relation = 'connects';
    protocol = 'TCP';
    port = 5432;
  }

  const NETWORK_KINDS = new Set(['vpc', 'subnet', 'network', 'security-group']);
  const preferKinds: string[] | null = /BUCKET/i.test(key)
    ? ['bucket']
    : /QUEUE|SQS|TOPIC/i.test(key)
      ? ['queue', 'topic']
      : /DB_|DATABASE|JDBC|POSTGRES|MYSQL/i.test(key)
        ? ['relational-database']
        : /REDIS|CACHE/i.test(key)
          ? ['cache']
          : null;

  // Internal service DNS e.g. http://catalog:8081 — before fuzzy name matching
  if (/^https?:\/\//.test(val)) {
    try {
      const u = new URL(val);
      if (!u.hostname.includes('.')) {
        const svc = resources.find(
          (r) => (r.kind === 'service' || r.kind === 'workload') && r.name === u.hostname,
        );
        if (svc) {
          return {
            target: svc,
            relation: 'connects',
            protocol: u.protocol.replace(':', '').toUpperCase(),
            port: u.port ? Number(u.port) : undefined,
            confidence: 0.9,
            reason: `Internal service URL ${u.hostname}`,
            missing: [],
          };
        }
      } else {
        const hostHit = resources.find(
          (r) =>
            r.name === u.hostname ||
            String(r.metadata.identifier ?? '') === u.hostname ||
            String(r.metadata.endpoint ?? '') === u.hostname,
        );
        if (hostHit && !NETWORK_KINDS.has(hostHit.kind)) {
          return {
            target: hostHit,
            relation,
            protocol: u.protocol.replace(':', '').toUpperCase(),
            port: u.port ? Number(u.port) : port,
            confidence: 0.88,
            reason: `Hostname match ${u.hostname}`,
            missing: [],
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  const scored = resources
    .filter((r) => !NETWORK_KINDS.has(r.kind))
    .map((r) => {
      let score = 0;
      if (preferKinds?.includes(r.kind)) score += 50;
      if (r.name === val) score += 200;
      if (String(r.metadata.identifier ?? '') === val) score += 190;
      if (String(r.metadata.bucket ?? '') === val) score += 190;
      if (String(r.metadata.name ?? '') === val) score += 180;
      if (String(r.metadata.address ?? '') === val) score += 180;
      // Contained name match: prefer closest length so retail-prod-assets beats *-logs
      if (r.name.length >= 4 && val.includes(r.name) && r.name !== val) {
        const slack = Math.abs(val.length - r.name.length);
        score += Math.max(0, 40 - slack * 4) + Math.min(r.name.length, 12);
      }
      if (preferKinds && !preferKinds.includes(r.kind) && score < 50) score = 0;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.name.length - b.r.name.length);

  let target: ResourceNode | undefined = scored[0]?.r;

  if (!target && preferKinds) {
    const needle = val.toLowerCase();
    target = resources.find(
      (r) =>
        preferKinds.includes(r.kind) &&
        (needle.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(needle.replace(/[^a-z0-9-]/g, ''))),
    );
    if (!target) target = resources.find((r) => preferKinds.includes(r.kind));
  }

  if (!target) return { confidence: 0.4, relation, reason: 'No match', missing: ['matching resource'] };

  return {
    target,
    relation,
    protocol,
    port,
    confidence: 0.82,
    reason: `${key} matches ${target.displayName}`,
    missing: target.truthStates.includes('observed')
      ? []
      : ['live confirmation of endpoint'],
  };
}
