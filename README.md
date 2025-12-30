# SayIt OwnIt - Stock Market TV Recommendation Tracker

An MVP application that transcribes YouTube videos from Indian Stock Market TV channels, extracts expert stock recommendations using AI, and displays them in a web interface.

## Features

- **Video Processing**: Process both live streams and recorded YouTube videos
- **Multilingual Support**: Hindi and English audio transcription
- **AI-Powered Extraction**: Extract structured stock recommendations from unstructured conversations
- **Real-time Processing**: Live streams are processed in real-time with recommendations appearing as they're mentioned
- **Comprehensive Dashboard**: View statistics, top experts, top stocks, and recent recommendations
- **Filtering & Export**: Filter recommendations by expert, stock, action, date range; export to CSV

## Tech Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: Ollama (self-hosted) for LLM analysis
- **Transcription**: Whisper (multiple backends supported)
- **Video Processing**: yt-dlp + ffmpeg

## Prerequisites

- Node.js 18+
- yt-dlp (`pip install yt-dlp`)
- ffmpeg (`apt install ffmpeg`)
- Whisper (one of: `pip install openai-whisper`, whisper.cpp, or faster-whisper)

## Setup

### 1. Database Setup

Run the SQL schema in your Supabase project:
```bash
# Copy the contents of database/schema.sql and run in Supabase SQL Editor
```

### 2. Backend Setup

```bash
cd backend
npm install
# Edit .env with your credentials (already configured)
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:3000

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/videos/process` | POST | Submit a YouTube URL for processing |
| `/api/videos` | GET | List all processed videos |
| `/api/videos/:id` | GET | Get video details with transcripts and recommendations |
| `/api/recommendations` | GET | List recommendations with filters |
| `/api/recommendations/export` | GET | Export recommendations as CSV |
| `/api/experts` | GET | List all experts |
| `/api/shares` | GET | List all stocks |
| `/api/stats` | GET | Dashboard statistics |

## Project Structure

```
sayit-ownit/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, Ollama, environment configs
│   │   ├── services/        # Video, transcription, analysis, queue services
│   │   ├── routes/          # API endpoints
│   │   └── index.js         # Express app entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Route pages
│   │   ├── services/        # API client
│   │   └── App.jsx
│   └── package.json
├── database/
│   └── schema.sql           # Supabase schema
└── documentation/
    └── stock-tracker-mvp-prompt.md
```

## Testing

Test with videos from these channels:
- CNBC Awaaz (Hindi)
- Zee Business (Hindi)
- ET Now (English)
- CNBC TV18 (English)

## License

Private project
