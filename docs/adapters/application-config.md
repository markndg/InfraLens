# Application config adapter

**Adapter ID:** `app-config` (`@infralens/discovery-app-config`)

Discovers application-shaped nodes and configuration-reference edges from common app manifests — bridging “what infra declares” and “what software expects to call.”

## Matched files

Rough patterns (see adapter `supports` for the authoritative list):

- `.env`
- Spring-style `application.yaml` / `.yml` / `.properties` / `.toml`
- `package.json`
- `docker-compose` files
- `config.ts` / `config.js` / `config.json`
- `settings.py` / `settings.toml`
- YAML env blocks inside deployment manifests (re-scanned for refs)

## What it emits

| Signal | Example |
|--------|---------|
| Application nodes | From `package.json` name, scripts, dependency-derived tech stack |
| Config / dependency edges | Host/URL/URI/endpoint/bucket/queue/DB-style keys |
| Compose services | Service topology hints from Compose files |
| Framework hints | Spring datasource URLs, JS framework roles |

Reference keys matching patterns such as `HOST`, `URL`, `URI`, `ENDPOINT`, `BUCKET`, `QUEUE`, `DB_`, `JDBC`, `REDIS`, `BROKER`, `DSN`, `CONNECTION` are treated as dependency candidates. Values are redacted when secret-shaped.

## Truth and confidence

Most app-config evidence is `declared` with moderate-to-high confidence when the file is explicit. Edges inferred only from naming may be weaker — treat **source-derived service dependencies** as experimental completeness ([capability-matrix.md](../product/capability-matrix.md)).

## Limits (preview)

- Implicit runtime wiring that never appears in files will be missing.
- Dynamic config servers / remote feature flags are out of scope unless materialised on disk.
- Same hostname strings across environments need human review of truth state and URIs.

## Fixtures

- `fixtures/demo-estate/apps/storefront/package.json`
- `fixtures/demo-estate/apps/catalog/.env` and `application.yaml`
- `fixtures/demo-estate/docker-compose.yml`
- `fixtures/legacy-hybrid/app/config.yaml`

## Related

- [Scanning a project](../guides/scanning-a-project.md)
- [Adapter contract](adapter-contract.md)
