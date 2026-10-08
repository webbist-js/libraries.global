import { Box, Flex, LinkButton } from "@strapi/design-system"
import { Link } from "react-router-dom"

import { PEOPLE_PATH, PLANS_PATH, TEAMS_PATH } from "./peopleMeta"

export type AccessSection = "people" | "teams" | "plans"

/**
 * The plugin's three pages. Each shows only to an admin whose role holds
 * that page's permission (`App` passes the allowed set).
 */
export function PluginNav({
  current,
  allowed = { people: true, teams: true, plans: true },
}: {
  current: AccessSection
  allowed?: Record<AccessSection, boolean>
}) {
  const links = [
    { id: "people", label: "People", to: PEOPLE_PATH },
    { id: "teams", label: "Teams", to: TEAMS_PATH },
    { id: "plans", label: "Plans", to: PLANS_PATH },
  ] as const
  const visible = links.filter((l) => allowed[l.id])
  if (visible.length < 2) return null

  return (
    <Box paddingBottom={4}>
      <nav aria-label="Access sections">
        <Flex gap={2}>
          {visible.map((l) => (
            <LinkButton
              key={l.id}
              tag={Link}
              to={l.to}
              variant={l.id === current ? "secondary" : "tertiary"}
              aria-current={l.id === current ? "page" : undefined}
            >
              {l.label}
            </LinkButton>
          ))}
        </Flex>
      </nav>
    </Box>
  )
}
