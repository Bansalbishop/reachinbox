# Outbox — Email Scheduler Backend

A TypeScript Express backend for scheduling email batches with durable delayed delivery via BullMQ, rate limiting, Elasticsearch search, Google OAuth, Slack notifications, and a live queue dashboard.

## Architecture

```
┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Client   │───▶  Express  │───▶  PostgreSQL   │
│ (Browser) │    │   API    │    │ (Prisma ORM) │
└──────────┘    └────┬─────┘    └──────────────┘
                     │
                     │ BullMQ delayed jobs
                     ▼
                ┌──────────┐    ┌──────────────┐
                │  Redis   │◀───│   Worker      │
                │  Queue   │    │  (separate    │
                └──────────┘    │   process)    │
                                └──────┬───────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │ Ethereal │ │  Elastic  │ │  Slack   │
                    │  SMTP    │ │  search   │ │  API     │
                    └──────────┘ └──────────┘ └──────────┘
```

### Data Flow

1. **POST /api/email-batches** → Validates input → Creates `EmailBatch` + `ScheduledEmail` records in PostgreSQL (transaction) → Enqueues BullMQ delayed jobs → Indexes in Elasticsearch
2. **Worker** picks up due jobs → Atomically claims email (prevents duplicate sends) → Checks rate limit (Redis Lua) → Sends via Ethereal SMTP → Updates DB status + Elasticsearch
3. **Rate-limited jobs** are rescheduled to the next available slot (not dropped)
4. **Quota hit** triggers a deduplicated Slack notification to the connected workspace

### No Cron Design

All scheduling uses BullMQ delayed jobs. No `node-cron`, `setInterval`, or OS cron is involved. Each email gets a job with a computed delay based on its `scheduledAt` timestamp. This is durable — jobs survive process restarts (backed by Redis AOF persistence).

### Reconciliation

On startup, both the API server and worker scan for `PENDING` emails (committed to DB but not yet queued) and enqueue them. This handles the crash window between DB commit and queue publish.

## Folder Structure

```
src/
  config.ts          # Zod-validated env config
  db.ts              # Prisma client singleton
  redis.ts           # Redis connection factory
  app.ts             # Express app factory
  server.ts          # API entry point
  worker.ts          # Worker entry point
  routes/
    auth.ts          # Google OAuth + session management
    emails.ts        # Batch creation, email listing, search
    senders.ts       # Sender CRUD
    slack.ts         # Slack OAuth connect/disconnect
    health.ts        # Health check endpoint
  services/
    scheduler.ts     # BullMQ job scheduling + reconciliation
    email-sender.ts  # Nodemailer SMTP transport
    rate-limit.ts    # Redis Lua atomic rate limiting
    search.ts        # Elasticsearch indexing + search
    slack-notifier.ts# Slack notifications + token encryption
  middleware/
    auth.ts          # Session auth middleware
    error-handler.ts # Error formatting
  lib/
    email-queue.ts   # BullMQ queue definition
    logger.ts        # Pino logger
prisma/
  schema.prisma      # Database models
scripts/
  es-setup.ts        # Elasticsearch index creation
  es-reconcile.ts    # Full re-index from Postgres
tests/               # Vitest unit tests
docker-compose.yml   # PostgreSQL, Redis, Elasticsearch
```

## Installation

```bash
# Clone and install
npm install

# Copy env file and configure
cp .env.example .env

# Start infrastructure
docker compose up -d

# Wait for services to be healthy
docker compose ps

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Setup Elasticsearch index
npm run es:setup
```

## Environment Setup

### Required Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Random 64+ char string for session encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/auth/google/callback` |
| `SMTP_USER` / `SMTP_PASS` | Ethereal SMTP credentials |
| `SLACK_TOKEN_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM |
| `WORKER_CONCURRENCY` | Number of concurrent worker jobs (default: 5) |

### Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy Client ID and Client Secret to `.env`

### Ethereal SMTP Setup

1. Visit [ethereal.email](https://ethereal.email/) and click "Create Ethereal Account"
2. Copy the generated username and password to `SMTP_USER` and `SMTP_PASS`
3. Ethereal is a testing service — emails are captured but never delivered to real inboxes
4. View sent emails at `https://ethereal.email/messages`

