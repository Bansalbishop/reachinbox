import type {
  User,
  Sender,
  EmailBatch,
  PaginatedBatches,
  PaginatedScheduledEmails,
  PaginatedSentEmails,
  SearchEmailsResponse,
  SlackConnectionResponse,
  CreateBatchPayload,
  CreateSenderPayload,
  HealthCheckResponse,
  ApiError,
} from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Attach auth token if available (supports cross-origin third-party cookie restrictions)
  const token = typeof window !== 'undefined' ? localStorage.getItem('outbox_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always send and receive cookies for Express-session
    });
  } catch (err) {
    throw new ApiRequestError(
      0,
      `Cannot reach API at ${API_BASE_URL}. Ensure the backend is running.`,
      'NETWORK_ERROR',
      err
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorObj: ApiError = typeof data === 'object' && data?.error ? data.error : { message: typeof data === 'string' ? data : 'API error' };
    throw new ApiRequestError(
      response.status,
      errorObj.message || `Request failed with status ${response.status}`,
      errorObj.code,
      errorObj.details
    );
  }

  return data as T;
}

export const api = {
  // URLs for direct browser redirects (OAuth and Bull Board)
  authUrls: {
    googleLogin: `${API_BASE_URL}/auth/google`,
    get bullBoard() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('outbox_token') : null;
      return token ? `${API_BASE_URL}/admin/queues?token=${encodeURIComponent(token)}` : `${API_BASE_URL}/admin/queues`;
    },
    get slackConnect() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('outbox_token') : null;
      return token ? `${API_BASE_URL}/api/slack/connect?token=${encodeURIComponent(token)}` : `${API_BASE_URL}/api/slack/connect`;
    },
  },

  // Auth
  auth: {
    async getMe(): Promise<{ user: User }> {
      return request<{ user: User }>('/api/auth/me');
    },
    async logout(): Promise<{ ok: boolean }> {
      try {
        return await request<{ ok: boolean }>('/api/auth/logout', {
          method: 'POST',
        });
      } finally {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('outbox_token');
        }
      }
    },
  },

  // Senders
  senders: {
    async list(): Promise<{ senders: Sender[] }> {
      return request<{ senders: Sender[] }>('/api/senders');
    },
    async create(payload: CreateSenderPayload): Promise<{ sender: Sender }> {
      return request<{ sender: Sender }>('/api/senders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // Email Batches & Scheduling
  emails: {
    async createBatch(payload: CreateBatchPayload): Promise<{ batch: EmailBatch; created: boolean }> {
      return request<{ batch: EmailBatch; created: boolean }>('/api/email-batches', {
        method: 'POST',
        headers: {
          'idempotency-key': payload.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    },
    async listBatches(page = 1, size = 20): Promise<PaginatedBatches> {
      return request<PaginatedBatches>(`/api/email-batches?page=${page}&size=${size}`);
    },
    async getScheduled(page = 1, size = 20): Promise<PaginatedScheduledEmails> {
      return request<PaginatedScheduledEmails>(`/api/emails/scheduled?page=${page}&size=${size}`);
    },
    async getSent(page = 1, size = 20): Promise<PaginatedSentEmails> {
      return request<PaginatedSentEmails>(`/api/emails/sent?page=${page}&size=${size}`);
    },
    async reconcile(): Promise<{ ok: boolean; reconciled: number }> {
      return request<{ ok: boolean; reconciled: number }>('/api/emails/reconcile', {
        method: 'POST',
      });
    },
    async dispatchNow(emailId: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/api/emails/${emailId}/dispatch-now`, {
        method: 'POST',
      });
    },
    async search(params: {
      recipient?: string;
      subject?: string;
      senderEmail?: string;
      senderId?: string;
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      size?: number;
    }): Promise<SearchEmailsResponse> {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      return request<SearchEmailsResponse>(`/api/emails?${searchParams.toString()}`);
    },
  },

  // Slack Integration
  slack: {
    async getStatus(): Promise<SlackConnectionResponse> {
      return request<SlackConnectionResponse>('/api/slack/connection');
    },
    async disconnect(): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>('/api/slack/connection', {
        method: 'DELETE',
      });
    },
  },

  // System Health
  health: {
    async check(): Promise<HealthCheckResponse> {
      return request<HealthCheckResponse>('/health');
    },
  },
};
