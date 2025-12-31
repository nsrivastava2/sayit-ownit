# Phase 2b: Outcome Detection

## Overview
**Branch:** `phase-2b-outcomes`
**Goal:** Detect when recommendations hit target or stop-loss
**Dependencies:** Phase 2a (prices exist)
**Estimated Effort:** 1 day

---

## Scope

### In Scope
- Create `recommendation_outcomes` table
- Add status column to recommendations
- Detect TARGET_HIT, SL_HIT, EXPIRED
- Calculate return percentage
- Outcome badges on UI
- Filter by outcome

### Out of Scope (Later)
- XIRR calculations
- Expert metrics aggregation

---

## Database Changes

### Migration: `005_recommendation_outcomes.sql`
```sql
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
    outcome_type VARCHAR(50) NOT NULL,
    outcome_date DATE NOT NULL,
    outcome_price DECIMAL(15,2) NOT NULL,
    return_percentage DECIMAL(10,4),
    days_held INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_rec_outcome UNIQUE(recommendation_id)
);

ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
```

---

## Backend Implementation

### New Files
1. `backend/src/services/outcomeService.js` - Detection logic

### Logic
```javascript
// For each ACTIVE recommendation with latest price:
if (high_price >= target_price) → TARGET_HIT
else if (low_price <= stop_loss) → SL_HIT
else if (days_since_recommendation >= 90) → EXPIRED
else → Still ACTIVE
```

### API Changes
```
GET /api/recommendations?status=ACTIVE|CLOSED
GET /api/recommendations?outcome=TARGET_HIT|SL_HIT
```

---

## Frontend Changes

### Outcome Badge Component
```jsx
function OutcomeBadge({ outcome }) {
  const styles = {
    TARGET_HIT: 'bg-green-100 text-green-800',
    SL_HIT: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    ACTIVE: 'bg-blue-100 text-blue-800'
  };

  const labels = {
    TARGET_HIT: 'Target Hit',
    SL_HIT: 'SL Hit',
    EXPIRED: 'Expired',
    ACTIVE: 'Active'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${styles[outcome]}`}>
      {labels[outcome]}
    </span>
  );
}
```

### Add to Recommendations Table
- Outcome column with badge
- Return % column (only for closed)
- Filter dropdown for outcome type

---

## Test Cases

### Unit Tests
```javascript
describe('OutcomeService', () => {
  it('should detect TARGET_HIT when high >= target');
  it('should detect SL_HIT when low <= stop_loss');
  it('should detect EXPIRED after 90 days');
  it('should return null for active recommendations');
  it('should calculate return percentage correctly');
});
```

### E2E Tests
```javascript
test('outcome badges displayed on recommendations');
test('filter by TARGET_HIT shows only targets');
test('return percentage shown for closed recs');
```

---

## Logging
```
[OUTCOME:INFO] Checking {"id":"...","target":100,"high":105}
[OUTCOME:INFO] TARGET HIT {"id":"...","returnPct":"10.5%"}
[OUTCOME:ERROR] Detection failed {"id":"...","error":"..."}
```

---

## Acceptance Criteria
- [ ] recommendation_outcomes table created
- [ ] Outcomes detected correctly
- [ ] Return % calculated
- [ ] Badges display on UI
- [ ] Filter by outcome works
- [ ] Site still fully functional

---

## Commands

```bash
git checkout main && git pull
git checkout -b phase-2b-outcomes

# Run migration
psql -p 5433 -U sayitownit -d sayitownit -f database/migrations/005_recommendation_outcomes.sql

# Test
npm test -- --grep "OutcomeService"
npm run e2e -- --grep "outcome"

# Merge
gh pr create --base main
```
