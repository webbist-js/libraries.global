"use client"

import { Bell, Check, Clock, Mail, TriangleAlert } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  utilityButtonClass,
  UtilityHeading,
  UtilityLink,
  UtilityPanel,
} from "@/components/utility/UtilityPage"
import { T } from "@/lib/design-tokens"

type EmailAction = { action: "confirm" | "unsubscribe"; purpose: string }
type State =
  | { kind: "loading" }
  | { kind: "ready" | "done"; action: EmailAction }
  | { kind: "invalid" }
  | { kind: "unavailable" }

function isEmailAction(value: unknown): value is EmailAction {
  if (!value || typeof value !== "object") return false
  const data = value as Record<string, unknown>

  return (
    (data.action === "confirm" || data.action === "unsubscribe") &&
    typeof data.purpose === "string" &&
    data.purpose.length > 0
  )
}

export function EmailPreferences({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: "loading" })
    if (!token) {
      setState({ kind: "invalid" })

      return () => controller.abort()
    }
    fetch(`/api/email/preferences?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json()
        if (controller.signal.aborted) return
        setState(
          response.ok && isEmailAction(data)
            ? { kind: "ready", action: data }
            : { kind: response.status === 400 ? "invalid" : "unavailable" }
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "unavailable" })
      })

    return () => controller.abort()
  }, [token, attempt])

  async function submit() {
    if (state.kind !== "ready" || busy) return
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/email/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (response.status === 400) {
        setState({ kind: "invalid" })
      } else if (response.ok) {
        setState({ kind: "done", action: state.action })
      } else {
        setMessage(
          response.status === 429
            ? "Too many attempts. Wait a minute, then try again."
            : "We couldn’t save this change. Please try again."
        )
      }
    } catch {
      setMessage("We couldn’t save this change. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === "loading")
    return (
      <UtilityHeading
        title="Opening your"
        italic="email preferences"
        description={
          <p role="status">
            Checking your link. This won’t change your subscription.
          </p>
        }
        icon={<Mail size={28} />}
      />
    )

  if (state.kind === "invalid" || state.kind === "unavailable")
    return (
      <EmailLinkProblem
        kind={state.kind}
        retry={() => setAttempt((value) => value + 1)}
      />
    )

  return (
    <EmailActionContent
      action={state.action}
      done={state.kind === "done"}
      busy={busy}
      message={message}
      submit={submit}
    />
  )
}

function EmailLinkProblem({
  kind,
  retry,
}: {
  kind: "invalid" | "unavailable"
  retry: () => void
}) {
  const tUi = useUiTranslations("ui")

  return (
    <>
      <UtilityHeading
        title={kind === "invalid" ? "This link is" : "We couldn’t open your"}
        italic={kind === "invalid" ? "unavailable" : "email preferences"}
        icon={
          kind === "invalid" ? <Clock size={28} /> : <TriangleAlert size={28} />
        }
        tone="warn"
        description={
          kind === "invalid"
            ? "It may have expired or been replaced by a newer link. Open the most recent email and try its link."
            : "Email preferences are temporarily unavailable. Please give it a moment and try again."
        }
      />
      <div className="flex flex-wrap gap-3">
        {kind === "unavailable" && (
          <Button className={utilityButtonClass} onClick={retry}>
            {tUi("try_again")}{" "}
          </Button>
        )}
        <Button variant="outline" asChild className={utilityButtonClass}>
          <UtilityLink href="/profile/settings#notifications">
            Notification settings
          </UtilityLink>
        </Button>
        <Button variant="ghost" asChild className={utilityButtonClass}>
          <UtilityLink href="mailto:info@libraries.global">
            Email us
          </UtilityLink>
        </Button>
      </div>
      {kind === "invalid" && (
        <p
          className="mt-6 text-sm leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          For a new newsletter confirmation,{" "}
          <UtilityLink
            href="/journal#journal-dispatch"
            className="underline underline-offset-4"
          >
            subscribe again from the Journal
          </UtilityLink>
          . Your subscription is only activated after you confirm it.
        </p>
      )}
    </>
  )
}

function EmailActionContent({
  action,
  done,
  busy,
  message,
  submit,
}: {
  action: EmailAction
  done: boolean
  busy: boolean
  message: string
  submit: () => Promise<void>
}) {
  const confirming = action.action === "confirm"

  const copy = emailActionCopy(confirming, done, action.purpose)

  return (
    <>
      <UtilityHeading
        title={copy.title}
        italic={copy.italic}
        icon={done ? <Check size={28} /> : <copy.Icon size={28} />}
        tone={done ? copy.doneTone : "info"}
        description={
          <p role={done ? "status" : undefined}>{copy.description}</p>
        }
      />
      {!done && (
        <UtilityPanel>
          <p className="font-semibold">
            {confirming ? "The monthly newsletter" : action.purpose}
          </p>
          <p className="mt-1 text-sm" style={{ color: T.ink.dim }}>
            {confirming
              ? "News and reading from the Journal. No account needed."
              : "Unsubscribe from this email category."}
          </p>
        </UtilityPanel>
      )}
      {done && confirming && (
        <div
          className="my-6 rounded-[20px] p-6"
          style={{ background: T.accent.chip }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: T.accent.primary }}
          >
            While you wait for the next issue
          </p>
          <h2 className="mt-2 text-2xl" style={{ fontFamily: T.font.serif }}>
            Stories from the world’s libraries
          </h2>
          <UtilityLink
            href="/journal"
            className="mt-3 inline-block font-semibold underline underline-offset-4"
            style={{ color: T.accent.primary }}
          >
            Explore the Journal →
          </UtilityLink>
        </div>
      )}
      <EmailActionButtons
        confirming={confirming}
        done={done}
        busy={busy}
        submit={submit}
      />
      <p
        role="status"
        className="mt-3 text-sm"
        style={{ color: T.accent.danger }}
      >
        {message}
      </p>
      {!confirming && (
        <p
          className="mt-5 text-sm leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          Essential account and service emails, such as password resets and
          claim decisions, still reach you.
        </p>
      )}
    </>
  )
}

function emailActionCopy(confirming: boolean, done: boolean, purpose: string) {
  return confirming
    ? {
        title: done ? "You’re" : "Confirm your",
        italic: done ? "subscribed" : "subscription",
        Icon: Mail,
        doneTone: "ok" as const,
        description: done
          ? "Thanks for confirming. You’ll receive Libraries Global news and Journal articles, at most monthly. You can unsubscribe from any issue."
          : "Receive Libraries Global news and Journal articles, at most monthly. Confirm below to join the list.",
      }
    : {
        title: done ? "You’re" : "Choose what",
        italic: done ? "unsubscribed" : "we send",
        Icon: Bell,
        doneTone: "neutral" as const,
        description: done
          ? `You won’t receive ${purpose} emails any more. Your other email settings and in-app notifications are unchanged.`
          : `This link lets you stop receiving ${purpose} emails. Your other email settings and in-app notifications will stay the same.`,
      }
}

function EmailActionButtons({
  confirming,
  done,
  busy,
  submit,
}: {
  confirming: boolean
  done: boolean
  busy: boolean
  submit: () => Promise<void>
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!done && (
        <Button
          className={utilityButtonClass}
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy
            ? tUi("saving")
            : confirming
              ? "Confirm subscription"
              : "Unsubscribe"}
        </Button>
      )}
      <Button asChild variant="outline" className={utilityButtonClass}>
        <UtilityLink href={done ? "/libraries" : "/"}>
          {done
            ? tUi("find_libraries")
            : confirming
              ? "Not you? Leave this unchanged"
              : "Keep my preference"}
        </UtilityLink>
      </Button>
      {done && !confirming && (
        <Button asChild variant="ghost" className={utilityButtonClass}>
          <UtilityLink href="/profile/settings#notifications">
            Manage notification settings
          </UtilityLink>
        </Button>
      )}
    </div>
  )
}
