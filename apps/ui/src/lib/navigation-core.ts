import { createNavigation } from "next-intl/navigation"

import { routing } from "./routing"

export { routing } from "./routing"
export const {
  Link: NavigationLink,
  redirect: _redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing)
