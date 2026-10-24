export type EmailStatus = 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
export type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: string;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  enabled: boolean;
  hourlyLimit: number;
  minIntervalMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailBatch {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startAt: string;
  status: BatchStatus;
  idempotencyKey: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledEmail {
  id: string;
  batchId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  sentAt: string | null;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  idempotencyKey: string;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    email: string;
    name: string | null;
  };
}

export interface SlackConnection {
  teamId: string;
  teamName: string | null;
  scopes: string;
  createdAt: string;
}

export interface SlackConnectionResponse {
  connected: boolean;
  connection: SlackConnection | null;
}

export interface PaginatedBatches {
  batches: EmailBatch[];
  total: number;
  page: number;
  size: number;
}

export interface PaginatedScheduledEmails {
  emails: ScheduledEmail[];
  total: number;
  page: number;
  size: number;
}

export interface PaginatedSentEmails {
  emails: ScheduledEmail[];
  total: number;
  page: number;
  size: number;
}

export interface SearchEmailsResponse {
  hits: ScheduledEmail[];
  total: number;
  page: number;
  size: number;
  source?: 'postgres' | 'elasticsearch';
}

export interface CreateBatchPayload {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  startAt: string; // ISO datetime
  idempotencyKey: string;
}

export interface CreateSenderPayload {
  email: string;
  name?: string;
  hourlyLimit?: number;
  minIntervalMs?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded';
  checks: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
    elasticsearch: 'ok' | 'error';
  };
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}
