"use client"
import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { T } from "@/lib/design-tokens"
import {
  API_CONFIRMED_SCOPES,
  API_READ_SCOPES,
  API_SCOPES,
  type ApiScope,
} from "@/lib/team-api/types"

export type ApiKeyDraft = {
  name: string
  scopes: ApiScope[]
  expiresAt: string | null
  /** Sent only when a write or analysis scope was explicitly confirmed. */
  confirmScopes?: true
}

// These newer scope labels are English-only; they belong in the teamApiKeys
// messages once translated.
const NEW_SCOPE_COPY: Partial<
  Record<ApiScope, { title: string; help: string }>
> = {
  "services:read": {
    title: "Read services",
    help: "Published library services and networks, when that API is available.",
  },
  "analysis:run": {
    title: "Run analysis",
    help: "Starts analysis jobs that spend your account’s analysis credits.",
  },
  "submissions:write": {
    title: "Submit proposals",
    help: "Sends new-library and correction proposals for moderation. Nothing is published directly.",
  },
}
const needsConfirmation = (scope: ApiScope) =>
  (API_CONFIRMED_SCOPES as readonly ApiScope[]).includes(scope)

/** The list stays compact; a new form is mounted only when a key is needed. */
export function TeamApiKeyDialog({
  open,
  onOpenChange,
  pending,
  disabled,
  error,
  onCreate,
  focusSecret,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly pending: boolean
  readonly disabled: boolean
  readonly error: string
  readonly onCreate: (draft: ApiKeyDraft) => void
  readonly focusSecret: () => boolean
}) {
  const t = useTranslations("teamApiKeys")
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="pill"
        disabled={disabled || pending}
        onClick={(event) => {
          setTrigger(event.currentTarget)
          onOpenChange(true)
        }}
      >
        <Icon aria-hidden="true" icon="mdi:plus" width={18} />
        {t("create")}
      </Button>
      {open && (
        <KeyForm
          pending={pending}
          error={error}
          onCreate={onCreate}
          onClose={() => {
            if (!pending) onOpenChange(false)
          }}
          focusSecret={focusSecret}
          returnFocusTo={trigger}
        />
      )}
    </>
  )
}

function KeyForm({
  pending,
  error,
  onCreate,
  onClose,
  focusSecret,
  returnFocusTo,
}: {
  readonly pending: boolean
  readonly error: string
  readonly onCreate: (draft: ApiKeyDraft) => void
  readonly onClose: () => void
  readonly focusSecret: () => boolean
  readonly returnFocusTo: HTMLElement | null
}) {
  const tStatic = useTranslations("staticUi")

  const t = useTranslations("teamApiKeys")
  const id = useId()
  const formId = `${id}-form`
  const [name, setName] = useState("")
  const [expiry, setExpiry] = useState("")
  const [scopes, setScopes] = useState<ApiScope[]>([...API_READ_SCOPES])
  const [confirmed, setConfirmed] = useState(false)
  const confirming = scopes.some(needsConfirmation)
  const ready = name.trim() && scopes.length > 0 && (!confirming || confirmed)
  const toggleScope = (scope: ApiScope, checked: boolean) =>
    setScopes((previous) =>
      checked
        ? [...previous, scope]
        : previous.filter((value) => value !== scope)
    )

  return (
    <Drawer
      titleId={`${id}-title`}
      title={t("createTitle")}
      onClose={onClose}
      onAfterClose={() => {
        focusSecret()
      }}
      returnFocusTo={returnFocusTo}
      size="lg"
      edgeAligned
      icon={{ name: "mdi:key-plus", bg: T.accent.chip, fg: T.accent.primary }}
      footer={
        <div className="shrink-0 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
          {error && (
            <p
              role="alert"
              className="m-0 mb-3 text-sm leading-relaxed text-(--t-accent-danger)"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={pending}
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              size="pill"
              aria-busy={pending}
              disabled={pending || !ready}
            >
              {t(pending ? "creating" : "create")}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        aria-busy={pending}
        className="flex min-h-full min-w-0 flex-col gap-6 bg-(--t-bg-deep) px-5 py-6 sm:px-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (pending || !ready) return
          onCreate({
            name: name.trim(),
            scopes,
            ...(confirming ? { confirmScopes: true as const } : {}),
            expiresAt: expiry
              ? new Date(expiry + "T23:59:59Z").toISOString()
              : null,
          })
        }}
      >
        <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
          {t("createIntro")}
        </p>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-2 text-base">
            <label htmlFor="api-key-name" className="font-semibold">
              {t("name")}
            </label>
            <Input
              id="api-key-name"
              name="api-key-name"
              className={STAFF_FIELD}
              aria-describedby="api-key-name-help"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="off"
              disabled={pending}
            />
            <p
              id="api-key-name-help"
              className="m-0 text-sm leading-relaxed text-(--t-ink-dim)"
            >
              {t("nameHelp")}
            </p>
          </div>
          <div className="grid content-start gap-2 text-base">
            <label htmlFor="api-key-expiry" className="font-semibold">
              {t("expiry")}
            </label>
            <Input
              id="api-key-expiry"
              name="api-key-expiry"
              type="date"
              className={STAFF_FIELD}
              aria-describedby="api-key-expiry-help"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              disabled={pending}
            />
            <p
              id="api-key-expiry-help"
              className="m-0 text-sm leading-relaxed text-(--t-ink-dim)"
            >
              {t("expiryHelp")}
            </p>
          </div>
        </div>
        <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2 text-base font-semibold">
            {t("permissions")}
          </legend>
          <p className="mt-0 mb-4 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("permissionsHelp")}
          </p>
          <div className="grid gap-3">
            {API_SCOPES.map((scope) => {
              const selected = scopes.includes(scope)
              const search = scope === "search:read"
              const copy = NEW_SCOPE_COPY[scope]

              return (
                <label
                  key={scope}
                  className={
                    "flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--t-accent-primary) " +
                    (selected
                      ? "border-(--t-accent-primary)/50 bg-(--t-action-primary)/5"
                      : "border-(--t-border-line) bg-(--t-bg-deep) hover:bg-(--t-bg-surface)")
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      toggleScope(scope, event.target.checked)
                    }
                    className="mt-1 size-5 shrink-0 accent-(--t-accent-primary)"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      {copy?.title ?? t(search ? "search" : "records")}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-(--t-ink-dim)">
                      {copy?.help ?? t(search ? "searchHelp" : "recordsHelp")}
                    </span>
                    <code
                      translate="no"
                      className="mt-1.5 inline-block font-mono text-xs break-all text-(--t-ink-dim)"
                    >
                      {scope}
                    </code>
                  </span>
                </label>
              )
            })}
          </div>
          {confirming ? (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-(--t-border-hi) bg-(--t-bg-surface) p-4 text-base leading-relaxed">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
              />
              <span>
                {tStatic(
                  "staff.i_confirm_this_key_may_spend_analysis_credits_or_submit_proposals_on_behalf_of_our_api_account"
                )}
              </span>
            </label>
          ) : null}
        </fieldset>
        <p className="m-0 flex items-start gap-2 rounded-2xl bg-(--t-bg-surface) p-4 text-sm leading-relaxed text-(--t-ink-dim)">
          <Icon
            aria-hidden="true"
            icon="mdi:shield-key-outline"
            width={20}
            className="mt-0.5 shrink-0 text-(--t-accent-primary)"
          />
          {t("secretHelp")}
        </p>
      </form>
    </Drawer>
  )
}
