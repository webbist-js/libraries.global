"use client"

// Error boundaries must be Client Components:
// https://nextjs.org/docs/app/api-reference/file-conventions/error
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffLoadError } from "@/components/staff/StaffLoadError"

/**
 * The staff section's error boundary: anything a page still throws (a
 * fetch that failed before it could render its own notice) lands here as
 * an inline notice with "Try again", under the site header.
 */
export default function StaffErrorPage({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <>
      <PageHero
        compact
        eyebrow="Library staff"
        title="Your Staff area"
        tabs={<StaffAreaTabs active="overview" />}
      />
      <Container className="py-10">
        <StaffLoadError what="This page" onRetry={reset} />
      </Container>
    </>
  )
}
