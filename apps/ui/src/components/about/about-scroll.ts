const LAST_ABOUT_CHAPTER = 6

/** Measured document-scroll positions at which each chapter reaches its pose.
 * Uneven section heights still give each pair of chapters one transition. */
export function computeChapterProgress(
  scrollY: number,
  centres: readonly number[]
): number {
  if (centres.length < 2 || scrollY <= centres[0]!) return 0

  const last = centres.length - 1
  if (scrollY >= centres[last]!) return last

  for (let chapter = 0; chapter < last; chapter++) {
    const start = centres[chapter]!
    const end = centres[chapter + 1]!
    if (scrollY > end) continue

    const span = end - start

    return span > 0 ? chapter + (scrollY - start) / span : chapter + 1
  }

  return last
}

/** The nearest chapter owns the controls and scene caption. */
export function activeAboutChapter(progress: number): number {
  return Math.max(0, Math.min(LAST_ABOUT_CHAPTER, Math.round(progress)))
}

/** Display chapter indices as the page's 01–07 folio numbers. */
export function formatAboutChapter(chapter: number): string {
  return String(activeAboutChapter(chapter) + 1).padStart(2, "0")
}
