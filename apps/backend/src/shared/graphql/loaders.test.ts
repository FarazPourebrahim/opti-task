import { describe, expect, it, vi } from 'vitest';
import DataLoader from 'dataloader';

/**
 * Proves the DataLoader contract the platform relies on: many `.load()` calls in
 * one tick collapse into a single batched call (N+1 → 1). The real loaders in
 * loaders.ts are exercised against the DB in schema.test.ts.
 */
describe('DataLoader batching', () => {
  it('collapses many loads in the same tick into one batch call', async () => {
    // Arrange
    const batchFn = vi.fn(async (ids: ReadonlyArray<string>) =>
      ids.map((id) => `value:${id}`),
    );
    const loader = new DataLoader(batchFn);

    // Act
    const results = await Promise.all([
      loader.load('a'),
      loader.load('b'),
      loader.load('c'),
    ]);

    // Assert
    expect(results).toEqual(['value:a', 'value:b', 'value:c']);
    expect(batchFn).toHaveBeenCalledTimes(1);
    expect(batchFn).toHaveBeenCalledWith(['a', 'b', 'c']);
  });
});
