# Projection contracts

InfraLens projects **many architecture views from one evidence graph**. Each view is governed by an explicit **projection contract**: one architectural question, one primary containment model, and a bounded relationship vocabulary.

Source of truth for the UI contracts: `apps/web/src/projection/contracts.ts`. Projection construction lives in `@infralens/architecture-intelligence`.

## Contract shape

Each `ProjectionContract` defines:

| Field | Meaning |
|-------|---------|
| `architecturalQuestion` | The single question the view answers |
| `purpose` | Short UX cue |
| `primaryContainment` | Semantic grouping used for layout (capability, team, trust, …) |
| `primaryRelationshipFamilies` | Allowed relationship *families* in the view |
| `eligibleCanonicalRelations` | Evidence-graph `RelationKind` values that may appear |
| `secondaryMetadata` | Badges/filters only — never used as containment |
| `summaryGenerator` | Deterministic one-line summary from graph slices |

Rules for contributors ([CONTRIBUTING.md](../../CONTRIBUTING.md)):

- Do not invent edges that lack evidence.
- Keep eligible relations explicit when adding a view.
- Preserve unknowns and conflicts; do not force a tidy diagram.

## Primary views

| View | Question | Primary containment | Example relation families |
|------|----------|---------------------|---------------------------|
| Capability | What business capabilities exist? | capability | supports, depends-on, implements |
| Application | How do applications communicate? | logical-application | calls, publishes, consumes, routes-to |
| Physical | What infrastructure implements this? | platform | implements, hosts, network, storage |
| Data | Where does data move? | data-domain | creates, reads, writes, transforms |
| Ownership | Who owns what? | team | owns, shared-ownership |
| Security | How does trust flow? | trust | public-ingress, allowed, blocked, protects |
| Risk | What is most likely to fail? | risk-domain | causes, amplifies, mitigates |
| Cost | Where is money spent? | cost-domain | consumes-cost, unused, duplicated |
| Time | How has the architecture evolved? | review-period | introduced, removed, drifted |
| Governance | Is this architecture acceptable? | review | validated, violated, approved, waived |
| Decision | What decisions shape the architecture? | review | validated, violated (+ decision edges) |

Supporting / legacy contracted views also exist (`executive`, `architecture`, `platform`, `network`, `evidence`, `drift`, `signoff`, `dna`) so nothing is ad-hoc.

## Containment vs metadata

**Containment** drives nesting and primary layout (for example trust zones left-to-right in Security). **Secondary metadata** (technology, environment, platform) may filter or badge nodes but must not redefine the view’s grouping model.

## Security zone order

The Security projection uses a stable trust-zone flow (`SECURITY_ZONE_ORDER` in the contracts module): internet → public edge → application → data → external / controls. Layout is a presentation concern; zone membership still comes from evidence (`protected-by`, trust-zone kinds).

## Governance projections

Governance / Decision / Sign-off views surface `satisfies-contract`, `violates-contract`, `realizes-intent`, `depends-on-assumption`, and related edges. They answer acceptability and decision validity — not “pretty infra topology.”

## Preview notes

- Dense graphs are common on first run; contracts constrain meaning more than they guarantee sparse layouts.
- Cost and some temporal views need richer metadata or multiple bundles to be informative.
- Changing a contract is a product change: update tests in `contracts.test.ts` and docs together.
