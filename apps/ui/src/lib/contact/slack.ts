import "server-only"

import { randomUUID } from "node:crypto"

import { contextPath } from "@/lib/contact/model"
import type { ContactSubmission } from "@/lib/contact/schema"

type Feedback = Extract<ContactSubmission, { mode: "feedback" }>
const words = (value: string) => value.replaceAll("_", " ")

/** Only feedback content and selected product answers enter the private Slack queue. */
export function feedbackEvent(submission: Feedback, reference: string) {
  const page = contextPath(submission.context.page)
  const detail = [
    `Reference: ${reference}`,
    `Page: ${page} · Language: ${submission.context.locale}`,
    `Task: ${words(submission.task)} · Outcome: ${words(submission.outcome)}`,
    ...(submission.ease ? [`Ease: ${submission.ease}/5`] : []),
    ...(submission.atlas
      ? [
          `Atlas features: ${submission.atlas.features.map(words).join(", ")}`,
          ...(submission.atlas.clarity
            ? [`Clarity: ${submission.atlas.clarity}/5`]
            : []),
        ]
      : []),
    "",
    submission.message,
    ...(submission.steps ? ["", "Steps to reproduce:", submission.steps] : []),
    ...(submission.atlas?.wishlist
      ? ["", "Wishlist:", submission.atlas.wishlist]
      : []),
  ].join("\n")

  return {
    eventKey: `feedback:${reference}`,
    title: `${submission.atlas ? "Atlas" : "Product"} feedback · ${words(submission.topic)}`,
    detail,
    href: page.length <= 240 ? page : null,
  }
}

export async function queueFeedbackNotification(
  submission: ContactSubmission,
  reference: string
): Promise<boolean> {
  if (
    submission.mode !== "feedback" ||
    process.env.INTERNAL_FEEDBACK_ENABLED !== "true"
  )
    return false
  if (process.env.INTERNAL_NOTIFICATIONS_ENABLED !== "true")
    throw new Error("Internal notification delivery is disabled")

  if (!process.env.DATABASE_URL)
    throw new Error("Feedback database binding is not configured")
  const since = process.env.INTERNAL_NOTIFICATIONS_SINCE
  if (!since || !Number.isFinite(Date.parse(since)))
    throw new Error("Internal notification activation date is required")

  const event = feedbackEvent(submission, reference)
  // UI and CMS use the same application database. Persist before acknowledging
  // the form; the CMS worker owns Slack transport, retries and payload retention.
  const { authDbPool } = await import("@/lib/auth")
  const client = await authDbPool.connect()
  let inTransaction = false
  let damaged = false
  try {
    await client.query("BEGIN")
    inTransaction = true
    await client.query("SET LOCAL statement_timeout = '5s'")
    await client.query({
      text: `INSERT INTO internal_notifications
      (document_id,event_key,kind,title,detail,href,event_at,state,attempts,next_attempt_at,created_at,updated_at)
      VALUES ($1,$2,'product_feedback',$3,$4,$5,now(),'pending',0,now(),now(),now())
      ON CONFLICT (event_key) DO NOTHING`,
      values: [
        randomUUID().replaceAll("-", ""),
        event.eventKey,
        event.title,
        event.detail,
        event.href,
      ],
    })

    await client.query("COMMIT")
    inTransaction = false
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query("ROLLBACK")
      } catch {
        damaged = true
      }
    }
    throw error
  } finally {
    client.release(damaged)
  }

  return true
}
