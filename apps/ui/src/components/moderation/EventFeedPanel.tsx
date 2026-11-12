import { Icon } from "@iconify/react"
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_COPY,
  FEED_TEST_LABEL,
  type FeedTestCode,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"

import { Notice } from "@/components/ds/Notice"
import { T } from "@/lib/design-tokens"

import { FeedTestButton } from "./FeedTestButton"
import { formatDateTime } from "./submissionMeta"

/** The live feed behind an `event_feed` submission (Strapi's `feed-review.ts`). */
export type EventFeedReview = {
  credentialDocumentId: string
  exists: boolean
  status: string | null
  kind: "connect" | "replace"
  provider: string
  library: { documentId: string; name: string; slug: string | null } | null
  currentHints: Record<string, string>
  newHints: Record<string, string>
  submittedTest: { result: FeedTestCode; testedAt: string } | null
  latestTest: { result: FeedTestCode; testedAt: string } | null
  submitterHoldsClaim: boolean
}

function TestLine({
  label,
  test,
}: {
  readonly label: string
  readonly test: EventFeedReview["submittedTest"]
}) {
  if (!test)
    return (
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {label}: not run
      </p>
    )
  const ok = test.result === "ok"

  return (
    <p
      className="m-0 flex items-start gap-2 text-sm"
      style={{ color: ok ? T.accent.ok : T.accent.warn }}
    >
      <Icon
        aria-hidden="true"
        icon={ok ? "mdi:check-circle-outline" : "mdi:alert-outline"}
        width={18}
        height={18}
        className="mt-0.5 shrink-0"
      />
      <span>
        <strong>
          {label}: {FEED_TEST_LABEL[test.result]}
        </strong>{" "}
        · {formatDateTime(test.testedAt)}
        {ok ? null : (
          <span style={{ color: T.ink.dim }}>
            {" "}
            — {FEED_TEST_COPY[test.result]}
          </span>
        )}
      </span>
    </p>
  )
}

/**
 * An Event Feed submission: the platform, the library, the masked details
 * (never the values) and whether the connection test passed. Only Strapi
 * admin can reveal a value.
 */
export function EventFeedPanel({
  documentId,
  status,
  review,
}: {
  readonly documentId: string
  readonly status: string
  readonly review: EventFeedReview | null
}) {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  if (!review)
    return (
      <p className="m-0" style={{ color: T.ink.dim }}>
        {tStatic("moderation.this_feed_rsquo_s_details_could_not_be_loaded")}
      </p>
    )
  const def = EVENT_PROVIDERS[review.provider as EventProviderKey]
  const label = (key: string) =>
    def?.fields.find((f) => f.key === key)?.label ?? key
  const open = status === "pending" || status === "needs_info"

  return (
    <div className="flex flex-col gap-4">
      {!review.submitterHoldsClaim ? (
        <Notice
          icon="mdi:account-alert-outline"
          tone="warn"
          title={tUi("claim_lost")}
        >
          {tStatic(
            "moderation.the_submitter_no_longer_holds_a_claim_on_this_library_reject_this_submission"
          )}
        </Notice>
      ) : null}
      {!review.exists ? (
        <Notice icon="mdi:link-off" tone="warn" title={tUi("feed_withdrawn")}>
          {tStatic(
            "moderation.the_library_withdrew_or_disconnected_this_feed_reject_this_submission"
          )}
        </Notice>
      ) : null}
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt style={{ color: T.ink.dim }}>{tStatic("common.platform")}</dt>
        <dd className="m-0">{def?.label ?? review.provider}</dd>
        <dt style={{ color: T.ink.dim }}>{tUi("library")}</dt>
        <dd className="m-0">{review.library?.name ?? tUi("unknown")}</dd>
        <dt style={{ color: T.ink.dim }}>{tStatic("common.kind")}</dt>
        <dd className="m-0">
          {review.kind === "replace"
            ? "New details for an active feed"
            : "New connection"}
        </dd>
        {Object.entries(review.newHints).map(([k, v]) => (
          <div key={k} className="contents">
            <dt style={{ color: T.ink.dim }}>
              {label(k)}
              {review.kind === "replace" ? " (new)" : ""}
            </dt>
            <dd
              className="m-0"
              style={{
                fontFamily: T.font.mono,
                fontSize: "var(--type-body-small-size)",
              }}
            >
              {v}
            </dd>
          </div>
        ))}
        {review.kind === "replace"
          ? Object.entries(review.currentHints).map(([k, v]) => (
              <div key={`c-${k}`} className="contents">
                <dt style={{ color: T.ink.dim }}>
                  {label(k)} {tStatic("moderation.current")}
                </dt>
                <dd
                  className="m-0"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "var(--type-body-small-size)",
                  }}
                >
                  {v}
                </dd>
              </div>
            ))
          : null}
      </dl>
      <div className="flex flex-col gap-2" aria-live="polite">
        <TestLine label={tUi("test_when_sent")} test={review.submittedTest} />
        <TestLine label={tUi("latest_test")} test={review.latestTest} />
      </div>
      {open && review.exists ? (
        <FeedTestButton documentId={documentId} />
      ) : null}
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        {tStatic(
          "moderation.details_are_encrypted_moderators_see_only_these_masked_hints_only_libraries_global_staff_can_read_a_"
        )}
      </p>
    </div>
  )
}
