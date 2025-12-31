# Phase 4: Enhanced Expert Profiles

## Overview
**Branch:** `phase-4-profiles`
**Goal:** Rich expert profile pages with bio, charts, history
**Dependencies:** Phase 3b
**Estimated Effort:** 1 day

---

## Scope

- Add bio, image, social links to experts
- Performance trend chart
- Recommendation history table
- Sector breakdown

---

## Database Changes

```sql
ALTER TABLE experts ADD COLUMN bio TEXT;
ALTER TABLE experts ADD COLUMN profile_image_url VARCHAR(500);
ALTER TABLE experts ADD COLUMN youtube_channel VARCHAR(500);
ALTER TABLE experts ADD COLUMN twitter_handle VARCHAR(100);
ALTER TABLE experts ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
```

---

## Frontend Additions

1. Profile header with image and bio
2. Social links (YouTube, Twitter)
3. Win rate trend chart (last 6 months)
4. Full recommendation history with filters
5. Sector performance breakdown

---

## Acceptance Criteria
- [ ] Expert profile enhanced
- [ ] Charts render correctly
- [ ] History table with export
- [ ] Site still fully functional
