import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

function RecommendationReview() {
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [processing, setProcessing] = useState(false);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    if (!confirm('Approve this recommendation as-is? The flag will be cleared.')) return;

    try {
      setProcessing(true);
      await api.approveRecommendation(id);
      setRecommendations(prev => prev.filter(r => r.id !== id));
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
      setProcessing(false);
    }
  }

  function startEdit(rec) {
    setEditingId(rec.id);
    setEditForm({
      recommended_price: rec.recommended_price || '',
      target_price: rec.target_price || '',
      stop_loss: rec.stop_loss || '',
      action: rec.action || 'BUY'
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function handleSaveEdit(id) {
    try {
      setProcessing(true);
      const updates = {
        recommended_price: editForm.recommended_price ? parseFloat(editForm.recommended_price) : null,
        target_price: editForm.target_price ? parseFloat(editForm.target_price) : null,
        stop_loss: editForm.stop_loss ? parseFloat(editForm.stop_loss) : null,
        action: editForm.action
      };
      await api.editRecommendation(id, updates);
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setEditingId(null);
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
      setProcessing(false);
    }
  }

  async function handleRevalidateAll() {
    if (!confirm('Re-validate all recommendations? This may flag more recommendations.')) return;

    try {
      setProcessing(true);
      const result = await api.validateAllRecommendations();
      alert(`Validated ${result.total} recommendations. ${result.flagged} flagged.`);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }

  // Get severity color for flag reasons
  const getSeverityColor = (reasons) => {
    if (reasons.some(r => r.code.includes('ILLOGICAL'))) return 'bg-red-100 text-red-800';
    if (reasons.some(r => r.code.includes('MISSING'))) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recommendation Review</h1>
          <p className="text-gray-500 mt-1">
            Review and approve flagged recommendations
          </p>
        </div>
        <button
          onClick={handleRevalidateAll}
          disabled={processing}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Re-validate All
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Flagged</p>
            <p className="text-3xl font-bold text-amber-600">{stats.flagged_count}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Clean</p>
            <p className="text-3xl font-bold text-green-600">{stats.clean_count}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total_count}</p>
          </div>
        </div>
      )}

      {/* Flag Reason Breakdown */}
      {stats?.reasonBreakdown?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Issues by Type</h3>
          <div className="flex flex-wrap gap-2">
            {stats.reasonBreakdown.map(({ reason, count }) => (
              <span key={reason} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                {reason.replace(/_/g, ' ')}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Flagged Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Flagged Recommendations ({recommendations.length})
          </h2>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg">No flagged recommendations</p>
            <p className="text-sm mt-2">All recommendations have been reviewed!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-4 hover:bg-gray-50">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        rec.action === 'BUY' ? 'bg-green-100 text-green-800' :
                        rec.action === 'SELL' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {rec.action}
                      </span>
                      <Link
                        to={`/shares/${encodeURIComponent(rec.nse_symbol || rec.share_name)}`}
                        className="font-semibold text-primary-600 hover:text-primary-800"
                      >
                        {rec.share_name}
                      </Link>
                      {rec.nse_symbol && (
                        <span className="text-sm text-gray-500">({rec.nse_symbol})</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {rec.expert_name} • {rec.recommendation_date}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {editingId !== rec.id && (
                      <>
                        <button
                          onClick={() => startEdit(rec)}
                          disabled={processing}
                          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleApprove(rec.id)}
                          disabled={processing}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Flag Reasons */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {rec.flag_messages?.map((flag, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-1 text-xs rounded ${getSeverityColor([flag])}`}
                      title={flag.message}
                    >
                      {flag.message}
                    </span>
                  ))}
                </div>

                {/* Current Values or Edit Form */}
                {editingId === rec.id ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
                        <select
                          value={editForm.action}
                          onChange={(e) => setEditForm(prev => ({ ...prev, action: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                          <option value="HOLD">HOLD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Entry Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.recommended_price}
                          onChange={(e) => setEditForm(prev => ({ ...prev, recommended_price: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Entry"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Target Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.target_price}
                          onChange={(e) => setEditForm(prev => ({ ...prev, target_price: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Target"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Stop Loss</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.stop_loss}
                          onChange={(e) => setEditForm(prev => ({ ...prev, stop_loss: e.target.value }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Stop Loss"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(rec.id)}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Save & Approve
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Entry: </span>
                      <span className={!rec.recommended_price ? 'text-red-600 font-medium' : ''}>
                        {rec.recommended_price ? `₹${rec.recommended_price}` : 'Missing'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target: </span>
                      <span className={!rec.target_price ? 'text-red-600 font-medium' : ''}>
                        {rec.target_price ? `₹${rec.target_price}` : 'Missing'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">SL: </span>
                      <span className={!rec.stop_loss ? 'text-red-600 font-medium' : ''}>
                        {rec.stop_loss ? `₹${rec.stop_loss}` : 'Missing'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Video Source */}
                {rec.video_title && (
                  <div className="mt-2 text-xs text-gray-500">
                    Source: {rec.video_title}
                    {rec.youtube_url && (
                      <a
                        href={rec.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-primary-600 hover:underline"
                      >
                        Watch
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendationReview;
