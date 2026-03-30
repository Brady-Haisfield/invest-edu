const BASE = '/api/auth';

async function authFetch(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function register(email, password) {
  return authFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email, password) {
  return authFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(token) {
  return authFetch('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveProfile(token, { inputs, refineInputs, lastCards, lastAdvisorNarrative }) {
  return authFetch('/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inputs, refineInputs, lastCards, lastAdvisorNarrative }),
  });
}

export async function savePlan(token, planData) {
  return authFetch('/save-plan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(planData),
  });
}

export async function getSavedPlans(token) {
  return authFetch('/saved-plans', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deletePlan(token, planId) {
  return authFetch(`/saved-plans/${planId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addHolding(token, holdingData) {
  return authFetch('/portfolio/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(holdingData),
  });
}

export async function getHoldings(token) {
  return authFetch('/portfolio/holdings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteHolding(token, holdingId) {
  return authFetch(`/portfolio/holdings/${holdingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
