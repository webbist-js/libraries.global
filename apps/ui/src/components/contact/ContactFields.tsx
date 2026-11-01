"use client"

import { Lightbulb, MessageSquare, ThumbsUp, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import type { RefObject } from "react"

import styles from "@/components/contact/contact.module.css"
import { SelectField } from "@/components/ds/SelectField"
import {
  ATLAS_FEEDBACK_TASKS,
  CONTACT_TYPES,
  FEEDBACK_TASKS,
  FEEDBACK_TOPICS,
  TASK_OUTCOMES,
  type ContactContext,
  type ContactIntent,
  type ContactType,
  type FeedbackTask,
  type FeedbackTopic,
} from "@/lib/contact/model"

const topicIcons = {
  problem: TriangleAlert,
  idea: Lightbulb,
  experience: MessageSquare,
  praise: ThumbsUp,
}

type QuestionProps = {
  atlas?: boolean
  topic: FeedbackTopic
  setTopic: (value: FeedbackTopic) => void
  task: FeedbackTask | ""
  setTask: (value: FeedbackTask) => void
  outcome: string
  setOutcome: (value: string) => void
  ease?: number
  setEase: (value: number) => void
}

export function FeedbackQuestions({
  atlas = false,
  topic,
  setTopic,
  task,
  setTask,
  outcome,
  setOutcome,
  ease,
  setEase,
}: QuestionProps) {
  const t = useTranslations("contactModal")
  const tasks = atlas
    ? ATLAS_FEEDBACK_TASKS.map((value) => ({
        value,
        label: t(`atlas.tasks.${value}`),
      }))
    : FEEDBACK_TASKS.map((value) => ({
        value,
        label: t(`feedback.tasks.${value}`),
      }))

  return (
    <>
      <fieldset className={styles.group}>
        <legend className={styles.label}>{t("feedback.topic")}</legend>
        <div className={styles.topics}>
          {FEEDBACK_TOPICS.map((value) => {
            const Icon = topicIcons[value]

            return (
              <label
                className={styles.topic}
                key={value}
                data-selected={topic === value}
              >
                <input
                  type="radio"
                  name="topic"
                  value={value}
                  checked={topic === value}
                  onChange={() => setTopic(value)}
                />
                <Icon size={18} aria-hidden="true" />
                <span>{t(`feedback.topics.${value}`)}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <label className={styles.field}>
        <span className={styles.label}>
          {t(atlas ? "atlas.task" : "feedback.task")}
        </span>
        <SelectField
          value={String(task ?? "")}
          onValueChange={(selectedValue) =>
            setTask(selectedValue as FeedbackTask)
          }
          required
          options={[
            { value: "", label: String(t("choose")), disabled: true },
            ...tasks.map(({ value, label }) => ({
              value: String(value),
              label: String(label),
            })),
          ]}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{t("feedback.outcome")}</span>
        <SelectField
          value={String(outcome ?? "")}
          onValueChange={(selectedValue) => setOutcome(selectedValue)}
          required
          options={[
            { value: "", label: String(t("choose")), disabled: true },
            ...TASK_OUTCOMES.map((value) => ({
              value: String(value),
              label: String(t(`feedback.outcomes.${value}`)),
            })),
          ]}
        />
      </label>
      <fieldset className={styles.group}>
        <legend className={styles.label}>
          {t("feedback.ease")}{" "}
          <span className={styles.optional}>{t("optional")}</span>
        </legend>
        <div className={styles.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} data-selected={ease === value}>
              <input
                type="radio"
                name="ease"
                value={value}
                checked={ease === value}
                onChange={() => setEase(value)}
                aria-label={t("feedback.easeScore", { value })}
              />
              {value}
            </label>
          ))}
        </div>
        <div className={styles.ratingLabels}>
          <span>{t("feedback.difficult")}</span>
          <span>{t("feedback.easy")}</span>
        </div>
      </fieldset>
    </>
  )
}

type DetailProps = {
  feedback: boolean
  atlas?: boolean
  type: ContactType
  setType: (value: ContactType) => void
  topic: FeedbackTopic
  task: FeedbackTask | ""
  intent: ContactIntent
  context: ContactContext
  messageRef: RefObject<HTMLTextAreaElement | null>
  message: string
  setMessage: (value: string) => void
  wishlist: string
  setWishlist: (value: string) => void
  steps: string
  setSteps: (value: string) => void
  name: string
  setName: (value: string) => void
  email: string
  setEmail: (value: string) => void
}

export function ContactDetails({
  feedback,
  atlas = false,
  type,
  setType,
  topic,
  task,
  intent,
  context,
  messageRef,
  message,
  setMessage,
  wishlist,
  setWishlist,
  steps,
  setSteps,
  name,
  setName,
  email,
  setEmail,
}: DetailProps) {
  const t = useTranslations("contactModal")
  const isIssue = feedback ? topic === "problem" : type === "report_issue"
  const promptKey = feedback
    ? (`${atlas ? "atlas" : "feedback"}.prompts.${topic}` as const)
    : (`contact.prompts.${type}` as const)
  const taskLabels = atlas
    ? Object.fromEntries(
        ATLAS_FEEDBACK_TASKS.map((value) => [value, t(`atlas.tasks.${value}`)])
      )
    : Object.fromEntries(
        FEEDBACK_TASKS.map((value) => [value, t(`feedback.tasks.${value}`)])
      )

  return (
    <>
      {!feedback ? (
        <label className={styles.field}>
          <span className={styles.label}>{t("contact.reason")}</span>
          <SelectField
            value={String(type ?? "")}
            onValueChange={(selectedValue) =>
              setType(selectedValue as ContactType)
            }
            options={CONTACT_TYPES.map((value) => ({
              value: String(value),
              label: String(t(`contact.types.${value}`)),
            }))}
          />
        </label>
      ) : (
        <p className={styles.summary}>
          {t(`feedback.topics.${topic}`)} <span aria-hidden="true">·</span>{" "}
          {taskLabels[task]}
        </p>
      )}
      {intent.mode === "contact" && intent.sourceSubject ? (
        <p className={styles.source}>{intent.sourceSubject}</p>
      ) : null}
      <label className={styles.field}>
        <span className={styles.label}>{t(`${promptKey}.label`)}</span>
        <span className={styles.hint}>{t(`${promptKey}.hint`)}</span>
        <textarea
          ref={messageRef}
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          placeholder={t(`${promptKey}.placeholder`)}
        />
      </label>
      {isIssue ? (
        <label className={styles.field}>
          <span className={styles.label}>
            {t("steps")}{" "}
            <span className={styles.optional}>{t("optional")}</span>
          </span>
          <textarea
            name="steps"
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("stepsPlaceholder")}
          />
        </label>
      ) : null}
      {atlas && topic !== "idea" ? (
        <label className={styles.field}>
          <span className={styles.label}>
            {t("atlas.wishlist.label")}{" "}
            <span className={styles.optional}>{t("optional")}</span>
          </span>
          <span className={styles.hint}>{t("atlas.wishlist.hint")}</span>
          <textarea
            name="wishlist"
            value={wishlist}
            onChange={(event) => setWishlist(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("atlas.wishlist.placeholder")}
          />
        </label>
      ) : null}
      <div className={styles.identity}>
        <label className={styles.field}>
          <span className={styles.label}>
            {t("name")} <span className={styles.optional}>{t("optional")}</span>
          </span>
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>
            {t("email")}{" "}
            {feedback ? (
              <span className={styles.optional}>{t("optional")}</span>
            ) : null}
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required={!feedback}
            maxLength={254}
          />
        </label>
      </div>
      <p className={styles.hint}>
        {feedback ? t("feedback.emailHint") : t("contact.emailHint")}
      </p>
      <p className={styles.contextNote}>
        {t("contextNote")}{" "}
        <a
          href={`${context.locale === "en" ? "" : `/${context.locale}`}/legal/privacy`}
          target="_blank"
          rel="noreferrer"
        >
          {t("privacy")}
        </a>
      </p>
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  )
}
