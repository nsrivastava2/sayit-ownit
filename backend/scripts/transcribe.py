#!/usr/bin/env python3
"""
Transcription script using faster-whisper library.
Called from Node.js transcriptionService.
"""

import os
import argparse
import json
import sys
from pathlib import Path

# Preload CUDA libraries before importing torch/ctranslate2
import ctypes
cudnn_lib_path = os.path.expanduser('~/.local/lib/python3.11/site-packages/nvidia/cudnn/lib')
cublas_lib_path = os.path.expanduser('~/.local/lib/python3.11/site-packages/nvidia/cublas/lib')
nvjitlink_lib_path = os.path.expanduser('~/.local/lib/python3.11/site-packages/nvidia/nvjitlink/lib')

# Load libraries in dependency order
for lib_path in [nvjitlink_lib_path, cublas_lib_path, cudnn_lib_path]:
    if os.path.exists(lib_path):
        for lib in sorted(Path(lib_path).glob('*.so*')):
            try:
                ctypes.CDLL(str(lib), mode=ctypes.RTLD_GLOBAL)
            except OSError:
                pass

def transcribe_audio(audio_path, model_name, language, device, compute_type):
    """Transcribe audio using faster-whisper."""
    from faster_whisper import WhisperModel

    print(f"Loading faster-whisper model '{model_name}' on {device}...", file=sys.stderr)
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    print(f"Transcribing {audio_path}...", file=sys.stderr)
    lang = language if language and language != 'auto' else None

    segments, info = model.transcribe(
        str(audio_path),
        language=lang,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    # Collect segments
    segment_list = []
    full_text = []

    for segment in segments:
        segment_list.append({
            'start': segment.start,
            'end': segment.end,
            'text': segment.text.strip()
        })
        full_text.append(segment.text.strip())

    return {
        'text': ' '.join(full_text),
        'language': info.language,
        'language_probability': info.language_probability,
        'duration': info.duration,
        'segments': segment_list
    }

def main():
    parser = argparse.ArgumentParser(description='Transcribe audio using faster-whisper')
    parser.add_argument('audio_path', help='Path to the audio file')
    parser.add_argument('--model', default='medium', help='Model size (tiny, base, small, medium, large-v2, large-v3)')
    parser.add_argument('--language', default=None, help='Language code (e.g., en, hi) or None for auto-detect')
    parser.add_argument('--device', default='auto', help='Device to use (auto, cpu, cuda)')
    parser.add_argument('--compute-type', default='auto', help='Compute type (auto, int8, float16, float32)')

    args = parser.parse_args()

    # Import here to fail fast if not installed
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({
            'error': 'faster-whisper not installed. Run: pip3 install faster-whisper'
        }))
        sys.exit(1)

    audio_path = Path(args.audio_path)
    if not audio_path.exists():
        print(json.dumps({
            'error': f'Audio file not found: {audio_path}'
        }))
        sys.exit(1)

    # Determine device and compute type
    device = args.device
    compute_type = args.compute_type

    if device == 'auto':
        try:
            import torch
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        except ImportError:
            device = 'cpu'

    if compute_type == 'auto':
        compute_type = 'float16' if device == 'cuda' else 'int8'

    # Try CUDA first, fall back to CPU if it fails
    try:
        result = transcribe_audio(audio_path, args.model, args.language, device, compute_type)
        print(json.dumps(result))
    except Exception as e:
        if device == 'cuda':
            # CUDA failed, try CPU as fallback
            print(f"CUDA failed ({e}), falling back to CPU...", file=sys.stderr)
            try:
                result = transcribe_audio(audio_path, args.model, args.language, 'cpu', 'int8')
                print(json.dumps(result))
                return
            except Exception as cpu_error:
                print(json.dumps({
                    'error': f'Both CUDA and CPU failed: {cpu_error}'
                }))
                sys.exit(1)
        else:
            print(json.dumps({
                'error': str(e)
            }))
            sys.exit(1)

if __name__ == '__main__':
    main()
