import { Icon } from "@iconify/react"
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_COPY,
  FEED_TEST_LABEL,
  type FeedTestCode,
} from "@repo/shared-data"

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
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {label}: not run
      </p>
    )
  const ok = test.result === "ok"

  return (
    <p
      className="m-0 flex items-start gap-2 text-[14px]"
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
  if (!review)
    return (
      <p className="m-0" style={{ color: T.ink.dim }}>
        This feed&rsquo;s details could not be loaded.
      </p>
    )
  const def = EVENT_PROVIDERS[review.provider as EventProviderKey]
  const label = (key: string) =>
    def?.fields.find((f) => f.key === key)?.label ?? key
  const open = status === "pending" || status === "needs_info"

  return (
    <div className="flex flex-col gap-4">
      {!review.submitterHoldsClaim ? (
        <Notice icon="mdi:account-alert-outline" tone="warn" title="Claim lost">
          The submitter no longer holds a claim on this library. Reject this
          submission.
        </Notice>
      ) : null}
      {!review.exists ? (
        <Notice icon="mdi:link-off" tone="warn" title="Feed withdrawn">
          The library withdrew or disconnected this feed. Reject this
          submission.
        </Notice>
      ) : null}
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[14px]">
        <dt style={{ color: T.ink.dim }}>Platform</dt>
        <dd className="m-0">{def?.label ?? review.provider}</dd>
        <dt style={{ color: T.ink.dim }}>Library</dt>
        <dd className="m-0">{review.library?.name ?? "Unknown"}</dd>
        <dt style={{ color: T.ink.dim }}>Kind</dt>
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
              style={{ fontFamily: T.font.mono, fontSize: "13px" }}
            >
              {v}
            </dd>
          </div>
        ))}
        {review.kind === "replace"
          ? Object.entries(review.currentHints).map(([k, v]) => (
              <div key={`c-${k}`} className="contents">
                <dt style={{ color: T.ink.dim }}>{label(k)} (current)</dt>
                <dd
                  className="m-0"
                  style={{ fontFamily: T.font.mono, fontSize: "13px" }}
                >
                  {v}
                </dd>
              </div>
            ))
          : null}
      </dl>
      <div className="flex flex-col gap-2" aria-live="polite">
        <TestLine label="Test when sent" test={review.submittedTest} />
        <TestLine label="Latest test" test={review.latestTest} />
      </div>
      {open && review.exists ? (
        <FeedTestButton documentId={documentId} />
      ) : null}
      <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
        Details are encrypted. Moderators see only these masked hints; only
        Libraries Global staff can read a value.
      </p>
    </div>
  )
}
