import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function StatCard({ title, value, icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-100 text-primary-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function RecommendationRow({ rec, onPlayVideo }) {
  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  const hasVideo = rec.videos?.youtube_url;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-900">{rec.recommendation_date}</td>
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
        {rec.target_price ? `₹${rec.target_price}` : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {rec.stop_loss ? `₹${rec.stop_loss}` : '-'}
      </td>
      <td className="px-4 py-3">
        {hasVideo ? (
          <button
            onClick={() => onPlayVideo(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
            title={rec.videos?.title}
          >
            <span className="mr-1">▶</span>
            Video
          </button>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>
    </tr>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading dashboard: {error}</p>
        <button
          onClick={loadStats}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Track stock recommendations from Indian financial TV
          </p>
        </div>
        <Link
          to="/add"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <span className="mr-2">➕</span>
          Add Video
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Videos Processed"
          value={stats?.overview?.completedVideos || 0}
          icon="🎬"
          color="primary"
        />
        <StatCard
          title="Recommendations"
          value={stats?.overview?.totalRecommendations || 0}
          icon="📋"
          color="green"
        />
        <StatCard
          title="Unique Experts"
          value={stats?.overview?.uniqueExperts || 0}
          icon="👤"
          color="purple"
        />
        <StatCard
          title="Stocks Tracked"
          value={stats?.overview?.uniqueShares || 0}
          icon="📈"
          color="yellow"
        />
      </div>

      {/* Action breakdown */}
      {stats?.actionBreakdown && Object.keys(stats.actionBreakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Action Breakdown</h2>
          <div className="flex space-x-8">
            <div className="flex items-center">
              <span className="w-4 h-4 bg-green-500 rounded mr-2"></span>
              <span className="text-sm text-gray-600">BUY: {stats.actionBreakdown.BUY || 0}</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 bg-red-500 rounded mr-2"></span>
              <span className="text-sm text-gray-600">SELL: {stats.actionBreakdown.SELL || 0}</span>
            </div>
            <div className="flex items-center">
              <span className="w-4 h-4 bg-yellow-500 rounded mr-2"></span>
              <span className="text-sm text-gray-600">HOLD: {stats.actionBreakdown.HOLD || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Processing jobs */}
      {stats?.processingJobs?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Jobs</h2>
          <div className="space-y-3">
            {stats.processingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{job.title || 'Processing...'}</p>
                  <p className="text-sm text-gray-500">{job.currentStep}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{job.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two column layout for experts and shares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Experts */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Experts</h2>
          {stats?.topExperts?.length > 0 ? (
            <ul className="space-y-3">
              {stats.topExperts.map((expert, idx) => (
                <li key={expert.name} className="flex items-center justify-between">
                  <Link
                    to={`/experts/${encodeURIComponent(expert.name)}`}
                    className="flex items-center text-gray-900 hover:text-primary-600"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium mr-3">
                      {idx + 1}
                    </span>
                    <span>{expert.name}</span>
                  </Link>
                  <span className="text-sm text-gray-500">{expert.count} picks</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No experts yet</p>
          )}
        </div>

        {/* Top Shares */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Stocks</h2>
          {stats?.topShares?.length > 0 ? (
            <ul className="space-y-3">
              {stats.topShares.map((share, idx) => (
                <li key={share.name} className="flex items-center justify-between">
                  <Link
                    to={`/shares/${encodeURIComponent(share.symbol || share.name)}`}
                    className="flex items-center text-gray-900 hover:text-primary-600"
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium mr-3">
                      {idx + 1}
                    </span>
                    <span>{share.name}</span>
                    {share.symbol && (
                      <span className="text-xs text-gray-500 ml-1">({share.symbol})</span>
                    )}
                  </Link>
                  <span className="text-sm text-gray-500">{share.count} mentions</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No stocks yet</p>
          )}
        </div>
      </div>

      {/* Recent recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Recommendations</h2>
          <Link
            to="/recommendations"
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            View all →
          </Link>
        </div>
        {stats?.recentRecommendations?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentRecommendations.map((rec) => (
                  <RecommendationRow key={rec.id} rec={rec} onPlayVideo={openVideoPlayer} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            <p>No recommendations yet</p>
            <Link to="/add" className="text-primary-600 hover:text-primary-800 mt-2 inline-block">
              Add a video to get started
            </Link>
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

export default Dashboard;
