/**
 * Classification CLI.
 *
 *   npm run classify            classify reviews that have no topics yet
 *   npm run classify -- --all   re-classify everything (after a lexicon change)
 */
import { classifyAndStore, reviewsForClassification } from '../db/topics';
import { isClassifiable } from './topics';

async function main() {
  const all = process.argv.includes('--all');
  const reviews = await reviewsForClassification(!all);

  if (reviews.length === 0) {
    console.log('Nothing to classify.');
    return;
  }

  const classifiable = reviews.filter(isClassifiable);
  const { tagsWritten } = await classifyAndStore(reviews);

  const skipped = reviews.length - classifiable.length;
  console.log(`Reviews considered ...... ${reviews.length}`);
  console.log(`Classifiable ............ ${classifiable.length}`);
  console.log(`Skipped (no text / non-English) ${skipped}`);
  console.log(`Topic tags written ...... ${tagsWritten}`);
}

main().catch((error) => {
  console.error('Classification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
