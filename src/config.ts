import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  SESSION_SECRET: z.string().min(16),
  SESSION_MAX_AGE_MS: z.coerce.number().default(86400000),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  FRONTEND_URL: z.string().url(),
  API_URL: z.string().url(),

  SMTP_HOST: z.string().default('smtp.ethereal.email'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),

  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default(''),
  SLACK_TOKEN_ENCRYPTION_KEY: z.string().min(64, 'Must be 32-byte hex (64 chars)'),

  WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
  DEFAULT_HOURLY_LIMIT: z.coerce.number().min(1).default(50),
  DEFAULT_MIN_INTERVAL_MS: z.coerce.number().min(0).default(5000),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`❌ Invalid environment variables:\n${formatted}`);
    process.exit(1);
  }
  return result.data;
}

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function config(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// For tests: allow overriding config
export function setConfig(c: Config) {
  _config = c;
}
