# Runbook: Branch Protection (§24.4, work item 7)

> GitHub settings that enforce the supply-chain rules. Configure on the GitHub
> repository (Settings → Branches / Rules). Code-level CI lives in
> `.github/workflows/ci.yml`.

## Protected branch: `main` (the deploy branch)

- [ ] Require a pull request before merging; **require ≥1 approving review**.
- [ ] Dismiss stale approvals on new commits.
- [ ] **Require status checks to pass** before merging, and require branches to
      be up to date. Required check contexts (job names from `ci.yml`):
  - `lint / typecheck / test / build`
  - `secret-scan`
  - `sast`
  - `license-scan`
- [ ] Require conversation resolution before merging.
- [ ] Do not allow force pushes or deletions on `main`.
- [ ] **Production deploys only from `main`** (set in Vercel: Production branch
      = `main`; disable production deploys from other branches).

## Repository security settings

- [ ] Enable **secret scanning** + push protection (GitHub Advanced Security or
      the free secret scanning for public repos). CI also runs Gitleaks.
- [ ] Enable **Dependabot** alerts + security updates (config:
      `.github/dependabot.yml`).
- [ ] Add a **CODEOWNERS** review requirement (`.github/CODEOWNERS`).
