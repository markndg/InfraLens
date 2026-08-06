# Reference estates

InfraLens ships small, synthetic **reference estates** under `fixtures/` so scanners, projections, and governance can be exercised without cloud credentials. Use them for demos, regression tests, and onboarding — not as production templates.

Scan any estate:

```bash
npm run scan -- ./fixtures/demo-estate --output /tmp/demo.bundle.json
# or regenerate all via
npm run demo:scan:all
```

## Retail SaaS (`fixtures/demo-estate`)

**Primary demo estate** used by `npm run demo` and `npm run demo:scan`.

| Aspect | Contents |
|--------|----------|
| Infra | Terraform VPC/network and managed data plane (`infra/main.tf`) |
| Deploy | OpenShift-flavoured manifests (`deploy/openshift.yaml`) |
| Apps | Storefront `package.json`, catalogue Spring/`/.env` |
| Compose | Local compose file for app-shaped wiring |
| Inventories | `.infralens/aws-inventory.json`, `cluster-inventory.json` |
| ADRs | PostgreSQL, OpenShift deploy, event-driven orders |

**What it proves:** Intent vs reality (HA / Multi-AZ), ADR impact, application + security projections, graph-only simulation, blocked approval. Walkthrough: [demo/walkthrough.md](../demo/walkthrough.md).

## Serverless AWS (`fixtures/serverless-aws`)

| Aspect | Contents |
|--------|----------|
| Infra | Terraform for API Gateway / Lambda / DynamoDB / SQS-style checkout |
| Inventory | `.infralens/aws-inventory.json` |
| ADR | Serverless checkout with PITR consequence |

**What it proves:** Event-driven / serverless topology, AWS snapshot reconciliation, ADR consequence around DynamoDB point-in-time recovery. Good contrast to the hybrid Retail SaaS estate.

## Kubernetes microservices (`fixtures/k8s-microservices`)

| Aspect | Contents |
|--------|----------|
| Deploy | Multi-service Kubernetes manifests (`deploy/manifests.yaml`) |

**What it proves:** Workload/service/ingress (and related) discovery without Terraform, application communication edges, cluster-native layout. Pair with a cluster inventory snapshot when testing observed vs declared.

## Legacy hybrid (`fixtures/legacy-hybrid`)

| Aspect | Contents |
|--------|----------|
| Infra | Terraform for legacy/batch-adjacent AWS resources |
| App | Batch-oriented `app/config.yaml` |
| Inventory | `.infralens/aws-inventory.json` |
| ADR | Nightly batch against ORDDB with Multi-AZ assumption |

**What it proves:** Mixed monolith/batch assumptions, partner/SFTP-style external edges, governance when resilience assumptions fail on older data planes.

## Using estates well

1. Prefer **synthetic** names, accounts, and ARNs (as shipped).
2. Compare scan output across estates with `npm run test:generality` / fixture tests rather than assuming one topology generalises.
3. When adding an estate, keep it structurally distinct (roadmap priority) and document the architectural question it answers.
4. Never replace fixture inventories with real account exports in git.

## Status

These fixtures are maintained for the **0.1.0** public preview. Shapes may grow; treat them as living examples. Capability coverage differs by estate — see [capability-matrix.md](../product/capability-matrix.md).
