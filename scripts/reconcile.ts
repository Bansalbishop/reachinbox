import '../src/config';
import { reconcilePendingEmails } from '../src/services/scheduler';

async function main() {
  const count = await reconcilePendingEmails();
  console.log(`Reconciled ${count} emails into queue.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
