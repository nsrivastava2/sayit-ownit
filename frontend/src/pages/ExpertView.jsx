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

      {/* Expert Profile Card */}
      <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl shadow-lg border border-primary-100 overflow-hidden">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 h-20"></div>

        <div className="px-6 pb-6">
          {/* Profile Header - Overlapping the banner */}
          <div className="flex flex-col md:flex-row gap-6 -mt-12">
            {/* Profile Picture */}
            <div className="flex-shrink-0">
              {expert?.profile_picture_url ? (
                <img
                  src={expert.profile_picture_url}
                  alt={expert?.name || name}
                  className="w-28 h-28 rounded-xl object-cover border-4 border-white shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div className={`w-28 h-28 bg-white rounded-xl border-4 border-white shadow-lg flex items-center justify-center text-primary-600 text-4xl font-bold ${expert?.profile_picture_url ? 'hidden' : ''}`}>
                {(expert?.name || name).charAt(0)}
              </div>
            </div>

            {/* Name & Badges */}
            <div className="flex-1 pt-14 md:pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{expert?.name || name}</h1>
                {metrics?.rank_position && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow">
                    {metrics.rank_position === 1 ? '🥇' : metrics.rank_position === 2 ? '🥈' : metrics.rank_position === 3 ? '🥉' : '#'}{metrics.rank_position}
                  </span>
                )}
                {expert?.profile_enriched_at && (
                  <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">✓ Verified Profile</span>
                )}
              </div>
              <p className="text-lg text-gray-600 mt-1">{expert?.specialization || 'Stock Market Analyst'}</p>
            </div>
          </div>

          {/* Bio / Experience Summary */}
          {(expert?.experience_summary || expert?.bio) && (
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-100">
              <p className="text-gray-700 leading-relaxed">{expert.experience_summary || expert.bio}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Social Links Card */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Connect</h3>
              <div className="space-y-2">
                {expert?.twitter_handle ? (
                  <a href={`https://twitter.com/${expert.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                    <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">𝕏</span>
                    <span className="text-gray-700">{expert.twitter_handle}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-2 text-gray-400">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">𝕏</span>
                    <span>Twitter not available</span>
                  </div>
                )}
                {expert?.linkedin_url ? (
                  <a href={expert.linkedin_url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                    <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">in</span>
                    <span className="text-gray-700">LinkedIn Profile</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-2 text-gray-400">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-sm font-bold">in</span>
                    <span>LinkedIn not available</span>
                  </div>
                )}
                {expert?.youtube_channel && (
                  <a href={expert.youtube_channel} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 transition-colors">
                    <span className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white">▶</span>
                    <span className="text-gray-700">YouTube Channel</span>
                  </a>
                )}
                {expert?.website_url && (
                  <a href={expert.website_url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white">🌐</span>
                    <span className="text-gray-700">Website</span>
                  </a>
                )}
              </div>
            </div>

            {/* Credentials Card */}
            <div className="bg-white rounded-lg border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Credentials</h3>
              <div className="space-y-3">
                {expert?.current_associations?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Associated with</p>
                    <div className="flex flex-wrap gap-1">
                      {expert.current_associations.map((assoc, i) => (
                        <span key={i} className="px-2.5 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">{assoc}</span>
                      ))}
                    </div>
                  </div>
                )}
                {expert?.certifications?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Certifications</p>
                    <div className="flex flex-wrap gap-1">
                      {expert.certifications.map((cert, i) => (
                        <span key={i} className="px-2.5 py-1 text-sm bg-green-100 text-green-800 rounded-full">{cert}</span>
                      ))}
                    </div>
                  </div>
                )}
                {expert?.education && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Education</p>
                    <p className="text-sm text-gray-700">{expert.education}</p>
                  </div>
                )}
                {!expert?.current_associations?.length && !expert?.certifications?.length && !expert?.education && (
                  <p className="text-gray-400 text-sm">No credentials information available</p>
                )}
              </div>
            </div>
          </div>

          {/* Warnings */}
          {expert?.warnings?.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Important Notices</p>
              <ul className="text-sm text-red-700 space-y-1">
                {expert.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {expert?.enrichment_sources?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Sources: {expert.enrichment_sources.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline mr-2">
                    [{i + 1}]
                  </a>
                ))}
                <span className="text-gray-400 ml-2">
                  Last updated: {new Date(expert.profile_enriched_at).toLocaleDateString()}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {/* Performance Metrics */}
        {metrics && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Win Rate</p>
              <p className={`text-3xl font-bold ${
                parseFloat(metrics.overall_win_rate) >= 70 ? 'text-green-600' :
                parseFloat(metrics.overall_win_rate) >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.overall_win_rate ? `${parseFloat(metrics.overall_win_rate).toFixed(1)}%` : '-'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Avg Return</p>
              <p className={`text-3xl font-bold ${
                parseFloat(metrics.avg_return_pct) > 0 ? 'text-green-600' :
                parseFloat(metrics.avg_return_pct) < 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {metrics.avg_return_pct ? `${parseFloat(metrics.avg_return_pct) >= 0 ? '+' : ''}${parseFloat(metrics.avg_return_pct).toFixed(1)}%` : '-'}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Target Hits</p>
              <p className="text-3xl font-bold text-green-600">{metrics.target_hit_count || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">SL Hits</p>
              <p className="text-3xl font-bold text-red-600">{metrics.sl_hit_count || 0}</p>
            </div>
          </>
        )}

        {/* Basic Stats */}
        {expert?.stats && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Total Picks</p>
              <p className="text-3xl font-bold text-gray-900">{expert.stats.totalRecommendations}</p>
            </div>
            {!metrics && (
              <>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">BUY Calls</p>
                  <p className="text-3xl font-bold text-green-600">{expert.stats.buyCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">SELL Calls</p>
                  <p className="text-3xl font-bold text-red-600">{expert.stats.sellCount}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">HOLD Calls</p>
                  <p className="text-3xl font-bold text-yellow-600">{expert.stats.holdCount}</p>
                </div>
              </>
            )}
          </>
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
                    <td className="px-4 py-3 text-sm text-gray-900">{rec.recommendation_date}</td>
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
