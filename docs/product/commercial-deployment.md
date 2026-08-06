# Commercial deployment architecture

- `INFRALENS_EDITION=commercial`
- API enforces commercial capabilities
- Persist scans/findings/waivers/sign-offs in PostgreSQL
- Optional scheduled read-only inventory jobs with credential references
- SSO/RBAC at the API edge
- Evidence retention policies and audit export
