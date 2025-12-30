import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

function VideoDetails() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    loadVideo();
  }, [id]);

  async function loadVideo() {
    try {
      setLoading(true);
      const data = await api.getVideo(id);
      setVideo(data.video);
      setTranscripts(data.transcripts);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getYouTubeEmbedUrl(url) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([^&\s]+)/);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
      </div>
    );
  }

  const embedUrl = video?.youtube_url ? getYouTubeEmbedUrl(video.youtube_url) : null;
  const fullTranscript = transcripts.map(t => t.transcript_text).join(' ');

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/"
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
      >
        ← Back to Dashboard
      </Link>

      {/* Video header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{video?.title || 'Untitled Video'}</h1>
            <p className="text-gray-500 mt-1">{video?.channel_name}</p>
            <div className="flex items-center space-x-4 mt-3">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[video?.status]}`}>
                {video?.status?.toUpperCase()}
              </span>
              <span className="text-sm text-gray-500">
                {video?.video_type === 'live' ? '🔴 Live Stream' : '📹 Recorded'}
              </span>
              {video?.duration_seconds && (
                <span className="text-sm text-gray-500">
                  Duration: {Math.floor(video.duration_seconds / 60)} min
                </span>
              )}
            </div>
          </div>
          <a
            href={video?.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            Watch on YouTube →
          </a>
        </div>
      </div>

      {/* Video embed */}
      {embedUrl && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Extracted Recommendations ({recommendations.length})
          </h2>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recommendations extracted from this video
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/experts/${encodeURIComponent(rec.expert_name)}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800"
                      >
                        {rec.expert_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                        className="text-sm font-medium text-gray-900"
                      >
                        {rec.share_name}
                        {rec.nse_symbol && (
                          <span className="text-xs text-gray-500 ml-1">({rec.nse_symbol})</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${actionColors[rec.action]}`}>
                        {rec.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.recommended_price ? `₹${rec.recommended_price}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.target_price ? `₹${rec.target_price}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.stop_loss ? `₹${rec.stop_loss}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {Math.round((rec.confidence_score || 0.5) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Transcript ({transcripts.length} segments)
          </h2>
          {transcripts.length > 0 && (
            <button
              onClick={() => setShowFullTranscript(!showFullTranscript)}
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              {showFullTranscript ? 'Show segments' : 'Show full transcript'}
            </button>
          )}
        </div>

        {transcripts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transcript available
          </div>
        ) : showFullTranscript ? (
          <div className="p-6">
            <p className="text-gray-700 whitespace-pre-wrap">{fullTranscript}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {transcripts.map((t, idx) => (
              <div key={t.id || idx} className="p-4 hover:bg-gray-50">
                <div className="flex items-start">
                  <span className="text-xs text-gray-400 w-16 flex-shrink-0">
                    {formatTimestamp(t.start_time_seconds)} - {formatTimestamp(t.end_time_seconds)}
                  </span>
                  <p className="text-sm text-gray-700 ml-4">{t.transcript_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoDetails;
