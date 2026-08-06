# InfraLens 30-second demonstration storyboard

Deterministic walkthrough for Retail SaaS (no production changes).

1. Open Architecture Governance (Review mode).
2. Observe architecture status: not ready / non-compliant.
3. Select the high-availability (production resilience) intent.
4. Show the failed assumption linked to `retail-prod-db`.
5. Open the database node; reveal evidence `multi_az = false`.
6. Show finding + ADR / assumption impact.
7. Confirm approval blocked / sign-off invalid.
8. Run graph-only simulation enabling Multi-AZ.
9. Observe finding resolve and readiness change.

Manual media (optional): record the Playwright flow as GIF/WebM locally.
Do not commit large binaries unless optimized and reviewed.

Assets:
- Hero: docs/assets/infralens-hero.svg
- Screenshots (when capture runs): docs/assets/demo/*.png
