import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import FloatingVideoPlayer from '../../components/FloatingVideoPlayer';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';

function ExpertManagement() {
  const [experts, setExperts] = useState([]);
  const [pendingExperts, setPendingExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExpert, setEditingExpert] = useState(null);
  const [editingProfileExpert, setEditingProfileExpert] = useState(null);
  const [newAlias, setNewAlias] = useState('');
  const [selectedExpertForAlias, setSelectedExpertForAlias] = useState(null);
  const [researchingId, setResearchingId] = useState(null);
  const [enrichingId, setEnrichingId] = useState(null);
  const [expandedExpertId, setExpandedExpertId] = useState(null);
  const [toast, setToast] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const { videoPlayer, openVideoPlayer, closeVideoPlayer } = useVideoPlayer();

  // Form state for create/edit
  const [formData, setFormData] = useState({
    canonical_name: '',
    bio: '',
    specialization: '',
    aliases: ''
  });

  // Form state for profile editing
  const [profileFormData, setProfileFormData] = useState({
    experience_summary: '',
    education: '',
    twitter_handle: '',
    linkedin_url: '',
    youtube_channel: '',
    website_url: '',
    current_associations: '',
    certifications: '',
    warnings: ''
  });

  // Show toast notification
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load data without scrolling to top
  const loadDataSilent = useCallback(async () => {
    try {
      const [expertsRes, pendingRes] = await Promise.all([
        api.getAdminExperts(),
        api.getPendingExperts()
      ]);
      setExperts(expertsRes.experts || []);
      setPendingExperts(pendingRes.pending || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      await loadDataSilent();
      setLoading(false);
    }
    initialLoad();
  }, [loadDataSilent]);

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
      await loadDataSilent();
      showToast(`Expert "${formData.canonical_name}" created`);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
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
      await loadDataSilent();
      showToast('Expert updated');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function handleDeleteExpert(expert) {
    if (!confirm(`Delete expert "${expert.canonical_name}"? This will also delete all aliases.`)) {
      return;
    }
    try {
      await api.deleteAdminExpert(expert.id);
      await loadDataSilent();
      showToast(`Expert "${expert.canonical_name}" deleted`);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function handleAddAlias(expertId) {
    if (!newAlias.trim()) return;
    const aliasToAdd = newAlias.trim();
    try {
      await api.addExpertAlias(expertId, aliasToAdd);
      setNewAlias('');
      setSelectedExpertForAlias(null);
      await loadDataSilent();
      showToast(`Alias "${aliasToAdd}" added`);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function handleRemoveAlias(aliasId, aliasName) {
    try {
      await api.removeExpertAlias(aliasId);
      await loadDataSilent();
      showToast(`Alias "${aliasName}" removed`);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
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
      await loadDataSilent();

      if (action === 'create_new') {
        showToast(`Expert "${canonicalName}" created from "${pending.raw_name}"`);
      } else if (action === 'assign_existing') {
        const expert = experts.find(e => e.id === expertId);
        showToast(`"${pending.raw_name}" assigned to ${expert?.canonical_name || 'expert'}`);
      } else if (action === 'reject') {
        showToast(`"${pending.raw_name}" rejected`);
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  async function handleResearchPending(pendingId) {
    try {
      setResearchingId(pendingId);
      const result = await api.researchPendingExpert(pendingId);
      setPendingExperts(prev => prev.map(p =>
        p.id === pendingId
          ? { ...p, research_summary: result.pendingExpert.research_summary, research_data: result.pendingExpert.research_data }
          : p
      ));
      showToast('Research completed');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setResearchingId(null);
    }
  }

  async function handleEnrichExpert(expertId) {
    try {
      setEnrichingId(expertId);
      await api.enrichExpertProfile(expertId);
      await loadDataSilent();
      setExpandedExpertId(expertId); // Auto-expand to show enriched data
      showToast('Profile enriched - click to view details');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
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

  function toggleExpandExpert(expertId) {
    setExpandedExpertId(prev => prev === expertId ? null : expertId);
  }

  function openProfileEditModal(expert) {
    setEditingProfileExpert(expert);
    setProfileFormData({
      experience_summary: expert.experience_summary || '',
      education: expert.education || '',
      twitter_handle: expert.twitter_handle || '',
      linkedin_url: expert.linkedin_url || '',
      youtube_channel: expert.youtube_channel || '',
      website_url: expert.website_url || '',
      current_associations: (expert.current_associations || []).join(', '),
      certifications: (expert.certifications || []).join(', '),
      warnings: (expert.warnings || []).join('\n')
    });
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    try {
      setSavingProfile(true);

      // Parse array fields
      const profileData = {
        experience_summary: profileFormData.experience_summary || null,
        education: profileFormData.education || null,
        twitter_handle: profileFormData.twitter_handle || null,
        linkedin_url: profileFormData.linkedin_url || null,
        youtube_channel: profileFormData.youtube_channel || null,
        website_url: profileFormData.website_url || null,
        current_associations: profileFormData.current_associations
          ? profileFormData.current_associations.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        certifications: profileFormData.certifications
          ? profileFormData.certifications.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        warnings: profileFormData.warnings
          ? profileFormData.warnings.split('\n').map(s => s.trim()).filter(Boolean)
          : null
      };

      await api.updateExpertProfile(editingProfileExpert.id, profileData);
      setEditingProfileExpert(null);
      await loadDataSilent();
      showToast('Profile updated');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleImageUpload(expertId, file) {
    try {
      setUploadingImage(true);
      const result = await api.uploadExpertImage(expertId, file);
      await loadDataSilent();
      // Update the editing expert with new image URL so modal shows it
      if (editingProfileExpert && editingProfileExpert.id === expertId) {
        setEditingProfileExpert(prev => ({ ...prev, profile_picture_url: result.imageUrl }));
      }
      showToast('Image uploaded');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

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
                      <button
                        onClick={() => openVideoPlayer(pending.youtube_url, pending.timestamp_in_video, pending.video_title)}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        ▶ View in video
                      </button>
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
                      {pending.research_data?.profile?.profile_picture_url && (
                        <img
                          src={pending.research_data.profile.profile_picture_url}
                          alt={pending.raw_name}
                          className="w-16 h-16 rounded-full object-cover"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )}
                      <div className="flex-1">
                        {pending.research_summary && (
                          <div className="prose prose-sm max-w-none text-gray-700">
                            {pending.research_summary.split('\n').map((line, i) => (
                              <p key={i} className="my-1">{line}</p>
                            ))}
                          </div>
                        )}
                        {pending.research_data?.social_media && (
                          <div className="flex gap-3 mt-3">
                            {pending.research_data.social_media.twitter_handle && (
                              <a href={`https://twitter.com/${pending.research_data.social_media.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                                Twitter: {pending.research_data.social_media.twitter_handle}
                              </a>
                            )}
                            {pending.research_data.social_media.linkedin_url && (
                              <a href={pending.research_data.social_media.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline">LinkedIn</a>
                            )}
                            {pending.research_data.social_media.youtube_channel && (
                              <a href={pending.research_data.social_media.youtube_channel} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:underline">YouTube</a>
                            )}
                          </div>
                        )}
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
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experts List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {experts.map(expert => (
            <div key={expert.id} className={!expert.is_active ? 'bg-gray-50 opacity-60' : ''}>
              {/* Expert Row */}
              <div className="px-6 py-4 flex items-center gap-4">
                {/* Profile Picture (if enriched) */}
                <div className="flex-shrink-0">
                  {expert.profile_picture_url ? (
                    <img
                      src={expert.profile_picture_url}
                      alt={expert.canonical_name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-semibold">
                      {expert.canonical_name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name & Bio */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{expert.canonical_name}</span>
                    {expert.profile_enriched_at && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                        ✓ Enriched
                      </span>
                    )}
                  </div>
                  {expert.specialization && (
                    <p className="text-sm text-gray-500">{expert.specialization}</p>
                  )}
                  {/* Social Links (compact) */}
                  {(expert.twitter_handle || expert.linkedin_url || expert.youtube_channel) && (
                    <div className="flex gap-2 mt-1">
                      {expert.twitter_handle && (
                        <a href={`https://twitter.com/${expert.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Twitter</a>
                      )}
                      {expert.linkedin_url && (
                        <a href={expert.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">LinkedIn</a>
                      )}
                      {expert.youtube_channel && (
                        <a href={expert.youtube_channel} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline">YouTube</a>
                      )}
                    </div>
                  )}
                </div>

                {/* Aliases */}
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1">
                    {(expert.aliases || []).map(alias => (
                      <span key={alias.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                        {alias.alias}
                        <button onClick={() => handleRemoveAlias(alias.id, alias.alias)} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                    {selectedExpertForAlias === expert.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newAlias}
                          onChange={(e) => setNewAlias(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddAlias(expert.id)}
                          placeholder="New alias"
                          className="px-2 py-0.5 text-xs border rounded w-24"
                          autoFocus
                        />
                        <button onClick={() => handleAddAlias(expert.id)} className="text-green-600 text-xs">Add</button>
                        <button onClick={() => { setSelectedExpertForAlias(null); setNewAlias(''); }} className="text-gray-400 text-xs">×</button>
                      </div>
                    ) : (
                      <button onClick={() => setSelectedExpertForAlias(expert.id)} className="text-xs text-primary-600 hover:underline">+ Alias</button>
                    )}
                  </div>
                </div>

                {/* Recommendations Count */}
                <div className="text-center w-16">
                  <span className="text-lg font-semibold text-gray-900">{expert.recommendation_count || 0}</span>
                  <p className="text-xs text-gray-500">Picks</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  {expert.profile_enriched_at ? (
                    <button
                      onClick={() => toggleExpandExpert(expert.id)}
                      className="text-sm text-purple-600 hover:underline"
                    >
                      {expandedExpertId === expert.id ? '▲ Hide' : '▼ Profile'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnrichExpert(expert.id)}
                      disabled={enrichingId === expert.id}
                      className="text-sm text-purple-600 hover:underline disabled:opacity-50"
                    >
                      {enrichingId === expert.id ? 'Enriching...' : '🔍 Enrich'}
                    </button>
                  )}
                  <button onClick={() => openEditModal(expert)} className="text-sm text-primary-600 hover:underline">Edit</button>
                  <button onClick={() => handleDeleteExpert(expert)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </div>

              {/* Expanded Profile Section */}
              {expandedExpertId === expert.id && (
                <div className="px-6 py-4 bg-purple-50 border-t border-purple-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Experience Summary */}
                    {expert.experience_summary && (
                      <div className="col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Experience</h4>
                        <p className="text-sm text-gray-600">{expert.experience_summary}</p>
                      </div>
                    )}

                    {/* Current Associations */}
                    {expert.current_associations?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Current Associations</h4>
                        <div className="flex flex-wrap gap-1">
                          {expert.current_associations.map((assoc, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">{assoc}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Education */}
                    {expert.education && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Education</h4>
                        <p className="text-sm text-gray-600">{expert.education}</p>
                      </div>
                    )}

                    {/* Certifications */}
                    {expert.certifications?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Certifications</h4>
                        <div className="flex flex-wrap gap-1">
                          {expert.certifications.map((cert, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">{cert}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Social Links */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Social & Web</h4>
                      <div className="flex flex-wrap gap-3">
                        {expert.twitter_handle && (
                          <a href={`https://twitter.com/${expert.twitter_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
                            🐦 {expert.twitter_handle}
                          </a>
                        )}
                        {expert.linkedin_url && (
                          <a href={expert.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 hover:underline">
                            💼 LinkedIn
                          </a>
                        )}
                        {expert.youtube_channel && (
                          <a href={expert.youtube_channel} target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 hover:underline">
                            📺 YouTube
                          </a>
                        )}
                        {expert.website_url && (
                          <a href={expert.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:underline">
                            🌐 Website
                          </a>
                        )}
                        {!expert.twitter_handle && !expert.linkedin_url && !expert.youtube_channel && !expert.website_url && (
                          <span className="text-sm text-gray-400">No social links found</span>
                        )}
                      </div>
                    </div>

                    {/* Warnings */}
                    {expert.warnings?.length > 0 && (
                      <div className="col-span-2">
                        <div className="p-3 bg-red-100 rounded-lg">
                          <h4 className="text-sm font-medium text-red-800 mb-1">⚠️ Warnings</h4>
                          <ul className="text-sm text-red-700 space-y-1">
                            {expert.warnings.map((warning, i) => (
                              <li key={i}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Enrichment Sources */}
                    {expert.enrichment_sources?.length > 0 && (
                      <div className="col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Sources</h4>
                        <div className="flex flex-wrap gap-2">
                          {expert.enrichment_sources.map((source, i) => (
                            <a
                              key={i}
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:underline bg-white px-2 py-1 rounded border"
                            >
                              [{i + 1}] {new URL(source).hostname}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="col-span-2 pt-2 border-t border-purple-200">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Enriched: {new Date(expert.profile_enriched_at).toLocaleDateString()}
                          {expert.profile_source && ` via ${expert.profile_source}`}
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => openProfileEditModal(expert)}
                            className="text-xs text-primary-600 hover:underline"
                          >
                            ✏️ Edit Profile
                          </button>
                          <button
                            onClick={() => handleEnrichExpert(expert.id)}
                            disabled={enrichingId === expert.id}
                            className="text-xs text-purple-600 hover:underline disabled:opacity-50"
                          >
                            {enrichingId === expert.id ? 'Re-enriching...' : '🔄 Re-enrich'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Create</button>
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
                <button type="button" onClick={() => setEditingExpert(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfileExpert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Profile: {editingProfileExpert.canonical_name}</h2>
              <button onClick={() => setEditingProfileExpert(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
              {/* Profile Image Section */}
              <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  {editingProfileExpert.profile_picture_url ? (
                    <img
                      src={editingProfileExpert.profile_picture_url}
                      alt={editingProfileExpert.canonical_name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-semibold">
                      {editingProfileExpert.canonical_name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(editingProfileExpert.id, file);
                    }}
                    className="text-sm"
                    disabled={uploadingImage}
                  />
                  {uploadingImage && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
                  <p className="text-xs text-gray-400 mt-1">Max 5MB. JPEG, PNG, GIF, or WebP.</p>
                </div>
              </div>

              {/* Experience Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Summary</label>
                <textarea
                  value={profileFormData.experience_summary}
                  onChange={(e) => setProfileFormData({ ...profileFormData, experience_summary: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Brief 2-3 sentence summary of their experience and expertise"
                />
              </div>

              {/* Education */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
                <input
                  type="text"
                  value={profileFormData.education}
                  onChange={(e) => setProfileFormData({ ...profileFormData, education: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g., MBA from IIM Ahmedabad, B.Tech from IIT Delhi"
                />
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twitter Handle</label>
                  <input
                    type="text"
                    value={profileFormData.twitter_handle}
                    onChange={(e) => setProfileFormData({ ...profileFormData, twitter_handle: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="@username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={profileFormData.linkedin_url}
                    onChange={(e) => setProfileFormData({ ...profileFormData, linkedin_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Channel</label>
                  <input
                    type="url"
                    value={profileFormData.youtube_channel}
                    onChange={(e) => setProfileFormData({ ...profileFormData, youtube_channel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={profileFormData.website_url}
                    onChange={(e) => setProfileFormData({ ...profileFormData, website_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Associations & Certifications */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Associations</label>
                  <input
                    type="text"
                    value={profileFormData.current_associations}
                    onChange={(e) => setProfileFormData({ ...profileFormData, current_associations: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Zee Business, ET Now (comma-separated)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated list</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certifications</label>
                  <input
                    type="text"
                    value={profileFormData.certifications}
                    onChange={(e) => setProfileFormData({ ...profileFormData, certifications: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="CFA, SEBI RIA, CFP (comma-separated)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated list</p>
                </div>
              </div>

              {/* Warnings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warnings / Red Flags</label>
                <textarea
                  value={profileFormData.warnings}
                  onChange={(e) => setProfileFormData({ ...profileFormData, warnings: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="One warning per line (e.g., SEBI actions, controversies)"
                />
                <p className="text-xs text-gray-400 mt-1">One warning per line</p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditingProfileExpert(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default ExpertManagement;
