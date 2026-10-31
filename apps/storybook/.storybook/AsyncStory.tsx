import { use, type ReactNode } from "react"

import { getFixtureLocale } from "./fixture-locale"

function AsyncStoryHost({ page }: { page: Promise<ReactNode> }) {
  return use(page)
}

const resetters = new Set<() => void>()

/** Start each story with fresh source output and server-reader promises. */
export function resetAsyncStories() {
  for (const reset of resetters) reset()
}

/**
 * Render the actual async server component in Storybook's browser renderer.
 * React.use needs a stable promise while a render suspends. Each host therefore
 * caches promises by its serializable props; Controls changes request fresh
 * source output. No production component or returned UI is substituted.
 */
export function asyncStory<Args, Output extends ReactNode>(
  component: (args: Args) => Promise<Output>
) {
  const pages = new Map<string, Promise<Output>>()
  resetters.add(() => pages.clear())

  return (args: Args) => {
    const key = `${getFixtureLocale()}:${JSON.stringify(args)}`
    let page = pages.get(key)
    if (!page) {
      page = component(args)
      pages.set(key, page)
    }

    return <AsyncStoryHost page={page} />
  }
}
