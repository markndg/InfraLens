# Demonstration walkthrough — InfraLens v2.0

Estate: `fixtures/demo-estate` with ADRs under `docs/adr/`.

InfraLens is an **Architecture Governance Platform**. Review, evidence graph and architecture intelligence are infrastructure; governance is the product.

## Quarterly architecture board script

1. `INFRALENS_EDITION=commercial npm run dev`
2. Landing: **Architecture Governance** — health, invalid ADRs, broken assumptions, intent drift, obligations.
3. Coach notes: HA objective invalidated, ADR-0001 violated, review Security before Approval.
4. **Open decision graph** — Capability → Decision (PostgreSQL) → Intent (HA) → Implementation (RDS) → Review outcome.
5. Simulate assumption failure: **Database resilient is false** → capability degraded → ADR invalidated → approval revoked.
6. **Start architecture review** — walk Availability / Security / Recommendations / Approval.
7. Commercial: **Replay historical review** against approved baseline evidence only.
8. Scroll executive **Governance report** sections (intent, decisions, assumptions, contracts, recommendations).
9. Evidence explorer for source/ADR/finding lineage.

## OSS vs commercial

| Capability | OSS | Commercial |
|---|---|---|
| Governance graph (single project) | ✓ | ✓ |
| ADR parse + intent/assumption/contract engines | ✓ | ✓ |
| Decision graph + governance report | ✓ | ✓ |
| Local review history | ✓ | ✓ |
| Review replay / portfolio / org graph | — | ✓ |
| Collaborative governance analytics | — | ✓ |
