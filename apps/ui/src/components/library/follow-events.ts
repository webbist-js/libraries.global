/**
 * Fired on window when the reader follows or unfollows a library, so other
 * parts of the page (the sidebar's follower count) can update at once.
 */
export const LIBRARY_FOLLOW_EVENT = "library:follow"

export type LibraryFollowDetail = {
  libraryDocumentId: string
  following: boolean
}

export function announceFollow(detail: LibraryFollowDetail) {
  window.dispatchEvent(
    new CustomEvent<LibraryFollowDetail>(LIBRARY_FOLLOW_EVENT, { detail })
  )
}
