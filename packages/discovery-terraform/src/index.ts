import {
  emptyResult,
  type DiscoveryAdapter,
  type DiscoveryContext,
  type DiscoveryInput,
  type DiscoveryResult,
} from '@infralens/discovery-core';
import { createEvidence, redactValue } from '@infralens/evidence-model';
import { stableId, type Finding, type ResourceNode, type UnsupportedConstruct } from '@infralens/graph-model';
import { inferEnvironment, makeResource } from '@infralens/shared';
import { attributesToObject, parseHclBlocks } from './hcl.js';
import { displayNameFromConfig, mapTerraformType } from './mapping.js';

export const terraformAdapter: DiscoveryAdapter = {
  id: 'terraform',
  async supports(input) {
    const matched = input.files
      .filter((f) => /\.tf$/i.test(f.path) || /\.tf\.json$/i.test(f.path) || /terraform\.tfstate$/i.test(f.path))
      .map((f) => f.path);
    const hasPlan = !!input.snapshots?.terraformPlan;
    return {
      supported: matched.length > 0 || hasPlan,
      confidence: matched.length ? 0.95 : hasPlan ? 0.9 : 0,
      reason: matched.length ? 'Terraform files present' : hasPlan ? 'Plan snapshot present' : 'No Terraform inputs',
      matchedFiles: matched,
    };
  },
  async discover(input, context) {
    const started = Date.now();
    const result = emptyResult(this.id, started);
    let keysRedacted = 0;
    let valuesRedacted = 0;

    for (const file of input.files) {
      try {
        if (file.path.endsWith('.tf.json')) {
          ingestTfJson(file.path, JSON.parse(file.content), result, context, (k, v) => {
            const r = redactValue(k, v);
            if (r.redacted) {
              keysRedacted++;
              valuesRedacted++;
            }
            return r.value;
          });
        } else if (/\.tf$/i.test(file.path)) {
          ingestHcl(file.path, file.content, result, context, (k, v) => {
            const r = redactValue(k, v);
            if (r.redacted) {
              keysRedacted++;
              valuesRedacted++;
            }
            return r.value;
          });
        }
      } catch (err) {
        result.warnings.push(
          `${file.path}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (input.snapshots?.terraformPlan) {
      ingestPlanOrState(input.snapshots.terraformPlan, 'planned', result, context);
    }
    if (input.snapshots?.terraformState) {
      ingestPlanOrState(input.snapshots.terraformState, 'evaluated', result, context);
    }

    result.redactionSummary = { keysRedacted, valuesRedacted };
    result.durationMs = Date.now() - started;
    result.metadata = { resourceCount: result.resources.length };
    return result;
  },
};

function ingestHcl(
  path: string,
  content: string,
  result: DiscoveryResult,
  context: DiscoveryContext,
  sanitize: (k: string, v: unknown) => unknown,
) {
  const blocks = parseHclBlocks(content);
  for (const block of blocks) {
    if (block.type === 'module') {
      const unsupported: UnsupportedConstruct = {
        id: stableId('unsupported', path, 'module', block.labels[0] ?? 'unnamed'),
        adapter: 'terraform',
        sourceUri: path,
        construct: `module.${block.labels[0] ?? 'unnamed'}`,
        reason:
          'Static parsing cannot expand module outputs. Import terraform show -json or expand modules in the scanner.',
        evidence: [],
      };
      const ev = createEvidence({
        adapter: 'terraform',
        sourceType: 'source-file',
        sourceUri: path,
        location: { lineStart: block.lineStart },
        confidence: 0.7,
        rationale: unsupported.reason,
        truthState: 'declared',
        extractedValue: { module: block.labels[0] },
      });
      unsupported.evidence.push(ev.id);
      result.evidence.push(ev);
      result.unsupported.push(unsupported);
      result.findings.push({
        id: stableId('finding', 'unsupported-module', path, block.labels[0]),
        severity: 'medium',
        title: 'Terraform module requires canonical evaluation',
        rationale: unsupported.reason,
        impact: 'Downstream resources from this module may be missing from the graph.',
        remediation: 'Run terraform show -json and import the plan/state snapshot.',
        affectedResources: [],
        evidence: [ev.id],
        status: 'open',
        firstSeen: context.now,
        lastSeen: context.now,
        blocksSignOff: false,
      });
      continue;
    }

    if (block.type !== 'resource' && block.type !== 'data') continue;
    const [tfType, logical] = block.labels;
    if (!tfType || !logical) continue;
    const { values, unresolved } = attributesToObject(block.attributes);
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) cleaned[k] = sanitize(k, v);
    addTerraformResource({
      tfType,
      logical,
      cfg: cleaned,
      unresolved,
      path,
      line: block.lineStart,
      truthState: 'declared',
      isData: block.type === 'data',
      result,
      context,
    });
  }
}

function ingestTfJson(
  path: string,
  parsed: Record<string, unknown>,
  result: DiscoveryResult,
  context: DiscoveryContext,
  sanitize: (k: string, v: unknown) => unknown,
) {
  const resources = (parsed.resource ?? {}) as Record<string, Record<string, unknown>>;
  for (const [tfType, named] of Object.entries(resources)) {
    for (const [logical, cfgRaw] of Object.entries(named)) {
      const cfgArr = Array.isArray(cfgRaw) ? cfgRaw : [cfgRaw];
      for (const cfg of cfgArr) {
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries((cfg ?? {}) as Record<string, unknown>)) {
          cleaned[k] = sanitize(k, v);
        }
        addTerraformResource({
          tfType,
          logical,
          cfg: cleaned,
          unresolved: [],
          path,
          truthState: 'declared',
          isData: false,
          result,
          context,
        });
      }
    }
  }
}

function ingestPlanOrState(
  doc: unknown,
  truthState: 'planned' | 'evaluated',
  result: DiscoveryResult,
  context: DiscoveryContext,
) {
  const root = doc as {
    resource_changes?: Array<{
      address?: string;
      type?: string;
      name?: string;
      change?: { after?: Record<string, unknown> | null };
    }>;
    values?: {
      root_module?: {
        resources?: Array<{
          address?: string;
          type?: string;
          name?: string;
          values?: Record<string, unknown>;
        }>;
      };
    };
  };

  const changes = root.resource_changes ?? [];
  for (const ch of changes) {
    if (!ch.type || !ch.name) continue;
    addTerraformResource({
      tfType: ch.type,
      logical: ch.name,
      cfg: ch.change?.after ?? {},
      unresolved: [],
      path: `snapshot:${truthState}`,
      address: ch.address,
      truthState,
      isData: false,
      result,
      context,
    });
  }

  const stateResources = root.values?.root_module?.resources ?? [];
  for (const r of stateResources) {
    if (!r.type || !r.name) continue;
    addTerraformResource({
      tfType: r.type,
      logical: r.name,
      cfg: r.values ?? {},
      unresolved: [],
      path: `snapshot:${truthState}`,
      address: r.address,
      truthState,
      isData: false,
      result,
      context,
    });
  }
}

function addTerraformResource(args: {
  tfType: string;
  logical: string;
  cfg: Record<string, unknown>;
  unresolved: string[];
  path: string;
  line?: number;
  address?: string;
  truthState: 'declared' | 'planned' | 'evaluated';
  isData: boolean;
  result: DiscoveryResult;
  context: DiscoveryContext;
}) {
  const mapped = mapTerraformType(args.tfType);
  const name = displayNameFromConfig(args.tfType, args.logical, args.cfg);
  const { resource, evidenceId } = makeResource({
    provider: mapped.provider,
    kind: mapped.kind,
    subtype: mapped.subtype,
    name,
    logicalId: stableId('tf', args.tfType, args.logical),
    platform: 'terraform',
    environment: inferEnvironment(String(name)),
    region: typeof args.cfg.region === 'string' ? args.cfg.region : 'eu-west-2',
    boundary: mapped.provider === 'aws' ? 'AWS' : 'Terraform',
    truthState: args.truthState,
    metadata: {
      terraformType: args.tfType,
      logicalName: args.logical,
      address: args.address ?? `${args.tfType}.${args.logical}`,
      isData: args.isData,
      unresolvedAttributes: args.unresolved,
      ...args.cfg,
      multiAz: args.cfg.multi_az,
      multi_az: args.cfg.multi_az,
      storageEncrypted: args.cfg.storage_encrypted,
      engine: args.cfg.engine,
      port: args.cfg.port,
    },
    tags: ['terraform', mapped.provider],
    confidence: args.unresolved.length ? 0.72 : args.truthState === 'declared' ? 0.9 : 0.95,
    reasons: [
      `Terraform ${args.truthState} resource ${args.tfType}.${args.logical}`,
      ...(args.unresolved.length
        ? [`Unresolved attributes: ${args.unresolved.join(', ')}`]
        : []),
    ],
    missingEvidence: args.unresolved.length
      ? ['resolved attribute values from plan/state']
      : args.truthState === 'declared'
        ? ['live inventory confirmation']
        : [],
    adapter: 'terraform',
    sourceUri: args.path,
    sourceType:
      args.truthState === 'planned'
        ? 'terraform-plan'
        : args.truthState === 'evaluated'
          ? 'terraform-state'
          : args.path.endsWith('.json')
            ? 'terraform-json'
            : 'source-file',
    location: {
      lineStart: args.line,
      jsonPath: `resource.${args.tfType}.${args.logical}`,
    },
    rationale: `Present as ${args.truthState} Terraform resource`,
  });

  const evidence = createEvidence({
    id: evidenceId,
    adapter: 'terraform',
    sourceType:
      args.truthState === 'planned'
        ? 'terraform-plan'
        : args.truthState === 'evaluated'
          ? 'terraform-state'
          : args.path.endsWith('.json')
            ? 'terraform-json'
            : 'source-file',
    sourceUri: args.path,
    location: {
      lineStart: args.line,
      jsonPath: `resource.${args.tfType}.${args.logical}`,
    },
    extractedValue: { type: args.tfType, name: args.logical, displayName: name },
    confidence: resource.confidence.score,
    rationale: resource.confidence.reasons[0],
    truthState: args.truthState,
  });
  args.result.evidence.push(evidence);
  args.result.resources.push(resource);

  if (args.unresolved.length) {
    args.result.unsupported.push({
      id: stableId('unresolved-expr', resource.id, args.unresolved.join(',')),
      adapter: 'terraform',
      sourceUri: args.path,
      construct: args.unresolved.join(','),
      reason: 'Dynamic or unevaluated Terraform expression',
      evidence: [evidenceId],
    });
  }
}

export { parseHclBlocks, attributesToObject } from './hcl.js';
export { mapTerraformType } from './mapping.js';
