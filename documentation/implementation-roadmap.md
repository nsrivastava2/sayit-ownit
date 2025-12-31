# SayItOwnIt - Implementation Roadmap

## Current State vs Requirements Analysis

### Current Database Schema (What We Have)
| Table | Status | Notes |
|-------|--------|-------|
| `videos` | ✅ Exists | Basic video metadata + processing status |
| `transcripts` | ✅ Exists | Chunked transcripts by video |
| `recommendations` | ✅ Exists | Basic: expert_name, share_name, action, prices |
| `experts` | ✅ Exists | Canonical names (recently added) |
| `expert_aliases` | ✅ Exists | Maps aliases to experts (recently added) |
| `pending_experts` | ✅ Exists | New experts for review (recently added) |
| `channels` | ✅ Exists | TV channels with prompt files (recently added) |

### Required Tables (From Requirements Doc)
| Table | Status | Priority |
|-------|--------|----------|
| `stocks` | ❌ Missing | Phase 2 |
| `price_tracking` | ❌ Missing | Phase 3 |
| `recommendation_outcomes` | ❌ Missing | Phase 3 |
| `expert_metrics` | ❌ Missing | Phase 4 |
| `users` | ❌ Missing | Phase 5 |
| `user_expert_following` | ❌ Missing | Phase 5 |
| `user_stock_watchlist` | ❌ Missing | Phase 5 |
| `user_portfolio_simulations` | ❌ Missing | Phase 6 |
| `notifications` | ❌ Missing | Phase 5 |
| `ranking_history` | ❌ Missing | Phase 4 |
| `audit_log` | ❌ Missing | Phase 2 |

---

## Implementation Phases

---

## Phase 0: Foundation & Security (IMMEDIATE)
**Goal:** Secure admin routes, configure domain, production-ready deployment

### 0.1 Admin Authentication
**What:** Password-protect all admin routes (`/add`, `/admin/*`)

**Implementation:**
- Simple password gate (no user system yet)
- Store hashed admin password in `.env`
- Session-based authentication (cookie)
- Protect routes: `/add`, `/admin/experts`, `/admin/channels`

**API Changes:**
```
POST /api/auth/admin-login     # Verify admin password
GET  /api/auth/admin-status    # Check if authenticated
POST /api/auth/admin-logout    # Clear session
```

**Frontend Changes:**
- Create `AdminLogin.jsx` page
- Create `ProtectedRoute` component wrapper
- Wrap admin routes with protection

### 0.2 Domain Configuration
**What:** Configure https://www.sayitownit.com

