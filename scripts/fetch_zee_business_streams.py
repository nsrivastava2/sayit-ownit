#!/usr/bin/env python3
"""
Fetch Zee Business live stream data from YouTube
Uses yt-dlp to extract metadata for market-related live streams
"""

import subprocess
import json
import sys
from datetime import datetime
import csv
import os

def get_streams_data():
    """Fetch live streams metadata using yt-dlp"""
    print("Fetching Zee Business live streams... This may take several minutes.", file=sys.stderr)

    cmd = [
        'yt-dlp',
        '--flat-playlist',
        '-j',
        '--dateafter', '20250101',
        '--datebefore', '20260102',
        'https://www.youtube.com/@ZeeBusiness/streams'
    ]

    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    videos = []
    for line in process.stdout:
        try:
            data = json.loads(line.strip())
            videos.append({
                'id': data.get('id', ''),
                'title': data.get('title', ''),
                'duration': data.get('duration', 0),
                'upload_date': data.get('upload_date', ''),
                'url': f"https://www.youtube.com/watch?v={data.get('id', '')}"
            })
            # Print progress
            if len(videos) % 100 == 0:
                print(f"Fetched {len(videos)} videos...", file=sys.stderr)
        except json.JSONDecodeError:
            continue

    process.wait()
    return videos

def format_duration(seconds):
    """Convert seconds to human readable format"""
    if not seconds:
        return "N/A"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

def is_trading_day(date_str):
    """Check if a date is a trading day (Mon-Fri, not a holiday)"""
    if not date_str or len(date_str) != 8:
        return True  # Include if date unknown

    try:
        date = datetime.strptime(date_str, '%Y%m%d')
        # Check if weekend
        if date.weekday() >= 5:  # Saturday=5, Sunday=6
            return False

        # Indian stock market holidays 2025 (NSE/BSE)
        holidays_2025 = [
            '20250126',  # Republic Day (Sunday - market closed anyway)
            '20250226',  # Maha Shivaratri
            '20250314',  # Holi
            '20250331',  # Id-Ul-Fitr (Eid)
            '20250410',  # Shri Mahavir Jayanti
            '20250414',  # Dr. Ambedkar Jayanti
            '20250418',  # Good Friday
            '20250501',  # Maharashtra Day
            '20250815',  # Independence Day
            '20250827',  # Janmashtami
            '20251002',  # Mahatma Gandhi Jayanti
            '20251020',  # Diwali-Laxmi Puja
            '20251021',  # Diwali-Balipratipada
            '20251105',  # Prakash Gurpurab Sri Guru Nanak Dev
            '20251225',  # Christmas
        ]

        if date_str in holidays_2025:
            return False

        return True
    except:
        return True

def is_market_show(title):
    """Check if the show is a market-related live show"""
    market_keywords = [
        'first trade', 'final trade', 'share bazaar', 'market radar',
        'traders diary', 'bazaar aaj', 'stock market', 'share market',
        'zee business live', 'anil singhvi', 'commodity live',
        'nifty', 'bank nifty', 'sensex', 'bazaar live'
    ]
    title_lower = title.lower()
    return any(kw in title_lower for kw in market_keywords)

def save_to_csv(videos, filename):
    """Save videos to CSV file"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Date', 'Day', 'Title', 'Duration', 'URL', 'Video ID'])
        for v in videos:
            writer.writerow([
                v.get('date_formatted', 'Unknown'),
                v.get('day_of_week', ''),
                v['title'],
                v.get('duration_formatted', 'N/A'),
                v['url'],
                v['id']
            ])
    print(f"Saved {len(videos)} videos to {filename}", file=sys.stderr)

def save_to_json(videos, filename):
    """Save videos to JSON file"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(videos)} videos to {filename}", file=sys.stderr)

if __name__ == '__main__':
    videos = get_streams_data()

    # Process and filter videos
    market_videos = []
    for v in videos:
        # Add formatted fields
        v['duration_formatted'] = format_duration(v['duration'])
        if v['upload_date'] and len(v['upload_date']) == 8:
            try:
                date = datetime.strptime(v['upload_date'], '%Y%m%d')
                v['date_formatted'] = date.strftime('%Y-%m-%d')
                v['day_of_week'] = date.strftime('%A')
            except:
                v['date_formatted'] = 'Unknown'
                v['day_of_week'] = ''
        else:
            v['date_formatted'] = 'Unknown'
            v['day_of_week'] = ''

        # Filter for trading days and market shows
        if is_trading_day(v['upload_date']) and is_market_show(v['title']):
            market_videos.append(v)

    # Sort by date (newest first)
    market_videos.sort(key=lambda x: x.get('upload_date', ''), reverse=True)

    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Total videos fetched: {len(videos)}", file=sys.stderr)
    print(f"Market videos on trading days: {len(market_videos)}", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)

    # Save to files
    output_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(output_dir, '..', 'zee_business_market_streams_2025.csv')
    json_file = os.path.join(output_dir, '..', 'zee_business_market_streams_2025.json')

    save_to_csv(market_videos, csv_file)
    save_to_json(market_videos, json_file)

    print(f"\nFiles saved:", file=sys.stderr)
    print(f"  - {csv_file}", file=sys.stderr)
    print(f"  - {json_file}", file=sys.stderr)
