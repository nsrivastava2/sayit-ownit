#!/usr/bin/env python3
"""Process YouTube search results for Zee Business market shows"""

import json
import csv
from datetime import datetime
import os
import glob
import re

def format_duration(seconds):
    if not seconds:
        return "N/A"
    try:
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"
    except:
        return "N/A"

def extract_date_from_title(title):
    """Extract date from title like 'First Trade 30th December 2025'"""
    # Patterns to match
    patterns = [
        r'(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})',
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})',
        r'(\d{1,2})/(\d{1,2})/(\d{4})',
        r'(\d{4})-(\d{1,2})-(\d{1,2})',
    ]

    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    }

    for pattern in patterns[:2]:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            groups = match.groups()
            if groups[1].lower() in months:  # day month year
                day = int(groups[0])
                month = months[groups[1].lower()]
                year = int(groups[2])
            else:  # month day year
                month = months[groups[0].lower()]
                day = int(groups[1])
                year = int(groups[2])
            try:
                return datetime(year, month, day)
            except:
                pass

    return None

def is_trading_day(date):
    if not date:
        return True
    if date.weekday() >= 5:
        return False
    date_str = date.strftime('%Y%m%d')
    holidays = ['20250226','20250314','20250331','20250410','20250414',
               '20250418','20250501','20250815','20250827','20251002',
               '20251020','20251021','20251105','20251225']
    if date_str in holidays:
        return False
    return True

def is_zee_business(channel):
    """Check if video is from Zee Business channel"""
    channel_lower = (channel or '').lower()
    return 'zee business' in channel_lower or 'zeebusiness' in channel_lower

# Find all jsonl files
base_dir = '/mnt/2tbdisk/proxmox-home-dir/sayit-ownit'
jsonl_files = glob.glob(os.path.join(base_dir, '*.jsonl'))

# Collect all unique videos
seen_ids = set()
all_videos = []

for filepath in jsonl_files:
    if os.path.getsize(filepath) == 0:
        continue
    print(f"Processing {os.path.basename(filepath)}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line.strip())
                video_id = data.get('id', '')
                channel = data.get('channel', data.get('uploader', ''))
                title = data.get('title', '')

                if video_id and video_id not in seen_ids and is_zee_business(channel):
                    # Extract date from title
                    date_obj = extract_date_from_title(title)

                    # Only include 2025 videos on trading days
                    if date_obj and date_obj.year == 2025 and is_trading_day(date_obj):
                        seen_ids.add(video_id)
                        all_videos.append({
                            'id': video_id,
                            'title': title,
                            'duration': data.get('duration', 0),
                            'duration_formatted': format_duration(data.get('duration', 0)),
                            'duration_string': data.get('duration_string', ''),
                            'upload_date': date_obj.strftime('%Y%m%d'),
                            'date_formatted': date_obj.strftime('%Y-%m-%d'),
                            'day_of_week': date_obj.strftime('%A'),
                            'url': f"https://www.youtube.com/watch?v={video_id}",
                            'channel': channel,
                            'views': data.get('view_count', 0)
                        })
            except json.JSONDecodeError:
                continue

# Sort by date (newest first)
all_videos.sort(key=lambda x: x.get('upload_date', ''), reverse=True)

# Save to JSON
json_output = os.path.join(base_dir, 'zee_business_market_streams_2025.json')
with open(json_output, 'w', encoding='utf-8') as f:
    json.dump(all_videos, f, indent=2, ensure_ascii=False)

# Save to CSV
csv_output = os.path.join(base_dir, 'zee_business_market_streams_2025.csv')
with open(csv_output, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Date', 'Day', 'Title', 'Duration', 'URL', 'Video ID', 'Views'])
    for v in all_videos:
        writer.writerow([
            v['date_formatted'],
            v['day_of_week'],
            v['title'],
            v['duration_string'] or v['duration_formatted'],
            v['url'],
            v['id'],
            v.get('views', 0)
        ])

# Print summary by month
print(f"\n{'='*60}")
print(f"Total market videos on trading days: {len(all_videos)}")
print(f"{'='*60}")

# Group by month
by_month = {}
for v in all_videos:
    month = v['upload_date'][:6] if v['upload_date'] else 'Unknown'
    by_month[month] = by_month.get(month, 0) + 1

print("\nVideos by month:")
for month in sorted(by_month.keys()):
    try:
        month_name = datetime.strptime(month, '%Y%m').strftime('%B %Y')
    except:
        month_name = month
    print(f"  {month_name}: {by_month[month]} videos")

# Show date range
if all_videos:
    oldest = min(v['date_formatted'] for v in all_videos)
    newest = max(v['date_formatted'] for v in all_videos)
    print(f"\nDate range: {oldest} to {newest}")

print(f"\nSaved to:")
print(f"  {json_output}")
print(f"  {csv_output}")
