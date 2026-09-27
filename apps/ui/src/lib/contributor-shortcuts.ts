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
  /** Opens outside the site (the Strapi admin), in a new tab. */
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

const JOURNAL_ADMIN_PATH =
  "/admin/content-manager/collection-types/api::blog-article.blog-article"

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
      href: `/contribute/edit/${encodeURIComponent(lib.slug)}`,
      icon: "mdi:pencil-outline",
    }))

  if (named.length === 0) {
    items.push({
      label: "Edit your library",
      href: "/contribute/edit",
      icon: "mdi:pencil-outline",
    })
  } else if (named.length > MAX_NAMED_LIBRARIES) {
    items.push({
      label: "Edit another library",
      href: "/contribute/edit",
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
    href: "/contribute/add",
    icon: "mdi:map-marker-plus-outline",
  })

  return {
    key: "libraries",
    title: claimedLibraries.length > 1 ? "Your libraries" : "Your library",
    items,
  }
}

function knowledgeGroup(cmsUrl: string | null): ContributorShortcutGroup {
  const items: ContributorShortcut[] = [
    {
      label: "Write a Knowledge article",
      href: "/contribute/knowledge/new",
      icon: "mdi:file-document-plus-outline",
    },
    {
      label: "Edit Knowledge articles",
      href: "/knowledge",
      icon: "mdi:file-document-edit-outline",
    },
  ]

  // Journal authoring lives in the Strapi admin (spec D-C3).
  if (cmsUrl) {
    items.push(
      {
        label: "Write a Journal article",
        href: `${cmsUrl}${JOURNAL_ADMIN_PATH}/create`,
        icon: "mdi:newspaper-plus",
        external: true,
      },
      {
        label: "Edit Journal articles",
        href: `${cmsUrl}${JOURNAL_ADMIN_PATH}`,
        icon: "mdi:newspaper-variant-outline",
        external: true,
      }
    )
  }

  return { key: "knowledge", title: "Knowledge & Journal", items }
}

export function buildContributorShortcuts({
  capabilities,
  claimedLibraries,
  cmsUrl,
}: {
  capabilities: readonly string[]
  claimedLibraries: readonly ShortcutLibrary[]
  /** Public Strapi origin; without it the Journal links are left out. */
  cmsUrl?: string | null
}): ContributorShortcutGroup[] {
  const groups: ContributorShortcutGroup[] = []
  // Library editors: anyone holding a claim (spec D-C2).
  if (capabilities.includes("submit.libraryEdit"))
    groups.push(libraryGroup(capabilities, claimedLibraries))
  // Doc editors: wiki_editor and editorial_board curate Knowledge and the Journal.
  if (capabilities.includes("docs.directEdit"))
    groups.push(knowledgeGroup(cmsUrl?.replace(/\/+$/, "") || null))

  return groups
}