### Slack App Configuration

1. Create a Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable OAuth & Permissions
3. Add redirect URL: `http://localhost:3000/api/slack/callback`
4. Add Bot Token Scopes: `chat:write`, `channels:read`
5. Copy Client ID, Client Secret, and Signing Secret to `.env`
6. Install to your workspace via the `/api/slack/connect` endpoint

### Elasticsearch

Single-node local setup via Docker Compose. **Not production HA.** Security is disabled for local dev. For production, enable TLS and authentication.

## Running

```bash
# Start API server (port 3000 by default)
npm run dev

# Start worker (separate terminal)
npm run dev:worker

# Or for production:
npm run build
npm start            # API
npm run start:worker # Worker
```

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | No | Initiate Google OAuth |
| GET | `/auth/google/callback` | No | OAuth callback |
| GET | `/api/auth/me` | Yes | Current user info |
| POST | `/api/auth/logout` | Yes | Destroy session |

### Email Batches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/email-batches` | Yes | Create a batch |
| GET | `/api/email-batches` | Yes | List batches (paginated) |

#### Create Batch Example

```bash
curl -X POST http://localhost:3000/api/email-batches \
  -H "Content-Type: application/json" \
  -H "Cookie: outbox.sid=<session>" \
  -H "Idempotency-Key: batch-20250315-001" \
  -d '{
    "subject": "Welcome!",
    "body": "<p>Hello from Outbox</p>",
    "recipients": ["user1@example.com", "user2@example.com"],
    "senderId": "<sender-id>",
    "startAt": "2025-03-15T10:00:00Z",
    "idempotencyKey": "batch-20250315-001"
  }'
```

### Emails

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/emails/scheduled` | Yes | Pending/queued emails |
| GET | `/api/emails/sent` | Yes | Sent emails |
| GET | `/api/emails?recipient=...&status=...` | Yes | Search via Elasticsearch |

### Senders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/senders` | Yes | List senders |
| POST | `/api/senders` | Yes | Create/update sender |

#### Create Sender Example

```bash
curl -X POST http://localhost:3000/api/senders \
  -H "Content-Type: application/json" \
  -H "Cookie: outbox.sid=<session>" \
  -d '{
    "email": "noreply@mycompany.com",
    "name": "My Company",
    "hourlyLimit": 100,
    "minIntervalMs": 3000
  }'
```

### Slack

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/slack/connect` | Yes | Start Slack OAuth |
| GET | `/api/slack/callback` | Yes | Slack OAuth callback |
| GET | `/api/slack/connection` | Yes | Connection status |
| DELETE | `/api/slack/connection` | Yes | Disconnect Slack |

### Infrastructure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/admin/queues` | Yes | Bull Board dashboard |

## Rate Limiting Algorithm

### Per-Sender Controls

1. **Hourly Quota**: Configurable per sender (default from `DEFAULT_HOURLY_LIMIT`). Uses a Redis counter key scoped to `sender:{id}:hour:{YYYYMMDDTHH}` (UTC). Expires automatically at end of hour.
2. **Minimum Interval**: Configurable per sender (default from `DEFAULT_MIN_INTERVAL_MS`). Tracks last send time in Redis.

### Atomic Reservation (Lua Script)

Both checks are performed atomically in a single Redis Lua script:
1. Check hourly counter < limit
2. Check elapsed time since last send >= minimum interval
3. If both pass: increment counter + set last-send timestamp
4. If either fails: return retry-after delay

This is safe across multiple workers and server instances — no read-then-increment races.

### Quota Exhaustion Behavior

When a quota is exceeded:
- The job is **not dropped or failed**
- The email is rescheduled to the next available slot (retry-after delay from Lua)
- A Slack notification is sent (once per sender per hour, deduplicated via Redis NX)

