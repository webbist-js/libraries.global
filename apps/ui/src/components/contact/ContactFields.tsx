"use client"

import { Lightbulb, MessageSquare, ThumbsUp, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import type { RefObject } from "react"

import styles from "@/components/contact/contact.module.css"
import {
  CONTACT_TYPES,
  FEEDBACK_TASKS,
  FEEDBACK_TOPICS,
  TASK_OUTCOMES,
  type ContactContext,
  type ContactIntent,
  type ContactType,
  type FeedbackTopic,
} from "@/lib/contact/model"

const topicIcons = {
  problem: TriangleAlert,
  idea: Lightbulb,
  experience: MessageSquare,
  praise: ThumbsUp,
}

type QuestionProps = {
  topic: FeedbackTopic
  setTopic: (value: FeedbackTopic) => void
  task: (typeof FEEDBACK_TASKS)[number] | ""
  setTask: (value: (typeof FEEDBACK_TASKS)[number]) => void
  outcome: string
  setOutcome: (value: string) => void
  ease?: number
  setEase: (value: number) => void
}

export function FeedbackQuestions({
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
        <span className={styles.label}>{t("feedback.task")}</span>
        <select
          value={task}
          onChange={(event) =>
            setTask(event.target.value as (typeof FEEDBACK_TASKS)[number])
          }
          required
        >
          <option value="" disabled>
            {t("choose")}
          </option>
          {FEEDBACK_TASKS.map((value) => (
            <option key={value} value={value}>
              {t(`feedback.tasks.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{t("feedback.outcome")}</span>
        <select
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          required
        >
          <option value="" disabled>
            {t("choose")}
          </option>
          {TASK_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {t(`feedback.outcomes.${value}`)}
            </option>
          ))}
        </select>
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
  type: ContactType
  setType: (value: ContactType) => void
  topic: FeedbackTopic
  task: (typeof FEEDBACK_TASKS)[number] | ""
  intent: ContactIntent
  context: ContactContext
  messageRef: RefObject<HTMLTextAreaElement | null>
  message: string
  setMessage: (value: string) => void
  steps: string
  setSteps: (value: string) => void
  name: string
  setName: (value: string) => void
  email: string
  setEmail: (value: string) => void
}

export function ContactDetails({
  feedback,
  type,
  setType,
  topic,
  task,
  intent,
  context,
  messageRef,
  message,
  setMessage,
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
    ? (`feedback.prompts.${topic}` as const)
    : (`contact.prompts.${type}` as const)

  return (
    <>
      {!feedback ? (
        <label className={styles.field}>
          <span className={styles.label}>{t("contact.reason")}</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ContactType)}
          >
            {CONTACT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`contact.types.${value}`)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className={styles.summary}>
          {t(`feedback.topics.${topic}`)} <span aria-hidden="true">·</span>{" "}
          {task ? t(`feedback.tasks.${task}`) : null}
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
