"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { type FormEvent, useId, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  LIST_LABELS,
  LIST_ORDER,
  type PublicSuggestion,
  type SuggestionList,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

export const SUGGEST_FORM_ID = "suggest-option"

const RETURN_TO = `/community/suggestions#${SUGGEST_FORM_ID}`

export const EMPTY_NAME = "Give the option a short name."
export const DUPLICATE_NAME =
  "That option already exists or has been suggested."
const FAILED = "Your suggestion didn’t post. Please try again."
const NETWORK = "Network error. Please try again."

/** Statuses whose message the server writes for the contributor. */
const SERVER_MESSAGES = new Set([400, 401, 409, 429])

type PostReply = {
  data?: PublicSuggestion
  error?: string | { message?: string }
}

const nameKey = (name: string) =>
  name.trim().replaceAll(/\s+/g, " ").toLowerCase()

/**
 * Why a name can't be posted to a list, or null: it's empty, or the list
 * (or a suggestion for it) already has it. Strapi checks the same, and
 * decides.
 */
export function nameIssue(
  name: string,
  list: SuggestionList,
  optionNames: Record<SuggestionList, string[]>,
  suggestions: readonly PublicSuggestion[]
): string | null {
  const key = nameKey(name)
  if (!key) return EMPTY_NAME
  const taken =
    (optionNames[list] ?? []).some((n) => nameKey(n) === key) ||
    suggestions.some((s) => s.optionKey === list && nameKey(s.name) === key)

  return taken ? DUPLICATE_NAME : null
}

function replyMessage(json: PostReply): string | null {
  if (typeof json.error === "string") return json.error

  return json.error?.message ?? null
}

const CARD = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: 22,
}

const FIELD = {
  border: `1px solid ${T.border.hi}`,
  borderRadius: 14,
  background: T.bg.deep,
  color: T.ink.base,
  fontFamily: T.font.sans,
  fontSize: 16,
  fontWeight: 500,
}

function Heading({ id }: { readonly id: string }) {
  return (
    <h2
      id={id}
      className="m-0"
      style={{
        fontFamily: T.font.serif,
        fontWeight: 500,
        fontSize: 26,
        lineHeight: 1.1,
        color: T.ink.base,
      }}
    >
      Suggest an option
    </h2>
  )
}

function Hint({ children }: { readonly children: string }) {
  return (
    <span className="font-medium" style={{ color: T.ink.dim }}>
      {children}
    </span>
  )
}

/**
 * "Suggest an option": posts an Option Suggestion straight to the board,
 * with the poster's vote. Checks for an empty or existing name before
 * posting; Strapi checks again and its message shows under the name.
 * Signed out, the card asks the viewer to sign in.
 */
