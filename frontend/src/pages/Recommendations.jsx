import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import OutcomeBadge from '../components/OutcomeBadge';
import FlagIndicator from '../components/FlagIndicator';
import FloatingVideoPlayer from '../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../hooks/useVideoPlayer';

function Recommendations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recommendations, setRecommendations] = useState([]);
  const [experts, setExperts] = useState([]);
  const [shares, setShares] = useState([]);
  const [tags, setTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  // Filter state from URL params
  const filters = {
    expert: searchParams.get('expert') || '',
    share: searchParams.get('share') || '',
    action: searchParams.get('action') || '',
    status: searchParams.get('status') || '',
    outcome: searchParams.get('outcome') || '',
    tag: searchParams.get('tag') || '',
    timeline: searchParams.get('timeline') || '',
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
      const [recsResult, expertsResult, sharesResult, tagsResult] = await Promise.all([
        api.getRecommendations({
          expert: filters.expert,
          share: filters.share,
          action: filters.action,
          status: filters.status,
          outcome: filters.outcome,
          tag: filters.tag,
          timeline: filters.timeline,
          date_from: filters.date_from,
          date_to: filters.date_to,
          limit,
          offset
        }),
        api.getExperts(),
        api.getShares(),
        api.getTags()
      ]);

      setRecommendations(recsResult.recommendations);
      setTotal(recsResult.total);
      setExperts(expertsResult.experts);
      setShares(sharesResult.shares);
      setTags(tagsResult.tags || []);
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

  const timelineColors = {
    INTRADAY: 'bg-red-100 text-red-700',
    BTST: 'bg-orange-100 text-orange-700',
    SHORT_TERM: 'bg-yellow-100 text-yellow-700',
    POSITIONAL: 'bg-blue-100 text-blue-700',
    MEDIUM_TERM: 'bg-indigo-100 text-indigo-700',
    LONG_TERM: 'bg-purple-100 text-purple-700'
  };

  const timelineLabels = {
    INTRADAY: 'Intraday',
    BTST: 'BTST',
    SHORT_TERM: 'Short Term',
    POSITIONAL: 'Positional',
    MEDIUM_TERM: 'Medium Term',
    LONG_TERM: 'Long Term'
  };

  // Format date as 12-Dec-2025
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mt-4">
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

          {/* Tag filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag/Segment</label>
            <select
              value={filters.tag}
              onChange={(e) => updateFilter('tag', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Tags</option>
              {tags.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </option>
              ))}
            </select>
          </div>

          {/* Timeline filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
            <select
              value={filters.timeline}
              onChange={(e) => updateFilter('timeline', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">All Timelines</option>
              <option value="INTRADAY">Intraday</option>
              <option value="BTST">BTST</option>
              <option value="SHORT_TERM">Short Term</option>
              <option value="POSITIONAL">Positional</option>
              <option value="MEDIUM_TERM">Medium Term</option>
              <option value="LONG_TERM">Long Term</option>
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
            {(filters.expert || filters.share || filters.action || filters.status || filters.outcome || filters.tag || filters.timeline || filters.date_from || filters.date_to) && (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timeline</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stop Loss</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(rec.recommendation_date)}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/experts/${encodeURIComponent(rec.expert_name)}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800"
                      >
                        {rec.expert_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <FlagIndicator isFlagged={rec.is_flagged} flagReasons={rec.flag_reasons} />
                        <Link
                          to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                          className="text-sm font-medium text-gray-900"
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
                    <td className="px-4 py-3">
                      {rec.timeline ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${timelineColors[rec.timeline] || 'bg-gray-100 text-gray-700'}`}>
                          {timelineLabels[rec.timeline] || rec.timeline}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
                      {rec.tags && rec.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rec.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              onClick={() => updateFilter('tag', tag)}
                              className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full cursor-pointer hover:bg-blue-200"
                              title={`Filter by: ${tag}`}
                            >
                              {tag}
                            </span>
                          ))}
                          {rec.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{rec.tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rec.videos && rec.videos.youtube_url ? (
                        <button
                          onClick={() => openVideoPlayer(rec.videos.youtube_url, rec.timestamp_in_video, rec.videos.title)}
                          className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                        >
                          <span>▶</span>
                          {rec.timestamp_in_video ? formatTimestamp(rec.timestamp_in_video) : 'Play'}
                        </button>
                      ) : rec.video_id ? (
                        <Link
                          to={`/videos/${rec.video_id}`}
                          className="text-xs text-primary-600 hover:text-primary-800"
                        >
                          View
                        </Link>
                      ) : null}
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

export default Recommendations;
