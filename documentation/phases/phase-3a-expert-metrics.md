# Phase 3a: Expert Metrics

## Overview
**Branch:** `phase-3a-metrics`
**Goal:** Calculate and store expert performance metrics
**Dependencies:** Phase 2b (outcomes exist)
**Estimated Effort:** 1 day

---

## Scope

### In Scope
- Create `expert_metrics` table
- Calculate win rate, avg return, avg days
- Daily metrics recalculation job
- Display metrics on expert profile

### Out of Scope (Phase 3b)
- Ranking algorithm
- Leaderboard page

---

## Database Changes

### Migration: `006_expert_metrics.sql`
```sql
CREATE TABLE IF NOT EXISTS expert_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID REFERENCES experts(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL,

    -- Counts
    total_recommendations INT DEFAULT 0,
    active_count INT DEFAULT 0,
    target_hit_count INT DEFAULT 0,
    sl_hit_count INT DEFAULT 0,
    expired_count INT DEFAULT 0,

    -- Rates
    win_rate DECIMAL(5,2),           -- % target hits
    avg_return_pct DECIMAL(10,4),
    avg_days_held DECIMAL(10,2),

    -- Calculated at
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_expert_date UNIQUE(expert_id, calculation_date)
);

CREATE INDEX idx_expert_metrics_expert ON expert_metrics(expert_id);
CREATE INDEX idx_expert_metrics_date ON expert_metrics(calculation_date);
```

---

## Backend Implementation

### New Service: `metricsService.js`
```javascript
async function calculateExpertMetrics(expertId) {
  // Query all recommendations
  // Calculate:
  //   - win_rate = target_hits / (target_hits + sl_hits)
  //   - avg_return_pct = AVG(return_percentage)
  //   - avg_days_held = AVG(days_held)
  // Store in expert_metrics
}

async function recalculateAllMetrics() {
  // For each expert, calculate and store metrics
  // Run daily after outcome detection
}
```

---

## Frontend Changes

### Expert Profile Stats Card
```
┌──────────────┬──────────────┬──────────────┐
│ Win Rate     │ Avg Return   │ Avg Days     │
│   64.2%      │   +12.8%     │   18 days    │
└──────────────┴──────────────┴──────────────┘
```

---

## Test Cases

### Unit Tests
```javascript
it('should calculate win rate correctly');
it('should calculate average return');
it('should handle expert with no closed recs');
```

### E2E Tests
```javascript
test('expert profile shows metrics');
test('metrics update after new outcome');
```

---

## Acceptance Criteria
- [ ] expert_metrics table created
- [ ] Metrics calculated correctly
- [ ] Daily recalculation works
- [ ] Metrics displayed on expert page
- [ ] Site still fully functional
