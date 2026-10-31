"use client"

import { useTranslations } from "next-intl"
import {
  Activity,
  createContext,
  useContext,
  useId,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"

import { Icon, PANEL_STYLE } from "./atlas-ui"
import type { LayerId } from "./atlas.logic"
import { AtlasAnalysisPanelContext } from "./AtlasAnalysisHeader"

import styles from "./AtlasAnalysisStack.module.css"

export interface AtlasInspectEntry {
  id: string
  label: string
  title: string
  detail: string
  metric?: string
  status?: string
  layer?: LayerId
  content: ReactNode
}

const FooterContext = createContext<{
  target: HTMLDivElement | null
  active: boolean
} | null>(null)

export function AtlasInspectFooter({
  children,
}: {
  readonly children: ReactNode
}) {
  const context = useContext(FooterContext)
  if (!context) return children

  return context.active && context.target
    ? createPortal(children, context.target)
    : null
}

export function AtlasInspectTools({
  shading,
  onShading,
  about,
  downloads,
  action,
}: {
  readonly shading?: number
  readonly onShading?: (value: number) => void
  readonly about: ReactNode
  readonly downloads?: ReactNode
  readonly action?: ReactNode
}) {
  const t = useTranslations("atlasInspect")
  const id = useId()
  const [{ tool, open }, setPopover] = useState<{
    tool: "about" | "download"
    open: boolean
  }>({ tool: "about", open: false })
  const aboutButton = useRef<HTMLButtonElement>(null)
  const downloadButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const label = t(tool)
  const toggleTool = (next: "about" | "download") => {
    if (open && tool !== next)
      closeButton.current?.focus({ preventScroll: true })
    setPopover((current) => ({
      tool: next,
      open: current.tool === next ? !current.open : true,
    }))
  }

  return (
    <AtlasInspectFooter>
      <Popover
        open={open}
        onOpenChange={(next) =>
          setPopover((current) => ({ ...current, open: next }))
        }
      >
        <PopoverAnchor asChild>
          <div className="w-full border-t border-(--t-border-line) bg-(--t-bg-deep)">
            {action ? <div className="px-5 pt-3">{action}</div> : null}
            <div className="flex min-h-[60px] flex-wrap items-center gap-3 px-5 py-2.5 text-xs">
              {shading != null && onShading ? (
                <label className="flex min-w-[120px] flex-1 flex-col gap-1.5 text-(--t-ink-dim)">
                  <span>
                    {t("shading", { percent: Math.round(shading * 100) })}
                  </span>
                  <input
                    aria-label={t("shading", {
                      percent: Math.round(shading * 100),
                    })}
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(shading * 100)}
                    onChange={(event) =>
                      onShading(Number(event.target.value) / 100)
                    }
                    className="w-full accent-(--t-accent-primary)"
                  />
                </label>
              ) : (
                <span className="flex-1" />
              )}
              <button
                ref={aboutButton}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open && tool === "about"}
                aria-controls={open && tool === "about" ? id : undefined}
                onClick={() => toggleTool("about")}
                className="flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-semibold text-(--t-accent-primary) hover:bg-(--t-bg-surface)"
              >
                {t("about")}
                <Icon name="chevD" size={13} />
              </button>
              {downloads ? (
                <button
                  ref={downloadButton}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={open && tool === "download"}
                  aria-controls={open && tool === "download" ? id : undefined}
                  onClick={() => toggleTool("download")}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-1 font-semibold text-(--t-accent-primary) hover:bg-(--t-bg-surface)"
                >
                  {t("download")}
                  <Icon name="chevD" size={13} />
                </button>
              ) : null}
            </div>
          </div>
        </PopoverAnchor>
        <PopoverContent
          id={id}
          aria-label={label}
          side="top"
          align="end"
          collisionPadding={16}
          sideOffset={8}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeButton.current?.focus({ preventScroll: true })
          }}
          onInteractOutside={(event) => {
            const target = event.target as Node
            if (
              aboutButton.current?.contains(target) ||
              downloadButton.current?.contains(target)
            )
              event.preventDefault()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const trigger = tool === "about" ? aboutButton : downloadButton
            trigger.current?.focus({ preventScroll: true })
          }}
          className="z-[90] flex max-h-[min(72dvh,640px)] w-[min(400px,calc(100vw-32px))] flex-col overflow-clip rounded-2xl border-(--t-border-hi) bg-(--t-bg-deep) p-0 text-sm text-(--t-ink-base) shadow-lg"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-(--t-border-line) px-5 py-2.5">
            <h3 className="type-h3 m-0">{label}</h3>
            <button
              ref={closeButton}
              type="button"
              aria-label={t("close", { name: label })}
              onClick={() =>
                setPopover((current) => ({ ...current, open: false }))
              }
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--t-border-line) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="atlas-tool-content flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-5 text-sm leading-relaxed text-(--t-ink-dim) [&_button]:min-h-11 [&_p]:m-0">
            {tool === "about" ? about : downloads}
          </div>
        </PopoverContent>
      </Popover>
    </AtlasInspectFooter>
  )
}

