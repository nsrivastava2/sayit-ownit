import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function ChannelManagement() {
  const [channels, setChannels] = useState([]);
  const [promptFiles, setPromptFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testInput, setTestInput] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    prompt_file: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const response = await api.getAdminChannels();
      setChannels(response.channels || []);
      setPromptFiles(response.availablePromptFiles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateChannel(e) {
    e.preventDefault();
    try {
      await api.createAdminChannel({
        name: formData.name,
        prompt_file: formData.prompt_file || null
      });

      setShowCreateModal(false);
      setFormData({ name: '', prompt_file: '' });
      loadData();
    } catch (err) {
      alert('Error creating channel: ' + err.message);
    }
  }

  async function handleUpdateChannel(e) {
    e.preventDefault();
    try {
      await api.updateAdminChannel(editingChannel.id, {
        name: formData.name,
        prompt_file: formData.prompt_file || null
      });

      setEditingChannel(null);
      setFormData({ name: '', prompt_file: '' });
      loadData();
    } catch (err) {
      alert('Error updating channel: ' + err.message);
    }
  }

  async function handleToggleActive(channel) {
    try {
      await api.updateAdminChannel(channel.id, {
        is_active: !channel.is_active
      });
      loadData();
    } catch (err) {
      alert('Error updating channel: ' + err.message);
    }
  }

  async function handleTestMatch() {
    if (!testInput.trim()) return;
    try {
      const result = await api.testChannelMatch(testInput.trim());
      setTestResult(result);
    } catch (err) {
      alert('Error testing match: ' + err.message);
    }
  }

  async function handleClearCache() {
    try {
      await api.clearPromptCache();
      alert('Prompt cache cleared successfully');
    } catch (err) {
      alert('Error clearing cache: ' + err.message);
    }
  }

  function openEditModal(channel) {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      prompt_file: channel.prompt_file || ''
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
        <h1 className="text-2xl font-bold text-gray-900">Channel Management</h1>
        <div className="flex gap-2">
          <button
            onClick={handleClearCache}
            className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Clear Cache
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            + Add Channel
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
      )}

      {/* Test Channel Matching */}
      <div className="bg-gray-50 border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Test Channel Matching</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Enter channel name from YouTube (e.g., 'Zee Business Live')"
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <button
            onClick={handleTestMatch}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Test
          </button>
        </div>
        {testResult && (
          <div className="mt-3 p-3 bg-white rounded border">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Input:</span> {testResult.input}
              </div>
              <div>
                <span className="text-gray-500">Normalized:</span> {testResult.normalized}
              </div>
              <div>
                <span className="text-gray-500">Matched Channel:</span>{' '}
                {testResult.matchedChannel ? (
                  <span className="text-green-600">{testResult.matchedChannel.name}</span>
                ) : (
                  <span className="text-yellow-600">No match (will use default)</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Prompt File:</span>{' '}
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">{testResult.promptFile}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Available Prompt Files */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Available Prompt Files</h3>
        <div className="flex flex-wrap gap-2">
          {promptFiles.map(file => (
            <span
              key={file}
              className="px-2 py-1 bg-white border border-blue-200 rounded text-sm font-mono"
            >
              {file}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Files are located in: <code>/backend/prompts/</code>. Add new .md files and refresh.
        </p>
      </div>

      {/* Channels Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt File</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {channels.map(channel => (
              <tr key={channel.id} className={!channel.is_active ? 'bg-gray-50 opacity-60' : ''}>
                <td className="px-6 py-4 font-medium text-gray-900">
                  {channel.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                  {channel.slug}
                </td>
                <td className="px-6 py-4">
                  {channel.prompt_file ? (
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-mono">
                      {channel.prompt_file}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">default.md</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleActive(channel)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      channel.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {channel.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openEditModal(channel)}
                    className="text-sm text-primary-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No channels configured. Add your first channel to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Channel</h2>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Channel Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Zee Business"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prompt File</label>
                <select
                  value={formData.prompt_file}
                  onChange={(e) => setFormData({ ...formData, prompt_file: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Use default.md</option>
                  {promptFiles.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
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
      {editingChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Edit Channel</h2>
            <form onSubmit={handleUpdateChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Channel Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prompt File</label>
                <select
                  value={formData.prompt_file}
                  onChange={(e) => setFormData({ ...formData, prompt_file: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Use default.md</option>
                  {promptFiles.map(file => (
                    <option key={file} value={file}>{file}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
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

export default ChannelManagement;
