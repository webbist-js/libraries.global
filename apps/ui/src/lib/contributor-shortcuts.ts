/**
 * Role-specific contribution shortcuts for the header Contribute menu, the
 * mobile menu and the footer. Built from session capabilities, so what a
 * person sees matches what the servers will let them do. UI only: every
 * route behind these links re-checks access.
 */

export type ContributorShortcut = {
  label: string
  href: string
  /** Iconify name. */
  icon: string
  /** Opens outside the site, in a new tab. */
  external?: boolean
}

export type ContributorShortcutGroup = {
  key: "libraries" | "knowledge"
  title: string
  items: ContributorShortcut[]
}

export type ShortcutLibrary = {
  name: string | null
  slug: string | null
}

const MAX_NAMED_LIBRARIES = 3

function libraryGroup(
  capabilities: readonly string[],
  claimedLibraries: readonly ShortcutLibrary[]
): ContributorShortcutGroup {
  const named = claimedLibraries.flatMap((lib) =>
    lib.name && lib.slug ? [{ name: lib.name, slug: lib.slug }] : []
  )
  const items: ContributorShortcut[] = named
    .slice(0, MAX_NAMED_LIBRARIES)
    .map((lib) => ({
      label: `Edit ${lib.name}`,
      href: `/contribute/index/${encodeURIComponent(lib.slug)}`,
      icon: "mdi:pencil-outline",
    }))

  if (named.length === 0) {
    items.push({
      label: "Edit your library",
      href: "/contribute/index",
      icon: "mdi:pencil-outline",
    })
  } else if (named.length > MAX_NAMED_LIBRARIES) {
    items.push({
      label: "Edit another library",
      href: "/contribute/index",
      icon: "mdi:pencil-outline",
    })
  }

  if (capabilities.includes("events.feed")) {
    items.push({
      label: "Connect an event feed",
      href: "/contribute/events",
      icon: "mdi:calendar-sync-outline",
    })
  }
  items.push({
    label: "Add a library",
    href: "/contribute/index/new",
    icon: "mdi:map-marker-plus-outline",
  })

  return {
    key: "libraries",
    title: claimedLibraries.length > 1 ? "Your libraries" : "Your library",
    items,
  }
}

/** Knowledge editors curate the knowledge base; Journal editors the Journal. */
function knowledgeGroup(
  capabilities: readonly string[]
): ContributorShortcutGroup | null {
  const docs = capabilities.includes("docs.directEdit")
  const journal = capabilities.includes("journal.directEdit")
  if (!docs && !journal) return null

  const items: ContributorShortcut[] = []
  if (docs)
    items.push(
      {
        label: "Write a Knowledge article",
        href: "/contribute/knowledge/new?type=knowledge",
        icon: "mdi:file-document-plus-outline",
      },
      {
        label: "Edit Knowledge articles",
        href: "/contribute/knowledge",
        icon: "mdi:file-document-edit-outline",
      }
    )
  if (journal)
    items.push(
      {
        label: "Write a Journal article",
        href: "/contribute/knowledge/new?type=journal",
        icon: "mdi:newspaper-plus",
      },
      {
        label: "Edit Journal articles",
        href: "/contribute/knowledge?type=journal",
        icon: "mdi:newspaper-variant-outline",
      }
    )

  return {
    key: "knowledge",
    title:
      docs && journal ? "Knowledge & Journal" : docs ? "Knowledge" : "Journal",
    items,
  }
}

export function buildContributorShortcuts({
  capabilities,
  claimedLibraries,
}: {
  capabilities: readonly string[]
  claimedLibraries: readonly ShortcutLibrary[]
}): ContributorShortcutGroup[] {
  const groups: ContributorShortcutGroup[] = []
  // Library editors: anyone holding a claim (spec D-C2).
  if (capabilities.includes("submit.libraryEdit"))
    groups.push(libraryGroup(capabilities, claimedLibraries))
  const knowledge = knowledgeGroup(capabilities)
  if (knowledge) groups.push(knowledge)

  return groups
}