export function AtlasInspectSettings({
  summary,
  children,
}: {
  readonly summary: string
  readonly children: ReactNode
  readonly open?: boolean
}) {
  const t = useTranslations("atlasInspect")

  return (
    <section
      aria-label={t("settings")}
      className="flex flex-col gap-4 border-t border-(--t-border-line) pt-5"
    >
      <div>
        <h3 className="type-h3 m-0">{t("settings")}</h3>
        <span
          className="mt-1 block text-xs leading-relaxed text-(--t-ink-dim)"
          title={summary}
        >
          {summary}
        </span>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function AtlasInspect({
  entries,
  active,
  minimised,
  onSelect,
  onMinimise,
  onRemove,
  mobile = false,
  visible = true,
}: {
  readonly entries: AtlasInspectEntry[]
  readonly active: string
  readonly minimised: boolean
  readonly onSelect: (id: string) => void
  readonly onMinimise: () => void
  readonly onRemove: (entry: AtlasInspectEntry) => void
  readonly visible?: boolean
  readonly mobile?: boolean
}) {
  const t = useTranslations("atlasInspect")
  const id = useId()
  const previouslyMinimised = useRef(minimised)
  useEffect(() => {
    if (previouslyMinimised.current === minimised) return
    previouslyMinimised.current = minimised
    // Opening Explore can minimise this dock; keep focus in that workspace.
    if (
      minimised &&
      !document.getElementById(`${id}-panel`)?.contains(document.activeElement)
    )
      return
    const selector = minimised
      ? `#${CSS.escape(id)}-rail button`
      : `#${CSS.escape(id)}-panel [role="tab"][aria-selected="true"], #${CSS.escape(id)}-panel button`
    document
      .querySelector<HTMLButtonElement>(selector)
      ?.focus({ preventScroll: true })
  }, [minimised, id])
  const [footer, setFooter] = useState<HTMLDivElement | null>(null)
  const selected = entries.find((entry) => entry.id === active) ?? entries[0]
  if (!selected) return null

  const hidden = minimised && !mobile

  return (
    <>
      {" "}
      {hidden ? (
        <nav
          id={`${id}-rail`}
          aria-label={t("minimised")}
          style={PANEL_STYLE}
          className="atlas-inspect-rail flex max-h-full min-h-0 w-[64px] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-[18px] p-2"
        >
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`${entry.title} · ${entry.detail}${entry.metric ? ` · ${entry.metric}` : ""}`}
              onClick={() => onSelect(entry.id)}
              className="flex min-h-11 w-12 flex-col items-center justify-center overflow-hidden rounded-xl px-1 text-xs font-semibold aria-current:bg-(--t-accent-chip) aria-current:text-(--t-accent-primary)"
              aria-current={selected.id === entry.id ? "true" : undefined}
            >
              <span className="max-w-full truncate">
                {entry.metric ?? entry.label}
              </span>
              {entry.metric ? (
                <span className="max-w-full truncate text-xs font-normal">
                  {entry.label}
                </span>
              ) : null}
              {entry.status ? (
                <span className="sr-only">{entry.status}</span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            aria-label={t("expand")}
            onClick={() => onSelect(selected.id)}
            className="flex min-h-10 items-center justify-center"
          >
            <Icon name="chev" className="rotate-180" size={18} />
          </button>
        </nav>
      ) : null}
      <section
        hidden={hidden}
        id={`${id}-panel`}
        aria-label={t("inspect")}
        className={`${styles.stack} atlas-motion-card flex min-h-0 flex-1 flex-col overflow-clip ${mobile ? "bg-(--t-bg-deep)" : "rounded-[22px] border border-(--t-border-hi) bg-(--t-bg-deep) shadow-[0_8px_24px_rgb(23_22_43/0.06)]"}`}
        style={{
          viewTransitionName: "var(--atlas-inspect-transition, none)",
          display: hidden ? "none" : undefined,
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-(--t-border-line) px-3 py-2.5">
          {entries.length > 1 ? (
            <div
              role="tablist"
              aria-label={t("inspect")}
              className="atlas-inspect-tabs flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-(--t-bg-surface) p-1"
            >
              {entries.map((entry, index) => (
                <button
                  key={entry.id}
                  id={`${id}-${entry.id}-tab`}
                  role="tab"
                  type="button"
                  aria-selected={entry.id === selected.id}
                  aria-controls={`${id}-${entry.id}-panel`}
                  tabIndex={entry.id === selected.id ? 0 : -1}
                  title={entry.title}
                  onClick={() => onSelect(entry.id)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % entries.length
                        : event.key === "ArrowLeft"
                          ? (index + entries.length - 1) % entries.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? entries.length - 1
                              : null
                    if (next == null) return
                    event.preventDefault()
                    const target = entries[next]!
                    onSelect(target.id)
                    document
                      .getElementById(`${id}-${target.id}-tab`)
                      ?.focus({ preventScroll: true })
                  }}
                  className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold aria-selected:bg-(--t-bg-deep) aria-selected:text-(--t-accent-primary) aria-selected:shadow-[inset_0_0_0_1px_var(--t-border-hi)]"
                >
                  <span className="max-w-[110px] truncate">{entry.label}</span>
                  {entry.status ? (
                    <span
                      aria-label={entry.status}
                      title={entry.status}
                      className="size-[6px] shrink-0 rounded-full bg-(--t-action-primary)"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">
              {selected.label}
            </span>
          )}
          <button
            type="button"
            aria-label={t("minimise")}
            title={t("minimiseHint")}
            onClick={onMinimise}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-(--t-border-hi)"
          >
            <Icon name="chev" size={18} />
          </button>
        </div>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-(--t-border-line) px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p
              className="m-0 truncate text-xs leading-relaxed text-(--t-ink-dim)"
              title={selected.detail}
            >
              {selected.detail}
            </p>
            <h2 tabIndex={-1} className="type-h2 m-0 mt-1 text-(--t-ink-base)">
              {selected.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={
              selected.layer
                ? t("remove", { name: selected.label })
                : t("close", { name: selected.label })
            }
            title={selected.layer ? t("turnOff") : t("closeRecord")}
            onClick={() => onRemove(selected)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-(--t-border-hi) text-(--t-ink-dim)"
          >
            <Icon name="x" size={16} />
          </button>
        </header>
        {entries.map((entry) => (
          <Activity
            key={entry.id}
            mode={
              visible && !hidden && entry.id === selected.id
                ? "visible"
                : "hidden"
            }
          >
            <div
              id={`${id}-${entry.id}-panel`}
              role="tabpanel"
              aria-label={entry.title}
              aria-labelledby={
                entries.length > 1 ? `${id}-${entry.id}-tab` : undefined
              }
              className="flex min-h-0 flex-1 flex-col overflow-clip"
            >
              <InspectPanel
                active={visible && !hidden && entry.id === selected.id}
                footer={footer}
              >
                {entry.content}
              </InspectPanel>
            </div>
          </Activity>
        ))}
        <div ref={setFooter} className="shrink-0 empty:hidden" />
      </section>
    </>
  )
}

function InspectPanel({
  active,
  footer,
  children,
}: {
  readonly active: boolean
  readonly footer: HTMLDivElement | null
  readonly children: ReactNode
}) {
  const value = useMemo(() => ({ target: footer, active }), [footer, active])

  return (
    <AtlasAnalysisPanelContext value>
      <FooterContext value={value}>{children}</FooterContext>
    </AtlasAnalysisPanelContext>
  )
}
