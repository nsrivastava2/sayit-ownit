import { useState, useEffect, useRef } from 'react';

/**
 * Reusable floating video player component for YouTube embeds
 * Supports small/large size toggle, auto-plays at specified timestamp
 * Optional playbackRate prop for faster review (e.g., 2x for admin)
 */
function FloatingVideoPlayer({ videoId, timestamp = 0, title = 'Video', onClose, playbackRate = 1 }) {
  const [isLarge, setIsLarge] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(playbackRate);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize player when API is ready
  useEffect(() => {
    if (!videoId) return;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player(iframeRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(timestamp),
          enablejsapi: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setPlaybackRate(currentSpeed);
          },
          onStateChange: (event) => {
            // Ensure playback rate persists after state changes
            if (event.data === window.YT.PlayerState.PLAYING) {
              event.target.setPlaybackRate(currentSpeed);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, timestamp]);

  // Update playback rate when speed changes
  useEffect(() => {
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(currentSpeed);
    }
  }, [currentSpeed]);

  if (!videoId) return null;

  const speeds = [1, 1.5, 2];

  return (
    <div className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden z-50 transition-all duration-200 ${
      isLarge ? 'w-[640px]' : 'w-96'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
        <span className="text-xs font-medium text-gray-700 truncate flex-1">
          {title}
        </span>
        <div className="flex items-center gap-1 ml-2">
          {/* Speed selector */}
          <div className="flex items-center gap-0.5 mr-1">
            {speeds.map(speed => (
              <button
                key={speed}
                onClick={() => setCurrentSpeed(speed)}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  currentSpeed === speed
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
                title={`${speed}x speed`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsLarge(!isLarge)}
            className="text-gray-500 hover:text-gray-700 text-sm px-1"
            title={isLarge ? 'Shrink' : 'Expand'}
          >
            {isLarge ? '⊖' : '⊕'}
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg leading-none"
            title="Close"
          >
            &times;
          </button>
        </div>
      </div>
      <div className="aspect-video">
        <div ref={iframeRef} className="w-full h-full" />
      </div>
    </div>
  );
}

export default FloatingVideoPlayer;
