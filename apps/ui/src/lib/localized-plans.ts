import { useTranslations, type TranslationValues } from "next-intl"

import { compareGroups, type CompareGroup, shortPrice } from "./plan-compare"
import {
  exportLimitOf,
  planCard,
  type PlanCardKey,
  type PlanPrice,
} from "./plans"

/** Dynamic keys follow the canonical plan and comparison inventories; coverage is tested. */
export function useMembershipContent() {
  return useTranslations("membershipContent") as (
    key: string,
    values?: TranslationValues
  ) => string
}

export function useMembershipPlan() {
  const t = useMembershipContent()

  return (key: PlanCardKey) => {
    const plan = planCard(key)
    const prefix = `plans.${key}`

    return {
      ...plan,
      name: t(`${prefix}.name`),
      who: t(`${prefix}.who`),
      cta: { ...plan.cta, label: t(`${prefix}.cta`) },
      price:
        plan.price === "free"
          ? plan.price
          : {
              ...plan.price,
              ...(key === "pro" ? { note: t(`${prefix}.note`) } : {}),
            },
      includes: plan.includes.map((item, i) => ({
        ...item,
        text: t(`${prefix}.includes.${i}`, {
          limit:
            key === "pro" || key === "supporter" || key === "team"
              ? exportLimitOf(key)
              : 0,
        }),
      })),
    }
  }
}

export function useMembershipGroups() {
  const t = useMembershipContent()

  return compareGroups().map((group) => ({
    ...group,
    title: t(`groups.${group.id}`),
    rows: group.rows.map((row) => ({
      ...row,
      label: t(`rows.${row.id.replaceAll(".", "_")}`, {
        limit: exportLimitOf("supporter"),
      }),
    })),
  }))
}

export function useMembershipSummary() {
  const t = useMembershipContent()

  return (group: CompareGroup) => {
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

export function useMembershipShortPrice() {
  const t = useMembershipContent()

  return (price: PlanPrice) =>
    price === "free"
      ? t("copy.free")
      : shortPrice(price)
          .replace("/mo", `/${t("copy.shortMonth")}`)
          .replace("/yr", `/${t("copy.shortYear")}`)
}
