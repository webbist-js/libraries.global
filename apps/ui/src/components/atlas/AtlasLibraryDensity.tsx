"use client"

import {
  atlasCellId,
  atlasDensityCell,
  atlasDensityScale,
  ATLAS_DENSITY_BREAKS,
  ATLAS_DENSITY_COLORS,
  type AtlasDensitySelection,
  type AtlasDensitySettings,
  type AtlasLibraryDensity,
} from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"

import { SelectField } from "@/components/ds/SelectField"

import { AtlasInspectSettings, AtlasInspectTools } from "./AtlasInspect"

export function AtlasLibraryDensityLegend({
  data,
  settings,
}: {
  readonly data: AtlasLibraryDensity | null
  readonly settings: AtlasDensitySettings
}) {
  const t = useTranslations("atlasDensity")
  const locale = useLocale()
  const max = atlasDensityScale(data, settings.scale)
  const format = (n: number) =>
    n.toLocaleString(locale, { maximumSignificantDigits: 3 })

  return (
    <div className="flex flex-col gap-2" aria-label={t("legend")}>
      <p className="m-0 text-xs font-semibold">
        {t(settings.view === "smooth" ? "relative" : "unit")}
      </p>
      <div
        className="h-3.5 rounded-full"
        style={{
          background: `linear-gradient(90deg,${ATLAS_DENSITY_COLORS.join(",")})`,
        }}
      />
      <div className="flex justify-between gap-1 text-[10px] text-(--t-ink-dim)">
        {settings.view === "smooth" ? (
          <>
            <span>{t("low")}</span>
            <span>{t("high")}</span>
          </>
        ) : (
          ATLAS_DENSITY_BREAKS.map((n, i) => (
            <span key={n}>
              {format((n * max) / 100)}
              {i === ATLAS_DENSITY_BREAKS.length - 1 ? "+" : ""}
            </span>
          ))
        )}
      </div>
      {settings.view === "grid" ? (
        <p className="m-0 text-xs text-(--t-ink-dim)">
          {t(settings.scale === "fixed" ? "fixedNote" : "localNote")}
        </p>
      ) : null}
    </div>
  )
}

