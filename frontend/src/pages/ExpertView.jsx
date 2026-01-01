import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import OutcomeBadge from '../components/OutcomeBadge';
import FlagIndicator from '../components/FlagIndicator';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function ExpertView() {
  const { name } = useParams();
  const [expert, setExpert] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  useEffect(() => {
    loadExpert();
  }, [name]);

  async function loadExpert() {
    try {
      setLoading(true);
      const [expertData, metricsData] = await Promise.all([
        api.getExpert(name),
        api.getExpertMetrics(name).catch(() => null)
      ]);
      setExpert(expertData.expert);
      setRecommendations(expertData.recommendations);
      setMetrics(metricsData?.metrics || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  // Format date as "17 Dec 2025"
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

      {/* Compact Expert Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          {/* Photo */}
          {expert?.profile_picture_url ? (
            <img src={expert.profile_picture_url} alt={expert?.name || name}
              className="w-14 h-14 rounded-full object-cover border border-gray-200 flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div className={`w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xl font-bold flex-shrink-0 ${expert?.profile_picture_url ? 'hidden' : ''}`}>
            {(expert?.name || name).charAt(0)}
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">{expert?.name || name}</h1>
              {metrics?.rank_position && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-800 rounded">
                  {metrics.rank_position === 1 ? '🥇' : metrics.rank_position === 2 ? '🥈' : metrics.rank_position === 3 ? '🥉' : '#'}{metrics.rank_position}
                </span>
              )}
              {expert?.profile_enriched_at && <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">✓</span>}
            </div>
            <p className="text-sm text-gray-500 truncate">{expert?.specialization || 'Stock Market Analyst'}</p>
            {/* Social Links Inline */}
            <div className="flex gap-2 mt-1 flex-wrap">
              {expert?.twitter_handle && (
                <a href={`https://twitter.com/${expert.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">𝕏 {expert.twitter_handle}</a>
              )}
              {expert?.linkedin_url && (
                <a href={expert.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">LinkedIn</a>
              )}
              {expert?.youtube_channel && (
                <a href={expert.youtube_channel} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline">YouTube</a>
              )}
              {expert?.website_url && (
                <a href={expert.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:underline">Website</a>
              )}
            </div>
          </div>

          {/* Stats - Inline */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            {metrics?.overall_win_rate && (
              <div className="text-center">
                <p className={`text-lg font-bold ${parseFloat(metrics.overall_win_rate) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(metrics.overall_win_rate).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Win</p>
              </div>
            )}
            {metrics?.avg_return_pct && (
              <div className="text-center">
                <p className={`text-lg font-bold ${parseFloat(metrics.avg_return_pct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(metrics.avg_return_pct) >= 0 ? '+' : ''}{parseFloat(metrics.avg_return_pct).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Avg</p>
              </div>
            )}
            {expert?.stats && (
              <>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{expert.stats.totalRecommendations}</p>
                  <p className="text-xs text-gray-500">Picks</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{expert.stats.buyCount}</p>
                  <p className="text-xs text-gray-500">Buy</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{expert.stats.sellCount}</p>
                  <p className="text-xs text-gray-500">Sell</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Stats Row */}
        <div className="md:hidden flex justify-around mt-3 pt-3 border-t border-gray-100">
          {metrics?.overall_win_rate && (
            <div className="text-center">
              <p className={`text-lg font-bold ${parseFloat(metrics.overall_win_rate) >= 50 ? 'text-green-600' : 'text-red-600'}`}>{parseFloat(metrics.overall_win_rate).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Win</p>
            </div>
          )}
          {expert?.stats && (
            <>
              <div className="text-center"><p className="text-lg font-bold">{expert.stats.totalRecommendations}</p><p className="text-xs text-gray-500">Picks</p></div>
              <div className="text-center"><p className="text-lg font-bold text-green-600">{expert.stats.buyCount}</p><p className="text-xs text-gray-500">Buy</p></div>
              <div className="text-center"><p className="text-lg font-bold text-red-600">{expert.stats.sellCount}</p><p className="text-xs text-gray-500">Sell</p></div>
            </>
          )}
        </div>

        {/* Expandable Details */}
        {(expert?.experience_summary || expert?.current_associations?.length > 0 || expert?.warnings?.length > 0) && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
            {expert?.experience_summary && <p className="mb-2">{expert.experience_summary}</p>}
            {expert?.current_associations?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {expert.current_associations.map((a, i) => <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">{a}</span>)}
              </div>
            )}
            {expert?.warnings?.length > 0 && (
              <div className="text-xs text-red-600">⚠️ {expert.warnings.join(' • ')}</div>
            )}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
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
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(rec.recommendation_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <FlagIndicator isFlagged={rec.is_flagged} flagReasons={rec.flag_reasons} />
                        <Link
                          to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                          className="text-sm font-medium text-primary-600 hover:text-primary-800"
                        >
                          {rec.share_name}
                          {rec.nse_symbol && (
                            <span className="text-xs text-gray-500 ml-1">({rec.nse_symbol})</span>
                          )}
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
                    <td className="px-4 py-3 text-sm">
                      {rec.videos?.youtube_url ? (
                        <button
                          onClick={() => openVideoPlayer(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
                          className="text-primary-600 hover:text-primary-800 flex items-center whitespace-nowrap"
                          title={rec.videos.title}
                        >
                          <span className="mr-1">▶</span>
                          {formatTimestamp(rec.timestamp_in_video)}
                        </button>
                      ) : '-'}
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

export default ExpertView;
