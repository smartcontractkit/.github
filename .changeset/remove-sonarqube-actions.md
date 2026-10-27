---
---

Remove the `ci-sonarqube-go` and `ci-sonarqube-ts` actions. SonarQube is being sunset (DX-5526) and no workflow in the org uses them anymore. Existing `ci-sonarqube-go/*` and `ci-sonarqube-ts/*` tags are left in place.
