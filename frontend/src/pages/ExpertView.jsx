import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import OutcomeBadge from '../components/OutcomeBadge';
import FlagIndicator from '../components/FlagIndicator';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { SectorBreakdownChart, MonthlyReturnsChart, WinRateChart } from '../components/charts';
import { useUser } from '../contexts/UserContext';
import PortfolioSimulator from '../components/PortfolioSimulator';

function ExpertView() {
  const { name } = useParams();
  const { user, isAuthenticated } = useUser();
  const [expert, setExpert] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  // Chart data states
  const [sectors, setSectors] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Expandable row state
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Following state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [expertId, setExpertId] = useState(null);
  const [followError, setFollowError] = useState(null);

  const toggleRowExpansion = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    loadExpert();
  }, [name]);

  // Check if user is following this expert
  useEffect(() => {
    if (isAuthenticated && expertId) {
      checkFollowingStatus();
    }
  }, [isAuthenticated, expertId]);

  async function checkFollowingStatus() {
    try {
      const data = await api.getFollowing();
      const following = data.following?.find(f => f.expert_id === expertId);
      setIsFollowing(!!following);
    } catch (err) {
      console.error('Error checking following status:', err);
    }
  }

  async function handleFollow() {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    setFollowLoading(true);
    setFollowError(null);

    try {
      if (isFollowing) {
        await api.unfollowExpert(expertId);
        setIsFollowing(false);
      } else {
        await api.followExpert(expertId);
        setIsFollowing(true);
      }
    } catch (err) {
      setFollowError(err.message);
      // Show error briefly then clear
      setTimeout(() => setFollowError(null), 3000);
    } finally {
      setFollowLoading(false);
    }
  }

  async function loadExpert() {
    try {
      setLoading(true);
      setChartsLoading(true);

      // Load main data first
      const [expertData, metricsData] = await Promise.all([
        api.getExpert(name),
        api.getExpertMetrics(name).catch(() => null)
      ]);
      setExpert(expertData.expert);
      setRecommendations(expertData.recommendations);
      setMetrics(metricsData?.metrics || null);
      // Get expert ID for follow functionality
      if (metricsData?.metrics?.expert_id) {
        setExpertId(metricsData.metrics.expert_id);
      }
      setLoading(false);

      // Load chart data in background
      const [sectorsData, monthlyData, historyData] = await Promise.all([
        api.getExpertSectors(name).catch(() => ({ sectors: [] })),
        api.getExpertMonthlyReturns(name).catch(() => ({ monthlyReturns: [] })),
        api.getExpertMetricsHistory(name, 90).catch(() => ({ history: [] }))
      ]);
      setSectors(sectorsData.sectors || []);
      setMonthlyReturns(monthlyData.monthlyReturns || []);
      setMetricsHistory(historyData.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setChartsLoading(false);
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

          {/* Follow Button */}
          {expertId && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isFollowing
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              } disabled:opacity-50`}
            >
              {followLoading ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin">⟳</span>
                </span>
              ) : isFollowing ? (
                '✓ Following'
              ) : (
                '+ Follow'
              )}
            </button>
          )}
        </div>

        {/* Follow Error */}
        {followError && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
            {followError}
          </div>
        )}

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

        {/* Mobile Follow Button */}
        {expertId && (
          <div className="md:hidden mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                isFollowing
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-primary-600 text-white'
              } disabled:opacity-50`}
            >
              {followLoading ? 'Loading...' : isFollowing ? '✓ Following' : '+ Follow'}
            </button>
          </div>
        )}

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

      {/* Performance Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Win Rate Over Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Win Rate Trend</h3>
          <WinRateChart history={metricsHistory} loading={chartsLoading} />
        </div>

        {/* Monthly Returns */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Returns</h3>
          <MonthlyReturnsChart monthlyReturns={monthlyReturns} loading={chartsLoading} />
        </div>

        {/* Sector Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Sector Distribution</h3>
          <SectorBreakdownChart sectors={sectors} loading={chartsLoading} />
        </div>
      </div>

      {/* Portfolio Simulator */}
      {expertId && (
        <PortfolioSimulator
          expertId={expertId}
          expertName={expert?.name || name}
        />
      )}

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
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
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
                {recommendations.map((rec) => {
                  const isExpanded = expandedRows.has(rec.id);
                  const hasDetails = rec.reason || rec.raw_extract || rec.timeline || rec.tags?.length > 0;

                  return (
                    <React.Fragment key={rec.id}>
                      <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                        <td className="px-2 py-3 text-center">
                          {hasDetails && (
                            <button
                              onClick={() => toggleRowExpansion(rec.id)}
                              className="text-gray-400 hover:text-gray-600 transition-transform"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              ▶
                            </button>
                          )}
                        </td>
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
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-blue-50/50">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              {rec.reason && (
                                <div>
                                  <span className="font-medium text-gray-700">Reason: </span>
                                  <span className="text-gray-600">{rec.reason}</span>
                                </div>
                              )}
                              {rec.timeline && (
                                <div>
                                  <span className="font-medium text-gray-700">Timeline: </span>
                                  <span className="text-gray-600">{rec.timeline}</span>
                                </div>
                              )}
                              {rec.confidence_score && (
                                <div>
                                  <span className="font-medium text-gray-700">Confidence: </span>
                                  <span className="text-gray-600">{(rec.confidence_score * 100).toFixed(0)}%</span>
                                </div>
                              )}
                              {rec.tags?.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-700">Tags: </span>
                                  <div className="inline-flex flex-wrap gap-1 mt-1">
                                    {rec.tags.map((tag, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {rec.outcome?.outcome_date && (
                                <div>
                                  <span className="font-medium text-gray-700">Closed On: </span>
                                  <span className="text-gray-600">
                                    {formatDate(rec.outcome.outcome_date)} ({rec.outcome.days_held} days)
                                  </span>
                                </div>
                              )}
                              {rec.outcome?.outcome_price && (
                                <div>
                                  <span className="font-medium text-gray-700">Exit Price: </span>
                                  <span className="text-gray-600">₹{rec.outcome.outcome_price}</span>
                                </div>
                              )}
                              {rec.raw_extract && (
                                <div className="md:col-span-2 lg:col-span-3">
                                  <span className="font-medium text-gray-700">Original Quote: </span>
                                  <span className="text-gray-500 italic">"{rec.raw_extract}"</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
