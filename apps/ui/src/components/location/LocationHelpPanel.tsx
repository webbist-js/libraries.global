import { Icon } from "@iconify/react"

import {
  hubHref,
  type WizardLibrary,
} from "@/components/contribute/wizard.logic"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

type HelpAction = {
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  href: string
}

/**
 * The three contribution routes a location page offers. On a region page,
 * pass the records with the gaps so the links open the hub on that library.
 */
export function locationHelpActions({
  hoursLibrary,
  photoLibrary,
}: {
  hoursLibrary?: WizardLibrary | null
  photoLibrary?: WizardLibrary | null
} = {}): HelpAction[] {
  return [
    {
      icon: "mdi:plus",
      tintBg: T.accent.chip,
      tintFg: T.accent.primary,
      title: "Add a missing library",
      description: "With a website or other source.",
      href: "/contribute/add",
    },
    {
      icon: "mdi:clock-outline",
      tintBg: "var(--tint-academic-bg)",
      tintFg: "var(--tint-academic-fg)",
      title: "Fix opening hours",
      description: hoursLibrary
        ? `Start with ${hoursLibrary.name}.`
        : "The detail that goes out of date fastest.",
      href: hubHref("correction", hoursLibrary ?? undefined, "Opening hours"),
    },
    {
      icon: "mdi:camera-outline",
      tintBg: "var(--tint-special-bg)",
      tintFg: "var(--tint-special-fg)",
      title: "Share a photo",
      description: photoLibrary
        ? `${photoLibrary.name} has none yet.`
        : "Your own, or openly licensed.",
      href: hubHref("photo", photoLibrary ?? undefined),
    },
  ]
}

/** "Help keep {place}'s index current": a nudge plus the contribution routes. */
export function LocationHelpPanel({
  name,
  body,
  actions = locationHelpActions(),
}: {
  readonly name: string
  readonly body: string
  readonly actions?: HelpAction[]
}) {
  return (
    <section
      aria-labelledby="help-title"
      className="grid gap-x-10 gap-y-7 rounded-3xl px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-center"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div>
        <h2
          id="help-title"
          className="m-0 text-[clamp(28px,3.4vw,40px)] leading-[1.1] tracking-[-0.01em] text-balance"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          Help keep {name}&rsquo;s index current
        </h2>
        <p
          className="mt-3 mb-0 max-w-[56ch] text-[15.5px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          {body}
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {actions.map((action) => (
          <li key={action.title}>
            <GlobalLink
              href={action.href}
              className="group flex items-center gap-3.5 rounded-2xl border px-4 py-3 transition-colors hover:border-(--t-accent-primary) hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.line, background: T.bg.deep }}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: action.tintBg, color: action.tintFg }}
              >
                <Icon height={17} icon={action.icon} width={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[14.5px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {action.title}
                </span>
                <span
                  className="block text-[13px] leading-[1.4]"
                  style={{ color: T.ink.dim }}
                >
                  {action.description}
                </span>
              </span>
              <Icon
                aria-hidden="true"
                className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                height={18}
                icon="mdi:chevron-right"
                style={{ color: T.accent.primary }}
                width={18}
              />
            </GlobalLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
