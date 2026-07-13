---
name: youtube-content-vault
description: Download YouTube videos and generate transcripts for the Crash Out Diary content vault. Supports single videos, playlists, and channels.
compatibility: Created for Zo Computer
metadata:
  author: karimadigital.zo.computer
  created: 2026-02-10
  category: content-management
---

# YouTube Content Vault

Download YouTube videos and generate transcripts for the Crash Out Diary content vault.

## Usage

```bash
cd /home/workspace/Skills/youtube-content-vault/scripts

# Download a single video
python3 youtube_vault.py download "https://youtube.com/watch?v=..."

# Download a playlist
python3 youtube_vault.py playlist "https://youtube.com/playlist?list=..."

# Download a channel's recent videos
python3 youtube_vault.py channel "https://youtube.com/@channelname"

# Generate transcript for a downloaded video
python3 youtube_vault.py transcript /path/to/video.mp4

# Download + transcribe in one command
python3 youtube_vault.py full "https://youtube.com/watch?v=..."
```

## Output Structure

```
Content-Vault/
├── 2026-02-10_video-title/
│   ├── video.mp4
│   ├── transcript.txt
│   ├── transcript.json (timestamped)
│   └── metadata.json (title, channel, upload date, etc.)
```

## Features

- Downloads videos in best available quality
- Generates full text transcript
- Creates timestamped JSON transcript for easy reference
- Extracts metadata (title, channel, upload date, description, tags)
- Organizes files by download date and video title
- Supports captions/transcripts if available on YouTube
- Falls back to Whisper AI transcription if no captions available

## Requirements

- yt-dlp (YouTube downloader)
- ffmpeg (for audio extraction)
- whisper (OpenAI Whisper for transcription fallback)

Install dependencies:
```bash
pip install yt-dlp openai-whisper
apt install -y ffmpeg
```

## Notes

- Transcripts are saved in plain text and JSON formats
- Use the JSON transcript for timestamped navigation
- Metadata helps with content organization and search
- Videos are organized in dated folders for easy browsing
