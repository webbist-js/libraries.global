import {
  ArrowRight,
  BookOpen,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

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
  const tStatic = useTranslations("staticUi")
  const CARDS: RoleCard[] = [
    {
      id: "claim",
      title: tStatic("contributeRoute.claim_your_library"),
      copy: tStatic(
        "contributeModule.work_or_volunteer_at_a_library_verify_it_then_look_after_its_record_and_connect_its_events"
      ),
      cta: tStatic("contributeModule.find_your_library"),
      href: "/contribute/claim",
      icon: Landmark,
      tint: "bg-(--t-palette-mint-bg) text-(--t-palette-mint-fg)",
    },
    {
      id: "editor",
      title: tStatic("contributeRoute.become_an_editor"),
      copy: tStatic(
        "contributeModule.publish_approved_knowledge_or_journal_changes_in_the_languages_you_choose"
      ),
      cta: tStatic("contributeModule.apply_to_be_an_editor"),
      href: "/contribute/knowledge/apply",
      icon: BookOpen,
      tint: "bg-(--t-palette-violet-bg) text-(--t-palette-violet-fg)",
    },
    {
      id: "moderator",
      title: tStatic("contributeRoute.help_moderate"),
      copy: tStatic(
        "contributeModule.review_other_people_s_changes_in_a_queue_and_language_you_choose_always_with_a_reason"
      ),
      cta: tStatic("contributeModule.apply_to_moderate"),
      href: "/contribute/knowledge/apply?role=moderator",
      icon: ShieldCheck,
      tint: "bg-(--t-palette-amber-bg) text-(--t-palette-amber-fg)",
    },
  ]

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
        "grid gap-5 border-t border-(--t-border-line) bg-(--t-bg-surface) p-6 sm:p-8",
        single && "lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"
      )}
    >
      <div
        className={
          single ? undefined : "flex flex-wrap items-baseline gap-x-6 gap-y-2"
        }
      >
        <h2 id="take-on-a-role" className="type-h2 m-0 text-(--t-ink-base)">
          {tStatic("contributeRoute.take_on_a_role")}
        </h2>
        <p
          className={cn(
            "mb-0 text-sm leading-relaxed text-(--t-ink-dim)",
            single ? "mt-2 max-w-[48ch]" : "mt-0 max-w-[74ch]"
          )}
        >
          {tStatic(
            "contributeRoute.accepted_work_and_library_verification_open_up_more_ways_to_help_roles_are_never_bought_or_earned_wi"
          )}
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
                "group flex w-full min-w-0 flex-col items-start gap-3 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 no-underline transition-colors hover:border-[#b9b4f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)",
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
                <h3 className="type-h3 m-0 text-(--t-ink-base)">{title}</h3>
                <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {copy}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-semibold text-(--t-accent-primary) group-hover:underline",
                  single
                    ? "min-h-11 shrink-0 rounded-full border border-(--t-edge-info) px-4 py-2 sm:max-w-[180px]"
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
