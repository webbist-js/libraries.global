import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

type RoleCard = {
  id: "claim" | "editor" | "moderator"
  title: string
  copy: string
  cta: string
  href: string
  icon: string
  bg: string
  fg: string
}

const CARDS: RoleCard[] = [
  {
    id: "claim",
    title: "Claim your library",
    copy: "Work or volunteer at a library? Verify it, then look after its record and connect its events.",
    cta: "Find your library",
    href: "/contribute/index?intent=claim",
    icon: "mdi:bank-outline",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
  },
  {
    id: "editor",
    title: "Become an editor",
    copy: "Publish your Knowledge or Journal changes straight away, in the languages you choose.",
    cta: "Apply to be an editor",
    href: "/contribute/knowledge/apply",
    icon: "mdi:book-open-page-variant-outline",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
  },
  {
    id: "moderator",
    title: "Help moderate",
    copy: "Review other people’s changes in a queue and language you choose, always with a reason.",
    cta: "Apply to moderate",
    href: "/contribute/knowledge/apply?role=moderator",
    icon: "mdi:shield-check-outline",
    bg: "var(--tint-national-bg)",
    fg: "var(--tint-national-fg)",
  },
]

/**
 * "Take on a role": up to three ways to do more, each hidden once the
 * viewer has it. Signed-out viewers go through sign-in first. Roles come
 * from accepted work and verification only, never points or a plan.
 */
export function TakeOnARole({
  signedIn,
  hasClaim,
  isEditor,
  isModerator,
}: {
  readonly signedIn: boolean
  readonly hasClaim: boolean
  readonly isEditor: boolean
  readonly isModerator: boolean
}) {
  const held: Record<RoleCard["id"], boolean> = {
    claim: hasClaim,
    editor: isEditor,
    moderator: isModerator,
  }
  const cards = CARDS.filter((c) => !held[c.id])
  if (cards.length === 0) return null

  return (
    <section
      aria-labelledby="take-on-a-role"
      className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8"
    >
      <h2
        id="take-on-a-role"
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(26px,3vw,32px)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        Take on a role
      </h2>
      <p
        className="mt-2 mb-6 max-w-[62ch] text-[16px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Roles go to people whose work has been accepted, or who work at a
        library. They’re never bought or earned with points.
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {cards.map((card) => {
          const href = signedIn
            ? card.href
            : `/auth/signin?callbackUrl=${encodeURIComponent(card.href)}`

          return (
            <li key={card.id} className="flex">
              <GlobalLink
                href={href}
                className="group flex w-full flex-col gap-3 rounded-[20px] p-6 no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.line}`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full"
                  style={{ background: card.bg, color: card.fg }}
                >
                  <Icon icon={card.icon} width={20} height={20} />
                </span>
                <span
                  className="text-[20px]"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {card.title}
                </span>
                <span
                  className="flex-1 text-[15px] leading-[1.55]"
                  style={{ color: T.ink.dim }}
                >
                  {card.copy}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 text-[15px] font-semibold group-hover:underline"
                  style={{ color: T.accent.primary }}
                >
                  {signedIn
                    ? card.cta
                    : `Sign in to ${card.cta.charAt(0).toLowerCase()}${card.cta.slice(1)}`}
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={17} />
                </span>
              </GlobalLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
