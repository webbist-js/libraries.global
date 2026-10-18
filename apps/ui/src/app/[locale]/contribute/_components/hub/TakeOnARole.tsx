import {
  ArrowRight,
  BookOpen,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import { cn } from "@/lib/styles"

type RoleCard = {
  id: "claim" | "editor" | "moderator"
  title: string
  copy: string
  cta: string
  href: string
  icon: LucideIcon
  tint: string
}

const CARDS: RoleCard[] = [
  {
    id: "claim",
    title: "Claim your library",
    copy: "Work or volunteer at a library? Verify it, then look after its record and connect its events.",
    cta: "Find your library",
    href: "/contribute/index?intent=claim",
    icon: Landmark,
    tint: "bg-[#e5f2eb] text-[#256346]",
  },
  {
    id: "editor",
    title: "Become an editor",
    copy: "Publish approved Knowledge or Journal changes in the languages you choose.",
    cta: "Apply to be an editor",
    href: "/contribute/knowledge/apply",
    icon: BookOpen,
    tint: "bg-[#eeebfb] text-[#5143a2]",
  },
  {
    id: "moderator",
    title: "Help moderate",
    copy: "Review other people’s changes in a queue and language you choose, always with a reason.",
    cta: "Apply to moderate",
    href: "/contribute/knowledge/apply?role=moderator",
    icon: ShieldCheck,
    tint: "bg-[#f8eed8] text-[#805817]",
  },
]

export type RoleOpportunities = {
  readonly signedIn: boolean
  readonly hasClaim: boolean
  readonly isEditor: boolean
  readonly isModerator: boolean
}

/** Only show roles the viewer doesn't hold; keep sign-in return targets. */
export function TakeOnARole({
  signedIn,
  hasClaim,
  isEditor,
  isModerator,
}: RoleOpportunities) {
  const held: Record<RoleCard["id"], boolean> = {
    claim: hasClaim,
    editor: isEditor,
    moderator: isModerator,
  }
  const cards = CARDS.filter((card) => !held[card.id])
  if (cards.length === 0) return null
  const single = cards.length === 1

  return (
    <section
      aria-labelledby="take-on-a-role"
      className={cn(
        "grid gap-5 border-t border-(--t-border-line) bg-[#f7f6f2] p-6 sm:p-8",
        single && "lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"
      )}
    >
      <div
        className={
          single ? undefined : "flex flex-wrap items-baseline gap-x-6 gap-y-2"
        }
      >
        <h2
          id="take-on-a-role"
          className="m-0 font-serif text-[26px] leading-tight font-medium text-(--t-ink-base)"
        >
          Take on a role
        </h2>
        <p
          className={cn(
            "mb-0 text-sm leading-relaxed text-(--t-ink-dim)",
            single ? "mt-2 max-w-[48ch]" : "mt-0 max-w-[74ch]"
          )}
        >
          Accepted work and library verification open up more ways to help.
          Roles are never bought or earned with points.
        </p>
      </div>
      <ul
        className={cn(
          "m-0 grid min-w-0 list-none gap-3 p-0",
          cards.length === 2 && "md:grid-cols-2",
          cards.length === 3 && "md:grid-cols-3"
        )}
      >
        {cards.map(({ id, icon: Icon, tint, title, copy, cta, href }) => (
          <li key={id} className="flex min-w-0">
            <GlobalLink
              href={
                signedIn
                  ? href
                  : "/auth/signin?callbackUrl=" + encodeURIComponent(href)
              }
              className={cn(
                "group flex w-full min-w-0 flex-col items-start gap-3 rounded-[20px] border border-(--t-border-line) bg-white p-5 no-underline transition-colors hover:border-[#b9b4f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)",
                single && "sm:flex-row sm:items-center sm:gap-4"
              )}
            >
              <span
                className={
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-full " +
                  tint
                }
              >
                <Icon size={20} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 font-serif text-[22px] leading-tight font-medium text-(--t-ink-base)">
                  {title}
                </h3>
                <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {copy}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-semibold text-(--t-accent-primary) group-hover:underline",
                  single
                    ? "min-h-11 shrink-0 rounded-full border border-[#d9d3f1] px-4 py-2 sm:max-w-[180px]"
                    : "mt-auto pt-1"
                )}
              >
                {signedIn
                  ? cta
                  : "Sign in to " + cta.charAt(0).toLowerCase() + cta.slice(1)}
                <ArrowRight size={16} className="shrink-0" aria-hidden />
              </span>
            </GlobalLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
