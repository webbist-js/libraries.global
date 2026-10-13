import type { FormData } from "./wizard.types"

export function calcScore(f: FormData): number {
  const checks = [
    // Step 1: identity essentials
    !!f.name && !!f.libraryType && !!f.operationalStatus,
    // Step 2: location essentials
    !!f.city && !!f.country,
    // Step 3: contact — at least one web URL
    !!(f.website || f.catalogueUrl),
    // Step 4: collections — at least a size
    !!f.collectionSize,
    // Step 5: history — at least a founded year
    !!f.foundedYear,
    // Step 6: imagery — at least one uploaded image
    f.uploadedImages.length > 0,
    // Step 7: sources — evidence URL + summary
    !!f.evidenceUrl && !!f.editSummary,
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
