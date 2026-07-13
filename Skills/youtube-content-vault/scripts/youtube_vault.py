#!/usr/bin/env python3
"""
YouTube Content Vault - Download videos and generate transcripts
for the Crash Out Diary content vault.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Default output directory
VAULT_DIR = Path("/home/workspace/Content-Vault")

def sanitize_filename(filename):
    """Sanitize filename for filesystem compatibility."""
    return re.sub(r'[<>:"/\\|?*]', '_', filename)[:100]

def get_video_info(url):
    """Get video metadata without downloading."""
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-download",
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error getting video info: {result.stderr}")
        return None
    return json.loads(result.stdout.strip().split('\n')[0])

def download_video(url, output_dir):
    """Download video to specified directory."""
    print(f"Downloading: {url}")
    
    cmd = [
        "yt-dlp",
        "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--output", f"{output_dir}/video.%(ext)s",
        "--write-info-json",
        "--write-thumbnail",
        "--embed-subs",
        "--sub-langs", "en",
        "--convert-subs", "srt",
        url
    ]
    
    result = subprocess.run(cmd)
    return result.returncode == 0

def extract_audio(video_path, output_path):
    """Extract audio from video for transcription."""
    cmd = [
        "ffmpeg",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path),
        "-y"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0

def transcribe_with_whisper(audio_path, output_dir):
    """Generate transcript using Whisper."""
    print("Generating transcript with Whisper...")
    
    import whisper
    
    model = whisper.load_model("base")
    result = model.transcribe(str(audio_path))
    
    # Save full transcript as text
    transcript_path = output_dir / "transcript.txt"
    with open(transcript_path, 'w') as f:
        f.write(result["text"])
    
    # Save timestamped transcript as JSON
    transcript_json_path = output_dir / "transcript.json"
    with open(transcript_json_path, 'w') as f:
        json.dump({
            "text": result["text"],
            "segments": result["segments"],
            "language": result.get("language", "en")
        }, f, indent=2)
    
    print(f"Transcript saved to: {transcript_path}")
    print(f"Timestamped transcript saved to: {transcript_json_path}")
    
    return result["text"]

def extract_captions(video_path, output_dir):
    """Try to extract YouTube captions if available."""
    # Look for SRT files that yt-dlp might have downloaded
    srt_files = list(Path(output_dir).glob("*.en.srt")) + list(Path(output_dir).glob("*.srt"))
    
    if srt_files:
        print(f"Found captions: {srt_files[0]}")
        with open(srt_files[0], 'r') as f:
            content = f.read()
        
        # Parse SRT to plain text
        lines = content.split('\n\n')
        text_parts = []
        for line in lines:
            parts = line.split('\n')
            if len(parts) >= 3:
                text_parts.append(' '.join(parts[2:]))
        
        transcript = ' '.join(text_parts)
        
        # Save plain text transcript
        transcript_path = output_dir / "transcript.txt"
        with open(transcript_path, 'w') as f:
            f.write(transcript)
        
        # Save JSON version with timing info
        segments = []
        for line in lines:
            parts = line.split('\n')
            if len(parts) >= 3:
                timecode = parts[1] if len(parts) > 1 else "00:00:00,000 --> 00:00:00,000"
                start_time = timecode.split(' --> ')[0] if ' --> ' in timecode else "00:00:00,000"
                text = ' '.join(parts[2:])
                segments.append({
                    "start": start_time,
                    "text": text
                })
        
        transcript_json_path = output_dir / "transcript.json"
        with open(transcript_json_path, 'w') as f:
            json.dump({
                "text": transcript,
                "segments": segments,
                "source": "youtube_captions"
            }, f, indent=2)
        
        return transcript
    
    return None

def create_metadata(info, output_dir):
    """Create metadata JSON file."""
    metadata = {
        "title": info.get("title", "Unknown"),
        "channel": info.get("channel", "Unknown"),
        "channel_id": info.get("channel_id", ""),
        "upload_date": info.get("upload_date", ""),
        "description": info.get("description", ""),
        "duration": info.get("duration", 0),
        "view_count": info.get("view_count", 0),
        "like_count": info.get("like_count", 0),
        "tags": info.get("tags", []),
        "categories": info.get("categories", []),
        "webpage_url": info.get("webpage_url", ""),
        "downloaded_at": datetime.now().isoformat(),
        "vault_path": str(output_dir.relative_to(VAULT_DIR.parent))
    }
    
    metadata_path = output_dir / "metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    return metadata

def process_video(url, download=True, transcribe=True):
    """Download and process a single video."""
    # Get video info first
    info = get_video_info(url)
    if not info:
        print("Failed to get video info")
        return False
    
    # Create output directory
    date_prefix = datetime.now().strftime("%Y-%m-%d")
    title = sanitize_filename(info.get("title", "unknown"))
    output_dir = VAULT_DIR / f"{date_prefix}_{title}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Output directory: {output_dir}")
    
    # Download video
    if download:
        if not download_video(url, output_dir):
            print("Download failed")
            return False
    
    # Create metadata
    create_metadata(info, output_dir)
    
    # Generate transcript
    if transcribe:
        video_path = output_dir / "video.mp4"
        
        # Try YouTube captions first
        caption_transcript = extract_captions(video_path, output_dir)
        
        if not caption_transcript and video_path.exists():
            # Fall back to Whisper
            audio_path = output_dir / "audio.wav"
            if extract_audio(video_path, audio_path):
                transcribe_with_whisper(audio_path, output_dir)
                # Clean up audio file
                audio_path.unlink(missing_ok=True)
    
    print(f"\n✓ Video processed successfully!")
    print(f"  Location: {output_dir}")
    print(f"  Title: {info.get('title')}")
    print(f"  Channel: {info.get('channel')}")
    
    return True

def download_playlist(url, limit=None):
    """Download all videos from a playlist."""
    print(f"Processing playlist: {url}")
    
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-json",
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error getting playlist: {result.stderr}")
        return
    
    videos = [json.loads(line) for line in result.stdout.strip().split('\n') if line]
    
    if limit:
        videos = videos[:limit]
    
    print(f"Found {len(videos)} videos in playlist")
    
    for i, video in enumerate(videos, 1):
        print(f"\n[{i}/{len(videos)}] Processing: {video.get('title', 'Unknown')}")
        video_url = f"https://youtube.com/watch?v={video.get('id')}"
        process_video(video_url)

def download_channel(url, limit=10):
    """Download recent videos from a channel."""
    print(f"Processing channel: {url}")
    
    # Get recent videos from channel
    cmd = [
        "yt-dlp",
        "--playlist-end", str(limit),
        "--flat-playlist",
        "--dump-json",
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error getting channel videos: {result.stderr}")
        return
    
    videos = [json.loads(line) for line in result.stdout.strip().split('\n') if line]
    
    print(f"Found {len(videos)} recent videos")
    
    for i, video in enumerate(videos, 1):
        print(f"\n[{i}/{len(videos)}] Processing: {video.get('title', 'Unknown')}")
        video_url = f"https://youtube.com/watch?v={video.get('id')}"
        process_video(video_url)

def main():
    parser = argparse.ArgumentParser(
        description="YouTube Content Vault - Download and transcribe videos"
    )
    parser.add_argument(
        "command",
        choices=["download", "transcript", "full", "playlist", "channel"],
        help="Command to execute"
    )
    parser.add_argument(
        "url_or_path",
        help="YouTube URL or local video path"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of videos (for playlist/channel)"
    )
    
    args = parser.parse_args()
    
    # Create vault directory
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    
    if args.command == "download":
        process_video(args.url_or_path, download=True, transcribe=False)
    
    elif args.command == "transcript":
        video_path = Path(args.url_or_path)
        output_dir = video_path.parent
        
        # Try captions first
        caption_transcript = extract_captions(video_path, output_dir)
        
        if not caption_transcript:
            audio_path = output_dir / "audio.wav"
            if extract_audio(video_path, audio_path):
                transcribe_with_whisper(audio_path, output_dir)
                audio_path.unlink(missing_ok=True)
    
    elif args.command == "full":
        process_video(args.url_or_path, download=True, transcribe=True)
    
    elif args.command == "playlist":
        download_playlist(args.url_or_path, args.limit)
    
    elif args.command == "channel":
        limit = args.limit or 10
        download_channel(args.url_or_path, limit)

if __name__ == "__main__":
    main()
