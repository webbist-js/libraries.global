import { Box, Flex, LinkButton } from "@strapi/design-system"
import { Link } from "react-router-dom"

import { PEOPLE_PATH, PLUGIN_PATH } from "./peopleMeta"

/**
 * The plugin's two pages: the moderation queue and People. People only
 * shows for admins with "Manage contributor roles".
 */
export function PluginNav({
  current,
  canManageRoles,
}: {
  current: "queue" | "people"
  canManageRoles: boolean
}) {
  if (!canManageRoles) return null
  const links = [
    { id: "queue", label: "Moderation queue", to: PLUGIN_PATH },
    { id: "people", label: "People", to: PEOPLE_PATH },
  ] as const

  return (
    <Box paddingBottom={4}>
      <nav aria-label="Moderation sections">
        <Flex gap={2}>
          {links.map((l) => (
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
