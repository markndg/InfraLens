import { resolveEdition, type InfraLensEdition } from '@infralens/edition-capabilities';
import { appConfigAdapter, linkConfigReferences } from '@infralens/discovery-app-config';
import { awsSnapshotAdapter } from '@infralens/discovery-aws';
import { runDiscovery, type DiscoveryInput, type ProjectFile } from '@infralens/discovery-core';
import { kubernetesAdapter } from '@infralens/discovery-kubernetes';
import { openshiftAdapter } from '@infralens/discovery-openshift';
import { terraformAdapter } from '@infralens/discovery-terraform';
import type { ScanBundle } from '@infralens/graph-model';
import {
  DEFAULT_POLICIES,
  applyWaivers,
  evaluatePolicies,
  parsePolicyYaml,
} from '@infralens/policy-engine';
import { ensureInternetNode } from '@infralens/reachability';
import { reconcileTruthStates } from '@infralens/reconciliation';
import {
  enrichArchitectureIntelligence,
  enrichGovernance,
} from '@infralens/architecture-intelligence';
import { computeCompleteness, generateNarrative } from '@infralens/reporting';

export async function scanFiles(
  files: ProjectFile[],
  options?: {
    project?: string;
    edition?: InfraLensEdition;
    snapshots?: DiscoveryInput['snapshots'];
    includeLive?: boolean;
    policyDir?: string;
    repositoryRevision?: string;
    policiesYaml?: string[];
  },
): Promise<ScanBundle> {
  const edition = options?.edition ?? resolveEdition();
  const input: DiscoveryInput = {
    project: options?.project ?? 'project',
    files,
    repositoryRevision: options?.repositoryRevision,
    snapshots: options?.snapshots,
    options: { edition, includeLive: options?.includeLive },
  };

  const { bundle } = await runDiscovery(input, {
    edition,
    adapters: [
      terraformAdapter,
      kubernetesAdapter,
      openshiftAdapter,
      appConfigAdapter,
      awsSnapshotAdapter,
    ],
    postProcessors: [
      async (graph, input) => {
        linkConfigReferences(graph, graph.scan.generatedAt);
        reconcileTruthStates(graph);
        ensureInternetNode(graph);

        let policies = DEFAULT_POLICIES;
        if (options?.policiesYaml?.length) {
          policies = [
            ...DEFAULT_POLICIES,
            ...options.policiesYaml.map((content) => parsePolicyYaml(content)),
          ];
        } else if (
          options?.policyDir &&
          (globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node
        ) {
          try {
            const fs = await (Function('return import("node:fs/promises")')() as Promise<
              typeof import('node:fs/promises')
            >);
            const path = await (Function('return import("node:path")')() as Promise<
              typeof import('node:path')
            >);
            const names = await fs.readdir(options.policyDir);
            const loaded = [];
            for (const name of names.filter((n: string) => /\.ya?ml$/i.test(n))) {
              const content = await fs.readFile(path.join(options.policyDir!, name), 'utf8');
              loaded.push(parsePolicyYaml(content));
            }
            if (loaded.length) policies = [...DEFAULT_POLICIES, ...loaded];
          } catch {
            /* keep defaults */
          }
        }

        const findings = evaluatePolicies(graph, policies, graph.scan.generatedAt);
        for (const f of findings) {
          if (!graph.findings.some((x) => x.id === f.id)) graph.findings.push(f);
        }
        applyWaivers(graph);
        computeCompleteness(graph);
        generateNarrative(graph);
        enrichArchitectureIntelligence(graph);
        enrichGovernance(graph, { files: input.files });
      },
    ],
  });

  return bundle;
}
