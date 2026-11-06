"use client"

import { Icon } from "@iconify/react"
import { useFormatter, useTranslations } from "next-intl"
import { type FormEvent, useId, useState } from "react"

import { Drawer } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { primaryCtaSm } from "@/components/ui/action-styles"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import {
  type SavedView,
  type SavedViewKind,
  savedViewHref,
  savedViewLimit,
} from "@/lib/saved-views"
import { cn } from "@/lib/styles"

/** Every signed-in account keeps up to 1,000 of each; the count drops the cap. */
const UNLIMITED = 1000

type SavedViewsNotice = { text: string; failed: boolean }

/** Sign-in that returns to this page with its view or search intact. */
function currentSignInHref() {
  return typeof window === "undefined"
    ? "/auth/signin"
    : `/auth/signin?callbackUrl=${encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      )}`
}

/** The last save or delete outcome, announced politely or as an alert. */
function SavedViewsMessage({
  message,
}: {
  readonly message: SavedViewsNotice | null
}) {
  if (!message) return null

  return (
    <p
      role={message.failed ? "alert" : "status"}
      className={`m-0 rounded-xl px-4 py-3 text-sm ${message.failed ? "bg-(--t-palette-coral-soft) text-(--t-palette-coral-fg)" : "bg-(--t-palette-mint-soft) text-(--t-palette-mint-fg)"}`}
    >
      {message.text}
    </p>
  )
}

