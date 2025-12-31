# Phase 6: Portfolio Simulation

## Overview
**Branch:** `phase-6-simulation`
**Goal:** "What if I invested ₹1 lakh following Expert X?"
**Dependencies:** Phase 2b
**Estimated Effort:** 2 days

---

## Scope

- Simulation engine
- XIRR calculation
- Simulation results storage
- Portfolio simulator UI tab

---

## Simulation Parameters

```
Input:
- Expert ID
- Initial Capital (₹)
- Start Date
- End Date
- Position Size per recommendation

Output:
- Final Portfolio Value
- Total Return %
- XIRR (annualized)
- Win Rate
- Max Drawdown
- Trade Log
```

---

## XIRR Implementation

Newton-Raphson method to solve:
```
NPV = Σ(Cash_Flow_i / (1 + rate)^years_i) = 0
```

---

## Frontend

### Portfolio Simulator Tab on Expert Profile
```
┌─────────────────────────────────────────┐
│ PORTFOLIO SIMULATION                    │
├─────────────────────────────────────────┤
│ Initial Capital:  ₹ [1,00,000]          │
│ Start Date:       [01-Jan-2024]         │
│ End Date:         [Today]               │
│ Position Size:    ₹ [50,000]            │
│                                          │
│ [Run Simulation]                         │
├─────────────────────────────────────────┤
│ RESULTS                                  │
│                                          │
│ Final Value:   ₹1,28,400                │
│ Total Return:  +28.4%                   │
│ XIRR:          +31.2%                   │
│ Win Rate:      68%                      │
│                                          │
│ [View Trade Log] [Export]               │
└─────────────────────────────────────────┘
```

---

## Acceptance Criteria
- [ ] Simulation engine works
- [ ] XIRR calculated correctly
- [ ] UI displays results
- [ ] Trade log exportable
- [ ] Site still fully functional