export function AtlasLibraryDensity({
  data,
  settings,
  onSettings,
  selected,
  pins,
  onPins,
  onResults,
  centre,
  evaluatedAt,
  loading,
  error,
  retry,
}: {
  readonly data: AtlasLibraryDensity | null
  readonly settings: AtlasDensitySettings
  readonly onSettings: (settings: AtlasDensitySettings) => void
  readonly selected: AtlasDensitySelection | null
  readonly pins: boolean
  readonly onPins: () => void
  readonly onResults: (cell: AtlasDensitySelection) => void
  readonly centre: { lat: number; lng: number }
  readonly evaluatedAt?: string
  readonly loading?: boolean
  readonly error?: string | null
  readonly retry: () => void
}) {
  const t = useTranslations("atlasDensity")
  const locale = useLocale()
  const format = (n: number) =>
    n.toLocaleString(locale, { maximumSignificantDigits: 3 })
  const cell = data
    ? atlasDensityCell(atlasCellId(centre, data.resolution), 0)
    : null
  const width = cell ? cell.areaKm2 : 0
  const resolution = data
    ? t("resolved", { resolution: data.resolution, width: format(width) })
    : t("loading")

  return (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 text-sm"
        aria-busy={loading}
      >
        <div>
          <p className="m-0 text-[36px] leading-tight font-semibold text-(--t-accent-primary)">
            {data?.exactTotal.toLocaleString(locale) ?? "—"}
          </p>
          <p className="mt-1 mb-0 text-xs text-(--t-ink-dim)">{t("inView")}</p>
        </div>
        {loading && data ? (
          <p role="status" className="m-0 text-xs text-(--t-ink-dim)">
            {t("loading")}
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-xl bg-(--t-bg-surface) p-3">
            <p className="m-0">{t("error")}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 min-h-11 font-semibold text-(--t-accent-primary)"
            >
              {t("retry")}
            </button>
          </div>
        ) : null}
        <AtlasLibraryDensityLegend data={data} settings={settings} />
        {selected ? (
          <section
            className="rounded-xl border border-(--t-border-line) p-4"
            aria-label={t("inspection")}
          >
            <h3 className="m-0 text-sm font-semibold">{t("inspection")}</h3>
            <p className="mt-3 mb-1 text-2xl font-semibold">
              {selected.total.toLocaleString(locale)}{" "}
              <span className="text-xs font-normal text-(--t-ink-dim)">
                {t("recorded")}
              </span>
            </p>
            <dl className="m-0 mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs">
              <dt>{t("cellArea")}</dt>
              <dd className="m-0">{format(selected.areaKm2)} km²</dd>
              <dt>{t("unit")}</dt>
              <dd className="m-0 font-semibold">
                {format(selected.per100Km2)}
              </dd>
            </dl>
            <button
              type="button"
              onClick={() => onResults(selected)}
              disabled={selected.total === 0}
              className="mt-3 min-h-11 w-full rounded-full border border-(--t-border-hi) px-3 font-semibold text-(--t-accent-primary) disabled:opacity-50"
            >
              {t("results")}
            </button>
          </section>
        ) : (
          <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
            {t("inspectPrompt")}
          </p>
        )}
        <AtlasInspectSettings summary={resolution}>
          <Select
            label={t("view")}
            value={settings.view}
            onChange={(view) =>
              onSettings({
                ...settings,
                view: view as AtlasDensitySettings["view"],
              })
            }
            options={[
              { value: "grid", label: t("grid") },
              { value: "smooth", label: t("smooth") },
            ]}
          />
          {settings.view === "smooth" ? (
            <Select
              label={t("smoothing")}
              value={String(settings.smoothing)}
              onChange={(value) =>
                onSettings({
                  ...settings,
                  smoothing: Number(value) as 1 | 2 | 3,
                })
              }
              options={[1, 2, 3].map((n) => ({
                value: String(n),
                label: t("distance", {
                  distance: format(Math.sqrt(cell?.areaKm2 ?? 0) * n),
                }),
              }))}
            />
          ) : null}
          <Select
            label={t("detail")}
            value={String(settings.detail)}
            onChange={(detail) =>
              onSettings({
                ...settings,
                detail:
                  detail === "auto"
                    ? "auto"
                    : (Number(detail) as AtlasDensitySettings["detail"]),
              })
            }
            options={[
              { value: "auto", label: t("automatic") },
              { value: "6", label: t("continental") },
              { value: "10", label: t("regional") },
              { value: "14", label: t("local") },
              { value: "18", label: t("neighbourhood") },
            ]}
          />
          <Select
            label={t("scale")}
            value={settings.scale}
            onChange={(scale) =>
              onSettings({
                ...settings,
                scale: scale as AtlasDensitySettings["scale"],
              })
            }
            options={[
              { value: "fixed", label: t("fixed") },
              { value: "local", label: t("contrast") },
            ]}
          />
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={pins}
              onChange={onPins}
              className="size-4 accent-(--t-accent-primary)"
            />
            {t("pins")}
          </label>
        </AtlasInspectSettings>
        {data?.coarsened ? (
          <p
            role="status"
            className="m-0 rounded-xl bg-(--t-bg-surface) p-3 text-xs leading-relaxed"
          >
            {t("coarsened")}
          </p>
        ) : null}
        <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
          {t(settings.view === "smooth" ? "smoothNote" : "gridNote")}
        </p>
        <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
          {t("filters")}
        </p>
      </div>
      <AtlasInspectTools
        shading={settings.opacity}
        onShading={(opacity) => onSettings({ ...settings, opacity })}
        about={
          <>
            <p>{t("method")}</p>
            <p>{t("coverage")}</p>
            <p>{t(data?.mode === "tiles" ? "prepared" : "current")}</p>
            {evaluatedAt ? (
              <p>
                {t("updated", {
                  time: new Date(evaluatedAt).toLocaleString(locale),
                })}
              </p>
            ) : null}
          </>
        }
      />
    </>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold text-(--t-ink-dim)">
      {label}
      <SelectField
        label={label}
        value={value}
        onValueChange={onChange}
        options={options}
      />
    </label>
  )
}
