import { config } from '../src/config';
import { ensureIndex } from '../src/services/search';
import { logger } from '../src/lib/logger';

async function main() {
  config(); // validate env
  await ensureIndex();
  logger.info('Elasticsearch index setup complete');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'ES setup failed');
  process.exit(1);
});
