import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const STEPS = [
  {
    n: "1",
    title: "Suggest",
    desc: "Add or edit details, attach a source or a licensed photo.",
  },
  {
    n: "2",
    title: "Review",
    desc: "Trusted contributors check it against sources. You'll see its status.",
  },
  {
    n: "3",
    title: "Publish",
    desc: "Accepted changes go live with attribution and full revision history.",
  },
] as const

export function ContributeBand() {
  return (
    <section
      id="contribute"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-[clamp(28px,4vw,56px)] rounded-[32px] p-[clamp(28px,5vw,64px)] text-white"
        style={{ background: "#17162B" }}
      >
        <div>
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(34px,4.2vw,54px)",
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
            }}
          >
            The index is only as good as the people who care for it.
          </h2>
          <p
            className="mt-4 max-w-[480px] text-[18px] leading-[1.6]"
            style={{ color: "#D6D4E4" }}
          >
            Librarians, researchers and regular visitors all help keep records
            accurate. You don&rsquo;t need an account to suggest a correction.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <GlobalLink
              href="/contribute"
              className="rounded-full px-5 py-3.5 font-semibold no-underline transition-colors hover:bg-(--t-accent-chip)"
              style={{ background: "#fff", color: "#17162B" }}
            >
              Add a missing library
            </GlobalLink>
            <GlobalLink
              href="/contribute"
              className="rounded-full border px-5 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
              style={{ borderColor: "#6E6B8C" }}
            >
              Suggest a correction
            </GlobalLink>
          </div>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex gap-4 rounded-[18px] p-5"
              style={{ background: "#23213C" }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "30px",
                  lineHeight: 1,
                  color: "#B9B4F5",
                }}
              >
                {step.n}
              </span>
              <span>
                <strong className="block text-[18px]">{step.title}</strong>
                <span
                  className="text-[16px] leading-[1.5]"
                  style={{ color: "#D6D4E4" }}
                >
                  {step.desc}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

ContributeBand.displayName = "ContributeBand"

export default ContributeBand
