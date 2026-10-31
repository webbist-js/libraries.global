/** Shared geometry keeps the loader's completed frame identical to the brand. */
export const LIBRARIES_GLOBAL_MARK = {
  back: "M76 164 340 32v72l-192 96v284l-72-36Z",
  middle: "m180 220 264-132v72l-192 96v284l-72-36Z",
  front: "m284 276 280-140v360L332 612l-48-24Z",
  window: "M356 312v216l136-68V244Z",
}

/** Supplied three-book mark; the owner supplies its colour and accessible name. */
export function LibrariesGlobalMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 640 640" fill="currentColor">
      <path d={LIBRARIES_GLOBAL_MARK.back} />
      <path d={LIBRARIES_GLOBAL_MARK.middle} />
      <path
        fillRule="evenodd"
        d={`${LIBRARIES_GLOBAL_MARK.front}${LIBRARIES_GLOBAL_MARK.window}`}
        clipRule="evenodd"
      />
    </svg>
  )
}
