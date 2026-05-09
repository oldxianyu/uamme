// UAMME API Client
const API = {
  token: localStorage.getItem('uamme_token'),

  setToken(token) {
    this.token = token;
    localStorage.setItem('uamme_token', token);
  },

  clearToken() {
    this.token = null;
    localStorage.removeItem('uamme_token');
  },

  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const resp = await fetch(url, { ...options, headers });
    const data = await resp.json();

    if (resp.status === 401) {
      this.clearToken();
      window.location.href = '/login.html';
      return data;
    }

    return data;
  },

  // Auth
  async login(username, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    });
    if (data.token) this.setToken(data.token);
    return data;
  },

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.clearToken();
  },

  async getMe() { return this.request('/api/auth/me'); },
  async changePassword(oldPassword, newPassword) { return this.request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }); },
  async getUsers() { return this.request('/api/auth/users'); },
  async createUser(username, password, display_name) { return this.request('/api/auth/users', { method: 'POST', body: JSON.stringify({ username, password, display_name }) }); },
  async deleteUser(id) { return this.request(`/api/auth/users/${id}`, { method: 'DELETE' }); },

  // Dashboard
  async getStats() { return this.request('/api/dashboard/stats'); },
  async getRecentPushes() { return this.request('/api/dashboard/recent-pushes'); },
  async getRecentFailures() { return this.request('/api/dashboard/recent-failures'); },

  // Webhooks
  async getWebhooks() { return this.request('/api/webhooks'); },
  async getWebhook(id) { return this.request(`/api/webhooks/${id}`); },
  async createWebhook(data) { return this.request('/api/webhooks', { method: 'POST', body: JSON.stringify(data) }); },
  async updateWebhook(id, data) { return this.request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteWebhook(id) { return this.request(`/api/webhooks/${id}`, { method: 'DELETE' }); },
  async testWebhook(id, content, format) { return this.request(`/api/webhooks/${id}/test`, { method: 'POST', body: JSON.stringify({ content, format }) }); },

  // Templates
  async getTemplates() { return this.request('/api/templates'); },
  async getTemplate(id) { return this.request(`/api/templates/${id}`); },
  async createTemplate(data) { return this.request('/api/templates', { method: 'POST', body: JSON.stringify(data) }); },
  async updateTemplate(id, data) { return this.request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteTemplate(id) { return this.request(`/api/templates/${id}`, { method: 'DELETE' }); },
  async previewTemplate(id, variables) { return this.request(`/api/templates/${id}/preview`, { method: 'POST', body: JSON.stringify({ variables }) }); },

  // Content Sources
  async getContentSources() { return this.request('/api/content-sources'); },
  async getContentSource(id) { return this.request(`/api/content-sources/${id}`); },
  async createContentSource(data) { return this.request('/api/content-sources', { method: 'POST', body: JSON.stringify(data) }); },
  async updateContentSource(id, data) { return this.request(`/api/content-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteContentSource(id) { return this.request(`/api/content-sources/${id}`, { method: 'DELETE' }); },
  async testContentSource(id) { return this.request(`/api/content-sources/${id}/test`, { method: 'POST' }); },

  // Custom Content
  async getCustomContents() { return this.request('/api/custom-contents'); },
  async getCustomContent(id) { return this.request(`/api/custom-contents/${id}`); },
  async createCustomContent(data) { return this.request('/api/custom-contents', { method: 'POST', body: JSON.stringify(data) }); },
  async updateCustomContent(id, data) { return this.request(`/api/custom-contents/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteCustomContent(id) { return this.request(`/api/custom-contents/${id}`, { method: 'DELETE' }); },

  // Push
  async getPushLogs(limit, offset) { return this.request(`/api/push/logs?limit=${limit || 50}&offset=${offset || 0}`); },
  async getPushLog(id) { return this.request(`/api/push/logs/${id}`); },
  async sendPush(data) { return this.request('/api/push/send', { method: 'POST', body: JSON.stringify(data) }); },

  // AI
  async getAISettings() { return this.request('/api/ai/settings'); },
  async updateAISettings(data) { return this.request('/api/ai/settings', { method: 'PUT', body: JSON.stringify(data) }); },
  async aiOptimize(content, action) { return this.request('/api/ai/optimize', { method: 'POST', body: JSON.stringify({ content, action }) }); },
};
