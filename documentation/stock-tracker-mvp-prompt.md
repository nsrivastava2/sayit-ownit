# Claude Code Prompt: Stock Market TV Recommendation Tracker MVP
mvp to be hosted: https://www.sayitownit.com

## Project Overview

Build an MVP application that transcribes YouTube videos (both live streams and recorded videos) from Indian Stock Market TV channels, extracts expert stock recommendations using AI, and displays them in a web interface.

## Technical Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: Ollama (self-hosted) for both transcription and analysis
- **Video Processing**: yt-dlp for YouTube stream/video capture

## External Services Configuration

### Ollama API
- **Base URL**: `https://ai-api.veldev.com`
- **Authentication**: Basic Auth
  - Username: `ollama-api-user1`
  - Password: `tEst@#987xy`
- **Models to use**:
  - Transcription: Use Whisper model via Ollama
  - Analysis: Use Llama 3.1 or Mistral for extracting recommendations

### Supabase Configuration
- **Project URL**: `https://rltobpjezlhnmzuyrsmk.supabase.co`
- **API Key**: `sb_publishable_MvcFz47k547UdJuKhDLZcQ_PKEx5ncn`
- **Project Password**: `tEst@#987lui`
- **Project Name**: `sayit-ownit`

## Core Features to Implement

### 1. Video Input & Processing Module

```
Features:
- Accept YouTube URL (live stream or recorded video)
- Detect if video is live or recorded
- For recorded: Download and process entire video
- For live: Process in real-time chunks (30-60 second segments)
- Support both English and Hindi audio
- Extract audio from video stream using ffmpeg
```

**Implementation approach**:
- Use `yt-dlp` to handle YouTube URLs
- For live streams: Use `yt-dlp` with `--live-from-start` or process ongoing stream
- Convert audio to format suitable for Whisper (16kHz, mono, WAV/MP3)
- Queue chunks for processing

### 2. Transcription Module

```
Features:
- Transcribe audio chunks using Whisper via Ollama
- Handle Hindi and English languages
- Maintain timestamp information
- Buffer and merge transcriptions for context
```

**API Call Structure for Ollama**:
```javascript
// Example structure - adapt based on Ollama's actual API
const transcribe = async (audioChunk) => {
  const response = await fetch('https://ai-api.veldev.com/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from('ollama-api-user1:tEst@#987xy').toString('base64')
    },
    body: JSON.stringify({
      model: 'whisper',
      // ... audio data
    })
  });
  return response.json();
};
```

### 3. AI Analysis Module - Recommendation Extraction

```
Features:
- Analyze transcribed text to identify stock recommendations
- Extract structured data from unstructured conversation
- Handle multiple experts in same video
- Identify buy/sell recommendations with associated details
```

**Data to Extract**:
| Field | Description | Example |
|-------|-------------|---------|
| expert_name | Name of the expert giving recommendation | "Anil Singhvi" |
| recommendation_date | Date when recommendation was made | "2024-01-15" |
| share_name | Stock/Share name | "Tata Motors", "RELIANCE" |
| recommended_action | Buy/Sell/Hold | "BUY" |
| recommended_price | Entry price suggested | 850.00 |
| target_price | Target price for profit | 920.00 |
| stop_loss | Stop loss price | 820.00 |
| reason | Why the expert recommends this | "Strong quarterly results expected" |
| confidence_score | AI confidence in extraction (0-1) | 0.85 |
| video_url | Source YouTube URL | "https://youtube.com/..." |
| timestamp_in_video | When in video this was said | "00:15:30" |

**Prompt Template for LLM Analysis**:
```
You are an expert at analyzing Indian stock market TV channel transcripts. 
Your task is to extract stock recommendations from the following transcript.

The transcript is from a financial TV channel where market experts discuss stocks.
Languages used: English and/or Hindi.

Extract ALL stock recommendations mentioned. For each recommendation, identify:
1. Expert Name - Who is giving the recommendation
2. Share/Stock Name - Which stock (use NSE symbol if possible)
3. Action - BUY, SELL, or HOLD
4. Recommended Buy Price - Entry price (if mentioned)
5. Target Price - Expected price target (if mentioned)
6. Stop Loss - Stop loss level (if mentioned)
7. Reason - Brief reason for the recommendation
8. Confidence - Your confidence in this extraction (low/medium/high)

If any field is not clearly mentioned, mark it as "not_specified".

TRANSCRIPT:
---
{transcript_text}
---

Respond ONLY in valid JSON format as an array of recommendations:
[
  {
    "expert_name": "...",
    "share_name": "...",
    "nse_symbol": "...",
    "action": "BUY|SELL|HOLD",
    "recommended_price": number or null,
    "target_price": number or null,
    "stop_loss": number or null,
    "reason": "...",
    "confidence": "low|medium|high"
  }
]

If no recommendations found, return empty array: []
```

