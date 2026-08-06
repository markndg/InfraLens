# ADR-0001: Nightly batch against ORDDB

## Status

Accepted

## Context

Order settlement runs as a nightly batch against the Oracle ORDDB instance.

## Decision

Keep the monolith batch job on a dedicated EC2 host with SFTP partner ingest.

## Assumptions

- ORDDB remains Multi-AZ for settlement resilience.
- Partner SFTP endpoint stays under corporate control.

## Consequences

If Multi-AZ is disabled, settlement approval is invalid.
