#!/bin/bash
# Extract Zee Business live streams from 2025
# Uses yt-dlp to fetch metadata

OUTPUT_FILE="/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_raw_streams.jsonl"
FINAL_JSON="/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_market_streams_2025.json"
FINAL_CSV="/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_market_streams_2025.csv"

echo "Extracting Zee Business live streams..."
echo "This may take 10-15 minutes..."

# Extract using yt-dlp with flat playlist (faster)
yt-dlp --flat-playlist -j \
  --dateafter 20250101 \
  --datebefore 20260102 \
  "https://www.youtube.com/@ZeeBusiness/streams" 2>/dev/null > "$OUTPUT_FILE"

# Count total videos
TOTAL=$(wc -l < "$OUTPUT_FILE")
echo "Extracted $TOTAL videos total"

# Process with Python
python3 << 'PYTHON_SCRIPT'
import json
import csv
from datetime import datetime, timedelta
import re

INPUT_FILE = "/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_raw_streams.jsonl"
OUTPUT_JSON = "/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_market_streams_2025.json"
OUTPUT_CSV = "/mnt/2tbdisk/proxmox-home-dir/sayit-ownit/zee_business_market_streams_2025.csv"

def format_duration(seconds):
    if not seconds:
        return "N/A"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

def is_trading_day(date_str):
    if not date_str or len(date_str) != 8:
        return True
    try:
        date = datetime.strptime(date_str, '%Y%m%d')
        if date.weekday() >= 5:
            return False
        holidays = ['20250226','20250314','20250331','20250410','20250414',
                   '20250418','20250501','20250815','20250827','20251002',
                   '20251020','20251021','20251105','20251225']
        if date_str in holidays:
            return False
        return True
    except:
        return True

def is_market_show(title):
    keywords = ['first trade', 'final trade', 'share bazaar', 'market radar',
                'traders diary', 'bazaar aaj', 'stock market', 'share market',
                'zee business live', 'anil singhvi', 'commodity live',
                'nifty', 'bank nifty', 'sensex', 'market live', 'bazaar live']
    title_lower = title.lower()
    return any(kw in title_lower for kw in keywords)

videos = []
with open(INPUT_FILE, 'r') as f:
    for line in f:
        try:
            data = json.loads(line.strip())
            upload_date = data.get('upload_date', '')
            title = data.get('title', '')

            if is_trading_day(upload_date) and is_market_show(title):
                videos.append({
                    'id': data.get('id', ''),
                    'title': title,
                    'duration': data.get('duration', 0),
                    'duration_formatted': format_duration(data.get('duration', 0)),
                    'upload_date': upload_date,
                    'date_formatted': datetime.strptime(upload_date, '%Y%m%d').strftime('%Y-%m-%d') if upload_date else '',
                    'day_of_week': datetime.strptime(upload_date, '%Y%m%d').strftime('%A') if upload_date else '',
                    'url': f"https://www.youtube.com/watch?v={data.get('id', '')}"
                })
        except:
            continue

# Sort by date
videos.sort(key=lambda x: x.get('upload_date', ''), reverse=True)

# Save JSON
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(videos, f, indent=2, ensure_ascii=False)

# Save CSV
with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Date', 'Day', 'Title', 'Duration', 'URL', 'Video ID'])
    for v in videos:
        writer.writerow([v['date_formatted'], v['day_of_week'], v['title'],
                        v['duration_formatted'], v['url'], v['id']])

print(f"Saved {len(videos)} market videos to:")
print(f"  {OUTPUT_JSON}")
print(f"  {OUTPUT_CSV}")
PYTHON_SCRIPT

echo "Done!"
