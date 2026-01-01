import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function ExpertManagement() {
  const [experts, setExperts] = useState([]);
  const [pendingExperts, setPendingExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExpert, setEditingExpert] = useState(null);
  const [newAlias, setNewAlias] = useState('');
  const [selectedExpertForAlias, setSelectedExpertForAlias] = useState(null);
  const [researchingId, setResearchingId] = useState(null);
  const [researchResult, setResearchResult] = useState(null);
  const [enrichingId, setEnrichingId] = useState(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    canonical_name: '',
    bio: '',
    specialization: '',
    aliases: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [expertsRes, pendingRes] = await Promise.all([
        api.getAdminExperts(),
        api.getPendingExperts()
      ]);
      setExperts(expertsRes.experts || []);
      setPendingExperts(pendingRes.pending || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExpert(e) {
    e.preventDefault();
    try {
      const aliases = formData.aliases
        .split(',')
        .map(a => a.trim())
        .filter(a => a);

      await api.createAdminExpert({
        canonical_name: formData.canonical_name,
        bio: formData.bio || null,
        specialization: formData.specialization || null,
        aliases
      });

      setShowCreateModal(false);
      setFormData({ canonical_name: '', bio: '', specialization: '', aliases: '' });
      loadData();
    } catch (err) {
      alert('Error creating expert: ' + err.message);
    }
  }

  async function handleUpdateExpert(e) {
    e.preventDefault();
    try {
      await api.updateAdminExpert(editingExpert.id, {
        canonical_name: formData.canonical_name,
        bio: formData.bio || null,
        specialization: formData.specialization || null
      });

      setEditingExpert(null);
      setFormData({ canonical_name: '', bio: '', specialization: '', aliases: '' });
      loadData();
    } catch (err) {
      alert('Error updating expert: ' + err.message);
    }
  }

  async function handleDeleteExpert(expert) {
    if (!confirm(`Delete expert "${expert.canonical_name}"? This will also delete all aliases.`)) {
      return;
    }
    try {
      await api.deleteAdminExpert(expert.id);
      loadData();
    } catch (err) {
      alert('Error deleting expert: ' + err.message);
    }
  }

  async function handleAddAlias(expertId) {
    if (!newAlias.trim()) return;
    try {
      await api.addExpertAlias(expertId, newAlias.trim());
      setNewAlias('');
      setSelectedExpertForAlias(null);
      loadData();
    } catch (err) {
      alert('Error adding alias: ' + err.message);
    }
  }

  async function handleRemoveAlias(aliasId) {
    try {
      await api.removeExpertAlias(aliasId);
      loadData();
    } catch (err) {
      alert('Error removing alias: ' + err.message);
    }
  }

  async function handleResolvePending(pending, action, expertId = null) {
    try {
      let canonicalName = null;
      if (action === 'create_new') {
        canonicalName = prompt('Enter canonical name:', pending.raw_name);
        if (canonicalName === null) return;
      }

      await api.resolvePendingExpert(pending.id, action, expertId, canonicalName);
      setResearchResult(null);
      loadData();
    } catch (err) {
      alert('Error resolving pending expert: ' + err.message);
    }
  }

  async function handleResearchPending(pendingId) {
    try {
      setResearchingId(pendingId);
      setResearchResult(null);
      const result = await api.researchPendingExpert(pendingId);
      setResearchResult({
        pendingId,
        data: result.pendingExpert
      });
      // Update the pending expert in our list with research data
      setPendingExperts(prev => prev.map(p =>
        p.id === pendingId
          ? { ...p, research_summary: result.pendingExpert.research_summary, research_data: result.pendingExpert.research_data }
          : p
      ));
    } catch (err) {
      alert('Error researching expert: ' + err.message);
    } finally {
      setResearchingId(null);
    }
  }

  async function handleEnrichExpert(expertId) {
    try {
      setEnrichingId(expertId);
      const result = await api.enrichExpertProfile(expertId);
      loadData();
      alert('Profile enriched successfully!');
    } catch (err) {
      alert('Error enriching profile: ' + err.message);
    } finally {
      setEnrichingId(null);
    }
  }

  function openEditModal(expert) {
    setEditingExpert(expert);
    setFormData({
      canonical_name: expert.canonical_name,
      bio: expert.bio || '',
      specialization: expert.specialization || '',
      aliases: ''
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Expert Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          + Add Expert
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Pending Experts Section */}
      {pendingExperts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-4">
            Pending Review ({pendingExperts.length})
          </h2>
          <div className="space-y-4">
            {pendingExperts.map(pending => (
              <div key={pending.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">"{pending.raw_name}"</p>
                    {pending.video_title && (
                      <p className="text-sm text-gray-500 mt-1">
                        From: {pending.video_title}
                        {pending.timestamp_in_video && (
                          <span className="ml-2">
                            @ {Math.floor(pending.timestamp_in_video / 60)}:{(pending.timestamp_in_video % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </p>
                    )}
                    {pending.youtube_url && (
                      <a
                        href={`${pending.youtube_url}${pending.timestamp_in_video ? `&t=${pending.timestamp_in_video}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:underline"
                      >
                        View in video
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleResearchPending(pending.id)}
                      disabled={researchingId === pending.id}
                      className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                    >
                      {researchingId === pending.id ? 'Researching...' : '🔍 Research'}
                    </button>
                    <button
                      onClick={() => handleResolvePending(pending, 'create_new')}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Create New
                    </button>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleResolvePending(pending, 'assign_existing', e.target.value);
                        }
                      }}
                      className="px-3 py-1 text-sm border rounded"
                      defaultValue=""
                    >
                      <option value="">Assign to existing...</option>
                      {experts.map(exp => (
                        <option key={exp.id} value={exp.id}>{exp.canonical_name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleResolvePending(pending, 'reject')}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {/* Research Results */}
                {(pending.research_summary || pending.research_data) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-start gap-4">
                      {/* Profile Picture */}
                      {pending.research_data?.profile?.profile_picture_url && (
                        <img
                          src={pending.research_data.profile.profile_picture_url}
                          alt={pending.raw_name}
                          className="w-16 h-16 rounded-full object-cover"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )}
                      <div className="flex-1">
                        {/* Summary */}
                        {pending.research_summary && (
                          <div className="prose prose-sm max-w-none text-gray-700">
                            {pending.research_summary.split('\n').map((line, i) => (
                              <p key={i} className="my-1">{line}</p>
                            ))}
                          </div>
                        )}

                        {/* Social Links */}
                        {pending.research_data?.social_media && (
                          <div className="flex gap-3 mt-3">
                            {pending.research_data.social_media.twitter_handle && (
                              <a
                                href={`https://twitter.com/${pending.research_data.social_media.twitter_handle.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline"
                              >
                                Twitter: {pending.research_data.social_media.twitter_handle}
                              </a>
                            )}
                            {pending.research_data.social_media.linkedin_url && (
                              <a
                                href={pending.research_data.social_media.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-700 hover:underline"
                              >
                                LinkedIn
                              </a>
                            )}
                            {pending.research_data.social_media.youtube_channel && (
                              <a
                                href={pending.research_data.social_media.youtube_channel}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-red-600 hover:underline"
                              >
                                YouTube
                              </a>
                            )}
                          </div>
                        )}

                        {/* Warnings */}
                        {pending.research_data?.warnings?.length > 0 && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm font-medium text-red-800 mb-2">⚠️ Warnings:</p>
                            <ul className="text-sm text-red-700 space-y-1">
                              {pending.research_data.warnings.map((w, i) => (
                                <li key={i}>• [{w.type}] {w.description}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Confidence */}
                        {pending.research_data?.confidence && (
                          <p className="mt-2 text-xs text-gray-500">
                            Research confidence: {pending.research_data.confidence}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aliases</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendations</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {experts.map(expert => (
              <tr key={expert.id} className={!expert.is_active ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{expert.canonical_name}</div>
                  {expert.bio && <div className="text-sm text-gray-500">{expert.bio}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(expert.aliases || []).map(alias => (
                      <span
                        key={alias.id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                      >
                        {alias.alias}
                        <button
                          onClick={() => handleRemoveAlias(alias.id)}
                          className="ml-1 text-gray-400 hover:text-red-500"
                        >
                          x
                        </button>
                      </span>
                    ))}
                    {selectedExpertForAlias === expert.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newAlias}
                          onChange={(e) => setNewAlias(e.target.value)}
                          placeholder="New alias"
                          className="px-2 py-0.5 text-xs border rounded w-24"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddAlias(expert.id)}
                          className="text-green-600 text-xs"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => { setSelectedExpertForAlias(null); setNewAlias(''); }}
                          className="text-gray-400 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedExpertForAlias(expert.id)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        + Add alias
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {expert.specialization || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {expert.recommendation_count || 0}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEnrichExpert(expert.id)}
                      disabled={enrichingId === expert.id}
                      className="text-sm text-purple-600 hover:underline disabled:opacity-50"
                    >
                      {enrichingId === expert.id ? 'Enriching...' : '🔍 Enrich'}
                    </button>
                    <button
                      onClick={() => openEditModal(expert)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteExpert(expert)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Expert</h2>
            <form onSubmit={handleCreateExpert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Canonical Name *</label>
                <input
                  type="text"
                  value={formData.canonical_name}
                  onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Specialization</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Technical Analysis, Fundamental"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Aliases (comma-separated)</label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Anil ji, Singhvi ji"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingExpert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Expert</h2>
            <form onSubmit={handleUpdateExpert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Canonical Name *</label>
                <input
                  type="text"
                  value={formData.canonical_name}
                  onChange={(e) => setFormData({ ...formData, canonical_name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Specialization</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingExpert(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpertManagement;
