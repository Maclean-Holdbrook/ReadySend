const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = payload?.error?.details?.fieldErrors;
    const firstFieldMessage = fieldErrors
      ? Object.values(fieldErrors).flat().find(Boolean)
      : '';
    const message = firstFieldMessage || payload?.error?.message || payload?.message || 'Something went wrong.';
    const error = new Error(message);
    error.code = payload?.error?.code;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload;
}

export const api = {
  signup(body) {
    return request('/api/auth/signup', { method: 'POST', body });
  },
  login(body) {
    return request('/api/auth/login', { method: 'POST', body });
  },
  me(token) {
    return request('/api/auth/me', { token });
  },
  listOrders(sellerId) {
    return request(`/api/orders?sellerId=${encodeURIComponent(sellerId)}&_=${Date.now()}`);
  },
  createOrder(body) {
    return request('/api/orders', { method: 'POST', body });
  },
  updateOrder(id, body) {
    return request(`/api/orders/${id}`, { method: 'PATCH', body });
  },
  updateSeller(id, body) {
    return request(`/api/sellers/${id}`, { method: 'PATCH', body });
  },
  ensureSellerSlug(id) {
    return request(`/api/sellers/${id}/slug`, { method: 'POST' });
  },
  getPublicSeller(slug) {
    return request(`/api/public/sellers/${encodeURIComponent(slug)}`);
  },
  submitBuyerRequest(slug, body) {
    return request(`/api/public/sellers/${encodeURIComponent(slug)}/requests`, { method: 'POST', body });
  },
  listBuyerRequests(sellerId) {
    return request(`/api/buyer-requests?sellerId=${encodeURIComponent(sellerId)}&_=${Date.now()}`);
  },
  updateBuyerRequest(id, body) {
    return request(`/api/buyer-requests/${id}`, { method: 'PATCH', body });
  },
  sendContact(body) {
    return request('/api/contact', { method: 'POST', body });
  },
  startSubscription(body) {
    return request('/api/billing/checkout', { method: 'POST', body });
  },
  getSubscription(sellerId) {
    return request(`/api/billing/subscription?sellerId=${encodeURIComponent(sellerId)}`);
  },
  verifyLatestPayment(sellerId) {
    return request('/api/billing/verify-latest', { method: 'POST', body: { sellerId } });
  }
};