/** The saved list: a retry on failure, loading, empty, or the entries. */
function SavedViewsList({
  kind,
  items,
  loadFailed,
  onRetry,
  onOpen,
  onRemove,
}: {
  readonly kind: SavedViewKind
  readonly items: SavedView[] | null
  readonly loadFailed: boolean
  readonly onRetry: () => void
  readonly onOpen: () => void
  readonly onRemove: (item: SavedView) => void
}) {
  const t = useTranslations("savedViews")
  const format = useFormatter()

  if (loadFailed)
    return (
      <p role="alert" className="m-0 text-sm">
        {t("loadFailed")}{" "}
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer font-semibold text-(--t-accent-primary) underline"
        >
          {t("retry")}
        </button>
      </p>
    )
  if (items === null)
    return (
      <p role="status" className="m-0 text-sm text-(--t-ink-dim)">
        {t("loading")}
      </p>
    )
  if (items.length === 0)
    return (
      <p className="m-0 text-sm text-(--t-ink-dim)">{t(`empty.${kind}`)}</p>
    )

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item) => (
        <li
          key={item.documentId}
          className="flex items-center gap-3 border-b border-(--t-border-line) py-3 last:border-b-0"
        >
          <GlobalLink
            href={savedViewHref(item)}
            onClick={onOpen}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-(--t-ink-base) no-underline hover:underline"
          >
            <span className="font-semibold [overflow-wrap:anywhere]">
              {item.name}
            </span>
            <span className="text-sm text-(--t-ink-dim)">
              {t("savedOn", {
                date: format.dateTime(new Date(item.createdAt), {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              })}
            </span>
          </GlobalLink>
          <button
            type="button"
            aria-label={t("delete", { name: item.name })}
            onClick={() => onRemove(item)}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-(--t-ink-dim) hover:bg-(--t-bg-surface) hover:text-(--t-accent-danger)"
          >
            <Icon aria-hidden icon="mdi:trash-can-outline" width={18} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Save the current Atlas view or Find search by name, and reopen or delete
 * earlier ones. Only the page's URL state is stored; limits follow the plan.
 */
export function SavedViewsButton({ kind }: { readonly kind: SavedViewKind }) {
  const t = useTranslations("savedViews")
  const id = useId()
  const { data: session } = authClient.useSession()
  const user = session?.user as { limits?: unknown } | undefined
  const limit = savedViewLimit(user?.limits, kind)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SavedView[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<SavedViewsNotice | null>(null)
  const count = items?.length ?? 0
  const atLimit = items !== null && count >= limit
  const unlimited = limit >= UNLIMITED

  const load = async () => {
    setLoadFailed(false)
    const res = await fetch(`/api/saved-views?kind=${kind}`, {
      cache: "no-store",
    }).catch(() => null)
    if (!res?.ok) {
      setLoadFailed(true)

      return
    }
    const json = (await res.json()) as { data?: SavedView[] }
    setItems(json.data ?? [])
  }

  const openDrawer = () => {
    setOpen(true)
    setMessage(null)
    if (user) void load()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || !name.trim()) return
    setSaving(true)
    setMessage(null)
    const res = await fetch("/api/saved-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        name: name.trim(),
        query: window.location.search.slice(1),
      }),
    }).catch(() => null)
    setSaving(false)
    if (res?.status === 201) {
      const json = (await res.json()) as { data: SavedView }
      setItems((list) => [json.data, ...(list ?? [])])
      setName("")
      setMessage({ text: t("saved", { name: json.data.name }), failed: false })

      return
    }
    setMessage({
      text: t(res?.status === 403 ? "limitReached" : "saveFailed", { limit }),
      failed: true,
    })
    if (res?.status === 403) void load()
  }

  const remove = async (item: SavedView) => {
    const res = await fetch(`/api/saved-views/${item.documentId}`, {
      method: "DELETE",
    }).catch(() => null)
    if (res?.ok || res?.status === 404) {
      setItems((list) =>
        list ? list.filter((x) => x.documentId !== item.documentId) : list
      )
      setMessage({ text: t("deleted", { name: item.name }), failed: false })
    } else setMessage({ text: t("deleteFailed"), failed: true })
  }

  const signInHref = currentSignInHref()

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={openDrawer}
        className="cursor-pointer"
      >
        <Icon aria-hidden icon="mdi:bookmark-outline" width={18} />
        <span>{t(`button.${kind}`)}</span>
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        edgeAligned
        titleId={`${id}-title`}
        title={t(`title.${kind}`)}
        subtitle={
          user && items !== null
            ? t(unlimited ? "countUnlimited" : "count", { count, limit })
            : t(`lead.${kind}`)
        }
        icon={{
          name: "mdi:bookmark-outline",
          bg: T.accent.chip,
          fg: T.accent.primary,
        }}
      >
        <div className="flex min-h-full flex-col gap-6 bg-(--t-bg-deep) px-5 py-6 sm:px-6">
          {!user ? (
            <div className="flex flex-col items-start gap-3">
              <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
                {t(`signedOut.${kind}`)}
              </p>
              <GlobalLink
                href={signInHref}
                className={cn(primaryCtaSm, "min-h-11")}
              >
                {t("signIn")}
              </GlobalLink>
            </div>
          ) : (
            <>
              {atLimit ? (
                <div className="flex flex-col items-start gap-2 rounded-2xl bg-(--t-accent-chip) p-4 text-base leading-relaxed">
                  <p className="m-0">{t(`atLimit.${kind}`, { limit })}</p>
                </div>
              ) : (
                <form className="flex flex-col gap-2" onSubmit={save}>
                  <label
                    htmlFor={`${id}-name`}
                    className="text-sm font-semibold text-(--t-ink-dim)"
                  >
                    {t(`nameLabel.${kind}`)}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id={`${id}-name`}
                      value={name}
                      maxLength={80}
                      required
                      disabled={saving || items === null}
                      placeholder={t(`namePlaceholder.${kind}`)}
                      onChange={(event) => setName(event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="submit"
                      disabled={saving || items === null || !name.trim()}
                      className={cn(
                        primaryCtaSm,
                        "min-h-11 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                    >
                      {t(saving ? "saving" : "save")}
                    </button>
                  </div>
                  <p className="m-0 text-sm text-(--t-ink-dim)">
                    {t(`saveHint.${kind}`)}
                  </p>
                </form>
              )}
              <SavedViewsMessage message={message} />
              <section aria-labelledby={`${id}-list`}>
                <h3
                  id={`${id}-list`}
                  className="type-label m-0 mb-2 text-(--t-ink-dim)"
                >
                  {t(`listTitle.${kind}`)}
                </h3>
                <SavedViewsList
                  kind={kind}
                  items={items}
                  loadFailed={loadFailed}
                  onRetry={() => void load()}
                  onOpen={() => setOpen(false)}
                  onRemove={(item) => void remove(item)}
                />
              </section>
            </>
          )}
        </div>
      </Drawer>
    </>
  )
}