**Tasks:**
- Configure DNS (A record → server IP)
- Set up SSL certificate (Let's Encrypt via certbot)
- Configure Apache/Nginx reverse proxy
- Update frontend API base URL
- Update CORS settings in backend

### 0.3 Environment Separation
**What:** Separate dev/prod configs

**Tasks:**
- Create `.env.production`
- Configure production database
- Set up PM2 for backend process management
- Configure Vite for production build

**Deliverables:**
- [ ] Admin routes password-protected
- [ ] Domain accessible via HTTPS
- [ ] Production deployment working

**Site Status:** ✅ Fully usable, admin features protected

---

## Phase 1: Stock Master Data
**Goal:** Replace free-text `share_name` with proper stock references

### 1.1 Stocks Table
**New Table:**
```sql
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) NOT NULL,           -- RELIANCE, TCS
    exchange VARCHAR(10) DEFAULT 'NSE',    -- NSE, BSE
    company_name VARCHAR(255) NOT NULL,
    isin VARCHAR(20),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap_category VARCHAR(50),       -- Large/Mid/Small Cap
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, exchange)
);
```

### 1.2 Seed NSE Stock Data
- Import ~2000 NSE listed stocks
- Source: NSE website CSV or API
- Include sector/industry classification

### 1.3 Update Recommendations Table
```sql
ALTER TABLE recommendations ADD COLUMN stock_id UUID REFERENCES stocks(id);
-- Backfill: Match nse_symbol to stocks.symbol
```

### 1.4 Frontend Updates
- Stock autocomplete in video processing display
- Stock detail page shows company info
- Filter recommendations by sector

**Deliverables:**
- [ ] Stocks table with 2000+ NSE stocks
- [ ] Recommendations linked to stocks
- [ ] Stock detail pages enhanced

**Site Status:** ✅ Fully usable, better stock data

---

## Phase 2: Recommendation Tracking & Outcomes
**Goal:** Track whether recommendations hit target or stop-loss

### 2.1 Price Tracking Infrastructure
**New Table:**
```sql
CREATE TABLE stock_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID REFERENCES stocks(id),
    price_date DATE NOT NULL,
    open_price DECIMAL(15,2),
    high_price DECIMAL(15,2),
    low_price DECIMAL(15,2),
    close_price DECIMAL(15,2),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stock_id, price_date)
);
```

### 2.2 Daily Price Update Job
- Fetch EOD prices from Yahoo Finance API (free)
- Run daily at 6 PM IST (after market close)
- Store in `stock_prices` table

### 2.3 Recommendation Outcomes
**New Table:**
```sql
CREATE TABLE recommendation_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES recommendations(id),
    outcome_type VARCHAR(50),      -- TARGET_HIT, SL_HIT, EXPIRED, ACTIVE
    outcome_date DATE,
    exit_price DECIMAL(15,2),
    return_percentage DECIMAL(10,4),
    days_held INT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.4 Outcome Detection Job
- Run daily after price update
- For each ACTIVE recommendation:
  - Check if high >= target_price → TARGET_HIT
  - Check if low <= stop_loss → SL_HIT
  - Check if 90 days passed → EXPIRED
- Create outcome record
- Update recommendation status

### 2.5 Frontend Updates
- Show outcome badges on recommendations (✅ Target, ❌ SL, ⏳ Active)
- Add "Return %" column
- Filter by outcome type

**Deliverables:**
- [x] Daily price fetching working
- [x] Automatic outcome detection
- [x] Visual outcome indicators on UI

**Site Status:** ✅ Fully usable, now shows recommendation results

---

## Phase 3: Expert Metrics & Basic Ranking
**Goal:** Calculate and display expert performance metrics

### 3.1 Expert Metrics Table
```sql
CREATE TABLE expert_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id UUID REFERENCES experts(id),
    calculation_date DATE NOT NULL,

    -- Counts
    total_recommendations INT DEFAULT 0,
    active_recommendations INT DEFAULT 0,
    target_hit_count INT DEFAULT 0,
    sl_hit_count INT DEFAULT 0,

    -- Rates
    overall_win_rate DECIMAL(5,2),
    last_3m_win_rate DECIMAL(5,2),
    avg_return_pct DECIMAL(10,4),
    avg_holding_days DECIMAL(10,2),

    -- Ranking (simplified)
    ranking_score DECIMAL(10,4),
    rank_position INT,

    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(expert_id, calculation_date)
);
```

### 3.2 Metrics Calculation Job
- Run daily at 7 PM IST (after outcome detection)
- Calculate for each expert:
  - Win rate (targets hit / closed recommendations)
  - Average return percentage
  - Average holding period
  - 3-month rolling win rate

### 3.3 Simplified Ranking Algorithm (v1)
```
Ranking_Score =
    (0.50 × Win_Rate) +
    (0.30 × Avg_Return_Normalized) +
    (0.20 × Volume_Credibility)

Volume_Credibility = MIN(100, total_recommendations * 2)
```

### 3.4 Frontend Updates
- Expert profile shows metrics dashboard
- Win rate, avg return, total recommendations
- "Rank #X" badge on expert pages
- Leaderboard page `/experts/rankings`

**Deliverables:**
- [x] Daily metrics calculation (metricsService.js)
- [x] Basic ranking system (50% win rate + 30% avg return + 20% volume)
- [x] Expert leaderboard page (/leaderboard)
- [x] Metrics displayed on expert profiles

**Site Status:** ✅ Fully usable, experts now have performance data

---

## Phase 4: Enhanced Expert Profiles
**Goal:** Rich expert profiles with detailed analytics

### 4.1 Expert Profile Enhancements
- Bio, profile image, social links
- Verification status
- Specialization tags

```sql
ALTER TABLE experts ADD COLUMN bio TEXT;
ALTER TABLE experts ADD COLUMN profile_image_url VARCHAR(500);
ALTER TABLE experts ADD COLUMN youtube_channel_url VARCHAR(500);
ALTER TABLE experts ADD COLUMN twitter_handle VARCHAR(100);
ALTER TABLE experts ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE experts ADD COLUMN specialization TEXT;
```

### 4.2 Sector Performance Analysis
- Track win rate by sector
- Show "Best sectors" on profile
- Store in expert_metrics as JSONB

### 4.3 Performance Charts
- Win rate over time (line chart)
- Monthly returns (bar chart)
- Sector breakdown (pie chart)

### 4.4 Recommendation History Table
- Full table with filters
- Export to CSV
- Expandable rows with reasoning

**Deliverables:**
- [ ] Enhanced expert profiles
- [ ] Performance charts
- [ ] Sector analysis
- [ ] Exportable history

**Site Status:** ✅ Fully usable, professional expert profiles

---

## Phase 5: User Accounts & Personalization
**Goal:** Allow users to register, follow experts, create watchlists

### 5.1 User Authentication
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    subscription_tier VARCHAR(50) DEFAULT 'FREE',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);
```

