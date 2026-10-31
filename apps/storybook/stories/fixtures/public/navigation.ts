import type { NavLink } from "@/components/global/GlobalNavLinks"
import type { ContributeMenu } from "@/hooks/useContributeMenu"
import { buildContributeMenu } from "@/lib/contributor-shortcuts"

import { editorSession } from "./session"

export const navLinks: NavLink[] = [
  { label: "Atlas", href: "/map" },
  { label: "Find libraries", href: "/libraries" },
  { label: "Community", href: "/community" },
  { label: "Journal", href: "/journal" },
  { label: "Knowledge", href: "/knowledge" },
]
export const navigationMenu: ContributeMenu = {
  ...buildContributeMenu({
    status: "signedIn",
    capabilities: editorSession.user.capabilities,
    featuredDrive: {
      title: "Opening hours for every library",
      slug: "opening-hours-for-every-library",
      progress: { done: 28, total: 50, percent: 56, unit: "library" },
    },
    counts: { inReview: 2 },
  }),
  status: "signedIn",
  acceptedCount: 24,
  plan: "free",
  library: { options: [], selectedId: null, select: () => {} },
}
export const visitorMenu: ContributeMenu = {
  ...buildContributeMenu({ status: "signedOut" }),
  status: "signedOut",
  acceptedCount: null,
  plan: null,
  library: { options: [], selectedId: null, select: () => {} },
}