### 4. Database Schema (Supabase)

Create these tables in Supabase:

```sql
-- Videos table to track processed videos
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL UNIQUE,
  title TEXT,
  channel_name TEXT,
  video_type TEXT CHECK (video_type IN ('live', 'recorded')),
  duration_seconds INTEGER,
  language TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transcripts table
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  start_time_seconds FLOAT,
  end_time_seconds FLOAT,
  transcript_text TEXT,
  language_detected TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendations table - main output
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  expert_name TEXT NOT NULL,
  recommendation_date DATE NOT NULL,
  share_name TEXT NOT NULL,
  nse_symbol TEXT,
  action TEXT CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  recommended_price DECIMAL(10,2),
  target_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  reason TEXT,
  confidence_score DECIMAL(3,2),
  timestamp_in_video TEXT,
  raw_extract TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_recommendations_expert ON recommendations(expert_name);
CREATE INDEX idx_recommendations_share ON recommendations(share_name);
CREATE INDEX idx_recommendations_date ON recommendations(recommendation_date);
CREATE INDEX idx_recommendations_action ON recommendations(action);

-- Enable Row Level Security (optional for MVP, but good practice)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- For MVP, allow all operations (tighten in production)
CREATE POLICY "Allow all" ON videos FOR ALL USING (true);
CREATE POLICY "Allow all" ON transcripts FOR ALL USING (true);
CREATE POLICY "Allow all" ON recommendations FOR ALL USING (true);
```

### 5. Backend API Endpoints

```
POST /api/videos/process
  - Body: { youtube_url: string }
  - Starts processing a video (queues for background processing)
  - Returns: { job_id, status, message }

GET /api/videos
  - List all processed videos with status
  - Query params: ?status=completed&limit=20&offset=0

GET /api/videos/:id
  - Get video details with transcript and recommendations

GET /api/recommendations
  - List all recommendations
  - Query params: 
    - ?expert=name
    - ?share=name
    - ?date_from=YYYY-MM-DD
    - ?date_to=YYYY-MM-DD
    - ?action=BUY|SELL|HOLD
    - ?limit=50&offset=0

GET /api/recommendations/by-expert
  - Group recommendations by expert
  
GET /api/recommendations/by-share
  - Group recommendations by share/stock

GET /api/experts
  - List all experts with recommendation counts

GET /api/shares
  - List all shares with recommendation counts

GET /api/stats
  - Dashboard statistics (total videos, recommendations, top experts, etc.)
```

### 6. Frontend UI Components

Build a React application with these pages/components:

#### Dashboard Page (`/`)
- Summary statistics cards:
  - Total videos processed
  - Total recommendations extracted
  - Number of unique experts
  - Number of unique stocks
- Recent recommendations table
- Quick action to add new video URL

#### Add Video Page (`/add`)
- Form to input YouTube URL
- Real-time status updates during processing
- Show progress: Downloading → Transcribing → Analyzing → Complete

#### Recommendations List Page (`/recommendations`)
- Filterable table with all recommendations
- Filters:
  - Date range picker
  - Expert dropdown
  - Share/Stock search
  - Action type (BUY/SELL/HOLD)
- Sortable columns
- Export to CSV option

#### Expert View Page (`/experts/:name`)
- Expert profile with all their recommendations
- Success rate tracking (if historical data available)
- Recommendations timeline

#### Share View Page (`/shares/:symbol`)
- All recommendations for a specific stock
- Multiple expert opinions comparison
- Price chart integration (optional for MVP)

#### Video Details Page (`/videos/:id`)
- Video embed or link
- Full transcript
- Extracted recommendations from this video

### 7. Project Structure

