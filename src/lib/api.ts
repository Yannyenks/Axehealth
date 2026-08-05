// Central API client — replaces mock data with real backend calls

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ─── Token management ─────────────────────────────────────────────────────────

function getAccessToken(): string | null {
  return localStorage.getItem('accessToken')
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken)
  localStorage.setItem('refreshToken', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    const rt = localStorage.getItem('refreshToken')
    if (rt) {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (refreshRes.ok) {
        const { data } = await refreshRes.json()
        setTokens(data.accessToken, data.refreshToken)
        return apiFetch<T>(path, options, false)
      }
    }
    clearTokens()
    window.location.href = '/'
    throw new Error('Session expirée')
  }

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const message = body?.message || `Erreur ${res.status}`
    throw new ApiClientError(message, res.status, body?.code, body?.details)
  }

  return body as T
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ success: boolean; data: { user: any; accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { email, password },
    )
    setTokens(res.data.accessToken, res.data.refreshToken)
    return res.data.user
  },

  logout: async () => {
    const rt = localStorage.getItem('refreshToken')
    await api.post('/auth/logout', { refreshToken: rt }).catch(() => null)
    clearTokens()
  },

  me: () => api.get<{ success: boolean; data: any }>('/auth/me').then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
}

// ─── Dossiers ─────────────────────────────────────────────────────────────────

export const dossierApi = {
  list: (params?: Record<string, string | number>) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return api.get<any>(`/dossiers${qs}`)
  },
  kanban: () => api.get<any>('/dossiers/kanban'),
  get: (id: string) => api.get<any>(`/dossiers/${id}`),
  create: (data: any) => api.post<any>('/dossiers', data),
  update: (id: string, data: any) => api.put<any>(`/dossiers/${id}`, data),
  advance: (id: string, commentaire?: string) => api.post<any>(`/dossiers/${id}/advance`, { commentaire }),
  addComment: (id: string, message: string) => api.post<any>(`/dossiers/${id}/comments`, { message }),
  linkDI: (id: string, diId: string) => api.post<any>(`/dossiers/${id}/link-di`, { diId }),
}

// ─── Containers ───────────────────────────────────────────────────────────────

export const containerApi = {
  byDossier: (dossierId: string) => api.get<any>(`/containers/dossier/${dossierId}`),
  create: (dossierId: string, data: any) => api.post<any>(`/containers/dossier/${dossierId}`, data),
  update: (id: string, data: any) => api.patch<any>(`/containers/${id}`, data),
  delete: (id: string) => api.delete<any>(`/containers/${id}`),
}

// ─── DI ───────────────────────────────────────────────────────────────────────

export const diApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/di${qs}`)
  },
  get: (id: string) => api.get<any>(`/di/${id}`),
  history: (id: string) => api.get<any>(`/di/${id}/history`),
  create: (data: any) => api.post<any>('/di', data),
  update: (id: string, data: any) => api.put<any>(`/di/${id}`, data),
  createOperation: (diId: string, data: any) => api.post<any>(`/di/${diId}/operations`, data),
  validateOperation: (opId: string) => api.patch<any>(`/di/operations/${opId}/validate`),
  rejectOperation: (opId: string, motif?: string) => api.patch<any>(`/di/operations/${opId}/reject`, { motif }),
}

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentApi = {
  byDossier: (dossierId: string) => api.get<any>(`/documents/dossier/${dossierId}`),
  upload: (formData: FormData) => api.post<any>('/documents/upload', formData),
  delete: (id: string) => api.delete<any>(`/documents/${id}`),
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const workflowApi = {
  byDossier: (dossierId: string) => api.get<any>(`/workflow/dossier/${dossierId}`),
  block: (stepId: string, raison: string) => api.patch<any>(`/workflow/step/${stepId}/block`, { raison }),
  resume: (stepId: string) => api.patch<any>(`/workflow/step/${stepId}/resume`),
  submitDelayReport: (stepId: string, data: any) => api.post<any>(`/workflow/step/${stepId}/delay-report`, data),
  slaOverview: () => api.get<any>('/workflow/sla-overview'),
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/alertes${qs}`)
  },
  stats: () => api.get<any>('/alertes/stats'),
  markRead: (id: string) => api.patch<any>(`/alertes/${id}/read`),
  markAllRead: () => api.patch<any>('/alertes/read-all'),
  resolve: (id: string) => api.patch<any>(`/alertes/${id}/resolve`),
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export const financeApi = {
  summary: () => api.get<any>('/finance/summary'),
  douane: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/finance/douane${qs}`)
  },
  createDouane: (data: any) => api.post<any>('/finance/douane', data),
  payDouane: (id: string) => api.patch<any>(`/finance/douane/${id}/pay`),
  compagnie: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/finance/compagnie${qs}`)
  },
  createCompagnie: (data: any) => api.post<any>('/finance/compagnie', data),
  payCompagnie: (id: string) => api.patch<any>(`/finance/compagnie/${id}/pay`),
  transfers: () => api.get<any>('/finance/transfers'),
  createTransfer: (data: any) => api.post<any>('/finance/transfers', data),
  parCompagnie: () => api.get<any>('/finance/par-compagnie'),
}

