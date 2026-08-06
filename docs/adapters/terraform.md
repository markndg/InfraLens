# Terraform adapter

**Adapter ID:** `terraform` (`@infralens/discovery-terraform`)

## Supported inputs

| Input | Status |
|-------|--------|
| `.tf` files | Available — bounded HCL block extractor |
| `.tf.json` | Available |
| Plan / state JSON snapshots | Snapshot import (preferred for fidelity) |
| Full module / expression resolution | Partial / planned without plan/state |

`supports` is true when Terraform files exist or a plan snapshot is provided.

## Behaviour

- Parses resources and key attributes into typed `ResourceNode`s (for example VPC, subnet, security group, load balancer, relational database, bucket, queue, IAM role).
- Applies secret redaction on attribute values before persistence.
- Ingests plan/state snapshots with truth states such as `planned` / `evaluated`.
- Records unsupported or failed files as warnings / unsupported constructs rather than failing the scan.

## Improving fidelity

```bash
terraform show -json tfplan > plan.json
# pass plan/state into scanPath options (terraformPlanPath / terraformStatePath)
# or place evaluated JSON where your scan pipeline loads snapshots
```

Without plan/state, complex modules, dynamic blocks, and expressions may be incomplete or marked unknown. This is an intentional preview limitation — see [capability-matrix.md](../product/capability-matrix.md).

## Evidence

Each resource carries evidence with `adapter: terraform`, source URI (file path or snapshot), and an appropriate truth state (`declared` for HCL/JSON files).

## Security notes

- No Terraform provider plugin execution inside the scanner.
- Prefer plan JSON produced in your own CI over trusting arbitrary remote state URLs in-process.
- See [scanner-security.md](../architecture/scanner-security.md).

## Fixtures

- `fixtures/demo-estate/infra/main.tf`
- `fixtures/serverless-aws/infra/main.tf`
- `fixtures/legacy-hybrid/infra/main.tf`
