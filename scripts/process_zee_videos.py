#!/usr/bin/env python3
"""
Process Zee Business video data extracted from YouTube
Filter for market-related shows on trading days
"""

import json
import csv
from datetime import datetime, timedelta
import re
import sys
import os

def parse_duration(duration_str):
    """Convert duration string to seconds"""
    if not duration_str or duration_str == 'LIVE':
        return 0

    parts = duration_str.split(':')
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 1:
            return int(parts[0])
    except:
        pass
    return 0

def format_duration(seconds):
    """Convert seconds to human readable format"""
    if seconds == 0:
        return "LIVE/Unknown"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

def parse_relative_date(meta_str, reference_date=None):
    """Parse relative date from meta string like 'Streamed 2 days ago'"""
    if not reference_date:
        reference_date = datetime.now()

    if not meta_str:
        return None

    meta_lower = meta_str.lower()

    # Handle various formats
    patterns = [
        (r'(\d+)\s*minutes?\s*ago', 'minutes'),
        (r'(\d+)\s*hours?\s*ago', 'hours'),
        (r'(\d+)\s*days?\s*ago', 'days'),
        (r'(\d+)\s*weeks?\s*ago', 'weeks'),
        (r'(\d+)\s*months?\s*ago', 'months'),
        (r'(\d+)\s*years?\s*ago', 'years'),
    ]

    for pattern, unit in patterns:
        match = re.search(pattern, meta_lower)
        if match:
            value = int(match.group(1))
            if unit == 'minutes':
                return reference_date - timedelta(minutes=value)
            elif unit == 'hours':
                return reference_date - timedelta(hours=value)
            elif unit == 'days':
                return reference_date - timedelta(days=value)
            elif unit == 'weeks':
                return reference_date - timedelta(weeks=value)
            elif unit == 'months':
                return reference_date - timedelta(days=value*30)
            elif unit == 'years':
                return reference_date - timedelta(days=value*365)

    return None

def is_trading_day(date):
    """Check if a date is a trading day (Mon-Fri, not a holiday)"""
    if not date:
        return True  # Include if date unknown

    # Check if weekend
    if date.weekday() >= 5:  # Saturday=5, Sunday=6
        return False

    date_str = date.strftime('%Y%m%d')

    # Indian stock market holidays 2025 (NSE/BSE)
    holidays_2025 = [
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

def is_market_show(title):
    """Check if the show is a market-related live show"""
    market_keywords = [
        'first trade', 'final trade', 'share bazaar', 'market radar',
        'traders diary', 'bazaar aaj', 'stock market', 'share market',
        'zee business live', 'anil singhvi', 'commodity live',
        'nifty', 'bank nifty', 'sensex', 'market live',
        'bazaar live', 'special 26', 'sector outlook'
    ]
    title_lower = title.lower()
    return any(kw in title_lower for kw in market_keywords)

def process_videos(input_file, output_csv, output_json):
    """Process video data and filter for market shows on trading days"""
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    videos = data.get('videos', data) if isinstance(data, dict) else data

    # Reference date for relative date parsing
    reference_date = datetime(2026, 1, 1, 18, 0)  # Assuming extraction on Jan 1, 2026 evening

    processed = []
    for v in videos:
        # Parse date
        date = parse_relative_date(v.get('meta', ''), reference_date)

        # Skip if before Jan 1, 2025
        if date and date < datetime(2025, 1, 1):
            continue

        # Skip if after Jan 1, 2026
        if date and date > datetime(2026, 1, 2):
            continue

        # Check if trading day and market show
        if is_trading_day(date) and is_market_show(v.get('title', '')):
            duration_secs = parse_duration(v.get('duration', ''))
            processed.append({
                'id': v.get('id', ''),
                'title': v.get('title', ''),
                'duration': v.get('duration', ''),
                'duration_formatted': format_duration(duration_secs),
                'duration_seconds': duration_secs,
                'date': date.strftime('%Y-%m-%d') if date else 'Unknown',
                'day_of_week': date.strftime('%A') if date else '',
                'url': v.get('url', ''),
                'meta_raw': v.get('meta', '')
            })

    # Sort by date (newest first)
    processed.sort(key=lambda x: x['date'], reverse=True)

    # Save to CSV
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Date', 'Day', 'Title', 'Duration', 'URL', 'Video ID'])
        for v in processed:
            writer.writerow([
                v['date'],
                v['day_of_week'],
                v['title'],
                v['duration'],
                v['url'],
                v['id']
            ])

    # Save to JSON
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(processed, f, indent=2, ensure_ascii=False)

    return processed

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python process_zee_videos.py <input_json>")
        sys.exit(1)

    input_file = sys.argv[1]
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_csv = os.path.join(base_dir, 'zee_business_market_streams_2025.csv')
    output_json = os.path.join(base_dir, 'zee_business_market_streams_2025.json')

    processed = process_videos(input_file, output_csv, output_json)

    print(f"Processed {len(processed)} market videos on trading days")
    print(f"Saved to:")
    print(f"  - {output_csv}")
    print(f"  - {output_json}")
