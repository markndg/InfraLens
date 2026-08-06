# Capability and edition model

Single codebase. No fork. Typed capability registry in `@infralens/edition-capabilities`.

## Switch

```bash
INFRALENS_EDITION=oss
INFRALENS_EDITION=commercial
INFRALENS_FEATURE_LIVE_CLOUD_RECONCILIATION=true
INFRALENS_FEATURE_ARCHITECT_SIGN_OFF=false
```

## Matrix (summary)

| Capability | OSS | Commercial |
|---|---|---|
| repositoryScan | yes | yes |
| terraformEvaluation | yes | yes |
| renderedManifestAnalysis | yes | yes |
| localEvidenceGraph | yes | yes |
| basicPolicyEngine | yes | yes |
| staticReportExport | yes | yes |
| architectureNarrative | yes | yes |
| blastRadiusAnalysis | yes | yes |
| liveCloudReconciliation | no | yes |
| liveClusterReconciliation | no | yes |
| effectiveNetworkAnalysis | no | yes |
| iamAnalysis | no | yes |
| historicalDrift | no | yes |
| organisationPolicyPacks | no | yes |
| waiverWorkflow | no | yes |
| architectSignOff | no | yes |
| multiProjectEstate | no | yes |
| ciEnforcement | no | yes |
| teamCollaboration | no | yes |
| counterfactualSimulation | no | yes |

Commercial-only API routes return HTTP 403 `capability_denied` when disabled.
