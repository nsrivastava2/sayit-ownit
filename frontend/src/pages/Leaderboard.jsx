import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useUser } from '../contexts/UserContext';

// Icons
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const LightbulbIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

function Leaderboard() {
  const { isAuthenticated } = useUser();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [timePeriod, setTimePeriod] = useState('all');
  const [minRecs, setMinRecs] = useState(false);
  const [following, setFollowing] = useState(new Set());

  useEffect(() => {
    loadLeaderboard();
    if (isAuthenticated) {
      loadFollowing();
    }
  }, [isAuthenticated]);

  async function loadLeaderboard() {
    try {
      setLoading(true);
      const data = await api.getLeaderboard(50);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowing() {
    try {
      const data = await api.getFollowing();
      const followingIds = new Set(data.following?.map(f => f.expert_id) || []);
      setFollowing(followingIds);
    } catch (err) {
      console.error('Error loading following:', err);
    }
  }

  async function handleFollow(expertId, expertName) {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    try {
      if (following.has(expertId)) {
        await api.unfollowExpert(expertId);
        setFollowing(prev => {
          const next = new Set(prev);
          next.delete(expertId);
          return next;
        });
      } else {
        await api.followExpert(expertId);
        setFollowing(prev => new Set([...prev, expertId]));
      }
    } catch (err) {
      console.error('Error following expert:', err);
    }
  }

  // Filter leaderboard based on search and filters
  const filteredLeaderboard = leaderboard.filter(expert => {
    const matchesSearch = expert.expert_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMinRecs = !minRecs || expert.total_recommendations >= 20;
    return matchesSearch && matchesMinRecs;
  });

  // Calculate stats
  const totalExperts = leaderboard.length;
  const topPerformer = leaderboard[0];
  const avgWinRate = leaderboard.length > 0
    ? leaderboard.reduce((sum, e) => sum + (parseFloat(e.overall_win_rate) || 0), 0) / leaderboard.filter(e => e.overall_win_rate).length
    : 0;
  const totalRecommendations = leaderboard.reduce((sum, e) => sum + (e.total_recommendations || 0), 0);

  // Format last updated
  const formatLastUpdated = () => {
    if (!leaderboard[0]?.calculation_date) return 'N/A';
    return new Date(leaderboard[0].calculation_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' IST';
  };

  // Get win rate badge
  const getWinRateBadge = (winRate) => {
    if (!winRate) return null;
    const rate = parseFloat(winRate);
    if (rate >= 70) return <span className="badge badge-success">High</span>;
    if (rate >= 50) return <span className="badge bg-secondary-100 text-secondary-700">Medium</span>;
    return <span className="badge badge-error">Low</span>;
  };

  // Get rank display
  const getRankDisplay = (rank) => {
    if (rank === 1) return (
      <div className="flex items-center gap-2">
        <TrophyIcon />
        <span className="font-bold text-accent data-value">1</span>
      </div>
    );
    if (rank === 2) return (
      <div className="flex items-center gap-2">
        <TrophyIcon />
        <span className="font-bold text-text-secondary data-value">2</span>
      </div>
    );
    if (rank === 3) return (
      <div className="flex items-center gap-2">
        <TrophyIcon />
        <span className="font-bold text-warning data-value">3</span>
      </div>
    );
    return <span className="font-bold text-text-primary data-value">{rank}</span>;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTimePeriod('all');
    setMinRecs(false);
  };

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-text-primary mb-2">Expert Leaderboard</h1>
            <p className="text-text-secondary">Compare and rank financial TV experts by quantitative performance metrics</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <ClockIcon />
            <span>Updated: {formatLastUpdated()}</span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UsersIcon />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-text-primary data-value">{totalExperts}</p>
                <p className="text-xs text-text-secondary">Total Experts</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrophyIcon />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-success data-value">
                  {topPerformer?.avg_return_pct ? `+${parseFloat(topPerformer.avg_return_pct).toFixed(1)}%` : '--'}
                </p>
                <p className="text-xs text-text-secondary">Top Performer</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <ChartIcon />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-text-primary data-value">
                  {avgWinRate ? `${avgWinRate.toFixed(1)}%` : '--'}
                </p>
                <p className="text-xs text-text-secondary">Avg Win Rate</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <LightbulbIcon />
              </div>
              <div>
                <p className="font-mono text-2xl font-bold text-text-primary data-value">{totalRecommendations.toLocaleString()}</p>
                <p className="text-xs text-text-secondary">Total Recommendations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="card">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Time Period Filter */}
          <div className="flex-1">
            <label className="text-xs text-text-secondary font-medium mb-2 block">Time Period</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '1m', label: '1 Month' },
                { value: '3m', label: '3 Months' },
                { value: '6m', label: '6 Months' },
                { value: '1y', label: '1 Year' },
                { value: 'all', label: 'All Time' }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => setTimePeriod(period.value)}
                  className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                    timePeriod === period.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-elevated'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="lg:w-64">
            <label className="text-xs text-text-secondary font-medium mb-2 block">Search Expert</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name..."
                className="input w-full pl-10"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                <SearchIcon />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-line">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={minRecs}
              onChange={(e) => setMinRecs(e.target.checked)}
              className="w-4 h-4 rounded border-line text-primary focus:ring-primary"
            />
            <span className="text-sm text-text-secondary">Min 20 recommendations</span>
          </label>
          <button
            onClick={resetFilters}
            className="text-sm text-primary font-medium hover:text-primary-700 inline-flex items-center gap-1"
          >
            <RefreshIcon />
            Reset filters
          </button>
        </div>
      </section>

      {/* Desktop Leaderboard Table */}
      <section className="hidden lg:block card overflow-hidden p-0">
        {filteredLeaderboard.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <p className="text-lg">No expert metrics available yet</p>
            <p className="text-sm mt-2">Metrics are calculated after recommendations are tracked and outcomes are detected.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-20">Rank</th>
                    <th>Expert Name</th>
                    <th className="w-32">Win Rate</th>
                    <th className="w-28">Avg Return</th>
                    <th className="w-24">Total Recs</th>
                    <th className="w-36">Accuracy</th>
                    <th className="w-32">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((expert) => {
                    const winRate = parseFloat(expert.overall_win_rate) || 0;
                    const avgReturn = parseFloat(expert.avg_return_pct) || 0;
                    const isFollowingExpert = following.has(expert.expert_id);

                    return (
                      <tr key={expert.expert_name}>
                        <td>{getRankDisplay(expert.rank_position)}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                              expert.rank_position <= 3 ? 'bg-success/10 border-success' : 'bg-secondary/10 border-secondary'
                            }`}>
                              <span className={`font-bold text-sm ${
                                expert.rank_position <= 3 ? 'text-success' : 'text-secondary'
                              }`}>
                                {expert.expert_name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <Link
                                to={`/experts/${encodeURIComponent(expert.expert_name)}`}
                                className="font-semibold text-text-primary hover:text-primary"
                              >
                                {expert.expert_name}
                              </Link>
                              <p className="text-xs text-text-secondary">Market Analyst</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-semibold data-value ${winRate >= 50 ? 'text-success' : 'text-error'}`}>
                              {winRate.toFixed(1)}%
                            </span>
                            {getWinRateBadge(winRate)}
                          </div>
                        </td>
                        <td>
                          <span className={`font-mono font-bold data-value ${avgReturn >= 0 ? 'text-success' : 'text-error'}`}>
                            {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <span className="font-mono font-medium text-text-primary data-value">
                            {expert.total_recommendations}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-line rounded-full h-2 max-w-[80px]">
                              <div
                                className={`h-2 rounded-full ${winRate >= 70 ? 'bg-success' : winRate >= 50 ? 'bg-secondary' : 'bg-error'}`}
                                style={{ width: `${Math.min(winRate, 100)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-sm font-medium text-text-primary data-value">
                              {winRate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {expert.expert_id && (
                              <button
                                onClick={() => handleFollow(expert.expert_id, expert.expert_name)}
                                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                                  isFollowingExpert
                                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'border border-line text-text-secondary hover:bg-surface-elevated'
                                }`}
                              >
                                {isFollowingExpert ? (
                                  <span className="flex items-center gap-1">
                                    <CheckIcon />
                                    Following
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <PlusIcon />
                                    Follow
                                  </span>
                                )}
                              </button>
                            )}
                            <Link
                              to={`/experts/${encodeURIComponent(expert.expert_name)}`}
                              className="p-2 hover:bg-surface-elevated rounded-md transition-colors"
                              aria-label={`View ${expert.expert_name} profile`}
                            >
                              <ChevronRightIcon />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-line">
              <p className="text-sm text-text-secondary">
                Showing <span className="font-semibold text-text-primary">1-{filteredLeaderboard.length}</span> of{' '}
                <span className="font-semibold text-text-primary">{filteredLeaderboard.length}</span> experts
              </p>
            </div>
          </>
        )}
      </section>

      {/* Mobile Leaderboard Cards */}
      <section className="lg:hidden space-y-4">
        {filteredLeaderboard.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-text-secondary">No experts found</p>
          </div>
        ) : (
          filteredLeaderboard.slice(0, 10).map((expert) => {
            const winRate = parseFloat(expert.overall_win_rate) || 0;
            const avgReturn = parseFloat(expert.avg_return_pct) || 0;
            const isFollowingExpert = following.has(expert.expert_id);

            return (
              <article key={expert.expert_name} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                        expert.rank_position <= 3 ? 'bg-success/10 border-success' : 'bg-secondary/10 border-secondary'
                      }`}>
                        <span className={`font-bold text-xl ${
                          expert.rank_position <= 3 ? 'text-success' : 'text-secondary'
                        }`}>
                          {expert.expert_name.charAt(0)}
                        </span>
                      </div>
                      {expert.rank_position <= 3 && (
                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${
                          expert.rank_position === 1 ? 'bg-accent' : expert.rank_position === 2 ? 'bg-line' : 'bg-warning'
                        }`}>
                          {expert.rank_position === 1 ? (
                            <TrophyIcon />
                          ) : (
                            <span className="text-xs font-bold text-white">{expert.rank_position}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">{expert.expert_name}</h3>
                      <p className="text-xs text-text-secondary">Market Analyst</p>
                      <span className={`badge mt-1 ${
                        expert.rank_position === 1 ? 'badge-success' :
                        expert.rank_position <= 3 ? 'bg-secondary-100 text-secondary-700' :
                        'bg-surface-elevated text-text-secondary'
                      }`}>
                        Rank #{expert.rank_position}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Win Rate</p>
                    <p className={`font-mono text-lg font-bold data-value ${winRate >= 50 ? 'text-success' : 'text-error'}`}>
                      {winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Avg Return</p>
                    <p className={`font-mono text-lg font-bold data-value ${avgReturn >= 0 ? 'text-success' : 'text-error'}`}>
                      {avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Total Recs</p>
                    <p className="font-mono text-lg font-bold text-text-primary data-value">{expert.total_recommendations}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Score</p>
                    <p className="font-mono text-lg font-bold text-text-primary data-value">
                      {parseFloat(expert.ranking_score).toFixed(1)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-2">Accuracy</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-line rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${winRate >= 70 ? 'bg-success' : winRate >= 50 ? 'bg-secondary' : 'bg-error'}`}
                        style={{ width: `${Math.min(winRate, 100)}%` }}
                      ></div>
                    </div>
                    <span className="font-mono text-sm font-medium text-text-primary data-value">{winRate.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {expert.expert_id && (
                    <button
                      onClick={() => handleFollow(expert.expert_id, expert.expert_name)}
                      className={`flex-1 px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                        isFollowingExpert
                          ? 'bg-primary/10 text-primary'
                          : 'border border-line text-text-secondary hover:bg-surface-elevated'
                      }`}
                    >
                      {isFollowingExpert ? (
                        <span className="flex items-center justify-center gap-1">
                          <CheckIcon />
                          Following
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <PlusIcon />
                          Follow
                        </span>
                      )}
                    </button>
                  )}
                  <Link
                    to={`/experts/${encodeURIComponent(expert.expert_name)}`}
                    className="flex-1 btn btn-outline text-center"
                  >
                    View Profile
                  </Link>
                </div>
              </article>
            );
          })
        )}

        {filteredLeaderboard.length > 10 && (
          <div className="text-center pt-4">
            <button className="btn btn-outline w-full">
              Load More Experts
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default Leaderboard;
