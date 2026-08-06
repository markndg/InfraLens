# AWS adapter (snapshot)

**Adapter ID:** `aws-snapshot` (`@infralens/discovery-aws`)

Snapshot-backed AWS discovery. **Live SDK calls are not performed from the browser.** Live mode, when enabled in the scanner path, still requires an explicit credential reference and remains read-only by design.

## Providing an inventory

Place a JSON snapshot at:

```text
.infralens/aws-inventory.json
```

The scanner auto-loads this path when present (`scanPath`). You can also pass `awsSnapshotPath` into `scanPath` options.

### Shape (conceptual)

```json
{
  "observedAt": "2026-08-06T00:00:00.000Z",
  "account": "123456789012",
  "region": "eu-west-1",
  "resources": [
    {
      "type": "AWS::RDS::DBInstance",
      "id": "orders-db",
      "name": "orders-db",
      "arn": "arn:aws:rds:eu-west-1:123456789012:db:orders-db",
      "region": "eu-west-1",
      "account": "123456789012",
      "tags": { "Environment": "production" },
      "attributes": { "multiAz": false, "storageEncrypted": true }
    }
  ]
}
```

Mapped CloudFormation-style types include S3 buckets, RDS instances, SQS queues, security groups, VPC/subnet, ALB, IAM roles, Route53 records (unknown types become `kind: unknown`).

## Truth state

Inventory resources are typically **observed**, enabling reconciliation against Terraform **declared** / **planned** resources and drift detection.

## Live mode

If `includeLive` is set without `credentialRef`, the adapter records an error and continues with snapshot import only. Capability status: **requires credentials** when live; **snapshot import** otherwise.

## Security

- Use synthetic accounts/ARNs in git fixtures.
- Never commit real credentials or production inventories.
- Least-privilege read-only IAM if you enable live discovery later.
- See [scanner-security.md](../architecture/scanner-security.md).

## Fixtures

- `fixtures/demo-estate/.infralens/aws-inventory.json`
- `fixtures/serverless-aws/.infralens/aws-inventory.json`
- `fixtures/legacy-hybrid/.infralens/aws-inventory.json`
