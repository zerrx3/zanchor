/**
 * Runs `fn` over `items` with at most `limit` in flight at once. Plain
 * Promise.all across dozens of tickers risks hammering Yahoo Finance's rate
 * limits; this caps concurrency while still running everything in parallel
 * batches rather than strictly one-at-a-time.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex;
      nextIndex += 1;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
