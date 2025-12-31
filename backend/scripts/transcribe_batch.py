#!/usr/bin/env python3
"""
Batch transcription script using faster-whisper library.
Processes multiple audio files with a single model load for efficiency.
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

def main():
    parser = argparse.ArgumentParser(description='Batch transcribe audio using faster-whisper')
    parser.add_argument('audio_dir', help='Directory containing audio chunks (chunk_XXX.wav)')
    parser.add_argument('--model', default='large-v3', help='Model size (tiny, base, small, medium, large-v2, large-v3)')
    parser.add_argument('--language', default=None, help='Language code (e.g., en, hi) or None for auto-detect')
    parser.add_argument('--device', default='auto', help='Device to use (auto, cpu, cuda)')
    parser.add_argument('--compute-type', default='auto', help='Compute type (auto, int8, float16, float32)')
    parser.add_argument('--output', default=None, help='Output JSON file path')

    args = parser.parse_args()

    # Import here to fail fast if not installed
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({
            'error': 'faster-whisper not installed. Run: pip3 install faster-whisper'
        }))
        sys.exit(1)

    audio_dir = Path(args.audio_dir)
    if not audio_dir.exists():
        print(json.dumps({
            'error': f'Audio directory not found: {audio_dir}'
        }))
        sys.exit(1)

    # Find all chunk files
    chunk_files = sorted(audio_dir.glob('chunk_*.wav'))
    if not chunk_files:
        print(json.dumps({
            'error': f'No chunk files found in {audio_dir}'
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

    try:
        # Load model ONCE
        print(f"Loading faster-whisper model '{args.model}' on {device}...", file=sys.stderr)
        model = WhisperModel(args.model, device=device, compute_type=compute_type)
        print(f"Model loaded. Processing {len(chunk_files)} chunks...", file=sys.stderr)

        language = args.language if args.language and args.language != 'auto' else None
        results = []

        for i, chunk_file in enumerate(chunk_files):
            print(f"Transcribing chunk {i+1}/{len(chunk_files)}: {chunk_file.name}", file=sys.stderr)

            try:
                segments, info = model.transcribe(
                    str(chunk_file),
                    language=language,
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

                # Extract chunk index from filename
                chunk_index = int(chunk_file.stem.split('_')[1])

                results.append({
                    'chunk_index': chunk_index,
                    'file': chunk_file.name,
                    'text': ' '.join(full_text),
                    'language': info.language,
                    'language_probability': info.language_probability,
                    'segments': segment_list
                })
            except Exception as e:
                print(f"Error processing {chunk_file.name}: {e}", file=sys.stderr)
                chunk_index = int(chunk_file.stem.split('_')[1])
                results.append({
                    'chunk_index': chunk_index,
                    'file': chunk_file.name,
                    'text': '',
                    'error': str(e)
                })

        output = {
            'chunks': results,
            'total_chunks': len(chunk_files)
        }

        # Output results
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(output, f, ensure_ascii=False, indent=2)
            print(f"Results written to {args.output}", file=sys.stderr)

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
