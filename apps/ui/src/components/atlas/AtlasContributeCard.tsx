import { PromptDismissButton } from "@/components/ds/DismissiblePrompt"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { Icon } from "./atlas-ui"

const PRIMARY =
  "inline-flex h-9 items-center rounded-full bg-(--t-accent-primary) px-3.5 text-[14px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
const SECONDARY =
  "inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold no-underline hover:border-(--t-accent-primary)"

/**
 * The Atlas's invitation to contribute, under the search. Signed out it
 * asks for an account first; members go straight to the Index editor. Inside
 * a `DismissiblePrompt`, its close button hides it.
 */
export function AtlasContributeCard({
  signedIn,
}: {
  readonly signedIn: boolean
}) {
  return (
    <section
      aria-labelledby="atlas-contribute-title"
      className="relative flex flex-col gap-3 rounded-[18px] border px-4 py-3.5"
      style={{ background: T.bg.surface, borderColor: T.border.hi }}
    >
      <PromptDismissButton
        label="Hide this"
        className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-(--t-bg-muted)"
        style={{ color: T.ink.dim }}
      />
      <div className="flex items-start gap-3">
        <span className="mt-0.5" style={{ color: T.accent.primary }}>
          <Icon name="pin" size={20} />
        </span>
        <div className="text-[14px] leading-normal">
          <h2
            id="atlas-contribute-title"
            className="m-0 pr-7 text-[15px] font-bold"
          >
            See a gap on the map?
          </h2>
          <p className="m-0" style={{ color: T.ink.dim }}>
            Add a missing library or fix one that’s out of date. Accepted
            changes are credited to you, and regular contributors get Pro free.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-8">
        {signedIn ? (
          <>
            <GlobalLink href="/contribute/index/new" className={PRIMARY}>
              Add a library
            </GlobalLink>
            <GlobalLink
              href="/contribute/index"
              className={SECONDARY}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              Fix a record
            </GlobalLink>
          </>
        ) : (
          <GlobalLink href="/auth/register" className={PRIMARY}>
            Create a free account
          </GlobalLink>
        )}
      </div>
    </section>
  )
}
