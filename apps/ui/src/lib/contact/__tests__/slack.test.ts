import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { query, connect, release } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: { connect } }))
import { contactSubmissionSchema } from "../schema"
import { feedbackEvent, queueFeedbackNotification } from "../slack"

const feedback = contactSubmissionSchema.parse({
  mode: "feedback",
  topic: "problem",
  task: "export_data",
  outcome: "partly",
  ease: 2,
  name: "Private name",
  email: "private@example.test",
  message: "<!channel> The exported data was missing a Library.",
  steps: "Select an area, then export.",
  atlas: {
    features: ["exports", "area_comparison"],
    clarity: 3,
    wishlist: "Add a CSV option.",
  },
  context: {
    page: "/atlas?token=secret#account",
    locale: "en",
    timezone: "Private timezone",
    viewport: { width: 1000, height: 700 },
  },
})
const reference = "b08d99e4-a40a-4382-bde4-35661c70116a"
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("INTERNAL_FEEDBACK_ENABLED", "true")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "2026-10-23T00:00:00Z")
  vi.stubEnv("DATABASE_URL", "postgresql://fixture@localhost/feedback_fixture")
  query.mockResolvedValue({ rows: [] })
  connect.mockResolvedValue({ query, release })
})
afterEach(() => vi.unstubAllEnvs())

it("queues selected product answers and full content using a fixed parameterized write", async () => {
  expect(await queueFeedbackNotification(feedback, reference)).toBe(true)
  const input = query.mock.calls.find(
    ([value]) => typeof value === "object"
  )![0]
  expect(input.text).toContain("ON CONFLICT (event_key) DO NOTHING")
  expect(input.values[1]).toBe(`feedback:${reference}`)
  expect(input.values[2]).toBe("Atlas feedback · problem")
  expect(input.values[3]).toContain("<!channel>")
  expect(input.values[3]).toContain("Ease: 2/5")
  expect(input.values[3]).toContain("Clarity: 3/5")
  expect(input.values[3]).toContain("Add a CSV option.")
  expect(input.values[4]).toBe("/atlas")
  for (const privateValue of [
    "Private name",
    "private@example.test",
    "Private timezone",
    "token=secret",
    "#account",
    "viewport",
  ])
    expect(JSON.stringify(input.values)).not.toContain(privateValue)
})
it("retains the complete longest feedback, steps and wishlist", () => {
  const long = contactSubmissionSchema.parse({
    ...feedback,
    message: "m".repeat(5000),
    steps: "s".repeat(2000),
    atlas: { features: ["exports"], wishlist: "w".repeat(2000) },
  })
  if (long.mode !== "feedback") throw new Error("Expected feedback")
  const event = feedbackEvent(long, reference)
  expect(event.detail).toContain("m".repeat(5000))
  expect(event.detail).toContain("s".repeat(2000))
  expect(event.detail).toContain("w".repeat(2000))
  expect(event.detail.length).toBeLessThan(12000)
})
it("keeps disabled development and ordinary contact messages out of the Slack queue", async () => {
  vi.stubEnv("INTERNAL_FEEDBACK_ENABLED", "false")
  expect(await queueFeedbackNotification(feedback, reference)).toBe(false)
  vi.stubEnv("INTERNAL_FEEDBACK_ENABLED", "true")
  expect(
    await queueFeedbackNotification(
      contactSubmissionSchema.parse({
        mode: "contact",
        type: "general_inquiry",
        message: "A contact-only message.",
        email: "private@example.test",
        context: { page: "/", locale: "en" },
      }),
      reference
    )
  ).toBe(false)
  expect(query).not.toHaveBeenCalled()
})
it("fails closed if delivery is disabled or persistence fails", async () => {
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "false")
  await expect(queueFeedbackNotification(feedback, reference)).rejects.toThrow(
    "disabled"
  )
  expect(query).not.toHaveBeenCalled()
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
  query.mockRejectedValue(new Error("Database unavailable"))
  await expect(queueFeedbackNotification(feedback, reference)).rejects.toThrow(
    "Database unavailable"
  )
})

it("requires an explicit database binding and activation date before writing", async () => {
  vi.stubEnv("DATABASE_URL", "")
  await expect(queueFeedbackNotification(feedback, reference)).rejects.toThrow(
    "database binding"
  )
  vi.stubEnv("DATABASE_URL", "postgresql://fixture@localhost/feedback_fixture")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "")
  await expect(queueFeedbackNotification(feedback, reference)).rejects.toThrow(
    "activation date"
  )
  expect(query).not.toHaveBeenCalled()
})

it("rolls back a failed queue write before returning its database connection", async () => {
  query.mockImplementation(async (input) => {
    if (typeof input === "object") throw new Error("Queue write failed")

    return { rows: [] }
  })
  await expect(queueFeedbackNotification(feedback, reference)).rejects.toThrow(
    "Queue write failed"
  )
  expect(query).toHaveBeenCalledWith("ROLLBACK")
  expect(query).not.toHaveBeenCalledWith("COMMIT")
  expect(release).toHaveBeenCalledWith(false)
})