export function SuggestOptionForm({
  signedIn,
  optionNames,
  suggestions,
  onPosted,
}: {
  readonly signedIn: boolean
  readonly optionNames: Record<SuggestionList, string[]>
  /** Every suggestion on the board, for the duplicate check. */
  readonly suggestions: readonly PublicSuggestion[]
  readonly onPosted: (s: PublicSuggestion) => void
}) {
  const tUi = useUiTranslations("ui")

  const ids = useId()
  const headingId = `${ids}-heading`
  const listId = `${ids}-list`
  const nameId = `${ids}-name`
  const nameErrorId = `${ids}-name-error`
  const whyId = `${ids}-why`
  const nameRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<SuggestionList>("accessibility")
  const [name, setName] = useState("")
  const [why, setWhy] = useState("")
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)

  if (!signedIn) {
    return (
      <section
        id={SUGGEST_FORM_ID}
        aria-labelledby={headingId}
        tabIndex={-1}
        className="flex scroll-mt-24 flex-col gap-3.5"
        style={CARD}
      >
        <Heading id={headingId} />
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Sign in to suggest an option.
        </p>
        <GlobalLink
          href={`/auth/signin?callbackUrl=${encodeURIComponent(RETURN_TO)}`}
          className="inline-flex min-h-11 items-center self-start rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
        >
          {tUi("sign_in")}{" "}
        </GlobalLink>
      </section>
    )
  }

  const issue = tried ? nameIssue(name, list, optionNames, suggestions) : null
  const message = issue ?? serverError

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (posting) return
    setTried(true)
    setPosted(false)
    setServerError(null)
    if (nameIssue(name, list, optionNames, suggestions)) {
      nameRef.current?.focus()

      return
    }

    setPosting(true)
    try {
      const description = why.trim()
      const res = await fetch("/api/option-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionKey: list,
          name: name.trim(),
          ...(description ? { description } : {}),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as PostReply
      if (res.status === 201 && json.data) {
        onPosted({ ...json.data, voted: json.data.voted ?? true })
        setName("")
        setWhy("")
        setTried(false)
        setPosted(true)

        return
      }
      setServerError(
        SERVER_MESSAGES.has(res.status)
          ? (replyMessage(json) ?? FAILED)
          : FAILED
      )
      nameRef.current?.focus()
    } catch {
      setServerError(NETWORK)
    } finally {
      setPosting(false)
    }
  }

  return (
    <form
      id={SUGGEST_FORM_ID}
      aria-labelledby={headingId}
      noValidate
      tabIndex={-1}
      onSubmit={(e) => void onSubmit(e)}
      className="m-0 flex scroll-mt-24 flex-col gap-3.5"
      style={CARD}
    >
      <Heading id={headingId} />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={listId}
          className="text-[15px] font-bold"
          style={{ color: T.ink.base }}
        >
          Which list?
        </label>
        <select
          id={listId}
          value={list}
          onChange={(e) => {
            setList(e.target.value as SuggestionList)
            setServerError(null)
          }}
          className="h-12 w-full cursor-pointer px-3"
          style={FIELD}
        >
          {LIST_ORDER.map((key) => (
            <option key={key} value={key}>
              {LIST_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={nameId}
          className="text-[15px] font-bold"
          style={{ color: T.ink.base }}
        >
          Option name <Hint>{tUi("required")}</Hint>
        </label>
        <input
          ref={nameRef}
          id={nameId}
          type="text"
          value={name}
          maxLength={80}
          autoComplete="off"
          placeholder="e.g. Tool lending"
          aria-required="true"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? nameErrorId : undefined}
          onChange={(e) => {
            setName(e.target.value)
            setServerError(null)
            setPosted(false)
          }}
          className="h-12 w-full px-3.5"
          style={{
            ...FIELD,
            border: message
              ? `2px solid ${T.accent.danger}`
              : `1px solid ${T.border.hi}`,
          }}
        />
        {message ? (
          <p
            id={nameErrorId}
            className="m-0 text-[14px] font-semibold"
            style={{ color: T.accent.danger }}
          >
            {message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={whyId}
          className="text-[15px] font-bold"
          style={{ color: T.ink.base }}
        >
          Why it matters <Hint>{tUi("optional_59be71")}</Hint>
        </label>
        <textarea
          id={whyId}
          value={why}
          rows={3}
          maxLength={400}
          placeholder="Who would use it, and how would they look for it?"
          onChange={(e) => setWhy(e.target.value)}
          className="w-full resize-y leading-normal"
          style={{ ...FIELD, padding: "12px 14px" }}
        />
      </div>

      <div className="flex flex-col">
        <button
          type="submit"
          disabled={posting}
          className="h-[52px] w-full cursor-pointer rounded-full bg-(--t-accent-primary) text-[16px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-wait disabled:opacity-60"
        >
          Post suggestion
        </button>
        <p
          role="status"
          className={
            posted
              ? "m-0 mt-3.5 flex items-center gap-2 text-[15px] font-semibold"
              : "m-0"
          }
          style={{ color: T.accent.ok }}
        >
          {posted ? (
            <>
              <Icon
                aria-hidden="true"
                height={16}
                icon="mdi:check"
                width={16}
              />
              Posted, with your vote.
            </>
          ) : null}
        </p>
      </div>
    </form>
  )
}
