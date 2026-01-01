import { useState, useCallback } from 'react';

/**
 * Custom hook for managing floating video player state
 * @returns {Object} { videoPlayer, openVideoPlayer, closeVideoPlayer }
 */
export function useVideoPlayer() {
  const [videoPlayer, setVideoPlayer] = useState(null);

  const openVideoPlayer = useCallback((url, timestamp, title) => {
    if (!url) return;
    // Extract YouTube video ID from various URL formats
    const match = url.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
    if (match) {
      setVideoPlayer({
        videoId: match[1],
        timestamp: timestamp || 0,
        title: title || 'Video'
      });
    }
  }, []);

  const closeVideoPlayer = useCallback(() => {
    setVideoPlayer(null);
  }, []);

  return { videoPlayer, openVideoPlayer, closeVideoPlayer };
}

export default useVideoPlayer;
