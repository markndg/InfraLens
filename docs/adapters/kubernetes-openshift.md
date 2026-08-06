# Kubernetes and OpenShift adapters

**Adapter IDs:** `kubernetes` (`@infralens/discovery-kubernetes`), `openshift` (`@infralens/discovery-openshift`)

Both consume YAML (and YAML multi-docs) from the project tree. Cluster inventory snapshots are consumed via the scanner’s snapshot channel (see [aws.md](aws.md) for the parallel AWS pattern; cluster files live at `.infralens/cluster-inventory.json`).

## Kubernetes

### Supported kinds (representative)

Workload: Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod, DeploymentConfig  
Networking: Service, Ingress, Gateway, HTTPRoute, NetworkPolicy  
Config / identity: ConfigMap, Secret (as `secret-ref`), ServiceAccount, Role(Binding), ClusterRole(Binding)  
Other: PVC, HPA, PDB, …

Relations commonly emitted: service-to-workload (selectors), ingress-route / routes-to, configuration references, network policy allow/deny signals when present.

### Helm and Kustomize

The scanner does **not** execute Helm or Kustomize. Supply **rendered** manifests into the scan tree (CI render step, committed rendered output, or exported YAML). Status: requires local tool for unrendered charts/overlays; rendered YAML is Available.

## OpenShift

Detects OpenShift API groups / kinds such as:

- `Route`
- `DeploymentConfig`
- `BuildConfig`
- `ImageStream`
- `Template`

Emits routes, workloads, builds, and image-stream nodes with evidence pointing at the source manifests. Works alongside the Kubernetes adapter when both standard and OpenShift resources appear (for example Retail SaaS `deploy/openshift.yaml`).

## Live cluster discovery

Live access is **disabled by default**, requires credentials, and must remain read-only when enabled. For 0.1.0 reviews and CI, prefer inventory snapshots.

## Evidence and truth

Manifest resources are typically `declared` / `rendered`. Inventory-backed instances add `observed` layers for reconciliation and drift.

## Fixtures

- `fixtures/k8s-microservices/deploy/manifests.yaml`
- `fixtures/demo-estate/deploy/openshift.yaml`
- `fixtures/demo-estate/.infralens/cluster-inventory.json`

## Limits

Gateway API / NetworkPolicy depth varies with evidence present; mesh and shared-VPC reachability are incomplete. See [limitations.md](../product/limitations.md).
