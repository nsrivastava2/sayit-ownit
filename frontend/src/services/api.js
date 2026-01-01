const API_BASE = '/api';

async function fetchApi(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Required for sending/receiving cookies
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
  // ============================================
  // Authentication
  // ============================================

  async adminLogin(password) {
    return fetchApi('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  async getAdminStatus() {
    return fetchApi('/auth/admin-status');
  },

  async adminLogout() {
    return fetchApi('/auth/admin-logout', { method: 'POST' });
  },

  // ============================================
  // Stats
  // ============================================

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
    // Filter out empty values before creating query string
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    );
    const query = new URLSearchParams(cleanParams).toString();
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

  // Stocks (Master data)
  async searchStocks(query, limit = 20) {
    return fetchApi(`/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  async getStockSectors() {
    return fetchApi('/stocks/sectors');
  },

  async getStocks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/stocks${query ? `?${query}` : ''}`);
  },

  async getStock(symbol) {
    return fetchApi(`/stocks/${encodeURIComponent(symbol)}`);
  },

  // Export
  getExportUrl(params = {}) {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE}/recommendations/export${query ? `?${query}` : ''}`;
  },

  // ============================================
  // Leaderboard & Expert Metrics
  // ============================================

  async getLeaderboard(limit = 50) {
    return fetchApi(`/prices/leaderboard?limit=${limit}`);
  },

  async getExpertMetrics(expertName) {
    return fetchApi(`/prices/metrics/${encodeURIComponent(expertName)}`);
  },

  async getExpertMetricsHistory(expertName, days = 30) {
    return fetchApi(`/prices/metrics/${encodeURIComponent(expertName)}/history?days=${days}`);
  },

  // ============================================
  // Admin API - Expert Management
  // ============================================

  async getAdminExperts() {
    return fetchApi('/admin/experts');
  },

  async getAdminExpert(id) {
    return fetchApi(`/admin/experts/${id}`);
  },

  async createAdminExpert(data) {
    return fetchApi('/admin/experts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminExpert(id, data) {
    return fetchApi(`/admin/experts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteAdminExpert(id) {
    return fetchApi(`/admin/experts/${id}`, { method: 'DELETE' });
  },

  async addExpertAlias(expertId, alias) {
    return fetchApi(`/admin/experts/${expertId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias })
    });
  },

  async removeExpertAlias(aliasId) {
    return fetchApi(`/admin/experts/aliases/${aliasId}`, { method: 'DELETE' });
  },

  async getPendingExperts() {
    return fetchApi('/admin/experts/pending');
  },

  async resolvePendingExpert(pendingId, action, expertId = null, canonicalName = null) {
    return fetchApi(`/admin/experts/pending/${pendingId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, expertId, canonicalName })
    });
  },

  async clearExpertCache() {
    return fetchApi('/admin/experts/cache/clear', { method: 'POST' });
  },

  // ============================================
  // Admin API - Channel Management
  // ============================================

  async getAdminChannels() {
    return fetchApi('/admin/channels');
  },

  async createAdminChannel(data) {
    return fetchApi('/admin/channels', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminChannel(id, data) {
    return fetchApi(`/admin/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getPromptFiles() {
    return fetchApi('/admin/channels/prompts');
  },

  async testChannelMatch(channelName) {
    return fetchApi(`/admin/channels/test/${encodeURIComponent(channelName)}`);
  },

  async clearPromptCache() {
    return fetchApi('/admin/channels/cache/clear', { method: 'POST' });
  },

  // ============================================
  // Admin API - Recommendation Review
  // ============================================

  async getFlaggedRecommendations() {
    return fetchApi('/admin/recommendations/flagged');
  },

  async getFlagStats() {
    return fetchApi('/admin/recommendations/stats');
  },

  async approveRecommendation(id, notes = null) {
    return fetchApi(`/admin/recommendations/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },

  async editRecommendation(id, updates, notes = null) {
    return fetchApi(`/admin/recommendations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, notes })
    });
  },

  async validateAllRecommendations() {
    return fetchApi('/admin/recommendations/validate-all', { method: 'POST' });
  }
};

export default api;
