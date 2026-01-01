import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import api from '../services/api';

function UserDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load dashboard data
  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
        <button onClick={loadDashboard} className="mt-2 text-red-600 underline">
          Retry
        </button>
      </div>
    );
  }

  const { recentRecommendations = [], watchlistAlerts = [], unreadNotifications = 0, followingCount = 0, limits = {} } = dashboardData || {};

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.fullName}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xl font-bold">
                {user?.fullName?.charAt(0) || '?'}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Welcome, {user?.fullName || 'User'}!
              </h1>
              <p className="text-sm text-gray-500">
                {user?.subscriptionTier === 'PRO' ? (
                  <span className="text-primary-600 font-medium">Pro Member</span>
                ) : (
                  <>Free Plan • Following {followingCount}/{limits.maxFollows} experts</>
                )}
              </p>
            </div>
          </div>
          {unreadNotifications > 0 && (
            <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
              {unreadNotifications} new notification{unreadNotifications > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{followingCount}</p>
          <p className="text-sm text-gray-500">Following</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{recentRecommendations.length}</p>
          <p className="text-sm text-gray-500">Recent Picks</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{watchlistAlerts.length}</p>
          <p className="text-sm text-gray-500">Watchlist Alerts</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{unreadNotifications}</p>
          <p className="text-sm text-gray-500">Notifications</p>
        </div>
      </div>

      {/* Recent Recommendations from Followed Experts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent from Your Experts</h2>
          <Link to="/recommendations" className="text-sm text-primary-600 hover:underline">
            View All
          </Link>
        </div>

        {recentRecommendations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No recent recommendations from followed experts</p>
            <Link to="/leaderboard" className="text-primary-600 hover:underline mt-2 inline-block">
              Browse experts to follow
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentRecommendations.slice(0, 10).map((rec) => (
              <div key={rec.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                {/* Expert Image */}
                <div className="flex-shrink-0">
                  {rec.expert_picture ? (
                    <img
                      src={rec.expert_picture}
                      alt=""
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center text-gray-600 font-bold"
                    style={{ display: rec.expert_picture ? 'none' : 'flex' }}
                  >
                    {rec.expert_name?.charAt(0)}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${actionColors[rec.action]}`}>
                      {rec.action}
                    </span>
                    <Link
                      to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                      className="font-medium text-gray-900 hover:text-primary-600 truncate"
                    >
                      {rec.share_name}
                    </Link>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                    <Link to={`/experts/${encodeURIComponent(rec.expert_name)}`} className="hover:text-primary-600">
                      {rec.expert_name}
                    </Link>
                    <span>•</span>
                    <span>{formatDate(rec.recommendation_date)}</span>
                    {rec.sector && (
                      <>
                        <span>•</span>
                        <span className="text-xs">{rec.sector}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Prices */}
                <div className="text-right text-sm flex-shrink-0">
                  {rec.recommended_price && (
                    <div className="text-gray-900">₹{rec.recommended_price}</div>
                  )}
                  {rec.target_price && (
                    <div className="text-green-600 text-xs">Target: ₹{rec.target_price}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Alerts */}
      {watchlistAlerts.length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <h3 className="font-semibold text-yellow-800 mb-3">Watchlist Alerts</h3>
          <div className="space-y-2">
            {watchlistAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${actionColors[alert.action]}`}>
                    {alert.action}
                  </span>
                  <Link
                    to={`/shares/${encodeURIComponent(alert.nse_symbol || alert.share_name)}`}
                    className="text-yellow-900 hover:underline font-medium"
                  >
                    {alert.share_name}
                  </Link>
                  <span className="text-yellow-600">by {alert.expert_name}</span>
                </div>
                <div className="text-yellow-600 text-xs">
                  {formatDate(alert.recommendation_date)} • {alert.watchlist_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/leaderboard"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-primary-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Browse Experts</h3>
          <p className="text-sm text-gray-500 mt-1">Find new experts to follow based on their performance</p>
        </Link>
        <Link
          to="/recommendations"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-primary-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">All Recommendations</h3>
          <p className="text-sm text-gray-500 mt-1">Browse all stock picks with filters</p>
        </Link>
        <Link
          to="/"
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-primary-300 transition-colors"
        >
          <h3 className="font-semibold text-gray-900">Market Overview</h3>
          <p className="text-sm text-gray-500 mt-1">View overall statistics and trends</p>
        </Link>
      </div>
    </div>
  );
}

export default UserDashboard;
