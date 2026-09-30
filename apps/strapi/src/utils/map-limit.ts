/**
 * Maps `items` through `fn` with at most `limit` calls in flight, keeping
 * result order. The first rejection rejects the whole call and no further
 * items are started (in-flight ones finish on their own).
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length })
  const workers = Math.max(1, Math.min(Math.trunc(limit) || 1, items.length))
  let next = 0
  let failed = false

  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++
      try {
        results[i] = await fn(items[i], i)
      } catch (err) {
        failed = true
        throw err
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker))

  return results
}
