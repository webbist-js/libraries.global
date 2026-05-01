"use client"

import { T } from "@/lib/design-tokens"

import { ContributeSubpageHero } from "../../_components/ContributeSubpageHero"

interface AddLibraryHeroProps {
  lastSavedAt?: Date | null
  /** Edit mode: shows different title/breadcrumb */
  libraryName?: string
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

function DraftBadge({ lastSavedAt }: { lastSavedAt?: Date | null }) {
  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: lastSavedAt ? T.accent.ok : T.ink.faint,
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: lastSavedAt ? T.accent.ok : T.ink.faint,
          flexShrink: 0,
          opacity: lastSavedAt ? 1 : 0.4,
        }}
      />
      {lastSavedAt
        ? `Draft saved · ${formatSavedTime(lastSavedAt)}`
        : "Draft not yet saved"}
    </p>
  )
}

export function AddLibraryHero({
  lastSavedAt,
  libraryName,
}: AddLibraryHeroProps) {
  const isEditMode = !!libraryName

  return (
    <ContributeSubpageHero
      section={isEditMode ? "Edit library" : "Add a library"}
      badge={<DraftBadge lastSavedAt={lastSavedAt} />}
      heading={isEditMode ? "Suggest edits to" : "Index a"}
      headingItalic={isEditMode ? `${libraryName}.` : "new library."}
      body={
        isEditMode
          ? "Correct or update any details below. Your changes go to editorial review before going live."
          : "Seven steps, granular but forgiving. Drafts save automatically; submit only when you\u2019re ready for editorial review."
      }
    />
  )
}
