# Transcript Quality Test Tool

Compares YouTube auto-generated transcripts with local Whisper-generated transcripts to evaluate quality and effectiveness for stock recommendation extraction.

## Purpose

Before using Whisper for transcribing videos that don't have YouTube transcripts, this tool validates:
1. Whisper transcription accuracy for Hindi/Hinglish content
2. Impact on stock recommendation extraction quality
3. Any systematic differences or issues

## Requirements

- Python 3.9+
- PostgreSQL (sayitownit database)
- NVIDIA GPU with CUDA (recommended)
- `faster-whisper` library
- `yt-dlp` for downloading audio
- Gemini API key

## Installation

```bash
# faster-whisper should already be installed
pip install faster-whisper psycopg2-binary requests

# Ensure yt-dlp is installed
pip install yt-dlp
```

## Usage

### Auto-select a video (recommended for first test)
```bash
export GEMINI_API_KEY="your-api-key"
python test_transcript_quality.py --auto
```

### Test specific video by URL
```bash
python test_transcript_quality.py --video-url "https://youtube.com/watch?v=..."
```

### Test specific video by database ID
```bash
python test_transcript_quality.py --video-id "uuid-here"
```

### Options
- `--whisper-model`: Whisper model size (default: large-v3)
- `--keep-audio`: Don't delete downloaded audio after test

## Output

Reports are saved to `output/quality_report_YYYYMMDD_HHMMSS.md` containing:
- Transcript comparison analysis
- Recommendations extracted from each transcript
- Quality metrics and recommendations
- Raw transcript samples

## Directory Structure

```
transcript-quality-test/
├── test_transcript_quality.py   # Main test script
├── README.md                    # This file
├── output/                      # Generated reports
└── temp/                        # Temporary audio files
```

## Extending to Other Channels

To add support for new channels:
1. Add channel-specific prompt to `backend/prompts/[channel-name].md`
2. Update prompt mapping in `load_channel_prompt()` if needed
3. Run test with a video from that channel

## Typical Output

```
============================================================
TRANSCRIPT QUALITY TEST
============================================================

[1/6] Finding video...
  Selected: Share Bazaar Live...
  Duration: 179 minutes

[2/6] Fetching YouTube transcript from database...
  Got 125000 characters

[3/6] Downloading audio...
  Downloaded to: temp/audio_xxx.mp3
  Time: 45.2s

[4/6] Transcribing with Whisper large-v3...
  Detected language: hi (probability: 0.98)
  Got 130000 characters
  Time: 320.5s  (RTX 4090: ~10x faster than real-time)

[5/6] Analyzing with Gemini...
  Time: 25.3s

[6/6] Generating report...
  Report saved to: output/quality_report_20250104_093000.md

============================================================
TEST COMPLETE
============================================================
```
