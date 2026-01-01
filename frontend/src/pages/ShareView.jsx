import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import OutcomeBadge from '../components/OutcomeBadge';
import FlagIndicator from '../components/FlagIndicator';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function ShareView() {
  const { symbol } = useParams();
  const [share, setShare] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  useEffect(() => {
    loadShare();
  }, [symbol]);

  async function loadShare() {
    try {
      setLoading(true);
      const data = await api.getShare(symbol);
      setShare(data.share);
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  const marketCapColors = {
    LARGE_CAP: 'bg-blue-100 text-blue-800',
    MID_CAP: 'bg-purple-100 text-purple-800',
    SMALL_CAP: 'bg-orange-100 text-orange-800'
  };

  const marketCapLabels = {
    LARGE_CAP: 'Large Cap',
    MID_CAP: 'Mid Cap',
    SMALL_CAP: 'Small Cap'
  };

  // Format timestamp as MM:SS or HH:MM:SS
  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return null;
    const secs = parseInt(seconds);
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/recommendations"
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
      >
        ← Back to Recommendations
      </Link>

      {/* Share header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {share?.name || symbol}
              </h1>
              {share?.marketCapCategory && (
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${marketCapColors[share.marketCapCategory] || 'bg-gray-100 text-gray-800'}`}
                  data-testid="market-cap-badge"
                >
                  {marketCapLabels[share.marketCapCategory] || share.marketCapCategory}
                </span>
              )}
            </div>
            {share?.symbol && (
              <p className="text-lg text-gray-500 mt-1">NSE: {share.symbol}</p>
            )}
            {/* Sector and Industry */}
            <div className="flex items-center gap-4 mt-2">
              {share?.sector && (
                <span className="text-sm text-gray-600" data-testid="stock-sector">
                  <span className="font-medium">Sector:</span> {share.sector}
                </span>
              )}
              {share?.industry && (
                <span className="text-sm text-gray-600">
                  <span className="font-medium">Industry:</span> {share.industry}
                </span>
              )}
            </div>
          </div>
          <a
            href={`https://www.nseindia.com/get-quotes/equity?symbol=${share?.symbol || symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View on NSE →
          </a>
        </div>

        {/* Stats */}
        {share?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500">Total Recommendations</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="total-recommendations">
                {share.stats.totalRecommendations}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">BUY Calls</p>
              <p className="text-2xl font-bold text-green-600">{share.stats.buyCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">SELL Calls</p>
              <p className="text-2xl font-bold text-red-600">{share.stats.sellCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Target</p>
              <p className="text-2xl font-bold text-gray-900">
                {share.stats.avgTargetPrice ? `₹${share.stats.avgTargetPrice}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Stop Loss</p>
              <p className="text-2xl font-bold text-gray-900">
                {share.stats.avgStopLoss ? `₹${share.stats.avgStopLoss}` : '-'}
              </p>
            </div>
          </div>
        )}

        {/* Experts who recommended */}
        {share?.experts?.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Recommended by:</p>
            <div className="flex flex-wrap gap-2">
              {share.experts.map((expert) => (
                <Link
                  key={expert}
                  to={`/experts/${encodeURIComponent(expert)}`}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                >
                  {expert}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Recommendations</h2>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recommendations found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{rec.recommendation_date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <FlagIndicator isFlagged={rec.is_flagged} flagReasons={rec.flag_reasons} />
                        <Link
                          to={`/experts/${encodeURIComponent(rec.expert_name)}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {rec.expert_name}
                        </Link>
                      </div>
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
                    <td className="px-4 py-3">
                      <OutcomeBadge
                        outcome={rec.outcome}
                        status={rec.status}
                        returnPct={rec.outcome?.return_percentage}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {rec.videos?.youtube_url ? (
                        <button
                          onClick={() => openVideoPlayer(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center whitespace-nowrap"
                          title={rec.videos?.title}
                        >
                          <span className="mr-1">▶</span>
                          {formatTimestamp(rec.timestamp_in_video)}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Video Player */}
      {videoPlayer && (
        <FloatingVideoPlayer
          videoId={videoPlayer.videoId}
          timestamp={videoPlayer.timestamp}
          title={videoPlayer.title}
          onClose={closeVideoPlayer}
        />
      )}
    </div>
  );
}

export default ShareView;
