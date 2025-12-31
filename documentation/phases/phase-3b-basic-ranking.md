# Phase 3b: Basic Ranking

## Overview
**Branch:** `phase-3b-ranking`
**Goal:** Rank experts and create leaderboard
**Dependencies:** Phase 3a (metrics exist)
**Estimated Effort:** 1 day

---

## Scope

### In Scope
- Simple ranking algorithm
- Add rank to expert_metrics
- Leaderboard page
- "Rank #X" badge on profiles

### Out of Scope (Later)
- Advanced 5-component algorithm
- Ranking history tracking
- Tier badges (Elite, Good, etc.)

---

## Ranking Algorithm (Simplified)

```
Ranking_Score =
  (0.50 × Win_Rate) +
  (0.30 × Avg_Return_Normalized) +
  (0.20 × Volume_Score)

Volume_Score = MIN(100, total_recommendations × 2)
Avg_Return_Normalized = MIN(100, avg_return_pct × 4)
```

---

## Database Changes

### Add to expert_metrics
```sql
ALTER TABLE expert_metrics ADD COLUMN ranking_score DECIMAL(10,4);
ALTER TABLE expert_metrics ADD COLUMN rank_position INT;
```

---

## Frontend Changes

### New Page: `/experts/rankings`
```
Expert Leaderboard
─────────────────────────────────────────────
Rank │ Expert        │ Win Rate │ Avg Return
─────────────────────────────────────────────
#1   │ Rajesh P.     │ 72%      │ +14.2%
#2   │ Anil S.       │ 68%      │ +12.8%
#3   │ ...           │ ...      │ ...
```

### Expert Profile Badge
```
Ashish Chaturvedi  Rank #12
```

---

## Test Cases

```javascript
it('should rank higher win rate above lower');
it('should consider volume in ranking');
it('should update rank daily');
```

---

## Acceptance Criteria
- [ ] Ranking calculated correctly
- [ ] Leaderboard page works
- [ ] Rank displayed on profiles
- [ ] Site still fully functional
