import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { logger } from '../lib/logger';

const INDEX_NAME = 'emails';

let _client: Client | null = null;

export function esClient(): Client {
  if (!_client) {
    _client = new Client({ node: config().ELASTICSEARCH_URL });
  }
  return _client;
}

export async function ensureIndex(): Promise<void> {
  const client = esClient();
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await client.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            emailId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            batchId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      },
    });
    logger.info('Created Elasticsearch index: emails');
  }
}

export interface EmailDocument {
  emailId: string;
  userId: string;
  senderId: string;
  batchId: string;
  senderEmail: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt?: string;
  createdAt: string;
}

export async function indexEmail(doc: EmailDocument): Promise<void> {
  try {
    await esClient().index({
      index: INDEX_NAME,
      id: doc.emailId,
      document: doc,
    });
  } catch (err) {
    logger.error({ err, emailId: doc.emailId }, 'Failed to index email in Elasticsearch');
  }
}

export async function updateEmailStatus(
  emailId: string,
  status: string,
  sentAt?: string
): Promise<void> {
  try {
    const body: Record<string, any> = { status };
    if (sentAt) body.sentAt = sentAt;
    await esClient().update({
      index: INDEX_NAME,
      id: emailId,
      doc: body,
    });
  } catch (err) {
    logger.error({ err, emailId }, 'Failed to update email status in Elasticsearch');
  }
}

export interface SearchParams {
  userId: string;
  recipient?: string;
  subject?: string;
  senderEmail?: string;
  senderId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export async function searchEmails(params: SearchParams) {
  const must: any[] = [{ term: { userId: params.userId } }];

  if (params.recipient) {
    must.push({ match: { recipient: params.recipient } });
  }
  if (params.subject) {
    must.push({ match: { subject: params.subject } });
  }
  if (params.senderEmail) {
    must.push({ term: { senderEmail: params.senderEmail } });
  }
  if (params.senderId) {
    must.push({ term: { senderId: params.senderId } });
  }
  if (params.status) {
    must.push({ term: { status: params.status } });
  }
  if (params.from || params.to) {
    const range: any = {};
    if (params.from) range.gte = params.from;
    if (params.to) range.lte = params.to;
    must.push({ range: { scheduledAt: range } });
  }

  const page = params.page ?? 1;
  const size = params.size ?? 20;

  const result = await esClient().search({
    index: INDEX_NAME,
    body: {
      query: { bool: { must } },
      sort: [{ scheduledAt: 'desc' }],
      from: (page - 1) * size,
      size,
    },
  });

  const hits = result.hits.hits.map((h: any) => ({ id: h._id, ...h._source }));
  const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value ?? 0;

  return { hits, total, page, size };
}
