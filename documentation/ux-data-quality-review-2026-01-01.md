# SayIt OwnIt - UX & Data Quality Review

**Review Date**: January 1, 2026
**Reviewed By**: AI Product Review (Claude)
**Site URL**: https://sayitownit.com/
**Review Method**: API analysis (React SPA)

---

## Executive Summary

The platform tracks stock market recommendations from TV experts. This review identified **significant data quality issues, expert name inconsistencies, and illogical data** that would confuse users and erode trust.

| Priority | Issues Found |
|----------|--------------|
| Critical (P0) | 4 |
| High (P1) | 4 |
| Medium (P2) | 3 |

---

## CRITICAL Issues (P0) - Must Fix Immediately

### 1. Illogical Price Data - Glenmark Pharma

| Field | Value | Problem |
|-------|-------|---------|
| Share | Glenmark Pharma (GLENMARK) | |
| Expert | Kavita | |
| Action | BUY | |
| Target Price | ₹2,080 | |
| Stop Loss | ₹208 | **WRONG! 10x lower than it should be** |

**Root Cause**: Data extraction error - likely dropped a zero or misplaced decimal.

**Expected Stop Loss**: ~₹1,980-2,000 (for a BUY with target ₹2,080)

**User Impact**: If someone follows this stop loss, they'd hold until the stock drops 90%. This is dangerous financial misinformation.

**Fix**: Review source video timestamp 1:03:15, correct to actual stop loss mentioned.

---

### 2. SELL Recommendation Logic Inverted - Eicher Motors

| Field | Value | Problem |
|-------|-------|---------|
| Share | Eicher Motors (EICHERMOT) | |
| Expert | Rajesh Satpute | |
| Action | SELL | |
| Target Price | ₹7,000 | |
| Stop Loss | ₹7,240 | **Stop loss ABOVE target!** |

**Root Cause**: For a SELL position, stop loss should be ABOVE current price (exit if stock rises against you). But target should be BELOW current price (where you take profit). Here, stop_loss > target_price which is backwards.

**User Impact**: Users can't make sense of when to exit this trade.

**Fix**: Review source video, verify if this is a short-sell or if prices are swapped.

---

### 3. Test/Irrelevant Video in Production

| Field | Value |
|-------|-------|
| Video ID | 27fd38e5-54a5-461d-9060-66eef70a8e1d |
| Title | "Web Development 2018 - The Must-Know Tech" |
| Channel | LearnCode.academy |
| Date | March 12, 2018 |

**Root Cause**: Test data that was never cleaned up during development.

**User Impact**: Degrades trust in the platform's data quality. If users see a programming tutorial mixed with stock recommendations, they'll question all data.

**Fix**: DELETE this video from the database:
```sql
DELETE FROM videos WHERE id = '27fd38e5-54a5-461d-9060-66eef70a8e1d';
```

---

### 4. Unknown Expert Attribution Error

| Field | Value |
|-------|-------|
| Current Expert | "Unknown Expert" |
| Share | Trent (TRENT) |
| Video Title | "Anil Singhvi's New Year Pick 2026 \| Why Trent Could Be the Next Big Winner" |

**Root Cause**: AI extraction failed to identify the expert from the video, despite the expert's name being IN THE VIDEO TITLE.

**User Impact**: Users searching for Anil Singhvi's recommendations will miss this one. His stats show 6 recommendations but should show 7.

**Fix**: Update the recommendation:
```sql
UPDATE recommendations
SET expert_name = 'Anil Singhvi'
WHERE id = '748f7cb4-b6e6-4ec8-9498-b206b0dc7531';
```

---

## HIGH Issues (P1) - Fix This Week

### 5. Expert Name Duplicates & Typos

The system shows 17 unique experts, but after deduplication there should be approximately 10.

| Likely Same Person | Current Entries | Recommendation Count | Should Be |
|-------------------|-----------------|---------------------|-----------|
| Amit Seth | "Amit Seth", "Amit" | 6 + 1 = 7 | Amit Seth (7) |
| Kavita Jain | "Kavita Jain", "Kavita" | 2 + 1 = 3 | Kavita Jain (3) |
| Manas Jaiswal | "Manas Jaiswal", "Manas" | 1 + 1 = 2 | Manas Jaiswal (2) |
| Siddharth Sedani | "Siddharth Sedani", "Siddharth Sidani", "Siddharth Soni" | 3 + 1 + 1 = 5 | Siddharth Sedani (5) |

