#!/usr/bin/env python3
"""
Transcript Quality Comparison Tool

Compares YouTube auto-generated transcripts with Whisper-generated transcripts
and evaluates their effectiveness for stock recommendation extraction.

Usage:
    python test_transcript_quality.py --video-url "https://youtube.com/watch?v=..."
    python test_transcript_quality.py --video-id "uuid-from-database"
    python test_transcript_quality.py --auto  # Auto-pick a suitable video from DB
"""

import sys
print("Starting script...", flush=True)

import os
import json
import argparse
import subprocess
import tempfile
from pathlib import Path
from datetime import datetime
print("Basic imports done", flush=True)

import psycopg2
from psycopg2.extras import RealDictCursor
print("psycopg2 imported", flush=True)

# Add parent paths for imports
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
print(f"PROJECT_ROOT: {PROJECT_ROOT}", flush=True)
# Don't add backend to path - it has node modules that conflict
# sys.path.insert(0, str(PROJECT_ROOT / "backend" / "src"))
print("Paths set", flush=True)

# Configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5433)),
    "database": os.getenv("DB_NAME", "sayitownit"),
    "user": os.getenv("DB_USER", "sayitownit"),
    "password": os.getenv("DB_PASSWORD", "sayitownit123")
}
print("DB_CONFIG set", flush=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
print("GEMINI config set", flush=True)

OUTPUT_DIR = SCRIPT_DIR / "output"
TEMP_DIR = SCRIPT_DIR / "temp"
PROMPTS_DIR = PROJECT_ROOT / "backend" / "prompts"
print("Directories set, importing requests...", flush=True)

import requests
print("All imports done, defining functions...", flush=True)


def get_db_connection():
    """Get PostgreSQL connection"""
    print(f"  Connecting to DB: {DB_CONFIG['host']}:{DB_CONFIG['port']}", flush=True)
    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
    print("  DB connected", flush=True)
    return conn


def find_test_video(video_id=None, video_url=None, auto=False):
    """Find a suitable video for testing"""
    conn = get_db_connection()
    cur = conn.cursor()

    if video_id:
        cur.execute("""
            SELECT v.*, COUNT(t.id) as transcript_chunks
            FROM videos v
            LEFT JOIN transcripts t ON t.video_id = v.id
            WHERE v.id = %s
            GROUP BY v.id
        """, (video_id,))
    elif video_url:
        cur.execute("""
            SELECT v.*, COUNT(t.id) as transcript_chunks
            FROM videos v
            LEFT JOIN transcripts t ON t.video_id = v.id
            WHERE v.youtube_url = %s
            GROUP BY v.id
        """, (video_url,))
    elif auto:
        # Find a 2-3 hour video with YouTube transcript
        cur.execute("""
            SELECT v.*, COUNT(t.id) as transcript_chunks
            FROM videos v
            JOIN transcripts t ON t.video_id = v.id
            WHERE v.status = 'completed'
              AND v.duration_seconds BETWEEN 7200 AND 12000
            GROUP BY v.id
            HAVING COUNT(t.id) > 50
            ORDER BY v.publish_date DESC
            LIMIT 1
        """)
    else:
        raise ValueError("Must provide video_id, video_url, or use --auto")

    video = cur.fetchone()
    conn.close()

    if not video:
        raise ValueError("No suitable video found")

    return dict(video)


def get_youtube_transcript(video_id):
    """Get stored YouTube transcript from database"""
    conn = get_db_connection()
    cur = conn.cursor()

    print(f"  Executing query for video_id: {video_id}", flush=True)
    cur.execute("""
        SELECT chunk_index, start_time_seconds, end_time_seconds, transcript_text
        FROM transcripts
        WHERE video_id = %s
        ORDER BY chunk_index
    """, (video_id,))
    print("  Query executed, fetching results...", flush=True)

    chunks = cur.fetchall()
    print(f"  Fetched {len(chunks)} chunks", flush=True)
    conn.close()
    print("  Connection closed", flush=True)

    # Format transcript with timestamps
    print("  Formatting transcript...", flush=True)
    formatted = []
    for i, chunk in enumerate(chunks):
        start = chunk['start_time_seconds']
        end = chunk['end_time_seconds']
        start_str = f"{int(start//60):02d}:{int(start%60):02d}"
        end_str = f"{int(end//60):02d}:{int(end%60):02d}"
        formatted.append(f"[{start_str}-{end_str}] {chunk['transcript_text']}")
        if i % 100 == 0:
            print(f"    Formatted {i}/{len(chunks)} chunks...", flush=True)

    print(f"  Formatted all {len(formatted)} chunks, joining...", flush=True)
    result = "\n\n".join(formatted)
    print(f"  Transcript ready: {len(result)} chars", flush=True)
    return result


def download_audio(youtube_url, output_path):
    """Download audio from YouTube using yt-dlp"""
    print(f"  Downloading audio from {youtube_url}...")

    cmd = [
        "yt-dlp",
        "-x",  # Extract audio
        "--audio-format", "mp3",
        "--audio-quality", "0",  # Best quality
        "-o", str(output_path),
        "--no-playlist",
        youtube_url
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    # yt-dlp adds extension automatically
    actual_path = Path(str(output_path) + ".mp3") if not output_path.suffix else output_path
    if not actual_path.exists():
        # Try without extension
        for ext in [".mp3", ".m4a", ".webm", ".opus"]:
            test_path = Path(str(output_path).replace(output_path.suffix, "") + ext)
            if test_path.exists():
                actual_path = test_path
                break

    return actual_path


def transcribe_with_whisper(audio_path, model_size="large-v3-turbo"):
    """Transcribe audio using whisper.cpp with GPU acceleration"""
    import re

    # Whisper.cpp paths
    WHISPER_CLI = Path.home() / "whisper.cpp/build/bin/whisper-cli"
    WHISPER_MODEL = Path.home() / "whisper.cpp/models/ggml-large-v3-turbo.bin"

    if not WHISPER_CLI.exists():
        raise RuntimeError(f"whisper.cpp not found at {WHISPER_CLI}")
    if not WHISPER_MODEL.exists():
        raise RuntimeError(f"Whisper model not found at {WHISPER_MODEL}")

    # Convert audio to 16kHz WAV (required by whisper.cpp)
    wav_path = Path(str(audio_path).replace('.mp3', '_16k.wav'))
    print(f"  Converting to 16kHz WAV...", flush=True)

    convert_cmd = [
        "ffmpeg", "-i", str(audio_path),
        "-ar", "16000", "-ac", "1",
        "-y", str(wav_path)
    ]
    result = subprocess.run(convert_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg conversion failed: {result.stderr}")

    print(f"  Running whisper.cpp with GPU (RTX 4090)...", flush=True)

    # Run whisper.cpp
    whisper_cmd = [
        str(WHISPER_CLI),
        "-m", str(WHISPER_MODEL),
        "-f", str(wav_path),
        "-l", "hi",  # Hindi
        "-t", "8",   # 8 threads
    ]

    result = subprocess.run(whisper_cmd, capture_output=True)
    # Decode with error handling for non-UTF8 characters in Hindi text
    stdout = result.stdout.decode('utf-8', errors='replace')
    stderr = result.stderr.decode('utf-8', errors='replace')
    if result.returncode != 0:
        raise RuntimeError(f"whisper.cpp failed: {stderr}")

    # Clean up WAV file
    if wav_path.exists():
        wav_path.unlink()

    # Parse whisper.cpp output - extract timestamps and text
    # Format: [00:00:00.000 --> 00:00:16.860]   Text here
    output = stdout + stderr  # whisper outputs to stderr

    # Extract timing info from stderr
    timing_match = re.search(r'total time\s*=\s*([\d.]+)\s*ms', output)
    if timing_match:
        total_ms = float(timing_match.group(1))
        print(f"  Transcription completed in {total_ms/1000:.1f}s", flush=True)

    # Parse transcript lines
    transcript_pattern = r'\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)'
    matches = re.findall(transcript_pattern, output)

    # Format transcript with timestamps (MM:SS format like YouTube)
    formatted = []
    current_chunk = {"start": 0, "end": 30, "texts": []}

    for start_time, end_time, text in matches:
        # Parse start time (HH:MM:SS.mmm -> seconds)
        h, m, s = start_time.split(':')
        start_seconds = int(h) * 3600 + int(m) * 60 + float(s)

        # Group into 30-second chunks like YouTube does
        chunk_index = int(start_seconds // 30)
        chunk_start = chunk_index * 30
        chunk_end = (chunk_index + 1) * 30

        if start_seconds >= current_chunk["end"]:
            # Save current chunk
            if current_chunk["texts"]:
                start_str = f"{int(current_chunk['start']//60):02d}:{int(current_chunk['start']%60):02d}"
                end_str = f"{int(current_chunk['end']//60):02d}:{int(current_chunk['end']%60):02d}"
                formatted.append(f"[{start_str}-{end_str}] {' '.join(current_chunk['texts'])}")

            # Start new chunk
            current_chunk = {"start": chunk_start, "end": chunk_end, "texts": [text.strip()]}
        else:
            current_chunk["texts"].append(text.strip())
            current_chunk["end"] = max(current_chunk["end"], chunk_end)

    # Don't forget last chunk
    if current_chunk["texts"]:
        start_str = f"{int(current_chunk['start']//60):02d}:{int(current_chunk['start']%60):02d}"
        end_str = f"{int(current_chunk['end']//60):02d}:{int(current_chunk['end']%60):02d}"
        formatted.append(f"[{start_str}-{end_str}] {' '.join(current_chunk['texts'])}")

    return "\n\n".join(formatted)


def load_channel_prompt(channel_name):
    """Load channel-specific prompt"""
    # Try to match channel name to prompt file
    prompt_map = {
        "zee business": "zee-business.md",
        "cnbc awaaz": "cnbc-awaaz.md",
    }

    prompt_file = prompt_map.get(channel_name.lower() if channel_name else "", "default.md")
    prompt_path = PROMPTS_DIR / prompt_file

    if not prompt_path.exists():
        prompt_path = PROMPTS_DIR / "default.md"

    with open(prompt_path, "r") as f:
        return f.read()


def call_gemini(prompt, max_tokens=8192):
    """Call Gemini API"""
    import requests

    response = requests.post(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": max_tokens
            }
        }
    )

    if not response.ok:
        raise RuntimeError(f"Gemini API error: {response.status_code} - {response.text}")

    result = response.json()
    return result["candidates"][0]["content"]["parts"][0]["text"]


def compare_transcripts(youtube_transcript, whisper_transcript):
    """Use Gemini to compare transcripts"""
    print("  Comparing transcripts with Gemini...")

    prompt = f"""You are a transcript quality analyst. Compare these two transcripts of the same Hindi/Hinglish stock market TV show.

## YouTube Auto-Generated Transcript:
{youtube_transcript[:15000]}
[... truncated for length ...]

## Whisper-Generated Transcript:
{whisper_transcript[:15000]}
[... truncated for length ...]

## Analysis Required:

1. **Overall Quality Comparison**
   - Which transcript is more accurate for Hindi/Hinglish content?
   - Rate each on a scale of 1-10 for: Accuracy, Completeness, Readability

2. **Key Differences**
   - List 5-10 specific examples where they differ significantly
   - Note which version got it right in each case

3. **Stock Market Terminology**
   - How well does each handle stock names, prices, technical terms?
   - Any systematic errors in either?

4. **Expert Names**
   - Are expert names captured correctly in both?
   - Any missing or garbled names?

5. **Recommendation for Production Use**
   - Which transcript source would you recommend for extracting stock recommendations?
   - What are the tradeoffs?

Provide a structured analysis with clear sections."""

    return call_gemini(prompt)


def extract_recommendations(transcript, channel_prompt, source_name):
    """Extract recommendations using channel prompt"""
    print(f"  Extracting recommendations from {source_name}...")

    prompt = f"""{channel_prompt}

TRANSCRIPT (Hindi/Hinglish - timestamps in [MM:SS-MM:SS] format):
---
{transcript[:30000]}
---

Extract ONLY actionable stock recommendations. Convert MM:SS to seconds (05:30 = 330).
Return as JSON array."""

    response = call_gemini(prompt)

    # Try to parse JSON
    try:
        # Find JSON array in response
        start = response.find('[')
        end = response.rfind(']') + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
    except json.JSONDecodeError:
        pass

    return response  # Return raw if can't parse


def compare_recommendations(youtube_recs, whisper_recs):
    """Compare extracted recommendations"""
    print("  Comparing extracted recommendations...")

    prompt = f"""Compare these two sets of stock recommendations extracted from the same video using different transcripts.

## Recommendations from YouTube Transcript:
{json.dumps(youtube_recs, indent=2) if isinstance(youtube_recs, list) else youtube_recs}

## Recommendations from Whisper Transcript:
{json.dumps(whisper_recs, indent=2) if isinstance(whisper_recs, list) else whisper_recs}

## Analysis Required:

1. **Matching Recommendations**
   - Which recommendations appear in both? List them.
   - Are the details (price, target, stop loss) consistent?

2. **Unique to YouTube Transcript**
   - List recommendations only found in YouTube version
   - Why might Whisper have missed these?

3. **Unique to Whisper Transcript**
   - List recommendations only found in Whisper version
   - Why might YouTube have missed these?

4. **Data Quality**
   - Which source provides more complete recommendation data?
   - Any systematic differences in price/target extraction?

5. **Conclusion**
   - Total recommendations: YouTube vs Whisper
   - Overlap percentage
   - Recommended source for production use

Provide counts and specific examples."""

    return call_gemini(prompt)


def generate_report(video, youtube_transcript, whisper_transcript,
                   transcript_comparison, youtube_recs, whisper_recs,
                   recs_comparison, duration_info):
    """Generate markdown report"""

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_name = f"quality_report_{timestamp}.md"
    report_path = OUTPUT_DIR / report_name

    yt_rec_count = len(youtube_recs) if isinstance(youtube_recs, list) else "N/A"
    wh_rec_count = len(whisper_recs) if isinstance(whisper_recs, list) else "N/A"

    report = f"""# Transcript Quality Comparison Report

**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## Video Information
- **Title:** {video.get('title', 'N/A')}
- **URL:** {video.get('youtube_url', 'N/A')}
- **Duration:** {video.get('duration_seconds', 0) // 60} minutes
- **Channel:** {video.get('channel_name', 'N/A')}

## Processing Times
- **Audio Download:** {duration_info.get('download', 'N/A')}
- **Whisper Transcription:** {duration_info.get('whisper', 'N/A')}
- **Gemini Analysis:** {duration_info.get('gemini', 'N/A')}

## Recommendations Summary
| Source | Count |
|--------|-------|
| YouTube Transcript | {yt_rec_count} |
| Whisper Transcript | {wh_rec_count} |

---

## Transcript Comparison Analysis

{transcript_comparison}

---

## Recommendations Comparison Analysis

{recs_comparison}

---

## Raw Data

### YouTube Transcript (first 5000 chars)
```
{youtube_transcript[:5000]}
```

### Whisper Transcript (first 5000 chars)
```
{whisper_transcript[:5000]}
```

### YouTube Recommendations
```json
{json.dumps(youtube_recs, indent=2) if isinstance(youtube_recs, list) else youtube_recs}
```

### Whisper Recommendations
```json
{json.dumps(whisper_recs, indent=2) if isinstance(whisper_recs, list) else whisper_recs}
```

---

*Report generated by transcript-quality-test tool*
"""

    with open(report_path, "w") as f:
        f.write(report)

    return report_path


print("Functions defined, starting main...", flush=True)

def main():
    print("In main()", flush=True)
    parser = argparse.ArgumentParser(description="Test transcript quality")
    parser.add_argument("--video-url", help="YouTube video URL")
    parser.add_argument("--video-id", help="Video ID from database")
    parser.add_argument("--auto", action="store_true", help="Auto-pick a suitable video")
    parser.add_argument("--whisper-model", default="large-v3", help="Whisper model size")
    parser.add_argument("--keep-audio", action="store_true", help="Keep downloaded audio file")
    print("Parser created", flush=True)

    args = parser.parse_args()
    print(f"Args parsed: {args}", flush=True)

    if not any([args.video_url, args.video_id, args.auto]):
        parser.print_help()
        sys.exit(1)

    if not GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY environment variable not set")
        sys.exit(1)
    print("Checks passed", flush=True)

    # Ensure output directories exist
    OUTPUT_DIR.mkdir(exist_ok=True)
    TEMP_DIR.mkdir(exist_ok=True)
    print("Directories ready", flush=True)

    duration_info = {}

    try:
        # Step 1: Find video
        print("\n" + "="*60, flush=True)
        print("TRANSCRIPT QUALITY TEST", flush=True)
        print("="*60, flush=True)

        print("\n[1/6] Finding video...", flush=True)
        video = find_test_video(args.video_id, args.video_url, args.auto)
        print(f"  Selected: {video['title'][:60]}...", flush=True)
        print(f"  Duration: {video['duration_seconds'] // 60} minutes", flush=True)
        print(f"  URL: {video['youtube_url']}", flush=True)

        # Step 2: Get YouTube transcript
        print("\n[2/6] Fetching YouTube transcript from database...", flush=True)
        youtube_transcript = get_youtube_transcript(video['id'])
        print(f"  Got {len(youtube_transcript)} characters", flush=True)

        # Step 3: Download audio (or skip if exists)
        print("\n[3/6] Downloading audio...", flush=True)
        import time
        start = time.time()
        audio_path = TEMP_DIR / f"audio_{video['id']}"
        # Check if audio already exists
        existing_audio = audio_path.with_suffix('.mp3')
        if existing_audio.exists():
            print(f"  Audio already exists: {existing_audio}", flush=True)
            audio_file = existing_audio
            duration_info['download'] = "skipped (cached)"
        else:
            print(f"  Downloading from YouTube...", flush=True)
            audio_file = download_audio(video['youtube_url'], audio_path)
            duration_info['download'] = f"{time.time() - start:.1f}s"
            print(f"  Downloaded to: {audio_file}", flush=True)
        print(f"  Time: {duration_info['download']}", flush=True)

        # Step 4: Transcribe with Whisper
        print(f"\n[4/6] Transcribing with Whisper {args.whisper_model}...", flush=True)
        start = time.time()
        whisper_transcript = transcribe_with_whisper(audio_file, args.whisper_model)
        duration_info['whisper'] = f"{time.time() - start:.1f}s"
        print(f"  Got {len(whisper_transcript)} characters", flush=True)
        print(f"  Time: {duration_info['whisper']}", flush=True)

        # Step 5: Compare transcripts and extract recommendations
        print("\n[5/6] Analyzing with Gemini...", flush=True)
        start = time.time()

        print("  Comparing transcripts...", flush=True)
        transcript_comparison = compare_transcripts(youtube_transcript, whisper_transcript)

        print("  Loading channel prompt...", flush=True)
        channel_prompt = load_channel_prompt(video.get('channel_name'))
        youtube_recs = extract_recommendations(youtube_transcript, channel_prompt, "YouTube")
        whisper_recs = extract_recommendations(whisper_transcript, channel_prompt, "Whisper")

        print("  Comparing recommendations...", flush=True)
        recs_comparison = compare_recommendations(youtube_recs, whisper_recs)
        duration_info['gemini'] = f"{time.time() - start:.1f}s"
        print(f"  Time: {duration_info['gemini']}", flush=True)

        # Step 6: Generate report
        print("\n[6/6] Generating report...", flush=True)
        report_path = generate_report(
            video, youtube_transcript, whisper_transcript,
            transcript_comparison, youtube_recs, whisper_recs,
            recs_comparison, duration_info
        )
        print(f"  Report saved to: {report_path}", flush=True)

        # Cleanup
        if not args.keep_audio and audio_file.exists():
            audio_file.unlink()
            print("  Cleaned up audio file", flush=True)

        print("\n" + "="*60, flush=True)
        print("TEST COMPLETE", flush=True)
        print("="*60, flush=True)
        print(f"\nReport: {report_path}", flush=True)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
