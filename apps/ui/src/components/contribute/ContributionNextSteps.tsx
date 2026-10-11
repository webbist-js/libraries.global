"use client"

import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

export function ContributionNextSteps({
  steps,
}: {
  readonly steps?: readonly string[]
}) {
  const { data: session } = authClient.useSession()
  const mounted = useMounted()
  const signedIn = mounted && Boolean(session?.user)
  const items = steps ?? [
    "The library is already selected.",
    "Add what you know, with a website or another source.",
    "{sign-in-add}",
    "A community editor reviews it before it’s published. You can follow its status on your profile.",
  ]

  const text = (step: string) => {
    if (step === "{sign-in}")
      return signedIn
        ? "You’re signed in. Review your answers and send them."
        : "Sign in to send. Accounts are free."
    if (step === "{sign-in-add}")
      return signedIn
        ? "You’re signed in, so you’ll go straight to the form."
        : "Sign in to submit. Accounts are free, and you can look at the form first."

    return step
  }

  return (
    <div>
      <h3 className="m-0 mb-3 text-[14px] font-bold">What happens next</h3>
      <ol className="m-0 list-none space-y-2.5 p-0">
        {items.map((step, index) => (
          <li
            key={step}
            className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2 text-[14px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            <span className="font-bold" style={{ color: T.ink.base }}>
              {index + 1}
            </span>
            <span>{text(step)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
