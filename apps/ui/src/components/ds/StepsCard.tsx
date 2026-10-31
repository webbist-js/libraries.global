import type { ReactNode } from "react"

/** Numbered guidance shared by community sidebars. */
export function StepsCard({
  title,
  steps,
  footer,
}: {
  readonly title: string
  readonly steps: readonly { id: string; content: ReactNode }[]
  readonly footer?: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-3xl bg-(--t-bg-inverse) p-6 text-white"
    >
      <h2 className="type-panel-title m-0 text-white">{title}</h2>
      <ol className="mt-4 mb-0 grid list-none gap-4 p-0 text-base leading-[1.6]">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-(--t-action-primary) text-sm font-bold text-white"
            >
              {index + 1}
            </span>
            <span className="min-w-0 pt-0.5 text-(--t-ink-on-dark)">
              {step.content}
            </span>
          </li>
        ))}
      </ol>
      {footer && (
        <div className="mt-4 border-t border-white/20 pt-3 text-base font-semibold text-white [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline [&_a]:underline-offset-4">
          {footer}
        </div>
      )}
    </section>
  )
}
