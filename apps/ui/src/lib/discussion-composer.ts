export const DISCUSSION_COMPOSE_EVENT = "discussion:compose"

/** The workspace sidebar opens the directory's existing composer in place. */
export function openDiscussionComposer() {
  window.dispatchEvent(new Event(DISCUSSION_COMPOSE_EVENT))
}

export const ARTICLE_DISCUSSION_EVENT = "discussion:article-activate"

/** Let the attached discussion handle empty conversations, preserving anchor fallback. */
export function requestArticleDiscussion() {
  return (
    document
      .getElementById("article-discussion")
      ?.dispatchEvent(
        new Event(ARTICLE_DISCUSSION_EVENT, { cancelable: true })
      ) === false
  )
}
