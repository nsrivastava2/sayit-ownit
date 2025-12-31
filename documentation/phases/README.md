# Implementation Phases

## Git Branching Strategy

```
main (production-ready)
  │
  ├── phase-0-admin-auth      → merge to main when complete
  │
main (with Phase 0)
  │
  ├── phase-1-stocks          → merge to main when complete
  │
main (with Phase 0+1)
  │
  ├── phase-2a-price-tracking → merge to main when complete
  │
main (with Phase 0+1+2a)
  │
  └── ... and so on
```

## Workflow for Each Phase

### 1. Start Phase
```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create phase branch
git checkout -b phase-X-feature-name
```

### 2. Develop & Test
```bash
# Write tests first (TDD)
npm test

# Implement feature
# Run Playwright E2E tests
npm run e2e

# Commit frequently
git add .
git commit -m "feat: implement X"
```

### 3. Complete Phase
```bash
# Run full test suite
npm test
npm run e2e

# Push branch
git push origin phase-X-feature-name

# Create PR to main
gh pr create --base main --head phase-X-feature-name

# After review & tests pass, merge
gh pr merge --merge
```

### 4. Start Next Phase
```bash
# Get latest main (includes previous phase)
git checkout main
git pull origin main

# Create new branch from updated main
git checkout -b phase-X+1-next-feature
```

---

## Phase Overview

| Phase | Branch Name | Focus | Est. Time |
|-------|-------------|-------|-----------|
| 0 | `phase-0-admin-auth` | Admin authentication, domain setup | 1 day |
| 1 | `phase-1-stocks` | NSE stocks database | 1 day |
| 2a | `phase-2a-prices` | Daily price fetching | 1 day |
| 2b | `phase-2b-outcomes` | Target/SL detection | 1 day |
| 3a | `phase-3a-metrics` | Expert win rates | 1 day |
| 3b | `phase-3b-ranking` | Basic leaderboard | 1 day |
| 4 | `phase-4-profiles` | Enhanced expert pages | 1 day |
| 5a | `phase-5a-users` | User registration | 1 day |
| 5b | `phase-5b-following` | Follow experts | 1 day |
| 6 | `phase-6-simulation` | Portfolio simulator | 2 days |

---

## Phase Documents

- [Phase 0: Admin Authentication](./phase-0-foundation-security.md)
- [Phase 1: Stock Master Data](./phase-1-stock-master-data.md)
- [Phase 2a: Price Tracking](./phase-2a-price-tracking.md)
- [Phase 2b: Outcome Detection](./phase-2b-outcome-detection.md)
- [Phase 3a: Expert Metrics](./phase-3a-expert-metrics.md)
- [Phase 3b: Basic Ranking](./phase-3b-basic-ranking.md)
- [Phase 4: Enhanced Profiles](./phase-4-enhanced-profiles.md)
- [Phase 5a: User Authentication](./phase-5a-user-auth.md)
- [Phase 5b: Follow System](./phase-5b-follow-system.md)
- [Phase 6: Portfolio Simulation](./phase-6-portfolio-simulation.md)

---

## Testing Requirements

### Before Merging Any Phase

1. **Unit Tests Pass**
   ```bash
   npm test
   ```

2. **E2E Tests Pass**
   ```bash
   npm run e2e
   ```

3. **Website Fully Functional**
   - All existing pages load without errors
   - New features work as specified
   - No console errors

4. **Manual Smoke Test**
   - Dashboard loads
   - Recommendations page works
   - Expert pages work
   - Share pages work
   - (If admin) Add video works

---

## Rollback Plan

If a phase breaks production:

```bash
# Revert the merge commit
git revert -m 1 <merge-commit-hash>
git push origin main
```

No phase should require complex rollback - each is designed to be additive and backwards-compatible.