### 5.2 Following System
```sql
CREATE TABLE user_expert_following (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    expert_id UUID REFERENCES experts(id),
    notify_on_new_rec BOOLEAN DEFAULT TRUE,
    followed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, expert_id)
);
```

### 5.3 Stock Watchlists
```sql
CREATE TABLE user_watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE watchlist_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID REFERENCES user_watchlists(id),
    stock_id UUID REFERENCES stocks(id),
    added_at TIMESTAMP DEFAULT NOW()
);
```

### 5.4 User Dashboard
- My followed experts
- My watchlists
- Recent recommendations from followed experts

### 5.5 Notifications (Basic)
- In-app notifications
- New recommendation from followed expert
- Target/SL hit for followed expert

**Deliverables:**
- [ ] User registration/login
- [ ] Follow experts
- [ ] Create watchlists
- [ ] User dashboard
- [ ] Basic notifications

**Site Status:** ✅ Fully usable, now personalized

---

## Phase 6: Portfolio Simulation
**Goal:** "What if I followed Expert X with ₹1 lakh?"

### 6.1 Simulation Engine
- Input: Expert ID, Initial Capital, Date Range, Position Size
- Output: Final Value, XIRR, Win Rate, Trade Log

### 6.2 XIRR Calculation
- Implement XIRR formula (Newton-Raphson method)
- Account for timing of entries/exits

### 6.3 Simulation Results Storage
```sql
CREATE TABLE portfolio_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    expert_id UUID REFERENCES experts(id),
    initial_capital DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    position_size DECIMAL(15,2),
    final_value DECIMAL(15,2),
    total_return_pct DECIMAL(10,4),
    xirr DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.4 Frontend
- Portfolio Simulator tab on expert profile
- Configuration form (capital, dates, strategy)
- Results dashboard with charts
- Trade log table

**Deliverables:**
- [ ] Portfolio simulation engine
- [ ] XIRR calculation
- [ ] Simulation UI on expert profiles
- [ ] Save simulation results

**Site Status:** ✅ Fully usable, advanced analytics

---

## Phase 7: Advanced Ranking & Analytics
**Goal:** Sophisticated ranking algorithm, deep analytics

### 7.1 Full Ranking Algorithm
Implement the 5-component model from requirements:
- Recent Performance (40%)
- Historical Performance (25%)
- Consistency (20%)
- Risk-Adjusted Returns (10%)
- Volume Credibility (5%)

### 7.2 Ranking History
- Track rank changes over time
- Show "moved up/down X positions"
- Ranking trend charts

### 7.3 Stock Consensus View
- Aggregate recommendations by stock
- Show consensus (X experts say BUY)
- Average target price

### 7.4 Advanced Filters
- Filter by sector specialist
- Filter by timeframe preference
- Filter by risk profile

**Deliverables:**
- [ ] Full ranking algorithm
- [ ] Ranking history tracking
- [ ] Stock consensus views
- [ ] Advanced filtering

**Site Status:** ✅ Production-ready platform

---

## Phase 8: Premium Features & Monetization
**Goal:** Subscription tiers, API access

### 8.1 Subscription Tiers
- FREE: Basic access, follow 3 experts, 1 watchlist
- PREMIUM (₹299/mo): Unlimited follows, watchlists, export
- PRO (₹999/mo): API access, advanced analytics

### 8.2 Payment Integration
- Razorpay integration
- Subscription management

### 8.3 API Access
- Rate-limited public API
- Full API for PRO subscribers
- API key management

**Deliverables:**
- [ ] Subscription system
- [ ] Payment integration
- [ ] API with rate limiting

---

## Summary Timeline

| Phase | Name | Key Deliverable | Dependency |
|-------|------|-----------------|------------|
| 0 | Foundation & Security | Admin protection, domain | - |
| 1 | Stock Master Data | NSE stocks database | Phase 0 |
| 2 | Recommendation Tracking | Outcome detection | Phase 1 |
| 3 | Expert Metrics | Basic ranking | Phase 2 |
| 4 | Enhanced Profiles | Rich expert pages | Phase 3 |
| 5 | User Accounts | Personalization | Phase 3 |
| 6 | Portfolio Simulation | XIRR calculator | Phase 2 |
| 7 | Advanced Analytics | Full ranking | Phase 3 |
| 8 | Premium Features | Monetization | Phase 5 |

---

## Recommended Starting Point

**Start with Phase 0** (Foundation & Security):
1. Add admin password protection
2. Configure domain https://www.sayitownit.com
3. Deploy to production

This secures the site immediately while keeping all existing functionality working.

**Then proceed sequentially** through phases, each building on the previous.
