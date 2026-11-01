"use client"

import type { AtlasBounds } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
import type {
  AtlasContextRelease,
  AtlasContextPoint,
  AtlasContextArea,
} from "@/lib/atlas-context"

import { AtlasAnalysisHeader } from "./AtlasAnalysisHeader"
import { AtlasAreaPicker } from "./AtlasAreaPicker"
import { AtlasInspectSettings, AtlasInspectTools } from "./AtlasInspect"
import { AtlasLoadingSkeleton } from "./AtlasLoadingSkeleton"

export function useAtlasContextCatalogue(enabled: boolean) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{
    releases?: AtlasContextRelease[]
    error?: boolean
  } | null>(null)
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    fetch("/api/atlas/context?kind=catalogue", {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Context unavailable")
        const value = await response.json()
        if (
          value.schemaVersion !== 1 ||
          !Array.isArray(value.releases) ||
          value.releases.length > 128
        )
          throw new Error("Invalid context catalogue")
        if (!abort.signal.aborted) setState({ releases: value.releases })
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ error: true })
      })

    return () => abort.abort()
  }, [enabled, revision])

  return {
    releases: state?.releases ?? [],
    loading: enabled && !state,
    error: state?.error,
    retry: () => {
      setState(null)
      setRevision((n) => n + 1)
    },
  }
}

export function useAtlasContextPoint(
  release: AtlasContextRelease | null,
  location: { lng: number; lat: number } | null
) {
  const key =
    release && location ? `${release.id}:${location.lng}:${location.lat}` : ""
  const [state, setState] = useState<{
    key: string
    value?: AtlasContextPoint
    error?: boolean
  } | null>(null)
  useEffect(() => {
    if (!key || !release || !location) return
    const abort = new AbortController()
    const params = new URLSearchParams({
      kind: "point",
      release: release.id,
      lng: location.lng.toFixed(7),
      lat: location.lat.toFixed(7),
    })
    fetch(`/api/atlas/context?${params}`, {
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Context unavailable")
        const value = await response.json()
        if (!abort.signal.aborted) setState({ key, value })
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ key, error: true })
      })

    return () => abort.abort()
  }, [key, release, location])

  return {
    value: state?.key === key ? state.value : undefined,
    error: state?.key === key && state.error,
    loading: Boolean(key) && state?.key !== key,
  }
}

const KEYS = {
  population: "population",
  deprivation: "deprivation",
  carAccess: "carAccess",
} as const

export function AtlasContextLegend({
  theme,
  categories,
  missing = "transparent",
}: {
  readonly theme: keyof typeof KEYS
  readonly categories?: AtlasContextRelease["categories"]
  readonly missing?: "transparent" | "grey"
}) {
  const t = useTranslations("atlasContext")
  const analysis = useTranslations("atlasAnalysis")
  const colors =
    categories?.map((category) => category.color) ??
    (theme === "deprivation"
      ? ["#9E3A64", "#CE7891", "#E7BCC5", "#BCCBDC", "#6084AB"]
      : theme === "carAccess"
        ? ["#EFF3FF", "#BDD7E7", "#6BAED6", "#3182BD", "#08519C"]
        : ["#F0F4E5", "#D7E5B0", "#9DC776", "#57A266", "#22634C"])
  const labels =
    categories?.map((category) => category.label) ??
    (theme === "deprivation"
      ? [
          t("decile12"),
          t("decile34"),
          t("decile56"),
          t("decile78"),
          t("decile910"),
        ]
      : theme === "carAccess"
        ? ["<10%", "10–<25%", "25–<40%", "40–<60%", "60%+"]
        : ["<50", "50–<200", "200–<1,000", "1,000–<5,000", "5,000+"])

  return (
    <section
      aria-label={t("legend")}
      className="rounded-xl bg-(--t-bg-surface) p-3"
    >
      <p className="mt-0 mb-3 text-xs font-semibold text-(--t-ink-dim)">
        {categories ? t("publishedCategories") : t(`${KEYS[theme]}Unit`)}
      </p>
      <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        {colors.map((color) => (
          <span key={color} className="flex-1" style={{ background: color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ background: colors[i] }}
            />
            {label}
          </div>
        ))}
      </div>
      {missing === "grey" ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-(--t-ink-dim)">
          <span className="size-3 rounded-sm bg-(--t-border-hi)" />
          {analysis("unavailable")}
        </div>
      ) : (
        <p className="mt-3 mb-0 text-xs text-(--t-ink-dim)">{t("noData")}</p>
      )}
    </section>
  )
}

