import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import OutcomeBadge from '../components/OutcomeBadge';

function Recommendations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recommendations, setRecommendations] = useState([]);
  const [experts, setExperts] = useState([]);
  const [shares, setShares] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state from URL params
  const filters = {
    expert: searchParams.get('expert') || '',
    share: searchParams.get('share') || '',
    action: searchParams.get('action') || '',
    status: searchParams.get('status') || '',
    outcome: searchParams.get('outcome') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    page: parseInt(searchParams.get('page') || '1')
  };

  const limit = 20;
  const offset = (filters.page - 1) * limit;

  useEffect(() => {
    loadData();
  }, [searchParams]);

  async function loadData() {
    try {
      setLoading(true);

      // Load recommendations and filter options in parallel
      const [recsResult, expertsResult, sharesResult] = await Promise.all([
        api.getRecommendations({
          expert: filters.expert,
          share: filters.share,
          action: filters.action,
          status: filters.status,
          outcome: filters.outcome,
          date_from: filters.date_from,
          date_to: filters.date_to,
          limit,
          offset
        }),
        api.getExperts(),
        api.getShares()
      ]);

      setRecommendations(recsResult.recommendations);
      setTotal(recsResult.total);
      setExperts(expertsResult.experts);
      setShares(sharesResult.shares);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Reset to first page on filter change
    setSearchParams(newParams);
  }

  function setPage(page) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  }

  function clearFilters() {
    setSearchParams({});
  }

  const totalPages = Math.ceil(total / limit);

  const actionColors = {
    BUY: 'bg-green-100 text-green-800',
    SELL: 'bg-red-100 text-red-800',
    HOLD: 'bg-yellow-100 text-yellow-800'
  };

  // Format seconds as MM:SS
  function formatTimestamp(seconds) {
    if (!seconds && seconds !== 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Generate YouTube URL with timestamp
  function getYouTubeUrlWithTimestamp(url, seconds) {
    if (!url) return null;
    if (!seconds && seconds !== 0) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Math.floor(seconds)}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
          <p className="text-gray-500 mt-1">
            {total} recommendations found
          </p>
        </div>
        <a
          href={api.getExportUrl({
            expert: filters.expert,
            share: filters.share,
            action: filters.action,
            date_from: filters.date_from,
            date_to: filters.date_to
          })}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span className="mr-2">📥</span>
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Expert filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expert</label>
            <select
              value={filters.expert}
              onChange={(e) => updateFilter('expert', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Experts</option>
              {experts.map((e) => (
                <option key={e.name} value={e.name}>
                  {e.name} ({e.count})
                </option>
              ))}
            </select>
          </div>

          {/* Share filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
            <select
              value={filters.share}
              onChange={(e) => updateFilter('share', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Stocks</option>
              {shares.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Actions</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="HOLD">HOLD</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Outcome filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <select
              value={filters.outcome}
              onChange={(e) => updateFilter('outcome', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Outcomes</option>
              <option value="TARGET_HIT">Target Hit</option>
              <option value="SL_HIT">Stop Loss Hit</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => updateFilter('date_from', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => updateFilter('date_to', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Clear filters button */}
          <div className="flex items-end">
            {(filters.expert || filters.share || filters.action || filters.status || filters.outcome || filters.date_from || filters.date_to) && (
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 text-sm text-primary-600 hover:text-primary-800 border border-primary-300 rounded-lg hover:bg-primary-50"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            Error: {error}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No recommendations found</p>
            {(filters.expert || filters.share || filters.action || filters.date_from || filters.date_to) && (
              <button
                onClick={clearFilters}
                className="mt-2 text-primary-600 hover:text-primary-800"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Price</th>
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
                    <td className="px-4 py-3">
                      <OutcomeBadge
                        outcome={rec.outcome}
                        status={rec.status}
                        returnPct={rec.outcome?.return_percentage}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {rec.videos && (
                        <div className="flex flex-col space-y-1">
                          {rec.timestamp_in_video !== null && rec.videos.youtube_url ? (
                            <a
                              href={getYouTubeUrlWithTimestamp(rec.videos.youtube_url, rec.timestamp_in_video)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:text-primary-800 flex items-center"
                            >
                              <span className="mr-1">▶</span>
                              {formatTimestamp(rec.timestamp_in_video)}
                            </a>
                          ) : (
                            <Link
                              to={`/videos/${rec.video_id}`}
                              className="text-xs text-primary-600 hover:text-primary-800"
                            >
                              View video
                            </Link>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} results
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(filters.page - 1)}
                disabled={filters.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (filters.page <= 3) {
                  pageNum = i + 1;
                } else if (filters.page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = filters.page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 border rounded-lg text-sm ${
                      pageNum === filters.page
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(filters.page + 1)}
                disabled={filters.page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Recommendations;
