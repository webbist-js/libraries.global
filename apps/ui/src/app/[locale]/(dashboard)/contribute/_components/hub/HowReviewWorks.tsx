import { Check, Clock3, RotateCcw, Send, ShieldCheck, X } from "lucide-react"
import { useTranslations } from "next-intl"

/** Review has two steps, followed by one of three possible outcomes. */
export function HowReviewWorks() {
  const tStatic = useTranslations("staticUi")
  const OUTCOMES = [
    {
      label: tStatic("contributeRoute.accepted"),
      icon: Check,
      tint: "bg-(--t-palette-mint-bg) text-(--t-palette-mint-fg)",
      copy: tStatic(
        "contributeModule.published_with_your_name_in_the_record_s_history"
      ),
    },
    {
      label: tStatic("contributeRoute.needs_changes"),
      icon: RotateCcw,
      tint: "bg-(--t-palette-amber-bg) text-(--t-palette-amber-fg)",
      copy: tStatic(
        "contributeModule.a_question_or_a_better_source_is_needed_your_work_is_saved_ready_to_revise"
      ),
    },
    {
      label: tStatic("contributeRoute.not_accepted"),
      icon: X,
      tint: "bg-(--t-palette-coral-bg) text-(--t-palette-coral-fg)",
      copy: tStatic(
        "contributeModule.you_ll_get_a_reason_such_as_a_duplicate_or_a_claim_that_can_t_be_verified"
      ),
    },
  ] as const

  const tExisting = useTranslations()

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
            {tExisting("homepageContribute.howReviewWorks")}
          </h2>
        </div>
        <p className="m-0 max-w-[52ch] text-base leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "contributeRoute.every_change_is_checked_before_it_s_published_accepted_work_is_credited_to_you_and_kept_in_the_recor"
          )}
        </p>
        <ol className="mt-6 mb-0 grid list-none gap-5 p-0">
          <li className="relative flex gap-3 before:absolute before:top-10 before:bottom-[-16px] before:left-[19px] before:border-l before:border-(--t-border-line)">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-bg-muted) text-(--t-ink-dim)">
              <Send size={17} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="type-small-heading m-0 text-(--t-ink-base)">
                {tStatic("contributeRoute.1_send_your_change")}
              </h3>
              <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {tStatic(
                  "contributeRoute.submitted_with_a_source_and_saved_while_it_waits_for_review"
                )}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-palette-blue-bg) text-(--t-palette-blue-fg)">
              <Clock3 size={18} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="type-small-heading m-0 text-(--t-ink-base)">
                {tStatic("contributeRoute.2_a_reviewer_checks_it")}
              </h3>
              <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {tStatic(
                  "contributeRoute.in_review_a_trusted_contributor_checks_the_change_against_your_source"
                )}
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-[20px] bg-(--t-bg-surface) p-5 sm:p-6">
        <h3 className="type-label m-0 text-(--t-ink-dim) uppercase">
          {tStatic("contributeRoute.after_review")}
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
