import { Check, Clock3, RotateCcw, Send, ShieldCheck, X } from "lucide-react"

const OUTCOMES = [
  {
    label: "Accepted",
    icon: Check,
    tint: "bg-(--t-palette-mint-bg) text-(--t-palette-mint-fg)",
    copy: "Published with your name in the record’s history.",
  },
  {
    label: "Needs changes",
    icon: RotateCcw,
    tint: "bg-(--t-palette-amber-bg) text-(--t-palette-amber-fg)",
    copy: "A question or a better source is needed. Your work is saved, ready to revise.",
  },
  {
    label: "Not accepted",
    icon: X,
    tint: "bg-(--t-palette-coral-bg) text-(--t-palette-coral-fg)",
    copy: "You’ll get a reason, such as a duplicate or a claim that can’t be verified.",
  },
] as const

/** Review has two steps, followed by one of three possible outcomes. */
export function HowReviewWorks() {
  return (
    <section
      aria-labelledby="how-review-works"
      className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-palette-violet-bg) text-(--t-accent-primary)">
            <ShieldCheck size={20} aria-hidden />
          </span>
          <h2 id="how-review-works" className="type-h2 m-0 text-(--t-ink-base)">
            How review works
          </h2>
        </div>
        <p className="m-0 max-w-[52ch] text-base leading-relaxed text-(--t-ink-dim)">
          Every change is checked before it’s published. Accepted work is
          credited to you and kept in the record’s history.
        </p>
        <ol className="mt-6 mb-0 grid list-none gap-5 p-0">
          <li className="relative flex gap-3 before:absolute before:top-10 before:bottom-[-16px] before:left-[19px] before:border-l before:border-(--t-border-line)">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-bg-muted) text-(--t-ink-dim)">
              <Send size={17} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="type-small-heading m-0 text-(--t-ink-base)">
                1. Send your change
              </h3>
              <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                Submitted with a source and saved while it waits for review.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-palette-blue-bg) text-(--t-palette-blue-fg)">
              <Clock3 size={18} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="type-small-heading m-0 text-(--t-ink-base)">
                2. A reviewer checks it
              </h3>
              <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                In review, a trusted contributor checks the change against your
                source.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-[20px] bg-(--t-bg-surface) p-5 sm:p-6">
        <h3 className="type-label m-0 text-(--t-ink-dim) uppercase">
          After review
        </h3>
        <ul className="mt-4 mb-0 grid list-none gap-4 p-0">
          {OUTCOMES.map(({ label, icon: Icon, tint, copy }) => (
            <li key={label} className="flex items-start gap-3">
              <span
                className={
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-full " +
                  tint
                }
              >
                <Icon size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="type-h4 m-0 text-(--t-ink-base)">{label}</h4>
                <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {copy}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
