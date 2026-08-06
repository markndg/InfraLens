# Graph schema

Logical components may contain multiple truth-layer instances and participate in multiple semantic layers.

`ResourceNode`: id, logicalId, kind, subtype, provider, platform, name, displayName, environment, account, region, cluster, namespace, ownership, lifecycle, truthStates, instances, metadata, interfaces, evidence, findings, confidence, tags, sensitivity, **layers**.

Semantic kinds (v1.3): `business-capability`, `data-asset`, `team`, `trust-zone`, `platform-system` — inferred deterministically onto the same graph as infrastructure.

`ResourceEdge`: id, source, target, relation, direction, protocol, ports, path, effectiveState, truthStates, evidence, confidence, findings.

Relation kinds include declared-dependency, configuration-reference, selector-relationship, ingress-route, service-to-workload, network-reachable/blocked, data-read/write, event-publish/consume, **contains / implements / stores / creates / owned-by / protected-by**, inferred-relation, drift-relation, and more.

`EvidenceGraph.intelligence` (derived, never a second store): story, DNA, health, risk, capability/data/team/trust ids.

Projections (`physical`, `application`, `capability`, `ownership`, `data`, `security`, `risk`, `cost`, `time`, `dna`) filter and present the same nodes/edges.