### Throughput Consistency

If `minIntervalMs = 5000` and `hourlyLimit = 50`, the effective max throughput is `min(3600000/5000, 50) = 50/hour`. If `hourlyLimit = 1000` with `minIntervalMs = 5000`, the effective max is `720/hour` (interval-limited). The system enforces the stricter constraint; it does not promise both can be independently satisfied.

## Idempotency

- **Batch level**: `idempotencyKey` on `EmailBatch` (unique constraint). Duplicate requests return the existing batch.
- **Email level**: `idempotencyKey` on `ScheduledEmail` = `{batchKey}:{index}`.
- **Job level**: BullMQ job ID = `email-{emailId}`. Duplicate job adds are rejected by BullMQ.

## SMTP Ambiguity Window

If the SMTP server accepts an email and the worker crashes before committing `SENT` status, the retry will attempt to send again. This is an inherent at-least-once delivery characteristic. The system mitigates this with:
- Atomic claiming (only one worker processes each email)
- Status checks before sending
- Provider message ID tracking

**Exactly-once email delivery is not guaranteed.** This is documented rather than falsely claimed.

## Redis Persistence

Docker Compose configures Redis with `appendonly yes` and `appendfsync everysec`. This means:
- Jobs survive Redis restarts (AOF replay)
- At most 1 second of jobs may be lost on a hard crash
- If Redis data is completely lost, the reconciliation process re-enqueues all PENDING/QUEUED emails from PostgreSQL on next startup

## Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests cover:
- Rate limit reservations (quota, interval, independent senders, deduplication)
- Email sender (SMTP success, transient/permanent failures)
- Scheduler (job creation, batch scheduling, reconciliation, duplicate handling)
- Slack notifier (encryption, deduplication, failure handling)
- API middleware (auth, error handling, request validation)
- Elasticsearch (indexing, status updates)

Tests use mocks and do not require running infrastructure. Integration tests with live PostgreSQL/Redis/Elasticsearch are separate.

## Known Trade-offs

1. **At-least-once delivery**: See SMTP ambiguity section above.
2. **Elasticsearch eventual consistency**: Index updates are best-effort. Use `npm run es:reconcile` to rebuild from Postgres.
3. **Single-node Elasticsearch**: The Docker Compose setup is not production HA.
4. **Session in PostgreSQL**: Adds DB load but survives API restarts. Consider Redis sessions for higher throughput.
5. **Rate limit reservation expiry**: Lua script sets TTLs on counter keys. If Redis data is lost, rate limits reset (more sends allowed, not fewer).
6. **Bull Board access**: Protected by session auth but does not currently scope visibility by tenant — all authenticated users see all queues. For multi-tenant isolation, implement role-based access.

## Feature Checklist

| Feature | Status |
|---------|--------|
| TypeScript Express API | ✅ |
| PostgreSQL + Prisma ORM | ✅ |
| BullMQ delayed jobs (no cron) | ✅ |
| Separate API + Worker processes | ✅ |
| Ethereal SMTP via Nodemailer | ✅ (requires credentials) |
| Per-sender hourly quota (Redis Lua) | ✅ |
| Per-sender minimum interval | ✅ |
| Quota rescheduling (not dropping) | ✅ |
| Google OAuth login | ✅ (requires credentials) |
| PostgreSQL session store | ✅ |
| Slack OAuth + notifications | ✅ (requires credentials) |
| Slack token encryption (AES-256-GCM) | ✅ |
| Elasticsearch indexing + search | ✅ |
| Bull Board dashboard (protected) | ✅ |
| Zod validation | ✅ |
| Pino structured logging | ✅ |
| Graceful shutdown | ✅ |
| Startup reconciliation | ✅ |
| Idempotent batch creation | ✅ |
| Atomic email claiming | ✅ |
| Docker Compose (PG, Redis, ES) | ✅ |
| Automated tests (34 passing) | ✅ |
| Health check endpoint | ✅ |
| Helmet + CORS + secure cookies | ✅ |
