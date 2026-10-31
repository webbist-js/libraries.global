import { FEED_TEST_COPY, type FeedTestCode } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"

import { Notice } from "@/components/ds/Notice"
import { T } from "@/lib/design-tokens"

/** The same live feedback for connecting a feed and replacing its credentials. */
export function FeedTestFeedback({
  error,
  result,
}: {
  readonly error: string | null
  readonly result: FeedTestCode | null
}) {
  const tUi = useUiTranslations("ui")

  return (
    <div aria-live="polite">
      {error ? (
        <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
          {error}
        </p>
      ) : null}
      {result ? (
        <Notice
          icon={
            result === "ok"
              ? "mdi:check-circle-outline"
              : "mdi:alert-circle-outline"
          }
          tone={result === "ok" ? "ok" : "warn"}
          title={tUi("test_result")}
        >
          <p className="m-0">{FEED_TEST_COPY[result]}</p>
        </Notice>
      ) : null}
    </div>
  )
}
