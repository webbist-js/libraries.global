"use client"

import {
  BookOpen,
  CalendarDays,
  FileText,
  Globe,
  Library,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { pushAnalyticsEvent } from "@/lib/analytics-events"
import { Link, usePathname, useRouter } from "@/lib/navigation"
import {
  inSearchScope,
  rememberSearch,
  searchScopeCount,
  SITE_SEARCH_GROUPS,
  SITE_SEARCH_SCOPES,
  type SiteSearchResponse,
  type SiteSearchGroup,
  type SiteSearchItem,
  type SiteSearchScope,
} from "@/lib/site-search"
import {
  captureSiteSearch,
  trackSiteSearchSelection,
} from "@/lib/site-search-analytics"

const OPEN_SEARCH = "site-search-open"
const RECENTS = "libraries-global:recent-site-searches:v1"
const ICONS = {
  libraries: Library,
  places: MapPin,
  journal: FileText,
  knowledge: BookOpen,
  events: CalendarDays,
  pages: Globe,
}

export function SiteSearchTrigger({
  iconOnly = false,
}: {
  readonly iconOnly?: boolean
}) {
  const t = useTranslations("siteSearch")

  return (
    <button
      type="button"
      className={`site-search-trigger ${iconOnly ? "site-search-icon" : ""}`}
      aria-label={iconOnly ? t("title") : undefined}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+k Control+k"
      onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH))}
    >
      <Search size={16} aria-hidden />
      {iconOnly ? null : (
        <>
          <span>{t("placeholder")}</span>
          <kbd>⌘K</kbd>
        </>
      )}
    </button>
  )
}
function Highlight({
  text,
  query,
}: {
  readonly text: string
  readonly query: string
}) {
  const index = query
    ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
    : -1

  return index < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  )
}

type SearchResult = { key: string; data?: SiteSearchResponse; error?: boolean }

function searchViewState(
  result: SearchResult | null,
  key: string,
  open: boolean
) {
  const data = result?.key === key ? result.data : undefined
  const error = result?.key === key && result.error

  return { data, error, loading: open && !data && !error }
}

function EmptySearchResults({
  loading,
  error,
  itemCount,
  unavailable,
  scope,
  query,
  onNavigate,
}: {
  loading: boolean
  error?: boolean
  itemCount: number
  unavailable?: SiteSearchGroup[]
  scope: SiteSearchScope
  query: string
  onNavigate: () => void
}) {
  const t = useTranslations("siteSearch")

  if (
    loading ||
    error ||
    itemCount ||
    unavailable?.some((group) => inSearchScope(group, scope))
  )
    return null

  return (
    <div className="site-search-empty">
      <h2 className="type-small-heading">
        {query.length === 1
          ? t("keepTyping")
          : scope === "events"
            ? t(query ? "noEventsMatch" : "noEvents")
            : t("noResults", { query })}
      </h2>
      <p>{scope === "events" ? t("eventsHint") : t("emptyHint")}</p>
      <Link
        href={
          scope === "events"
            ? "/knowledge?section=events"
            : "/contribute/index/new"
        }
        onClick={() => onNavigate()}
      >
        {scope === "events" ? t("eventGuide") : t("addLibrary")} →
      </Link>
    </div>
  )
}

function SearchGroups({
  items,
  scope,
  query,
  selected,
  id,
  onActivate,
  onSelect,
}: {
  items: SiteSearchItem[]
  scope: SiteSearchScope
  query: string
  selected?: SiteSearchItem
  id: string
  onActivate: (id: string) => void
  onSelect: (item: SiteSearchItem) => void
}) {
  const t = useTranslations("siteSearch")

  return (
    <>
      {SITE_SEARCH_GROUPS.filter((group) => inSearchScope(group, scope)).map(
        (group) => {
          const rows = items.filter((row) => row.group === group),
            Icon = ICONS[group]

          return rows.length ? (
            <div
              key={group}
              role="group"
              aria-label={t(group)}
              className={`site-search-group site-search-group-${group}`}
            >
              <p className="site-search-group-label">
                {!query && group === "pages" ? t("jumpTo") : t(group)}
              </p>
              {rows.map((row) => (
                <Link
                  publicProfile
                  id={`${id}-${row.id}`}
                  key={row.id}
                  href={row.href}
                  role="option"
                  aria-selected={selected?.id === row.id}
                  className="site-search-result"
                  onMouseEnter={() => onActivate(row.id)}
                  onClick={() => {
                    onSelect(row)
                  }}
                >
                  <span className="site-search-result-icon">
                    <Icon size={19} aria-hidden />
                  </span>
                  <span>
                    <strong>
                      <Highlight text={row.title} query={query} />
                    </strong>
                    <small>{row.summary}</small>
                  </span>
                  <span className="site-search-return" aria-hidden>
                    ↵
                  </span>
                </Link>
              ))}
            </div>
          ) : null
        }
      )}
    </>
  )
}

