import { useState } from 'react';

/**
 * Reusable floating video player component for YouTube embeds
 * Supports small/large size toggle and auto-plays at specified timestamp
 */
function FloatingVideoPlayer({ videoId, timestamp = 0, title = 'Video', onClose }) {
  const [isLarge, setIsLarge] = useState(false);

  if (!videoId) return null;

  return (
    <div className={`fixed bottom-4 right-4 bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden z-50 transition-all duration-200 ${
      isLarge ? 'w-[640px]' : 'w-96'
    }`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
        <span className="text-xs font-medium text-gray-700 truncate flex-1">
          {title}
        </span>
        <div className="flex items-center gap-1 ml-2">
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
        <iframe
          key={`${videoId}-${timestamp}`}
          src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(timestamp)}&autoplay=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export default FloatingVideoPlayer;
