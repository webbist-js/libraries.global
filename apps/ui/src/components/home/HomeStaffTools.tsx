"use client"

import GlobalLink from "@/components/global/GlobalLink"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import type { LinkCard } from "@/components/home/homepage.types"
import { useHydratedSession } from "@/lib/access-client"

/** Show what staff can do without sending visitors into gated workflows. */
export function HomeStaffTools({
  tools,
}: {
  readonly tools: readonly LinkCard[]
}) {
  const { data, isPending, error } = useHydratedSession()
  const signedIn = !!data?.user && !isPending && !error

  return (
    <ul className="home-link-rows home-staff-tools">
      {tools.map((tool) => (
        <li key={tool.title}>
          {signedIn ? (
            <GlobalLink href={tool.href} {...homepageLinkAttributes(tool.href)}>
              {tool.title}
              <span>{tool.text}</span>
            </GlobalLink>
          ) : (
            <div className="home-staff-tool-description">
              {tool.title}
              <span>{tool.text}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
