"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { API_SCOPES, type ApiScope } from "@/lib/team-api/types"

export type ApiKeyDraft = {
  name: string
  scopes: ApiScope[]
  expiresAt: string | null
}

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
  const titleRef = useRef<HTMLHeadingElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="primary"
          size="pill"
          disabled={disabled || pending}
        >
          <Icon aria-hidden="true" icon="mdi:plus" width={18} />
          {t("create")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto overscroll-contain rounded-3xl border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) motion-reduce:animate-none sm:max-w-2xl sm:p-8"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100 hover:bg-(--t-bg-surface)"
        showCloseButton={!pending}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (focusSecret()) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
        aria-busy={pending}
      >
        <DialogHeader className="gap-3 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="type-h2 m-0 pr-12 outline-none"
          >
            {t("createTitle")}
          </DialogTitle>
          <DialogDescription className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
            {t("createIntro")}
          </DialogDescription>
        </DialogHeader>
        <KeyForm pending={pending} error={error} onCreate={onCreate} />
      </DialogContent>
    </Dialog>
  )
}

function KeyForm({
  pending,
  error,
  onCreate,
}: {
  readonly pending: boolean
  readonly error: string
  readonly onCreate: (draft: ApiKeyDraft) => void
}) {
  const t = useTranslations("teamApiKeys")
  const [name, setName] = useState("")
  const [expiry, setExpiry] = useState("")
  const [scopes, setScopes] = useState<ApiScope[]>([...API_SCOPES])
  const toggleScope = (scope: ApiScope, checked: boolean) =>
    setScopes((previous) =>
      checked
        ? [...previous, scope]
        : previous.filter((value) => value !== scope)
    )

  return (
    <form
      className="min-w-0 space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending || !name.trim() || scopes.length === 0) return
        onCreate({
          name: name.trim(),
          scopes,
          expiresAt: expiry
            ? new Date(expiry + "T23:59:59Z").toISOString()
            : null,
        })
      }}
    >
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
        <div className="grid gap-3 sm:grid-cols-2">
          {API_SCOPES.map((scope) => {
            const selected = scopes.includes(scope)
            const search = scope === "search:read"

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
                  onChange={(event) => toggleScope(scope, event.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-(--t-accent-primary)"
                />
                <span className="min-w-0">
                  <span className="block text-base font-semibold">
                    {t(search ? "search" : "records")}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-(--t-ink-dim)">
                    {t(search ? "searchHelp" : "recordsHelp")}
                  </span>
                  <code
                    translate="no"
                    className="mt-3 inline-block font-mono text-sm break-all text-(--t-ink-dim)"
                  >
                    {scope}
                  </code>
                </span>
              </label>
            )
          })}
        </div>
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
      {error ? (
        <p
          role="alert"
          className="m-0 text-base leading-relaxed text-(--t-accent-danger)"
        >
          {error}
        </p>
      ) : null}
      <DialogFooter className="gap-3 border-t border-(--t-border-line) pt-5">
        <DialogClose asChild>
          <Button
            type="button"
            variant="surface"
            size="pill"
            disabled={pending}
          >
            {t("cancel")}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant="primary"
          size="pill"
          aria-busy={pending}
          disabled={pending || !name.trim() || scopes.length === 0}
        >
          {t(pending ? "creating" : "create")}
        </Button>
      </DialogFooter>
    </form>
  )
}
