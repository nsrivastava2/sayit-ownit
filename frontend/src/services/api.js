const API_BASE = '/api';

async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Stats
  async getStats() {
    return fetchApi('/stats');
  },

  // Videos
  async processVideo(youtubeUrl) {
    return fetchApi('/videos/process', {
      method: 'POST',
      body: JSON.stringify({ youtube_url: youtubeUrl })
    });
  },

  async getVideos(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/videos${query ? `?${query}` : ''}`);
  },

  async getVideo(id) {
    return fetchApi(`/videos/${id}`);
  },

  async getVideoStatus(id) {
    return fetchApi(`/videos/${id}/status`);
  },

  async deleteVideo(id) {
    return fetchApi(`/videos/${id}`, { method: 'DELETE' });
  },

  // Recommendations
  async getRecommendations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/recommendations${query ? `?${query}` : ''}`);
  },

  async getRecentRecommendations(limit = 10) {
    return fetchApi(`/recommendations/recent?limit=${limit}`);
  },

  async getRecommendationsByExpert() {
    return fetchApi('/recommendations/by-expert');
  },

  async getRecommendationsByShare() {
    return fetchApi('/recommendations/by-share');
  },

  // Experts
  async getExperts() {
    return fetchApi('/experts');
  },

  async getExpert(name) {
    return fetchApi(`/experts/${encodeURIComponent(name)}`);
  },

  // Shares
  async getShares() {
    return fetchApi('/shares');
  },

  async getShare(symbol) {
    return fetchApi(`/shares/${encodeURIComponent(symbol)}`);
  },

  // Export
  getExportUrl(params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE}/recommendations/export${query ? `?${query}` : ''}`;
  }
};

export default api;
