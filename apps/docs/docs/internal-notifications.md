# Internal beta notifications

Internal notifications report beta access requests, account creation, successful
session starts, authenticated daily activity, contributions, review decisions,
Library Notices, option suggestions, discussions, abuse reports, direct article
publishing and exhausted email delivery retries. Beta invitation sending and
redemption are reported separately. At 17:00 UTC a daily message counts recorded
events in the preceding 24 hours. Session alerts are limited to one per person
per UTC hour; authenticated activity is limited to one per person per UTC day.

The CMS reconciles committed records and audit events into a separate persisted
delivery table. It does not observe draft saves or automatic imports. A unique
event key prevents repeated collection from creating additional messages.
Immutable audit rows avoid missing transitions between worker runs. The account
feed revisits pages after each pass to catch transactions that commit late.

The authentication database records minimal account/session events in the same
transaction as account/session creation. Apply
`apps/ui/scripts/internal-notifications-schema.sql` as the application role
before enabling the feed. Events survive sign-out and cascade away when their
account is erased. The existing daily auth retention job removes them after
30 days. A disabled feed refuses requests.

## Configuration

Use the same explicit ISO activation date in the UI and CMS:

```dotenv
INTERNAL_NOTIFICATIONS_ENABLED=true
INTERNAL_NOTIFICATIONS_SINCE=2026-01-01T00:00:00.000Z
```

Only the CMS receives `SLACK_INTERNAL_WEBHOOK_URL`. It must be an HTTPS Slack
incoming webhook bound to the intended private channel. Set
`INTERNAL_NOTIFICATIONS_DRY_RUN=true` in the CMS to collect without sending.
Development environments are disabled by default. Dry-run events remain pending
and will be delivered when sending is enabled; choose activation dates accordingly.

The existing notification operations endpoint accepts `internalRun`,
`internalStatus` and `internalRetry`, authenticated by the server bridge secret.
`internalRetry` clears the channel pause and requeues failed deliveries. The
operator CLI supports these actions through `pnpm notifications:check`.

Schedule `internalRun` every minute through the environment's existing job
runner. There is no requirement to enable general CMS cron. Do not run a second
application stack for notification delivery. A database advisory lock selects
one worker. Each run collects up to 50 missing records per content source and
one page of 100 events per authentication source, then sends up to 20 messages.
These bounds keep database and Slack work finite; a backlog takes additional runs.

Throttling pauses the whole channel for Slack's Retry-After period. Network and
server failures retry with backoff, up to eight attempts. Permanent request or
permission failures pause delivery until an operator corrects the configuration
and runs `internalRetry`. Check failed deliveries and source collection failures
through the job runner's logs independently of Slack. An ambiguous response after
Slack accepts a message can still cause a duplicate on retry.

## Data handling

Messages contain short summaries and account references or public usernames.
Waitlist email addresses are masked. Messages omit session tokens, IP addresses,
user agents, invitation codes, authentication links, claim evidence and submission
bodies. User-controlled text uses plain text blocks; action links are restricted
to the configured application origin. Links retain the site's authentication and
moderation permissions. The webhook URL is never retained in diagnostic errors.

Local message payloads and actor identifiers expire after 30 days. Deduplication
keys remain so reconciliation cannot replay old notifications. Account erasure
also clears associated local payloads. Slack messages follow the private
channel/workspace's own access and retention settings; incoming webhooks cannot
delete previously posted messages. Keep channel membership restricted and set
its retention policy to suit the operational purpose.

## Product feedback

With `INTERNAL_FEEDBACK_ENABLED=true` in the UI, validated feedback forms persist
`product_feedback` events in the existing internal notification table before
returning success. UI and CMS must share the application database, and internal
notifications must be enabled. No new schema is needed. The existing CMS worker
then delivers these events to `SLACK_FEEDBACK_WEBHOOK_URL`, a separate private
channel webhook held only by the CMS. Feedback never falls back to the activity
channel when its destination is missing. Both settings are disabled or empty by
default.

Slack receives the full feedback message, reproduction steps, product answers,
query-free page path, locale and a support reference. It omits the visitor's
name, email and automatic browser/device context. Long messages are split into
bounded plain-text sections below [Slack’s text-object limit](https://docs.slack.dev/reference/block-kit/composition-objects/text-object/); Slack markup and mentions remain disabled. The
original email copy is still attempted. If email fails after the queue write,
the form remains accepted because the feedback is saved. If queue persistence
fails while feedback notifications are enabled, the form returns an error so
the visitor can retry. Ordinary contact enquiries retain email-only delivery.

Feedback and activity have independent channel cooldowns. A throttled, missing
or broken feedback webhook does not pause activity delivery. `internalRetry`
clears both pauses after an operator fixes the destination. Feedback payloads
follow the existing 30-day local retention; Slack follows channel retention.