// ─── Kribi ────────────────────────────────────────────────────────────────────

export const kribiApi = {
  bons: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/kribi/bons${qs}`)
  },
  createBon: (data: any) => api.post<any>('/kribi/bons', data),
  updateBonStatut: (id: string, statut: string) => api.patch<any>(`/kribi/bons/${id}/statut`, { statut }),
  gatePasses: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/kribi/gate-passes${qs}`)
  },
  createGatePass: (data: any) => api.post<any>('/kribi/gate-passes', data),
  transmettre: (id: string) => api.patch<any>(`/kribi/gate-passes/${id}/transmettre`),
  utiliser: (id: string) => api.patch<any>(`/kribi/gate-passes/${id}/utilise`),
  dashboard: () => api.get<any>('/kribi/dashboard'),
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messageApi = {
  conversations: () => api.get<any>('/messages/conversations'),
  createConversation: (data: any) => api.post<any>('/messages/conversations', data),
  messages: (convId: string, page?: number) =>
    api.get<any>(`/messages/conversations/${convId}/messages${page ? `?page=${page}` : ''}`),
  send: (convId: string, contenu: string) =>
    api.post<any>(`/messages/conversations/${convId}/messages`, { contenu }),
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const userApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/users${qs}`)
  },
  get: (id: string) => api.get<any>(`/users/${id}`),
  create: (data: any) => api.post<any>('/users', data),
  update: (id: string, data: any) => api.put<any>(`/users/${id}`, data),
  toggleActif: (id: string) => api.patch<any>(`/users/${id}/toggle-actif`),
  notifications: () => api.get<any>('/users/me/notifications'),
  markNotifRead: (id: string) => api.patch<any>(`/users/me/notifications/${id}/read`),
  markAllNotifsRead: () => api.patch<any>('/users/me/notifications/read-all'),
}

// ─── Reporting ────────────────────────────────────────────────────────────────

export const reportingApi = {
  kpis: () => api.get<any>('/reporting/kpis'),
  slaPerformance: () => api.get<any>('/reporting/sla-performance'),
  employees: () => api.get<any>('/reporting/employees'),
  weeklyActivity: () => api.get<any>('/reporting/weekly-activity'),
  diOverview: () => api.get<any>('/reporting/di-overview'),
  financialSummary: () => api.get<any>('/reporting/financial-summary'),
  delayReports: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/reporting/delay-reports${qs}`)
  },
  retards: () => api.get<any>('/reporting/retards'),
  audit: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<any>(`/reporting/audit${qs}`)
  },
  parSite: () => api.get<any>('/reporting/par-site'),
}

// ─── SLA Config ───────────────────────────────────────────────────────────────

export const slaApi = {
  list: () => api.get<any>('/sla'),
  update: (etape: string, slaHeures: number) => api.put<any>(`/sla/${etape}`, { slaHeures }),
  reset: () => api.post<any>('/sla/reset-defaults'),
}

export default api
