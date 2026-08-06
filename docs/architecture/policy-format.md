# Policy format

Declarative YAML policies evaluated by `@infralens/policy-engine`.

```yaml
id: PROD-DATA-004
title: Production relational databases must be resilient
scope:
  environment: production
  kinds: [relational-database]
condition:
  any:
    - field: metadata.multi_az
      equals: false
severity: high
rationale: ...
remediation: ...
signoff:
  blocksApproval: true
```

Default packs cover availability, exposure, encryption, latest tags, replicas, ownership, egress, security groups and drift-linked findings.
