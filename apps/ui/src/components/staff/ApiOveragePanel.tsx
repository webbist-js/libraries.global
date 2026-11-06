"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SelectField } from "@/components/ds/SelectField"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  API_OVERAGE_TERMS_VERSION,
  OVERAGE_CAP_DEFAULT_PENCE,
  OVERAGE_CAP_MAX_PENCE,
  OVERAGE_CAP_MIN_PENCE,
  OVERAGE_CAP_STEP_PENCE,
} from "@/lib/team-api/constants"
import type { ApiDashboard } from "@/lib/team-api/types"

import { formatPence } from "./api-format"

const CAPS = Array.from(
  {
    length:
      (OVERAGE_CAP_MAX_PENCE - OVERAGE_CAP_MIN_PENCE) / OVERAGE_CAP_STEP_PENCE +
      1,
  },
  (_, i) => OVERAGE_CAP_MIN_PENCE + i * OVERAGE_CAP_STEP_PENCE
)

type Money = (pence: number) => string

/** The organiser's current cap, or the £100 default before opting in. */
function initialCap(overage: ApiDashboard["overage"]) {
  return overage.enabled && overage.capPence
    ? overage.capPence
    : OVERAGE_CAP_DEFAULT_PENCE
}

function readOnlyReason(organiser: boolean, active: boolean) {
  if (!organiser) return "organisersOnly"

  return active ? "unavailable" : "inactive"
}

/** Accrued overage, the projected invoice and the current rates. */
function OverageFigures({
  data,
  money,
}: {
  readonly data: ApiDashboard
  readonly money: Money
}) {
  const t = useTranslations("apiOverage")
  const { accrued, rates, projectedInvoicePence, membership } = data

  return (
    <>
      <dl className="m-0 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
          <dt className="text-sm font-semibold text-(--t-ink-dim)">
            {t("accrued")}
          </dt>
          <dd className="type-h2 mt-2 mb-0 ml-0 tabular-nums">
            {money(accrued.totalPence)}
          </dd>
          <dd className="mt-2 mb-0 ml-0 text-sm text-(--t-ink-dim) tabular-nums">
            {t("accruedBreakdown", {
              requests: money(accrued.requestsPence),
              data: money(accrued.bytesPence),
              analysis: money(accrued.creditsPence),
            })}
          </dd>
        </div>
        <div className="min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
          <dt className="text-sm font-semibold text-(--t-ink-dim)">
            {t("projected")}
          </dt>
          <dd className="type-h2 mt-2 mb-0 ml-0 tabular-nums">
            {projectedInvoicePence === null
              ? "—"
              : money(projectedInvoicePence)}
          </dd>
          <dd className="mt-2 mb-0 ml-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {membership?.cancelAtPeriodEnd
              ? t("projectedEnding")
              : t("projectedRenewing")}
          </dd>
        </div>
      </dl>
      <p className="mt-4 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("rates", {
          request: money(rates.requestPence),
          mib: money(rates.mibPence),
          credit: money(rates.creditPence),
        })}
      </p>
    </>
  )
}

/** Turning overage off asks for a second, explicit confirmation. */
function TurnOffControl({
  confirmOff,
  setConfirmOff,
  pending,
  request,
}: {
  readonly confirmOff: boolean
  readonly setConfirmOff: (value: boolean) => void
  readonly pending: boolean
  readonly request: (body: unknown) => void
}) {
  const t = useTranslations("apiOverage")
  if (!confirmOff)
    return (
      <Button
        type="button"
        variant="surface"
        size="pill"
        disabled={pending}
        onClick={() => setConfirmOff(true)}
      >
        {t("turnOff")}
      </Button>
    )

  return (
    <>
      <Button
        type="button"
        variant="surface"
        size="pill"
        disabled={pending}
        onClick={() => {
          request({ action: "overage", enabled: false })
          setConfirmOff(false)
        }}
      >
        {t("confirmOff")}
      </Button>
      <Button
        type="button"
        variant="link"
        disabled={pending}
        onClick={() => setConfirmOff(false)}
      >
        {t("keepOn")}
      </Button>
    </>
  )
}

/**
 * Accrued overage, projected invoice and the organiser's opt-in control.
 * The cap is preselected at £100 but nothing is enabled until the organiser
 * confirms. Members see the same figures read-only.
 */
export function ApiOveragePanel({
  data,
  locale,
  pending,
  request,
}: {
  readonly data: ApiDashboard
  readonly locale: string
  readonly pending: boolean
  readonly request: (body: unknown) => void
}) {
  const t = useTranslations("apiOverage")
  const money = (pence: number) => formatPence(pence, locale)
  const consentId = useId()
  const { accrued, overage, organiser, active, overageAvailable } = data
  const [cap, setCap] = useState(() => initialCap(overage))
  const [consent, setConsent] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const capReached =
    overage.enabled &&
    overage.capPence > 0 &&
    accrued.totalPence >= overage.capPence
  const canManage = organiser && active
  const changing = !overage.enabled || cap !== overage.capPence

  return (
    <StaffPanel
      title={t("title")}
      id="api-overage"
      aside={
        <Badge
          label={
            overage.enabled
              ? t("badgeOn", { cap: money(overage.capPence) })
              : t("badgeOff")
          }
          color={overage.enabled ? "ok" : "dim"}
          dot
        />
      }
    >
      <OverageFigures data={data} money={money} />
      {capReached ? (
        <div className="mt-4">
          <Notice
            tone="warn"
            icon="mdi:alert-circle-outline"
            title={t("capReachedTitle")}
          >
            <span role="status">{t("capReached")}</span>
          </Notice>
        </div>
      ) : null}
      {canManage && overageAvailable ? (
        <form
          className="mt-5 space-y-4 border-t border-(--t-border-line) pt-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!consent || pending || !changing) return
            request({
              action: "overage",
              enabled: true,
              capPence: cap,
              termsVersion: API_OVERAGE_TERMS_VERSION,
              confirm: true,
            })
            setConsent(false)
          }}
        >
          <div className="max-w-xs">
            <SelectField
              label={t("capLabel")}
              value={String(cap)}
              disabled={pending}
              onValueChange={(value) => {
                setCap(Number(value))
                setConsent(false)
              }}
              options={CAPS.map((pence) => ({
                value: String(pence),
                label: money(pence),
              }))}
            />
          </div>
          {overage.enabled && cap < accrued.totalPence ? (
            <p role="status" className="m-0 text-sm text-(--t-ink-dim)">
              {t("capBelowAccrued")}
            </p>
          ) : null}
          <label
            htmlFor={consentId}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-base leading-relaxed"
          >
            <input
              id={consentId}
              type="checkbox"
              checked={consent}
              disabled={pending || !changing}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
            />
            <span>{t("consent", { cap: money(cap) })}</span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="primary"
              size="pill"
              disabled={pending || !consent || !changing}
              aria-busy={pending}
            >
              {t(overage.enabled ? "updateCap" : "turnOn")}
            </Button>
            {overage.enabled ? (
              <TurnOffControl
                confirmOff={confirmOff}
                setConfirmOff={setConfirmOff}
                pending={pending}
                request={request}
              />
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-4 mb-0 text-sm text-(--t-ink-dim)">
          {t(readOnlyReason(organiser, active))}
        </p>
      )}
    </StaffPanel>
  )
}
