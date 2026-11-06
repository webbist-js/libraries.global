import { useLocale, useTranslations, type TranslationValues } from "next-intl"
import { useMemo } from "react"

import {
  type CompareColumn,
  type CompareGroup,
  compareGroups,
  type CompareRow,
  rowMessageKey,
} from "./plan-compare"
import {
  offer,
  type Offer,
  type OfferItem,
  type OfferKey,
  offerValues,
  type OfferValues,
} from "./plans"

/** Dynamic keys follow the offer and comparison inventories; coverage is tested. */
export function useMembershipContent() {
  return useTranslations("membershipContent") as (
    key: string,
    values?: TranslationValues
  ) => string
}

/** Allowances and prices formatted for the current locale. */
export function useOfferValues(): OfferValues {
  const locale = useLocale()

  return useMemo(() => offerValues(locale), [locale])
}

export type LocalizedOffer = Omit<Offer, "items" | "cta"> & {
  name: string
  who: string
  /** "Free", "£100 a month", "By arrangement". */
  priceLabel: string
  priceNote: string
  items: (OfferItem & { text: string })[]
  cta: { id: string; href: string; label: string }
  secondary?: { id: string; href: string; label: string }
}

export function useOffer() {
  const t = useMembershipContent()
  const values = useOfferValues()

  return (key: OfferKey): LocalizedOffer => {
    const { secondary, ...o } = offer(key)
    const prefix = `offers.${key}`

    return {
      ...o,
      name: t(`${prefix}.name`),
      who: t(`${prefix}.who`, values),
      priceLabel: t(`${prefix}.price`, values),
      priceNote: t(`${prefix}.priceNote`, values),
      cta: { ...o.cta, label: t(`${prefix}.cta.${o.cta.id}`) },
      ...(secondary
        ? {
            secondary: {
              ...secondary,
              label: t(`${prefix}.cta.${secondary.id}`),
            },
          }
        : {}),
      items: o.items.map((item) => ({
        ...item,
        text: t(`${prefix}.items.${item.id}`, values),
      })),
    }
  }
}

/** A comparison column's name and its short price line. */
export function useCompareColumn() {
  const t = useMembershipContent()
  const values = useOfferValues()

  return (column: CompareColumn) => ({
    name: t(`columns.${column}.name`),
    price: t(`columns.${column}.price`, values),
  })
}

export type LocalizedRow = CompareRow & {
  label: string
  cellLabels: Partial<Record<CompareColumn, string>>
}
export type LocalizedGroup = Omit<CompareGroup, "rows"> & {
  title: string
  rows: LocalizedRow[]
}

export function useLocalizeRow() {
  const t = useMembershipContent()
  const values = useOfferValues()

  return (row: CompareRow): LocalizedRow => ({
    ...row,
    label: t(`rows.${rowMessageKey(row.id)}`, values),
    cellLabels: Object.fromEntries(
      Object.entries(row.cellValues ?? {}).map(([column, id]) => [
        column,
        t(`cells.${id}`, values),
      ])
    ),
  })
}

export function useMembershipGroups(): LocalizedGroup[] {
  const t = useMembershipContent()
  const localize = useLocalizeRow()

  return compareGroups().map((group) => ({
    ...group,
    title: t(`groups.${group.id}`),
    rows: group.rows.map(localize),
  }))
}

export function useMembershipSummary() {
  const t = useMembershipContent()

  return (group: { rows: readonly CompareRow[] }) => {
    const now = group.rows.filter((row) =>
      Object.values(row.cells).includes("yes")
    ).length
    const soon = group.rows.length - now

    return [
      now ? t("copy.availableCount", { count: now }) : null,
      soon ? t("copy.roadmapCount", { count: soon }) : null,
    ]
      .filter(Boolean)
      .join(" · ")
  }
}

/** Number of FAQ entries under `membershipContent.faq`. */
export const MEMBERSHIP_FAQ_COUNT = 7