```
stock-tracker-mvp/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # Supabase client setup
│   │   │   ├── ollama.js        # Ollama API client
│   │   │   └── index.js
│   │   ├── services/
│   │   │   ├── videoService.js      # yt-dlp integration
│   │   │   ├── transcriptionService.js  # Whisper/Ollama
│   │   │   ├── analysisService.js   # LLM recommendation extraction
│   │   │   └── queueService.js      # Job queue management
│   │   ├── routes/
│   │   │   ├── videos.js
│   │   │   ├── recommendations.js
│   │   │   ├── experts.js
│   │   │   └── stats.js
│   │   ├── utils/
│   │   │   ├── audioProcessor.js    # ffmpeg utilities
│   │   │   └── helpers.js
│   │   └── index.js                 # Express app entry
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Dashboard/
│   │   │   ├── Recommendations/
│   │   │   ├── VideoForm/
│   │   │   └── common/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AddVideo.jsx
│   │   │   ├── Recommendations.jsx
│   │   │   ├── ExpertView.jsx
│   │   │   ├── ShareView.jsx
│   │   │   └── VideoDetails.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
├── docker-compose.yml (optional)
└── README.md
```

### 8. Key Implementation Notes

#### Video Processing Flow
```
1. User submits YouTube URL
2. Backend validates URL and creates job
3. yt-dlp downloads/streams video
4. ffmpeg extracts audio in chunks
5. Each chunk sent to Whisper via Ollama for transcription
6. Transcriptions accumulated and sent to LLM for analysis
7. Extracted recommendations saved to Supabase
8. Status updated throughout process
```

#### Handling Live Streams
```javascript
// Pseudo-code for live stream handling
const processLiveStream = async (youtubeUrl) => {
  const stream = await ytdlp.streamAudio(youtubeUrl);
  const chunker = new AudioChunker(30); // 30-second chunks
  
  stream.pipe(chunker);
  
  chunker.on('chunk', async (audioChunk, timestamp) => {
    // Transcribe chunk
    const transcript = await transcribeWithWhisper(audioChunk);
    
    // Save transcript
    await saveTranscript(videoId, transcript, timestamp);
    
    // Analyze every 5 chunks (2.5 minutes of content)
    if (shouldAnalyze(timestamp)) {
      const recentTranscripts = await getRecentTranscripts(videoId, 5);
      const recommendations = await analyzeForRecommendations(recentTranscripts);
      await saveRecommendations(videoId, recommendations);
    }
  });
};
```

#### Error Handling
- Retry logic for Ollama API calls (3 retries with exponential backoff)
- Graceful handling of network issues during live stream
- Save partial progress for long videos
- Log all errors for debugging

### 9. Environment Variables

```env
# Backend .env
NODE_ENV=development
PORT=3001

# Supabase
SUPABASE_URL=https://rltobpjezlhnmzuyrsmk.supabase.co
SUPABASE_ANON_KEY=sb_publishable_MvcFz47k547UdJuKhDLZcQ_PKEx5ncn

# Ollama
OLLAMA_BASE_URL=https://ai-api.veldev.com
OLLAMA_USERNAME=ollama-api-user1
OLLAMA_PASSWORD=tEst@#987xy
WHISPER_MODEL=whisper
LLM_MODEL=llama3.1

# Processing
AUDIO_CHUNK_SECONDS=30
ANALYSIS_BATCH_CHUNKS=5
```

### 10. MVP Acceptance Criteria

1. **Can process a recorded YouTube video**: Submit URL → Get recommendations
2. **Can process a live YouTube stream**: Submit live URL → See recommendations appearing in real-time
3. **Supports Hindi and English**: Correctly transcribes both languages
4. **Extracts structured recommendations**: Expert, stock, prices, dates properly extracted
5. **Data persisted in Supabase**: All data correctly saved and retrievable
6. **Basic UI to view recommendations**: 
   - Filter by expert
   - Filter by share
   - Filter by date
   - See recommendation details
7. **Reasonable accuracy**: At least 70% of clearly stated recommendations are captured

### 11. Testing Instructions

Test with these sample YouTube channels/videos:
- CNBC Awaaz (Hindi)
- Zee Business (Hindi)
- ET Now (English)
- CNBC TV18 (English)

Start with recorded videos before testing live streams.

---

## Instructions for Claude Code

1. **Start with database setup**: Create tables in Supabase first
2. **Build backend services in order**: 
   - Supabase client
   - Ollama client (test connection)
   - Video download service
   - Transcription service
   - Analysis service
   - API routes
3. **Test backend independently**: Use curl/Postman to verify APIs work
4. **Build frontend**: Start with dashboard, then add video and recommendations pages
5. **Integration testing**: Process a real video end-to-end
6. **Handle edge cases**: Network errors, empty transcripts, no recommendations found

Focus on getting the core flow working first, then add polish and edge case handling.
