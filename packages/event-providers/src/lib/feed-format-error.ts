/**
 * The response arrived but isn't the format the provider expects.
 *
 * Lives in its own module, rather than in `../errors.ts` (its natural
 * home): `errors.ts` imports `FetchTimeoutError`/`ResponseTooLargeError`/
 * `UnsafeUrlError` from `./safe-fetch`, and `safe-fetch.ts`'s own
 * `parseJsonBody` needs to throw a `FeedFormatError` — importing it from
 * `../errors` there would close that loop. `errors.ts` re-exports this
 * class, so every existing `import { FeedFormatError } from "../errors"` in
 * the providers keeps working unchanged.
 */
export class FeedFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedFormatError"
  }
}
