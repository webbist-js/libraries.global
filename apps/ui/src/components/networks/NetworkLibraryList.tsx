"use client"
import { defaultWidgetConfig, emptyWidgetSelection } from "@repo/shared-data"

import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { WidgetFinder } from "@/components/widgets/WidgetFinder"
import type { NetworkDetail } from "@/lib/networks/types"

export function NetworkLibraryList({ data }: { readonly data: NetworkDetail }) {
  const config = {
    ...defaultWidgetConfig(),
    title: data.network.name,
    pageSize: 12 as const,
    showHours: false,
    showAccessibility: false,
    showFacilities: false,
  }
  const presentation: WidgetPresentationData = {
    type: "finder",
    config,
    spec: emptyWidgetSelection(),
    publisher: data.network.name,
    rows: data.libraries,
    diagnostics: {
      selected: data.libraries.length,
      mapped: data.libraries.filter((row) => row.location).length,
      missingCoordinates: data.libraries.filter((row) => !row.location).length,
      unresolvedIds: [],
      excludedIds: [],
      licenceIssues: [],
      missingHours: 0,
    },
    attribution: [],
    checkedAt: new Date().toISOString(),
    sourceLabels: {},
  }

  return <WidgetFinder data={presentation} siteUrl="" />
}
