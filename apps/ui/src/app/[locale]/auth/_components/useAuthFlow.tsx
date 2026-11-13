"use client"

import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

/** Whole messages preserve emphasis without fixing a language's word order. */
export function useAuthFlow() {
  const tFlow = useTranslations("authFlow")
  const heading = (key: Parameters<typeof tFlow>[0]) =>
    tFlow.rich(key, {
      em: (chunks) => (
        <em style={{ fontStyle: "italic", fontWeight: 400 }}>{chunks}</em>
      ),
    })
  const flowRich = (key: Parameters<typeof tFlow>[0], email: string) =>
    tFlow.rich(key, {
      email,
      strong: (chunks) => (
        <strong style={{ color: T.ink.base }}>{chunks}</strong>
      ),
    })
  const lifetime = (seconds: number) =>
    seconds >= 3600 && seconds % 3600 === 0
      ? tFlow("hours", { count: seconds / 3600 })
      : tFlow("minutes", { count: Math.max(1, Math.round(seconds / 60)) })

  return { tFlow, heading, flowRich, lifetime }
}
