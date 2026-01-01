import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

// Icon components for stat cards
const VideoIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const LightbulbIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

function StatCard({ title, value, icon: Icon, colorClass, badgeText, link, linkText }) {
  return (
    <div className="card stagger-item">
      <div className="flex items-start justify-between mb-4">
        <div className={`stat-card-icon ${colorClass}`}>
          <Icon />
        </div>
        {badgeText && (
          <span className="badge badge-primary">{badgeText}</span>
        )}
      </div>
      <h3 className="stat-card-value mb-1">{value}</h3>
      <p className="stat-card-label mb-3">{title}</p>
      {link && (
        <Link
          to={link}
          className="text-sm text-primary font-medium hover:text-primary-700 inline-flex items-center gap-1"
        >
          {linkText}
          <ArrowRightIcon />
        </Link>
      )}
    </div>
  );
}

function RecommendationCard({ rec, onPlayVideo }) {
  const hasVideo = rec.videos?.youtube_url;
  const actionBadgeClass = {
    BUY: 'badge-success',
    SELL: 'badge-error',
    HOLD: 'badge-warning'
  }[rec.action] || 'badge-secondary';

  return (
    <article className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
            <span className="text-secondary font-bold">{rec.expert_name?.charAt(0) || '?'}</span>
          </div>
          <div>
            <Link
              to={`/experts/${encodeURIComponent(rec.expert_name)}`}
              className="font-semibold text-gray-900 hover:text-primary"
            >
              {rec.expert_name}
            </Link>
            <p className="text-xs text-gray-500">{rec.recommendation_date}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
              className="text-lg font-bold text-gray-900 hover:text-primary"
            >
              {rec.share_name}
            </Link>
            <span className={`badge ${actionBadgeClass}`}>{rec.action}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Target</p>
              <p className="font-semibold text-success data-value">
                {rec.target_price ? `₹${rec.target_price}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Stop Loss</p>
              <p className="font-semibold text-error data-value">
                {rec.stop_loss ? `₹${rec.stop_loss}` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Link
          to={`/experts/${encodeURIComponent(rec.expert_name)}`}
          className="text-sm text-primary font-medium hover:text-primary-700 inline-flex items-center gap-1"
        >
          <UserIcon />
          View expert
        </Link>
        {hasVideo ? (
          <button
            onClick={() => onPlayVideo(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
            className="text-sm text-secondary font-medium hover:text-secondary-700 inline-flex items-center gap-1"
          >
            <PlayIcon />
            Watch video
          </button>
        ) : (
          <span className="text-sm text-gray-400">No video</span>
        )}
      </div>
    </article>
  );
}

function ExpertListItem({ expert, rank }) {
  return (
    <Link
      to={`/experts/${encodeURIComponent(expert.name)}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center border-2 border-success">
        <span className="text-success font-bold text-sm">{rank}</span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 text-sm">{expert.name}</p>
        <p className="text-xs text-gray-500">{expert.count} picks</p>
      </div>
      <ArrowRightIcon />
    </Link>
  );
}

function StockListItem({ share, rank }) {
  return (
    <Link
      to={`/shares/${encodeURIComponent(share.symbol || share.name)}`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
        <span className="text-primary font-bold text-sm">{rank}</span>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 text-sm">
          {share.name}
          {share.symbol && <span className="text-gray-400 ml-1">({share.symbol})</span>}
        </p>
        <p className="text-xs text-gray-500">{share.count} mentions</p>
      </div>
      <ArrowRightIcon />
    </Link>
  );
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        <p className="text-error font-medium">Error loading dashboard: {error}</p>
        <button
          onClick={loadStats}
          className="mt-3 btn btn-sm btn-outline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold text-gray-900 mb-2">
              Dashboard
            </h1>
            <p className="text-gray-500">
              Track stock recommendations from Indian financial TV
            </p>
          </div>
          <Link to="/add" className="btn btn-primary">
            Add Video
          </Link>
        </div>
      </section>

      {/* Quick Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Videos Processed"
          value={stats?.overview?.completedVideos || 0}
          icon={VideoIcon}
          colorClass="bg-primary/10 text-primary"
          link="/recommendations"
          linkText="View all"
        />
        <StatCard
          title="Recommendations"
          value={stats?.overview?.totalRecommendations || 0}
          icon={LightbulbIcon}
          colorClass="bg-secondary/10 text-secondary"
          badgeText="Total"
          link="/recommendations"
          linkText="View all"
        />
        <StatCard
          title="Unique Experts"
          value={stats?.overview?.uniqueExperts || 0}
          icon={UserIcon}
          colorClass="bg-accent/10 text-accent-700"
          link="/leaderboard"
          linkText="Leaderboard"
        />
        <StatCard
          title="Stocks Tracked"
          value={stats?.overview?.uniqueShares || 0}
          icon={ChartIcon}
          colorClass="bg-success/10 text-success"
          link="/recommendations"
          linkText="View stocks"
        />
      </section>

      {/* Action Breakdown */}
      {stats?.actionBreakdown && Object.keys(stats.actionBreakdown).length > 0 && (
        <section className="card">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">Action Breakdown</h2>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-success rounded"></span>
              <span className="text-sm text-gray-500">BUY:</span>
              <span className="font-semibold text-gray-900 data-value">{stats.actionBreakdown.BUY || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-error rounded"></span>
              <span className="text-sm text-gray-500">SELL:</span>
              <span className="font-semibold text-gray-900 data-value">{stats.actionBreakdown.SELL || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-warning rounded"></span>
              <span className="text-sm text-gray-500">HOLD:</span>
              <span className="font-semibold text-gray-900 data-value">{stats.actionBreakdown.HOLD || 0}</span>
            </div>
          </div>
        </section>
      )}

      {/* Processing Jobs */}
      {stats?.processingJobs?.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-heading font-bold text-gray-900 mb-4">Processing Jobs</h2>
          <div className="space-y-3">
            {stats.processingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{job.title || 'Processing...'}</p>
                  <p className="text-sm text-gray-500">{job.currentStep}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 data-value w-12 text-right">
                    {job.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recent Recommendations Feed */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-heading font-bold text-gray-900">Recent Recommendations</h2>
            <Link to="/recommendations" className="text-sm text-primary font-medium hover:text-primary-700">
              View all
            </Link>
          </div>

          {stats?.recentRecommendations?.length > 0 ? (
            <div className="space-y-4">
              {stats.recentRecommendations.slice(0, 5).map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} onPlayVideo={openVideoPlayer} />
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No recommendations yet</p>
              <Link to="/add" className="btn btn-primary">
                Add a video to get started
              </Link>
            </div>
          )}

          {stats?.recentRecommendations?.length > 5 && (
            <div className="mt-6 text-center">
              <Link to="/recommendations" className="btn btn-outline">
                View all recommendations
              </Link>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Top Experts */}
          <section className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-heading font-bold text-gray-900">Top Experts</h3>
              <Link to="/leaderboard" className="text-sm text-primary font-medium hover:text-primary-700">
                View all
              </Link>
            </div>

            {stats?.topExperts?.length > 0 ? (
              <div className="space-y-2">
                {stats.topExperts.slice(0, 5).map((expert, idx) => (
                  <ExpertListItem key={expert.name} expert={expert} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No experts yet</p>
            )}
          </section>

          {/* Top Stocks */}
          <section className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-heading font-bold text-gray-900">Top Stocks</h3>
              <Link to="/recommendations" className="text-sm text-primary font-medium hover:text-primary-700">
                View all
              </Link>
            </div>

            {stats?.topShares?.length > 0 ? (
              <div className="space-y-2">
                {stats.topShares.slice(0, 5).map((share, idx) => (
                  <StockListItem key={share.name} share={share} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No stocks yet</p>
            )}
          </section>
        </aside>
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

export default Dashboard;
