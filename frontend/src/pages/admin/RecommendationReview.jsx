import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import FloatingVideoPlayer from '../../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';

function RecommendationReview() {
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editedValues, setEditedValues] = useState({}); // Track inline edits per recommendation
  const [processing, setProcessing] = useState({});
  const [filterReason, setFilterReason] = useState(null);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [flaggedData, statsData] = await Promise.all([
        api.getFlaggedRecommendations(),
        api.getFlagStats()
      ]);
      setRecommendations(flaggedData.recommendations || []);
      setStats(statsData.stats);

      // Initialize edited values with current values
      const initialEdits = {};
      (flaggedData.recommendations || []).forEach(rec => {
        initialEdits[rec.id] = {
          recommended_price: rec.recommended_price || '',
          target_price: rec.target_price || '',
          stop_loss: rec.stop_loss || '',
          timeline: rec.timeline || 'SHORT_TERM'
        };
      });
      setEditedValues(initialEdits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(recId, field, value) {
    setEditedValues(prev => ({
      ...prev,
      [recId]: { ...prev[recId], [field]: value }
    }));
  }

  function hasChanges(rec) {
    const edited = editedValues[rec.id];
    if (!edited) return false;
    return (
      (edited.recommended_price || '') !== (rec.recommended_price?.toString() || '') ||
      (edited.target_price || '') !== (rec.target_price?.toString() || '') ||
      (edited.stop_loss || '') !== (rec.stop_loss?.toString() || '') ||
      (edited.timeline || '') !== (rec.timeline || '')
    );
  }

  async function handleSave(rec) {
    const edited = editedValues[rec.id];
    if (!edited) return;

    try {
      setProcessing(prev => ({ ...prev, [rec.id]: true }));
      const updates = {
        recommended_price: edited.recommended_price ? parseFloat(edited.recommended_price) : null,
        target_price: edited.target_price ? parseFloat(edited.target_price) : null,
        stop_loss: edited.stop_loss ? parseFloat(edited.stop_loss) : null,
        timeline: edited.timeline || null
      };
      await api.editRecommendation(rec.id, updates);
      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      if (stats) {
        setStats(prev => ({
          ...prev,
          flagged_count: parseInt(prev.flagged_count) - 1,
          clean_count: parseInt(prev.clean_count) + 1
        }));
      }
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setProcessing(prev => ({ ...prev, [rec.id]: false }));
    }
  }

  async function handleApprove(rec) {
    try {
      setProcessing(prev => ({ ...prev, [rec.id]: true }));
      await api.approveRecommendation(rec.id);
      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      if (stats) {
        setStats(prev => ({
          ...prev,
          flagged_count: parseInt(prev.flagged_count) - 1,
          clean_count: parseInt(prev.clean_count) + 1
        }));
      }
    } catch (err) {
      alert('Error approving: ' + err.message);
    } finally {
      setProcessing(prev => ({ ...prev, [rec.id]: false }));
    }
  }

  async function handleDelete(rec) {
    if (!confirm(`Delete recommendation for ${rec.share_name}?`)) return;
    try {
      setProcessing(prev => ({ ...prev, [rec.id]: true }));
      await api.deleteRecommendation(rec.id);
      setRecommendations(prev => prev.filter(r => r.id !== rec.id));
      if (stats) {
        setStats(prev => ({
          ...prev,
          flagged_count: parseInt(prev.flagged_count) - 1
        }));
      }
    } catch (err) {
      alert('Error deleting: ' + err.message);
    } finally {
      setProcessing(prev => ({ ...prev, [rec.id]: false }));
    }
  }

  // Format date as 12-Dec-2025
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };

  // Format timestamp as MM:SS or HH:MM:SS
  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return null;
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timelineOptions = [
    { value: 'INTRADAY', label: 'Intraday', color: 'bg-red-100 text-red-700' },
    { value: 'BTST', label: 'BTST', color: 'bg-orange-100 text-orange-700' },
    { value: 'SHORT_TERM', label: 'Short Term', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'POSITIONAL', label: 'Positional', color: 'bg-blue-100 text-blue-700' },
    { value: 'MEDIUM_TERM', label: 'Medium Term', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'LONG_TERM', label: 'Long Term', color: 'bg-purple-100 text-purple-700' }
  ];

  const getTimelineColor = (timeline) => {
    const opt = timelineOptions.find(o => o.value === timeline);
    return opt?.color || 'bg-gray-100 text-gray-700';
  };

  // Filter recommendations
  const filteredRecommendations = filterReason
    ? recommendations.filter(rec =>
        rec.flag_reasons?.includes(filterReason) ||
        rec.flag_messages?.some(f => f.code === filterReason)
      )
    : recommendations;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
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

  return (
    <div className="space-y-4">
      {/* Compact Header with Stats */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border p-3">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-gray-900">Review Recommendations</h1>
          {stats && (
            <div className="flex gap-4 text-sm">
              <span className="text-amber-600 font-semibold">{stats.flagged_count} Flagged</span>
              <span className="text-green-600">{stats.clean_count} Clean</span>
              <span className="text-gray-500">{stats.total_count} Total</span>
            </div>
          )}
        </div>
      </div>

      {/* Issue Filters - Compact */}
      {stats?.reasonBreakdown?.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <button
            onClick={() => setFilterReason(null)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              filterReason === null
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All ({stats.flagged_count})
          </button>
          {stats.reasonBreakdown.map(({ reason, count }) => (
            <button
              key={reason}
              onClick={() => setFilterReason(reason)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                filterReason === reason
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {reason.replace(/_/g, ' ')} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Recommendations Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredRecommendations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filterReason ? (
              <button onClick={() => setFilterReason(null)} className="text-primary-600 hover:underline">
                No items - Show all
              </button>
            ) : (
              <p>All recommendations reviewed!</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Stock / Expert</th>
                <th className="px-3 py-2 text-left">Issues</th>
                <th className="px-3 py-2 text-left w-24">Entry</th>
                <th className="px-3 py-2 text-left w-24">Target</th>
                <th className="px-3 py-2 text-left w-24">SL</th>
                <th className="px-3 py-2 text-left w-32">Timeline</th>
                <th className="px-3 py-2 text-left">Video</th>
                <th className="px-3 py-2 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecommendations.map((rec) => {
                const edited = editedValues[rec.id] || {};
                const isProcessing = processing[rec.id];
                const changed = hasChanges(rec);

                return (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    {/* Date */}
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatDate(rec.recommendation_date)}
                    </td>

                    {/* Stock / Expert */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                          rec.action === 'BUY' ? 'bg-green-100 text-green-800' :
                          rec.action === 'SELL' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {rec.action}
                        </span>
                        <Link
                          to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {rec.share_name}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{rec.expert_name}</div>
                    </td>

                    {/* Issues */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {rec.flag_messages?.slice(0, 2).map((flag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700"
                            title={flag.message}
                          >
                            {flag.code.replace(/^(MISSING_|ILLOGICAL_)/, '')}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Entry Price - Editable */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={edited.recommended_price || ''}
                        onChange={(e) => updateField(rec.id, 'recommended_price', e.target.value)}
                        className={`w-full px-2 py-1 text-sm border rounded ${
                          !edited.recommended_price ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        placeholder="Entry"
                      />
                    </td>

                    {/* Target - Editable */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={edited.target_price || ''}
                        onChange={(e) => updateField(rec.id, 'target_price', e.target.value)}
                        className={`w-full px-2 py-1 text-sm border rounded ${
                          !edited.target_price ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        placeholder="Target"
                      />
                    </td>

                    {/* Stop Loss - Editable */}
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={edited.stop_loss || ''}
                        onChange={(e) => updateField(rec.id, 'stop_loss', e.target.value)}
                        className={`w-full px-2 py-1 text-sm border rounded ${
                          !edited.stop_loss ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                        placeholder="SL"
                      />
                    </td>

                    {/* Timeline - Editable */}
                    <td className="px-3 py-2">
                      <select
                        value={edited.timeline || ''}
                        onChange={(e) => updateField(rec.id, 'timeline', e.target.value)}
                        className={`w-full px-2 py-1 text-xs border rounded ${getTimelineColor(edited.timeline)}`}
                      >
                        <option value="">Select...</option>
                        {timelineOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Video Link */}
                    <td className="px-3 py-2">
                      {rec.youtube_url && (
                        <button
                          onClick={() => openVideoPlayer(rec.youtube_url, rec.timestamp_in_video, rec.video_title)}
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                        >
                          <span>▶</span>
                          {rec.timestamp_in_video ? formatTimestamp(rec.timestamp_in_video) : 'Play'}
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {changed ? (
                          <button
                            onClick={() => handleSave(rec)}
                            disabled={isProcessing}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {isProcessing ? '...' : 'Save'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApprove(rec)}
                            disabled={isProcessing}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {isProcessing ? '...' : 'OK'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(rec)}
                          disabled={isProcessing}
                          className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

export default RecommendationReview;
