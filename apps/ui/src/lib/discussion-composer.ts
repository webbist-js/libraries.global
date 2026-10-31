export const DISCUSSION_COMPOSE_EVENT = "discussion:compose"

/** The workspace sidebar opens the directory's existing composer in place. */
export function openDiscussionComposer() {
  window.dispatchEvent(new Event(DISCUSSION_COMPOSE_EVENT))
}
