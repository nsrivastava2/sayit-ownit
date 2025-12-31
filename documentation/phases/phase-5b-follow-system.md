# Phase 5b: Follow System

## Overview
**Branch:** `phase-5b-following`
**Goal:** Users can follow experts
**Dependencies:** Phase 5a
**Estimated Effort:** 1 day

---

## Scope

- user_expert_following table
- Follow/unfollow buttons
- "My Followed Experts" page
- Feed of followed experts' recommendations

---

## Database Changes

```sql
CREATE TABLE user_expert_following (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expert_id UUID REFERENCES experts(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, expert_id)
);
```

---

## API Endpoints

```
POST   /api/users/follow/:expertId
DELETE /api/users/unfollow/:expertId
GET    /api/users/following
GET    /api/users/feed
```

---

## Acceptance Criteria
- [ ] User can follow expert
- [ ] User can unfollow
- [ ] Following list displayed
- [ ] Feed shows followed experts' recs
- [ ] Site still fully functional