export function AtlasContextSources({
  release,
  open = false,
  plain = false,
}: {
  readonly release: AtlasContextRelease
  readonly open?: boolean
  readonly plain?: boolean
}) {
  const t = useTranslations("atlasContext")
  const content = (
    <div className="flex flex-col gap-4 text-xs leading-relaxed text-(--t-ink-dim)">
      <p>
        {release.edition} · {release.boundary}
      </p>
      <p>{release.note}</p>
      <p>{release.attribution}</p>
      <p>
        <a
          href={release.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {release.source}
        </a>{" "}
        · {release.licence}
      </p>
    </div>
  )
  if (plain)
    return (
      <div className="flex flex-col gap-4">
        <h4 className="type-h4 m-0 text-(--t-ink-base)">{t("sources")}</h4>
        {content}
      </div>
    )

  return (
    <details
      open={open || undefined}
      className="rounded-xl border border-(--t-border-line) px-4 py-1"
    >
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">
        {t("sources")}
      </summary>
      <div className="pb-3">{content}</div>
    </details>
  )
}

type ContextAnalysisProps = {
  readonly theme: "deprivation" | "carAccess"
  readonly releases: AtlasContextRelease[]
  readonly release: AtlasContextRelease | null
  readonly onRelease: (id: string) => void
  readonly point?: AtlasContextPoint
  readonly loading: boolean
  readonly error: boolean
  readonly retry: () => void
  readonly onArea: (bounds: AtlasBounds) => void
  readonly opacity: number
  readonly onOpacity: (value: number) => void
  readonly onClose: () => void
  readonly collapsed: boolean
  readonly onCollapse: () => void
  readonly reachActive: boolean
  readonly onReach: () => void
}

export function AtlasContextAnalysis(props: ContextAnalysisProps) {
  const { theme, point, collapsed, onCollapse, onClose, release } = props
  const t = useTranslations("atlasContext")
  const [selected, setSelected] = useState<AtlasContextArea | null>(null)
  const area = point !== undefined ? point.area : selected

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AtlasAnalysisHeader
        title={t(theme)}
        description={
          release?.classification === "source-categories"
            ? t("publishedCategories")
            : t(`${theme}Unit`)
        }
        badge={t("contextLayer")}
        badgeTone="area"
        collapsed={collapsed}
        onCollapse={onCollapse}
        onClose={onClose}
      />
      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5 text-sm">
          <p className="m-0 leading-relaxed">{t(`${theme}Intro`)}</p>
          <ContextAnalysisBody
            {...props}
            area={area}
            onSelected={setSelected}
          />
        </div>
      ) : null}
    </div>
  )
}

function ContextAnalysisBody({
  theme,
  releases,
  release,
  onRelease,
  area,
  onSelected,
  loading,
  error,
  retry,
  onArea,
  opacity,
  onOpacity,
  reachActive,
  onReach,
}: ContextAnalysisProps & {
  area: AtlasContextArea | null | undefined
  onSelected: (area: AtlasContextArea | null) => void
}) {
  const t = useTranslations("atlasContext")
  if (error)
    return (
      <div role="alert">
        <p>{t("unavailable")}</p>
        <button type="button" className="min-h-11 underline" onClick={retry}>
          {t("retry")}
        </button>
      </div>
    )
  if (loading) return <AtlasLoadingSkeleton label={t("loading")} />
  if (!release)
    return (
      <div className="space-y-3">
        <p role="status">
          {t(releases.length ? "chooseCoverage" : "notInstalled")}
        </p>
        {releases.length ? (
          <SelectField
            label={t("nationEdition")}
            value=""
            onValueChange={onRelease}
            options={releases.map((r) => ({
              value: r.id,
              label: `${r.name} · ${r.edition}`,
            }))}
          />
        ) : null}
      </div>
    )

  return (
    <>
      {area ? (
        <ContextAreaSummary area={area} release={release} theme={theme} />
      ) : (
        <p className="m-0 text-xs text-(--t-ink-dim)">{t("clickArea")}</p>
      )}
      <AtlasInspectSettings
        summary={`${release.name} · ${release.edition}${area ? ` · ${area.name}` : ""}`}
        open={!area}
      >
        {" "}
        <label className="flex flex-col gap-2 text-xs font-semibold text-(--t-ink-dim)">
          {t("nationEdition")}
          <SelectField
            label={t("nationEdition")}
            value={release.id}
            onValueChange={(id) => {
              onSelected(null)
              onRelease(id)
            }}
            options={releases.map((r) => ({
              value: r.id,
              label: `${r.name} · ${r.edition}`,
            }))}
          />
        </label>
        <AtlasAreaPicker
          key={release.id}
          release={release.id}
          selected={area ? { id: area.code, name: area.name } : null}
          onSelect={(choice) => {
            if (choice.area) {
              onSelected(choice.area)
              onArea(choice.area.bounds)
            }
          }}
        />
      </AtlasInspectSettings>
      <AtlasContextLegend theme={theme} categories={release.categories} />
      <div className="rounded-xl bg-(--t-bg-surface) p-4">
        <p className="m-0 text-xs leading-relaxed">{t("reachHint")}</p>
        <button
          type="button"
          onClick={onReach}
          className="mt-2 min-h-11 text-sm font-semibold underline"
        >
          {t(reachActive ? "openReach" : "addReach")}
        </button>
      </div>
      <AtlasInspectTools
        shading={opacity}
        onShading={onOpacity}
        about={<AtlasContextSources release={release} plain />}
      />
    </>
  )
}

function ContextAreaSummary({
  area,
  release,
  theme,
}: {
  area: AtlasContextArea
  release: AtlasContextRelease
  theme: "deprivation" | "carAccess"
}) {
  const t = useTranslations("atlasContext")

  return (
    <section
      data-atlas-reveal
      className="rounded-xl border border-(--t-border-line) p-4"
    >
      <h3 className="type-h3 m-0">{area.name}</h3>
      <p className="mt-1 text-xs text-(--t-ink-dim)">
        {area.code} · {release.year}
      </p>
      <p className="my-3 text-3xl font-semibold">
        {theme === "deprivation"
          ? release.classification === "source-categories"
            ? (area.category ?? "—")
            : t("decile", { value: area.value ?? "—" })
          : `${area.value?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}%`}
      </p>
      <p className="m-0 text-xs leading-relaxed">
        {theme === "deprivation"
          ? release.classification === "source-categories"
            ? t("relativeScore", {
                value:
                  area.relativeScore?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }) ?? "—",
              })
            : t("rank", {
                rank: area.rank?.toLocaleString() ?? "—",
                total: release.areaCount?.toLocaleString() ?? "—",
                nation: release.name,
              })
          : t("households", {
              count: area.withoutCar?.toLocaleString() ?? "—",
              total: area.households?.toLocaleString() ?? "—",
            })}
      </p>
    </section>
  )
}
