import { ArrowLeft, ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"

import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

export function BackLink({
  href,
  children,
  className,
  icon = "arrow",
}: {
  readonly href: string
  readonly children: ReactNode
  readonly className?: string
  readonly icon?: "arrow" | "chevron"
}) {
  const BackIcon = icon === "chevron" ? ChevronLeft : ArrowLeft

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-2 text-sm font-semibold text-(--t-accent-primary)",
        className
      )}
    >
      <BackIcon size={16} aria-hidden />
      {children}
    </Link>
  )
}
