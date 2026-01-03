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
  const [experts, setExperts] = useState([]);
  const [showCreateExpert, setShowCreateExpert] = useState(null); // recId when creating new expert
  const [newExpertName, setNewExpertName] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20; // Show 20 items per page
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [flaggedData, statsData, expertsData] = await Promise.all([
        api.getFlaggedRecommendations(),
        api.getFlagStats(),
        api.getAdminExperts()
      ]);
      setRecommendations(flaggedData.recommendations || []);
      setStats(statsData.stats);
      setExperts(expertsData.experts || []);

      // Initialize edited values with current values
      const initialEdits = {};
      (flaggedData.recommendations || []).forEach(rec => {
        initialEdits[rec.id] = {
          expert_name: rec.expert_name || '',
          recommended_price: rec.recommended_price || '',
          target_price: rec.target_price || '',
          target_price_2: rec.target_price_2 || '',
          stop_loss: rec.stop_loss || '',
          stop_loss_type: rec.stop_loss_type || 'EXPERT',
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
      (edited.expert_name || '') !== (rec.expert_name || '') ||
      (edited.recommended_price || '') !== (rec.recommended_price?.toString() || '') ||
      (edited.target_price || '') !== (rec.target_price?.toString() || '') ||
      (edited.target_price_2 || '') !== (rec.target_price_2?.toString() || '') ||
      (edited.stop_loss || '') !== (rec.stop_loss?.toString() || '') ||
      (edited.stop_loss_type || 'EXPERT') !== (rec.stop_loss_type || 'EXPERT') ||
      (edited.timeline || '') !== (rec.timeline || '')
    );
  }

  // Create a new expert and select it
  async function handleCreateExpert(recId) {
    if (!newExpertName.trim()) {
      alert('Please enter an expert name');
      return;
    }
    try {
      const result = await api.createAdminExpert({ canonical_name: newExpertName.trim() });
      // Refresh experts list and select the new expert
      const expertsData = await api.getAdminExperts();
      setExperts(expertsData.experts || []);
      updateField(recId, 'expert_name', newExpertName.trim());
      setShowCreateExpert(null);
      setNewExpertName('');
    } catch (err) {
      alert('Error creating expert: ' + err.message);
    }
  }

  // Calculate system-generated stop loss: entry - (target - entry) / 2
  function calculateSystemSL(recId) {
    const edited = editedValues[recId];
    if (!edited) return;

    const entry = parseFloat(edited.recommended_price);
    const target = parseFloat(edited.target_price);

    if (!entry || !target) {
      alert('Entry price and Target are required to calculate SL');
      return;
    }

    const systemSL = entry - (target - entry) / 2;
    setEditedValues(prev => ({
      ...prev,
      [recId]: {
        ...prev[recId],
        stop_loss: systemSL.toFixed(2),
        stop_loss_type: 'SYSTEM'
      }
    }));
  }

  async function handleSave(rec) {
    const edited = editedValues[rec.id];
    if (!edited) return;

    try {
      setProcessing(prev => ({ ...prev, [rec.id]: true }));
      const updates = {
        expert_name: edited.expert_name || null,
        recommended_price: edited.recommended_price ? parseFloat(edited.recommended_price) : null,
        target_price: edited.target_price ? parseFloat(edited.target_price) : null,
        target_price_2: edited.target_price_2 ? parseFloat(edited.target_price_2) : null,
        stop_loss: edited.stop_loss ? parseFloat(edited.stop_loss) : null,
        stop_loss_type: edited.stop_loss_type || 'EXPERT',
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

  // Pagination
  const totalPages = Math.ceil(filteredRecommendations.length / pageSize);
  const paginatedRecommendations = filteredRecommendations.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filterReason]);

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
        <div className="flex gap-2 px-1 overflow-x-auto">
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
          <div className="space-y-3 p-3">
            {/* Pagination Info */}
            <div className="flex items-center justify-between text-sm text-gray-500 px-1">
              <span>Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRecommendations.length)} of {filteredRecommendations.length}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="px-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>

            {paginatedRecommendations.map((rec) => {
              const edited = editedValues[rec.id] || {};
              const isProcessing = processing[rec.id];
              const changed = hasChanges(rec);

              return (
                <div key={rec.id} className="bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden">
                  {/* Header Row */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 font-medium">
                        {formatDate(rec.recommendation_date)}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded ${
                        rec.action === 'BUY' ? 'bg-green-500 text-white' :
                        rec.action === 'SELL' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {rec.action}
                      </span>
                      <Link
                        to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                        className="font-bold text-gray-900 hover:text-primary-600 text-lg"
                      >
                        {rec.share_name}
                      </Link>
                      {rec.nse_symbol && (
                        <span className="text-sm text-gray-400">({rec.nse_symbol})</span>
                      )}
                      {/* Issues */}
                      {rec.flag_messages?.map((flag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 font-medium"
                          title={flag.message}
                        >
                          {flag.code.replace(/^(MISSING_|ILLOGICAL_)/, '')}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.youtube_url && (
                        <button
                          onClick={() => openVideoPlayer(rec.youtube_url, rec.timestamp_in_video, rec.video_title)}
                          className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                        >
                          ▶ {rec.timestamp_in_video ? formatTimestamp(rec.timestamp_in_video) : 'Play'}
                        </button>
                      )}
                      {changed ? (
                        <button
                          onClick={() => handleSave(rec)}
                          disabled={isProcessing}
                          className="px-4 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded font-medium hover:bg-green-100 disabled:opacity-50"
                        >
                          {isProcessing ? '...' : 'Save'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(rec)}
                          disabled={isProcessing}
                          className="px-4 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded font-medium hover:bg-green-100 disabled:opacity-50"
                        >
                          {isProcessing ? '...' : 'Approve'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rec)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <span className="text-xs font-mono text-gray-300 ml-2">#{rec.id?.slice(0, 6)}</span>
                    </div>
                  </div>

                  {/* Content Row */}
                  <div className="px-4 py-3 flex items-center gap-6">
                    {/* Expert */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 font-medium">Expert:</label>
                      {showCreateExpert === rec.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newExpertName}
                            onChange={(e) => setNewExpertName(e.target.value)}
                            className="w-36 px-2 py-1.5 text-sm border border-blue-400 rounded"
                            placeholder="Expert name..."
                            autoFocus
                          />
                          <button onClick={() => handleCreateExpert(rec.id)} className="px-2 py-1 text-xs bg-green-500 text-white rounded">Save</button>
                          <button onClick={() => { setShowCreateExpert(null); setNewExpertName(''); }} className="px-2 py-1 text-xs bg-gray-400 text-white rounded">X</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <select
                            value={edited.expert_name || ''}
                            onChange={(e) => updateField(rec.id, 'expert_name', e.target.value)}
                            className="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded"
                          >
                            <option value="">Select...</option>
                            {edited.expert_name && !experts.find(e => e.canonical_name === edited.expert_name) && (
                              <option value={edited.expert_name}>{edited.expert_name}</option>
                            )}
                            {experts.map(exp => (
                              <option key={exp.id} value={exp.canonical_name}>{exp.canonical_name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => { setShowCreateExpert(rec.id); setNewExpertName(rec.expert_name || ''); }}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded border border-gray-300 hover:bg-gray-200"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>

                    {/* Prices */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">Entry:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={edited.recommended_price || ''}
                          onChange={(e) => updateField(rec.id, 'recommended_price', e.target.value)}
                          className={`w-24 px-2 py-1.5 text-sm border rounded font-medium ${
                            !edited.recommended_price ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">T1:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={edited.target_price || ''}
                          onChange={(e) => updateField(rec.id, 'target_price', e.target.value)}
                          className={`w-24 px-2 py-1.5 text-sm border rounded font-medium ${
                            !edited.target_price ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">T2:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={edited.target_price_2 || ''}
                          onChange={(e) => updateField(rec.id, 'target_price_2', e.target.value)}
                          className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">SL:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={edited.stop_loss || ''}
                          onChange={(e) => {
                            updateField(rec.id, 'stop_loss', e.target.value);
                            updateField(rec.id, 'stop_loss_type', 'EXPERT');
                          }}
                          className={`w-24 px-2 py-1.5 text-sm border rounded font-medium ${
                            !edited.stop_loss ? 'border-red-400 bg-red-50 text-red-700' :
                            edited.stop_loss_type === 'SYSTEM' ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'
                          }`}
                        />
                        <button
                          onClick={() => calculateSystemSL(rec.id)}
                          className="px-2 py-1.5 text-xs bg-gray-100 text-gray-600 rounded border border-gray-300 hover:bg-gray-200"
                          title="Auto-calculate SL"
                        >
                          Auto
                        </button>
                      </div>
                    </div>

                    <div className="h-8 w-px bg-gray-200"></div>

                    {/* Timeline */}
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-gray-500">Timeline:</label>
                      <select
                        value={edited.timeline || ''}
                        onChange={(e) => updateField(rec.id, 'timeline', e.target.value)}
                        className={`w-28 px-2 py-1.5 text-sm border border-gray-300 rounded ${getTimelineColor(edited.timeline)}`}
                      >
                        <option value="">Select...</option>
                        {timelineOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 pt-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="px-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Video Player - 1.5x speed for admin review */}
      {videoPlayer && (
        <FloatingVideoPlayer
          videoId={videoPlayer.videoId}
          timestamp={videoPlayer.timestamp}
          title={videoPlayer.title}
          onClose={closeVideoPlayer}
          playbackRate={1.5}
        />
      )}
    </div>
  );
}

export default RecommendationReview;
