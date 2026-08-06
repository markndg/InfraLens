# Scanner security model

Execution uses allowlisted local operations only. No arbitrary provider plugin execution in v1.2.

Snapshots are JSON-parsed with structural validation. Terraform HCL uses a bounded block extractor; prefer `terraform show -json` for canonical evaluation.

UI labels are rendered as text; SVG icons are local constants, not fetched remotely per scan.
