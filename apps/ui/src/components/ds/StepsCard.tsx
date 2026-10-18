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
      className="rounded-3xl bg-(--t-ink-base) p-6 text-white"
    >
      <h2 className="m-0 font-serif text-[26px] leading-tight font-medium text-white">
        {title}
      </h2>
      <ol className="mt-4 mb-0 grid list-none gap-4 p-0 text-[15px] leading-[1.6]">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-(--t-accent-primary) text-sm font-bold text-white"
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
        <div className="mt-4 text-[15px] font-bold text-white [&_a]:underline [&_a]:underline-offset-4">
          {footer}
        </div>
      )}
    </section>
  )
}