**Other Problematic Expert Names:**

| Name | Problem | Suggested Fix |
|------|---------|---------------|
| `"Dealers (via Yatin)"` | Awkward format, not a person | Change to "Yatin" or remove |
| `"Morgan Stanley"` | Institution, not a person | Flag as institutional, not expert |
| `"Gavaskar"` | Incomplete name | Find full name from video |
| `"Unknown Expert"` | Should never exist | Review and assign proper expert |

**Raw Extract Evidence**: One recommendation shows `"Sigmi"` in raw_extract but is attributed to "Anil Singhvi" - this is likely a mishearing of "Singhvi" by the transcription.

**Fix**: Create expert aliases:
```sql
INSERT INTO expert_aliases (expert_id, alias) VALUES
((SELECT id FROM experts WHERE name = 'Amit Seth'), 'Amit'),
((SELECT id FROM experts WHERE name = 'Kavita Jain'), 'Kavita'),
((SELECT id FROM experts WHERE name = 'Manas Jaiswal'), 'Manas'),
((SELECT id FROM experts WHERE name = 'Siddharth Sedani'), 'Siddharth Sidani'),
((SELECT id FROM experts WHERE name = 'Siddharth Sedani'), 'Siddharth Soni');
```

---

### 6. Share Name Duplicates

| NSE Symbol | Entry 1 | Entry 2 |
|------------|---------|---------|
| KPIL | "Kalpataru Projects" | "Kalpataru Projects International" |

Both have the same NSE symbol but are stored as different shares.

**User Impact**: Stock performance tracking is split across two entries.

**Fix**: Normalize to canonical name from NSE master data.

---

### 7. NaN Values in API Responses

The API returns literal "NaN" strings instead of null or calculated values:

```json
{
  "avgConfidence": "NaN",
  "avgTargetPrice": "NaN"
}
```

**Root Cause**: JavaScript `NaN` being serialized to JSON when there's no data to calculate averages.

**User Impact**: UI may display "NaN" literally if not handled.

**Fix**: In backend, check for NaN before returning:
```javascript
avgConfidence: isNaN(avg) ? null : avg
```

---

### 8. Channel Name Inconsistency

| Channel | Issue |
|---------|-------|
| `"CNBC Awaaz."` | Has trailing period |
| `"Zee Business"` | Correct |

**Fix**: Normalize channel names on insert.

---

## MEDIUM Issues (P2) - Fix This Month

### 9. Missing Outcome Tracking

**Current State**: 32 of 35 recommendations (91%) have no outcome data:

```json
"outcome": {
  "outcome_type": null,
  "outcome_date": null,
  "outcome_price": null,
  "return_percentage": null,
  "days_held": null
}
```

**The 3 recommendations with outcomes all show problems:**

| Share | Target | Outcome Price | Shown Return | Actual Return |
|-------|--------|---------------|--------------|---------------|
| Asian Paints | ₹3,300 | ₹2,769 | 0% | -16% (LOSS) |
| IndiGo | ₹6,500 | ₹5,059 | 0% | -22% (LOSS) |
| HPCL | ₹600 | ₹499 | 0% | -17% (LOSS) |

**Problems**:
1. `return_percentage` shows 0% for failures instead of actual negative returns
2. No recommendations show successful outcomes

**User Impact**: Users cannot evaluate expert accuracy - the core value proposition of the platform.

---

### 10. Missing Price Data

Many recommendations have `null` values for critical fields:

| Field | Missing Count | % Missing |
|-------|---------------|-----------|
| recommended_price | 15 | 43% |
| stop_loss | 15 | 43% |
| target_price | 5 | 14% |

**Examples with missing data:**
- Deepak Fertilizers: No recommended_price
- PNB Housing: No recommended_price
- ONGC: No target_price

**User Impact**: Users don't know at what price to enter or what stop loss to set.

