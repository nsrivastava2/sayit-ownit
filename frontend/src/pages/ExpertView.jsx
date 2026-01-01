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

// Icons
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const CalculatorIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

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

  // Chart period state
  const [chartPeriod, setChartPeriod] = useState('6M');

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
      setTimeout(() => setFollowError(null), 3000);
    } finally {
      setFollowLoading(false);
    }
  }

  async function loadExpert() {
    try {
      setLoading(true);
      setChartsLoading(true);

      const [expertData, metricsData] = await Promise.all([
        api.getExpert(name),
        api.getExpertMetrics(name).catch(() => null)
      ]);
      setExpert(expertData.expert);
      setRecommendations(expertData.recommendations);
      setMetrics(metricsData?.metrics || null);
      if (metricsData?.metrics?.expert_id) {
        setExpertId(metricsData.metrics.expert_id);
      }
      setLoading(false);

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

  async function handleExportCSV() {
    try {
      const response = await api.exportRecommendations({ expert_name: name });
      // Create download link
      const blob = new Blob([response], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\s+/g, '_')}_recommendations.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-error/5 border-error/20">
        <p className="text-error font-medium">Error: {error}</p>
      </div>
    );
  }

  // Format date as "28 Dec 2025"
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

  const winRate = metrics?.overall_win_rate ? parseFloat(metrics.overall_win_rate).toFixed(1) : null;
  const avgReturn = metrics?.avg_return_pct ? parseFloat(metrics.avg_return_pct).toFixed(1) : null;
  const totalCalls = expert?.stats?.totalRecommendations || recommendations.length;

  return (
    <div className="space-y-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary transition-colors">Dashboard</Link>
        <ChevronRightIcon />
        <Link to="/leaderboard" className="hover:text-primary transition-colors">Experts</Link>
        <ChevronRightIcon />
        <span className="text-text-primary font-medium">{expert?.name || name}</span>
      </nav>

      {/* Expert Profile Header */}
      <section className="card">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Expert Photo & Basic Info */}
          <div className="flex flex-col sm:flex-row gap-6 lg:w-1/3">
            <div className="relative flex-shrink-0">
              {expert?.profile_picture_url ? (
                <img
                  src={expert.profile_picture_url}
                  alt={`${expert?.name || name} profile photo`}
                  className="w-32 h-32 rounded-xl object-cover border-4 border-secondary shadow-md"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div
                className={`w-32 h-32 rounded-xl bg-secondary/10 border-4 border-secondary shadow-md flex items-center justify-center ${expert?.profile_picture_url ? 'hidden' : ''}`}
              >
                <span className="text-secondary text-4xl font-bold">{(expert?.name || name).charAt(0)}</span>
              </div>
              {expert?.profile_enriched_at && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-success rounded-full border-4 border-surface flex items-center justify-center">
                  <CheckIcon />
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">{expert?.name || name}</h1>
              <p className="text-text-secondary mb-4">{expert?.specialization || 'Stock Market Analyst'}</p>

              {/* Specialty Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {expert?.expertise_areas?.length > 0 ? (
                  expert.expertise_areas.slice(0, 3).map((area, i) => (
                    <span key={i} className={`badge ${i === 0 ? 'bg-primary-100 text-primary-700' : i === 1 ? 'bg-secondary-100 text-secondary-700' : 'bg-accent-100 text-accent-700'}`}>
                      {area}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="badge bg-primary-100 text-primary-700">Technical Analysis</span>
                    <span className="badge bg-secondary-100 text-secondary-700">Stock Picks</span>
                  </>
                )}
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-3">
                {expert?.twitter_handle && (
                  <a
                    href={`https://twitter.com/${expert.twitter_handle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    aria-label="Twitter profile"
                  >
                    <span className="text-primary font-bold text-sm">𝕏</span>
                  </a>
                )}
                {expert?.linkedin_url && (
                  <a
                    href={expert.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    aria-label="LinkedIn profile"
                  >
                    <span className="text-primary font-bold text-sm">in</span>
                  </a>
                )}
                {expert?.youtube_channel && (
                  <a
                    href={expert.youtube_channel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center hover:bg-error/20 transition-colors"
                    aria-label="YouTube channel"
                  >
                    <span className="text-error font-bold text-sm">▶</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Win Rate */}
            <div className="p-4 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <TrophyIcon />
                <p className="text-xs text-text-secondary">Win Rate</p>
              </div>
              <p className={`font-mono text-2xl font-bold ${winRate && parseFloat(winRate) >= 50 ? 'text-success' : 'text-error'} data-value`}>
                {winRate ? `${winRate}%` : '--'}
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                {metrics?.wins_count && metrics?.total_closed ? `${metrics.wins_count} of ${metrics.total_closed} wins` : 'No data'}
              </p>
            </div>

            {/* Avg Return */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUpIcon />
                <p className="text-xs text-text-secondary">Avg Return</p>
              </div>
              <p className={`font-mono text-2xl font-bold ${avgReturn && parseFloat(avgReturn) >= 0 ? 'text-primary' : 'text-error'} data-value`}>
                {avgReturn ? `${parseFloat(avgReturn) >= 0 ? '+' : ''}${avgReturn}%` : '--'}
              </p>
              <p className="text-xs text-text-tertiary mt-1">Per recommendation</p>
            </div>

            {/* Total Calls */}
            <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <ChartIcon />
                <p className="text-xs text-text-secondary">Total Calls</p>
              </div>
              <p className="font-mono text-2xl font-bold text-secondary data-value">{totalCalls}</p>
              <p className="text-xs text-text-tertiary mt-1">Since tracking</p>
            </div>

            {/* Rank */}
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <UsersIcon />
                <p className="text-xs text-text-secondary">Rank</p>
              </div>
              <p className="font-mono text-2xl font-bold text-accent data-value">
                {metrics?.rank_position ? `#${metrics.rank_position}` : '--'}
              </p>
              <p className="text-xs text-text-tertiary mt-1">On leaderboard</p>
            </div>
          </div>
        </div>

        {/* Expert Bio & Follow Button */}
        <div className="mt-8 pt-8 border-t border-line">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-heading font-bold text-text-primary mb-3">About the Expert</h3>
              <p className="text-text-secondary leading-relaxed">
                {expert?.experience_summary || `${expert?.name || name} is a market analyst tracked on SayIt OwnIt. Their recommendations are extracted from TV appearances and analyzed for accuracy.`}
              </p>
              {expert?.current_associations?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {expert.current_associations.map((a, i) => (
                    <span key={i} className="px-3 py-1 text-xs bg-primary/5 text-primary rounded-full">{a}</span>
                  ))}
                </div>
              )}
            </div>

            {expertId && (
              <div className="flex flex-col gap-3 sm:ml-6">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`btn whitespace-nowrap ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {followLoading ? (
                    <span className="animate-spin mr-2">⟳</span>
                  ) : isFollowing ? (
                    <>
                      <CheckIcon />
                      <span className="ml-2">Following</span>
                    </>
                  ) : (
                    <>
                      <span className="mr-2">+</span>
                      Follow Expert
                    </>
                  )}
                </button>
                {followError && (
                  <p className="text-xs text-error text-center">{followError}</p>
                )}
              </div>
            )}
          </div>

          {/* Warnings */}
          {expert?.warnings?.length > 0 && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-warning-700">⚠️ {expert.warnings.join(' • ')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Performance Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy Trend Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-heading font-bold text-text-primary">Accuracy Trend</h3>
            <div className="flex items-center gap-2">
              {['6M', '1Y', 'All'].map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    chartPeriod === period
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <WinRateChart history={metricsHistory} loading={chartsLoading} />
          </div>
          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
            <div>
              <p className="text-xs text-text-secondary">Current Win Rate</p>
              <p className={`font-mono text-lg font-bold ${winRate && parseFloat(winRate) >= 50 ? 'text-success' : 'text-error'} data-value`}>
                {winRate ? `${winRate}%` : '--'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-secondary">Trend</p>
              <p className="font-mono text-lg font-bold text-success">--</p>
            </div>
          </div>
        </div>

        {/* Sector-wise Performance */}
        <div className="card">
          <h3 className="text-xl font-heading font-bold text-text-primary mb-6">Sector-wise Success Rate</h3>
          <div className="space-y-4">
            {sectors.length > 0 ? (
              sectors.slice(0, 6).map((sector, i) => {
                const successRate = sector.win_rate || (sector.wins / sector.total * 100) || 0;
                const isGood = successRate >= 70;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-primary">{sector.sector || sector.name}</span>
                      <span className={`font-mono text-sm font-bold ${isGood ? 'text-success' : 'text-warning'} data-value`}>
                        {successRate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isGood ? 'bg-success' : 'bg-warning'}`}
                        style={{ width: `${successRate}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">{sector.total || sector.count} recommendations</p>
                  </div>
                );
              })
            ) : (
              <div className="h-64 flex items-center justify-center text-text-secondary">
                <p>No sector data available</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Portfolio Simulator */}
      {expertId && (
        <PortfolioSimulator
          expertId={expertId}
          expertName={expert?.name || name}
        />
      )}

      {/* Recommendations History Section */}
      <section className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Recommendation History</h2>
            <p className="text-text-secondary">Complete track record with verified outcomes</p>
          </div>
          <button onClick={handleExportCSV} className="btn btn-outline">
            <DownloadIcon />
            <span className="ml-2">Export CSV</span>
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="py-12 text-center text-text-secondary">
            No recommendations found
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-32">Date</th>
                    <th className="w-32">Stock</th>
                    <th className="w-24">Action</th>
                    <th className="w-28">Entry Price</th>
                    <th className="w-28">Target</th>
                    <th className="w-28">Stop Loss</th>
                    <th className="w-24">Return</th>
                    <th className="w-32">Outcome</th>
                    <th className="w-24">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec) => {
                    const returnPct = rec.outcome?.return_percentage;
                    const isExpanded = expandedRows.has(rec.id);
                    const hasDetails = rec.reason || rec.raw_extract || rec.timeline;

                    return (
                      <React.Fragment key={rec.id}>
                        <tr className={isExpanded ? 'bg-primary/5' : ''}>
                          <td className="text-sm text-text-secondary">{formatDate(rec.recommendation_date)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <FlagIndicator isFlagged={rec.is_flagged} flagReasons={rec.flag_reasons} />
                              <Link
                                to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                                className="font-semibold text-text-primary hover:text-primary"
                              >
                                {rec.nse_symbol || rec.share_name}
                              </Link>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${rec.action === 'BUY' ? 'badge-success' : rec.action === 'SELL' ? 'badge-error' : 'badge-warning'}`}>
                              {rec.action}
                            </span>
                          </td>
                          <td className="font-mono text-text-primary data-value">
                            {rec.recommended_price ? `₹${Number(rec.recommended_price).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="font-mono text-success data-value">
                            {rec.target_price ? `₹${Number(rec.target_price).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="font-mono text-error data-value">
                            {rec.stop_loss ? `₹${Number(rec.stop_loss).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className={`font-mono data-value ${returnPct ? (parseFloat(returnPct) >= 0 ? 'text-success' : 'text-error') : 'text-text-tertiary'}`}>
                            {returnPct ? `${parseFloat(returnPct) >= 0 ? '+' : ''}${parseFloat(returnPct).toFixed(1)}%` : '--'}
                          </td>
                          <td>
                            <OutcomeBadge
                              outcome={rec.outcome}
                              status={rec.status}
                              returnPct={returnPct}
                            />
                          </td>
                          <td>
                            {rec.videos?.youtube_url ? (
                              <button
                                onClick={() => openVideoPlayer(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
                                className="touch-target p-2 hover:bg-surface-elevated rounded-md transition-colors"
                                aria-label="Watch video"
                              >
                                <PlayIcon />
                              </button>
                            ) : (
                              <span className="text-text-tertiary">-</span>
                            )}
                          </td>
                        </tr>
                        {/* Expanded Row */}
                        {isExpanded && hasDetails && (
                          <tr className="bg-primary/5">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                {rec.reason && (
                                  <div>
                                    <span className="font-medium text-text-primary">Reason: </span>
                                    <span className="text-text-secondary">{rec.reason}</span>
                                  </div>
                                )}
                                {rec.timeline && (
                                  <div>
                                    <span className="font-medium text-text-primary">Timeline: </span>
                                    <span className="text-text-secondary">{rec.timeline}</span>
                                  </div>
                                )}
                                {rec.raw_extract && (
                                  <div className="lg:col-span-3">
                                    <span className="font-medium text-text-primary">Quote: </span>
                                    <span className="text-text-tertiary italic">"{rec.raw_extract}"</span>
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

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {recommendations.slice(0, 10).map((rec) => {
                const returnPct = rec.outcome?.return_percentage;
                return (
                  <div key={rec.id} className="p-4 rounded-lg border border-line bg-surface-elevated">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FlagIndicator isFlagged={rec.is_flagged} flagReasons={rec.flag_reasons} />
                          <Link
                            to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                            className="font-bold text-text-primary hover:text-primary"
                          >
                            {rec.nse_symbol || rec.share_name}
                          </Link>
                          <span className={`badge text-xs ${rec.action === 'BUY' ? 'badge-success' : rec.action === 'SELL' ? 'badge-error' : 'badge-warning'}`}>
                            {rec.action}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-text-secondary">{formatDate(rec.recommendation_date)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-text-secondary">Entry</p>
                        <p className="font-mono font-semibold text-text-primary data-value">
                          {rec.recommended_price ? `₹${Number(rec.recommended_price).toLocaleString('en-IN')}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary">Target</p>
                        <p className="font-mono font-semibold text-success data-value">
                          {rec.target_price ? `₹${Number(rec.target_price).toLocaleString('en-IN')}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary">Stop Loss</p>
                        <p className="font-mono font-semibold text-error data-value">
                          {rec.stop_loss ? `₹${Number(rec.stop_loss).toLocaleString('en-IN')}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary">Return</p>
                        <p className={`font-mono font-semibold data-value ${returnPct ? (parseFloat(returnPct) >= 0 ? 'text-success' : 'text-error') : 'text-text-tertiary'}`}>
                          {returnPct ? `${parseFloat(returnPct) >= 0 ? '+' : ''}${parseFloat(returnPct).toFixed(1)}%` : '--'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-line">
                      <OutcomeBadge
                        outcome={rec.outcome}
                        status={rec.status}
                        returnPct={returnPct}
                      />
                      {rec.videos?.youtube_url && (
                        <button
                          onClick={() => openVideoPlayer(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
                          className="touch-target p-2 hover:bg-surface rounded-md transition-colors"
                          aria-label="Watch video"
                        >
                          <PlayIcon />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Info */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-line">
              <p className="text-sm text-text-secondary">
                Showing <span className="font-semibold text-text-primary">1-{Math.min(recommendations.length, 10)}</span> of{' '}
                <span className="font-semibold text-text-primary">{recommendations.length}</span> recommendations
              </p>
            </div>
          </>
        )}
      </section>

      {/* Quick Actions Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/simulator" className="card hover:shadow-lg transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalculatorIcon />
            </div>
            <div>
              <h3 className="font-heading font-bold text-text-primary mb-2">Simulate Portfolio</h3>
              <p className="text-sm text-text-secondary">Test this expert's recommendations with virtual capital</p>
            </div>
          </div>
        </Link>

        <Link to="/recommendations" className="card hover:shadow-lg transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
              <StarIcon />
            </div>
            <div>
              <h3 className="font-heading font-bold text-text-primary mb-2">Create Watchlist</h3>
              <p className="text-sm text-text-secondary">Track stocks from this expert's recommendations</p>
            </div>
          </div>
        </Link>

        <Link to="/leaderboard" className="card hover:shadow-lg transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
              <TrophyIcon />
            </div>
            <div>
              <h3 className="font-heading font-bold text-text-primary mb-2">Compare Experts</h3>
              <p className="text-sm text-text-secondary">See how this expert ranks against others</p>
            </div>
          </div>
        </Link>
      </section>

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
