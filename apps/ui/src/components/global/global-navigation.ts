/** Shared destinations for the site header and dashboard rail. */
export const GLOBAL_NAVIGATION = [
  { label: "atlas", href: "/map", icon: "atlas" },
  { label: "find_libraries", href: "/libraries", icon: "libraries" },
  { label: "library_networks", href: "/library-networks", icon: "networks" },
  { label: "community", href: "/community", icon: "community" },
  { label: "journal", href: "/journal", icon: "journal" },
  {
    label: "knowledge",
    href: "/knowledge",
    icon: "knowledge",
  },
  { label: "api", href: "/developers", icon: "api" },
] as const
