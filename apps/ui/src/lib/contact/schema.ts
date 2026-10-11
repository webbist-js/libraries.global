import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { z } from "zod"

import {
  CONTACT_TYPES,
  FEEDBACK_TASKS,
  FEEDBACK_TOPICS,
  TASK_OUTCOMES,
  contextPath,
} from "@/lib/contact/model"

const dimension = z.number().int().min(0).max(32768)
const shortText = z
  .string()
  .trim()
  .max(120)
  .regex(/^[^\r\n]*$/)
const contactContextSchema = z.object({
  page: z.string().max(2048).transform(contextPath),
  referrer: z.string().max(2048).transform(contextPath).optional(),
  locale: z.enum(SUPPORTED_LOCALES),
  viewport: z.object({ width: dimension, height: dimension }).optional(),
  screen: z.object({ width: dimension, height: dimension }).optional(),
  pixelRatio: z.number().min(0).max(10).optional(),
  language: shortText.optional(),
  timezone: shortText.optional(),
  pointer: z.enum(["coarse", "fine", "none"]).optional(),
  reducedMotion: z.boolean().optional(),
  timeOnPageSeconds: z.number().int().min(0).max(604800).optional(),
})
const base = {
  name: shortText.optional(),
  email: z
    .union([
      z.literal(""),
      z.string().trim().toLowerCase().pipe(z.email().max(254)),
    ])
    .optional(),
  message: z.string().trim().min(10).max(5000),
  steps: z.string().trim().max(2000).optional(),
  sourceSubject: shortText.optional(),
  context: contactContextSchema,
  website: z.string().max(200).optional(),
}

export const contactSubmissionSchema = z.discriminatedUnion("mode", [
  z
    .object({
      ...base,
      mode: z.literal("contact"),
      type: z.enum(CONTACT_TYPES),
      email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    })
    .strict(),
  z
    .object({
      ...base,
      mode: z.literal("feedback"),
      topic: z.enum(FEEDBACK_TOPICS),
      task: z.enum(FEEDBACK_TASKS),
      outcome: z.enum(TASK_OUTCOMES),
      ease: z.number().int().min(1).max(5).optional(),
    })
    .strict(),
])
export type ContactSubmission = z.infer<typeof contactSubmissionSchema>