---

### 11. Null timestamp_formatted

One recommendation shows:
```json
"timestamp_formatted": null
```

For the Trent recommendation (timestamp_in_video = 0).

**Expected**: Should show "0:00" or omit the field entirely.

---

## User Questions the Platform Cannot Answer

| Question | Can Answer? | Blocker |
|----------|-------------|---------|
| "Which expert has the best track record?" | ❌ No | No success rate calculated |
| "Did Anil Singhvi's picks make money?" | ❌ Partial | 3/6 have outcomes, all show 0% return |
| "Should I trust this stop loss of ₹208?" | ❌ No | No validation of price logic |
| "Is Amit the same as Amit Seth?" | ❌ No | No deduplication |
| "What's the current price vs recommended?" | ❌ No | No live price integration |
| "How many days has this recommendation been active?" | ❌ Partial | Status is ACTIVE but no age shown |
| "What's the overall hit rate of this platform?" | ❌ No | No aggregate success metrics |

---

## Data Summary

| Metric | Value | Issue |
|--------|-------|-------|
| Total Videos | 11 | 1 is test data |
| Total Recommendations | 35 | - |
| Unique Experts | 17 | Should be ~10 after dedup |
| Unique Shares | 32 | 1 duplicate (KPIL) |
| Recommendations with outcomes | 3 (8.5%) | Too low |
| Recommendations with stop_loss | 20 (57%) | 43% missing |
| Recommendations with target_price | 30 (86%) | 14% missing |
| Recommendations with recommended_price | 20 (57%) | 43% missing |

---

## Recommendations

### Immediate Actions (This Week)

| # | Action | Effort |
|---|--------|--------|
| 1 | Fix Glenmark stop loss: ₹208 → ~₹1,980 | 5 min |
| 2 | Delete test video "Web Development 2018" | 5 min |
| 3 | Fix Unknown Expert → Anil Singhvi for Trent | 5 min |
| 4 | Review Eicher Motors SELL logic | 15 min |

### Short Term (This Month)

| # | Action | Effort |
|---|--------|--------|
| 5 | Create expert alias mappings for duplicates | 2 hrs |
| 6 | Normalize share names using NSE master | 2 hrs |
| 7 | Fix NaN display in API responses | 1 hr |
| 8 | Add validation: stop_loss within 20% of target | 2 hrs |

### Medium Term (This Quarter)

| # | Action | Effort |
|---|--------|--------|
| 9 | Implement outcome tracking with live prices | 1 week |
| 10 | Add expert leaderboard with success rates | 3 days |
| 11 | Add data validation queue for suspicious extractions | 1 week |

---

## Appendix: Raw Data Samples

### Glenmark Pharma (Problematic)
```json
{
  "expert_name": "Kavita",
  "share_name": "Glenmark Pharma",
  "nse_symbol": "GLENMARK",
  "action": "BUY",
  "recommended_price": null,
  "target_price": "2080.00",
  "stop_loss": "208.00",
  "confidence_score": "0.50",
  "timestamp_in_video": "3795"
}
```

### Unknown Expert (Should be Anil Singhvi)
```json
{
  "expert_name": "Unknown Expert",
  "share_name": "Trent",
  "nse_symbol": "TRENT",
  "video_title": "Anil Singhvi's New Year Pick 2026 | Why Trent Could Be the Next Big Winner"
}
```

### Test Video (Should be deleted)
```json
{
  "id": "27fd38e5-54a5-461d-9060-66eef70a8e1d",
  "title": "Web Development 2018 - The Must-Know Tech",
  "channel_name": "LearnCode.academy",
  "publish_date": "2018-03-12"
}
```

---

## Conclusion

The SayIt OwnIt platform has a solid concept but suffers from **data quality issues that undermine user trust**. The most critical gaps are:

1. **Price validation** - Illogical values slip through
2. **Expert deduplication** - Same person tracked as multiple entities
3. **Outcome tracking** - Users can't evaluate expert performance

Addressing the P0 issues should take less than an hour. The P1 issues require a few days of focused work. Once data quality is improved, the platform will deliver on its core value proposition of tracking and evaluating TV stock recommendations.
