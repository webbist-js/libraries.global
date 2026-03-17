import type React from "react"

import { formatHref, isAppLink, Link } from "@/lib/navigation"

interface GlobalLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> {
  readonly href?: string | null
  readonly fallbackAs?: "div" | "span"
}

export function GlobalLink({
  href,
  className,
  children,
  target,
  rel,
  fallbackAs = "span",
  ...props
}: GlobalLinkProps) {
  const formattedHref = formatHref(href)

  if (!formattedHref || formattedHref === "#") {
    const FallbackTag = fallbackAs

    return <FallbackTag className={className}>{children}</FallbackTag>
  }

  if (isAppLink(formattedHref)) {
    return (
      <Link href={formattedHref} className={className} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={formattedHref}
      className={className}
      target={target ?? "_blank"}
      rel={rel ?? "noopener noreferrer"}
      {...props}
    >
      {children}
    </a>
  )
}

GlobalLink.displayName = "GlobalLink"

export default GlobalLink
