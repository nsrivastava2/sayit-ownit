# Phase 5a: User Authentication

## Overview
**Branch:** `phase-5a-users`
**Goal:** User registration and login
**Dependencies:** Phase 3b
**Estimated Effort:** 1 day

---

## Scope

- Users table
- Registration page
- Login page
- JWT-based auth
- User profile page

---

## Database Changes

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

---

## API Endpoints

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

---

## Acceptance Criteria
- [ ] User can register
- [ ] User can login
- [ ] Session persists
- [ ] User can logout
- [ ] Site still fully functional
