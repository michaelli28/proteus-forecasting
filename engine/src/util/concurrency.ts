/**
 * Run `worker` over every item with at most `limit` in flight.
 *
 * Results come back in INPUT order regardless of completion order. Anything that
 * has to re-associate results with their inputs afterwards eventually gets it
 * wrong, and in an ensemble that means a run's outcome attributed to the wrong
 * scenario — a silent, unfalsifiable corruption of the forecast.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      `concurrency limit must be a positive integer: ${limit}`,
    );
  }
  const semaphore = new Semaphore(limit);
  return Promise.all(
    items.map(async (item, index) => {
      const release = await semaphore.acquire();
      try {
        return await worker(item, index);
      } finally {
        release();
      }
    }),
  );
}

export class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.current < this.maxConcurrent) {
          this.current++;
          resolve(() => {
            this.current--;
            const next = this.queue.shift();
            if (next) next();
          });
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}
