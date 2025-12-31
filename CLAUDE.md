# SayIt OwnIt - Stock Market TV Recommendation Tracker

## Quick Reference

### Build & Run Commands

```bash
# Backend (Express.js on port 4001)
cd backend && npm install && npm run dev

# Frontend (Vite/React on port 5173)
cd frontend && npm install && npm run dev

# Database migrations
psql -h localhost -p 5433 -U sayitownit -d sayitownit -f database/migrations/<file>.sql
```

### Environment Setup

Backend requires `.env` file (copy from `.env.example`):
- `PORT=4001` - API server port
- `DB_PORT=5433` - PostgreSQL port (NOT default 5432)
- `GEMINI_API_KEY` - Primary AI service for video analysis
- `GROQ_API_KEY` - Fallback for Whisper transcription
- `YOUTUBE_TRANSCRIPT_API_KEY` - Fallback for transcript fetching

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
│  Dashboard │ Recommendations │ Experts │ Shares │ Admin (Experts/Ch)│
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP :4001
┌───────────────────────────────▼─────────────────────────────────────┐
│                         Backend (Express.js)                        │
│  Routes: /api/videos, /api/recommendations, /api/experts,           │
│          /api/shares, /api/stats, /api/admin/*                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────────┐
        ▼                       ▼                           ▼
┌───────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ PostgreSQL    │    │ Gemini API       │    │ External Services    │
│ :5433         │    │ (Video Analysis) │    │ - YouTube Transcript │
│               │    │                  │    │ - yt-dlp (metadata)  │
│ Tables:       │    │ Prompts:         │    │ - Groq (fallback)    │
│ - videos      │    │ - default.md     │    └──────────────────────┘
│ - transcripts │    │ - zee-business.md│
│ - recommends  │    │ - cnbc-awaaz.md  │
│ - experts     │    └──────────────────┘
│ - channels    │
│ - aliases     │
│ - pending     │
└───────────────┘
```

---

## Key Processing Flow

### Video Processing Pipeline (Transcript-First Strategy)

```
1. Submit YouTube URL → POST /api/videos/process
2. Fetch metadata via yt-dlp
3. TRY: YouTube Transcript API (FREE, instant)
   ├── Success → Analyze text with Gemini (cheaper)
   └── Fail → FALLBACK: Gemini Video Analysis (visual + audio)
4. Extract recommendations using channel-specific prompt
5. Resolve expert names via expertService (alias mapping)
6. Save to database
```

**Cost Optimization**: Always checks for free transcripts before expensive video analysis.

### Expert Name Resolution

```javascript
// queueService.js calls expertService for each recommendation
const expertResolution = await expertService.resolveExpertName(
  rec.expert_name,      // Raw name from extraction: "Anil ji"
  job.videoId,          // For tracking in pending_experts
  rec.timestamp_seconds // For verification in pending_experts
);
// Returns: { name: "Anil Singhvi", isNew: false } or adds to pending
```

---

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `videos` | YouTube videos with processing status |
| `transcripts` | Chunked transcript text by video |
| `recommendations` | Extracted stock picks with expert, action, prices |

### Expert Management Tables (v1.1)
| Table | Purpose |
|-------|---------|
| `experts` | Canonical expert names (e.g., "Anil Singhvi") |
| `expert_aliases` | Alias mappings (e.g., "Anil ji" → expert_id) |
| `pending_experts` | New names awaiting admin review |
| `channels` | TV channels with prompt file assignments |

---

## Services Architecture

### Backend Services (`backend/src/services/`)

| Service | Responsibility |
|---------|---------------|
| `queueService.js` | Job queue, orchestrates processing pipeline |
| `geminiVideoService.js` | Gemini API calls for video/text analysis |
| `youtubeTranscriptService.js` | Fetch YouTube transcripts (free method) |
| `promptService.js` | Load channel-specific prompts from .md files |
| `expertService.js` | Resolve aliases, manage pending experts |
| `videoService.js` | yt-dlp wrapper for metadata |

### Prompt Files (`backend/prompts/`)

Channel-specific extraction prompts stored as markdown:
- `default.md` - Fallback for unknown channels
- `zee-business.md` - Zee Business specific rules
- `cnbc-awaaz.md` - CNBC Awaaz specific rules

**To add a new channel**:
1. Create `backend/prompts/[slug].md`
2. Add channel record in DB with `prompt_file` reference
3. Prompts are cached with 5-min TTL

---

## API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/process` | Submit YouTube URL |
| GET | `/api/videos` | List all videos |
| GET | `/api/videos/:id` | Video details with recommendations |
| GET | `/api/recommendations` | Filter: expert, share, action, date |
| GET | `/api/recommendations/export` | CSV export |
| GET | `/api/experts` | List experts |
| GET | `/api/experts/:name` | Expert detail with recommendations |
| GET | `/api/shares` | List stocks |
| GET | `/api/shares/:symbol` | Stock detail with recommendations |
| GET | `/api/stats` | Dashboard statistics |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/experts` | List experts with aliases |
| POST | `/api/admin/experts` | Create expert |
| PUT | `/api/admin/experts/:id` | Update expert |
| DELETE | `/api/admin/experts/:id` | Delete expert |
| POST | `/api/admin/experts/:id/aliases` | Add alias |
| DELETE | `/api/admin/experts/aliases/:id` | Remove alias |
| GET | `/api/admin/experts/pending` | Pending expert review |
| POST | `/api/admin/experts/pending/:id/resolve` | Resolve pending |
| GET | `/api/admin/channels` | List channels |
| POST | `/api/admin/channels` | Create channel |
| PUT | `/api/admin/channels/:id` | Update channel |

---

## Frontend Structure

```
frontend/src/
├── pages/
│   ├── Dashboard.jsx        # Stats, top experts/stocks, recent recommendations
│   ├── Recommendations.jsx  # Filterable table with CSV export
│   ├── ExpertView.jsx       # Expert detail page
│   ├── ShareView.jsx        # Stock detail page
│   ├── VideoDetails.jsx     # Video with transcript and recommendations
│   ├── AddVideo.jsx         # Submit YouTube URL form
│   └── admin/
│       ├── ExpertManagement.jsx   # Expert CRUD, alias management
│       └── ChannelManagement.jsx  # Channel CRUD, prompt assignment
├── components/
│   └── Layout/Layout.jsx    # Navigation with admin dropdown
└── services/
    └── api.js               # Axios API client
```

---

## Common Tasks

### Add a New TV Channel
1. Create prompt file: `backend/prompts/[channel-slug].md`
2. Via Admin UI: Go to Admin → Channels → Add Channel
3. Or via SQL: `INSERT INTO channels (name, slug, prompt_file) VALUES (...)`

### Map Expert Alias
1. Via Admin UI: Go to Admin → Experts → Add Alias button
2. Or via SQL: `INSERT INTO expert_aliases (expert_id, alias) VALUES (...)`

### Process a Video
```bash
curl -X POST http://localhost:4001/api/videos/process \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=..."}'
```

### Run Database Migrations
```bash
# From project root
PGPASSWORD=<password> psql -h localhost -p 5433 -U sayitownit -d sayitownit \
  -f database/migrations/001_expert_management.sql
```

---

## Debugging Tips

1. **Backend not starting**: Check if port 4001 is in use
   ```bash
   lsof -ti:4001 | xargs kill -9
   ```

2. **Database connection failed**: Verify port 5433 (not default 5432)

3. **Video processing stuck**: Check Gemini API key is valid
   ```bash
   # Verify in backend/.env
   GEMINI_API_KEY=...
   ```

4. **No recommendations extracted**: Check prompt files exist in `backend/prompts/`

5. **Expert aliases not working**: Clear cache or restart backend

---

## Code Style Notes

- ES Modules throughout (`import`/`export`)
- Async/await pattern for all async operations
- React functional components with hooks
- Tailwind CSS for styling
- UUID primary keys in all tables

---

## Testing Channels

- **Zee Business** (Hindi) - Anil Singhvi's shows
- **CNBC Awaaz** (Hindi) - Market analysis
- **ET Now** (English) - Stock recommendations
- **CNBC TV18** (English) - Expert picks