/** A single modal owns focus, request cancellation, scoped results and keyboard navigation. */
export function SiteSearchMount() {
  const t = useTranslations("siteSearch"),
    ui = useTranslations("ui")
  const locale = useLocale(),
    pathname = usePathname(),
    router = useRouter(),
    id = useId()
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [scope, setScope] = useState<SiteSearchScope>("all")
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: SiteSearchResponse
    error?: boolean
  } | null>(null)
  const input = useRef<HTMLInputElement | null>(null),
    opener = useRef<HTMLElement | null>(null)
  if (openedAt !== null && openedAt !== pathname) setOpenedAt(null)
  const open = openedAt === pathname
  const query = q.trim(),
    key = `${locale}:${query}:${attempt}`
  const { data, error, loading } = searchViewState(result, key, open)
  const items = SITE_SEARCH_GROUPS.flatMap((group) =>
    inSearchScope(group, scope)
      ? (data?.items ?? [])
          .filter((row) => row.group === group)
          .slice(0, query || group === "pages" ? 6 : 2)
      : []
  )
  const selected = items[Math.min(active, Math.max(0, items.length - 1))]
  useEffect(() => {
    const show = (event: Event) => {
      if (document.querySelector('[role="dialog"]')) return
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      const initial =
        event instanceof CustomEvent && typeof event.detail?.q === "string"
          ? event.detail.q.slice(0, 120)
          : ""
      setQ(initial)
      setActive(0)
      setScope("all")
      setOpenedAt(pathname)
      pushAnalyticsEvent("navigation_action", {
        interaction_source: "site_search",
        action_type: "open",
        destination: "search",
      })
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(RECENTS) ?? "[]")
        setRecent(
          Array.isArray(saved)
            ? saved
                .filter(
                  (value): value is string =>
                    typeof value === "string" && value.length <= 120
                )
                .slice(0, 5)
            : []
        )
      } catch {
        setRecent([])
      }
    }
    const keyboard = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !event.altKey
      ) {
        event.preventDefault()
        if (open) setOpenedAt(null)
        else show(event)
      }
    }
    window.addEventListener(OPEN_SEARCH, show)
    window.addEventListener("keydown", keyboard)

    return () => {
      window.removeEventListener(OPEN_SEARCH, show)
      window.removeEventListener("keydown", keyboard)
    }
  }, [pathname, open])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        const measured = query.length > 1 ? captureSiteSearch() : null
        fetch(`/api/site-search?${new URLSearchParams({ q: query, locale })}`, {
          signal: controller.signal,
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("Search unavailable")

            return response.json() as Promise<SiteSearchResponse>
          })
          .then((data) => {
            if (!controller.signal.aborted) {
              setResult({ key, data })
              measured?.complete(data)
            }
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setResult({ key, error: true })
              measured?.failed()
            }
          })
      },
      query.length > 1 ? 250 : 0
    )

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, locale, open, query])
  useEffect(() => {
    if (open && selected)
      document
        .getElementById(`${id}-${selected.id}`)
        ?.scrollIntoView({ block: "nearest" })
  }, [id, open, selected])
  const remember = () => {
    const next = rememberSearch(recent, query)
    setRecent(next)
    try {
      localStorage.setItem(RECENTS, JSON.stringify(next))
    } catch {
      /* Browser storage is optional. */
    }
    setOpenedAt(null)
  }

  const handleActivate = (rowId: string) =>
    setActive(items.findIndex((item) => item.id === rowId))
  const handleSelection = (row: SiteSearchItem) => {
    trackSiteSearchSelection(row, scope)
    remember()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => setOpenedAt(value ? pathname : null)}
    >
      <DialogContent
        className="site-search-dialog site-search-live"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          input.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
        }}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("keyboardHelp")}
        </DialogDescription>
        <div className="site-search-input-row">
          <Search size={22} aria-hidden />
          <label className="sr-only" htmlFor={`${id}-input`}>
            {t("placeholder")}
          </label>
          <input
            ref={input}
            id={`${id}-input`}
            role="combobox"
            type="search"
            autoComplete="off"
            maxLength={120}
            placeholder={t("placeholder")}
            value={q}
            aria-expanded="true"
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={
              selected ? `${id}-${selected.id}` : undefined
            }
            onChange={(event) => {
              setQ(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (
                ["ArrowDown", "ArrowUp"].includes(event.key) &&
                items.length
              ) {
                event.preventDefault()
                setActive(
                  (current) =>
                    (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length
                )
              }
              if (event.key === "Enter" && selected) {
                event.preventDefault()
                trackSiteSearchSelection(selected, scope)
                remember()
                router.push(selected.href)
              }
            }}
          />
          {q ? (
            <button
              type="button"
              className="site-search-clear"
              aria-label={ui("clear_search")}
              onClick={() => {
                setQ("")
                setActive(0)
                input.current?.focus()
              }}
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
          <DialogClose className="site-search-escape" title={ui("close")}>
            Esc
          </DialogClose>
        </div>
        <div
          className="site-search-scopes"
          role="group"
          aria-label={t("scopes")}
        >
          {SITE_SEARCH_SCOPES.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={scope === value}
              onClick={() => {
                if (scope !== value)
                  pushAnalyticsEvent("navigation_action", {
                    interaction_source: "site_search",
                    action_type: "filter",
                    destination: "search",
                    search_scope: value,
                  })
                setScope(value)
                setActive(0)
                input.current?.focus()
              }}
            >
              {t(value === "libraries" ? "librariesAndPlaces" : value)}
              {query.length > 1 && data ? (
                <span>{searchScopeCount(data, value, locale)}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="site-search-results" aria-busy={loading}>
          {!query && scope === "all" && recent.length ? (
            <section className="site-search-recents">
              <div>
                <h2 className="type-label">{t("recent")}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setRecent([])
                    try {
                      localStorage.removeItem(RECENTS)
                    } catch {
                      /* Optional storage. */
                    }
                  }}
                >
                  {t("clearRecent")}
                </button>
              </div>
              <div>
                {recent.map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      setQ(value)
                      setActive(0)
                      input.current?.focus()
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {loading ? (
            <div role="status" className="space-y-5 p-5">
              <p className="m-0 flex items-center gap-2 text-sm text-(--t-ink-dim)">
                <LoaderCircle
                  size={18}
                  className="motion-safe:animate-spin"
                  aria-hidden
                />
                {t("loading")}
              </p>
              <div aria-hidden="true" className="space-y-4">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                    <div className="grid flex-1 gap-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="site-search-status">
              <p>{t("error")}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("retry")}
              </button>
            </div>
          ) : null}
          {data?.unavailable.length ? (
            <p role="status" className="site-search-warning">
              {t("partial", {
                groups: data.unavailable.map((group) => t(group)).join(", "),
              })}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("retry")}
              </button>
            </p>
          ) : null}
          <div id={`${id}-results`} role="listbox" aria-label={t("results")}>
            <SearchGroups
              items={items}
              scope={scope}
              query={query}
              selected={selected}
              id={id}
              onActivate={handleActivate}
              onSelect={handleSelection}
            />
          </div>
          <EmptySearchResults
            loading={loading}
            error={error}
            itemCount={items.length}
            unavailable={data?.unavailable}
            scope={scope}
            query={query}
            onNavigate={() => setOpenedAt(null)}
          />
        </div>
        <footer className="site-search-footer">
          <span>{t("keyboardHelp")}</span>
          <span aria-live="polite">
            {loading ? t("loading") : t("shown", { count: items.length })}
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
