import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  API_SECTIONS,
  type ApiSection,
} from "@/components/developers/ApiWorkspace"
import { ApiWorkspacePage } from "@/components/developers/ApiWorkspacePage"

const sections = new Set(["keys", "usage", "reference", "playground"])

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  if (!sections.has(section)) notFound()

  return {
    title: `${API_SECTIONS[section as ApiSection].label} · API`,
    ...(["keys", "usage"].includes(section)
      ? { robots: { index: false, follow: false } }
      : {}),
  }
}

export default async function ApiSectionPage({
  params,
}: {
  readonly params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!sections.has(section)) notFound()

  return <ApiWorkspacePage section={section as ApiSection} />
}
