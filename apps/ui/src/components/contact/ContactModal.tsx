"use client"

import * as Dialog from "@radix-ui/react-dialog"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageSquare,
  Send,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, type FormEvent, type RefObject } from "react"

import styles from "@/components/contact/contact.module.css"
import {
  ContactDetails,
  FeedbackQuestions,
} from "@/components/contact/ContactFields"
import type {
  FEEDBACK_TASKS,
  ContactContext,
  ContactIntent,
  ContactType,
  FeedbackTopic,
} from "@/lib/contact/model"
import { contactSubmissionSchema } from "@/lib/contact/schema"

export default function ContactModal({
  intent,
  context,
  trigger,
  onClose,
}: {
  readonly intent: ContactIntent
  readonly context: ContactContext
  readonly trigger: HTMLElement | null
  readonly onClose: () => void
}) {
  const t = useTranslations("contactModal")
  const feedback = intent.mode === "feedback"
  const [step, setStep] = useState(feedback ? "questions" : "details")
  const [topic, setTopic] = useState<FeedbackTopic>("problem")
  const [type, setType] = useState<ContactType>(
    intent.mode === "contact" ? intent.type : "general_inquiry"
  )
  const [task, setTask] = useState<(typeof FEEDBACK_TASKS)[number] | "">("")
  const [outcome, setOutcome] = useState("")
  const [ease, setEase] = useState<number>()
  const [message, setMessage] = useState("")
  const [steps, setSteps] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")
  const [sent, setSent] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const isIssue = feedback ? topic === "problem" : type === "report_issue"

  function focusDetails() {
    requestAnimationFrame(() => messageRef.current?.focus())
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    if (step === "questions") {
      setStep("details")
      focusDetails()

      return
    }
    const form = new FormData(event.currentTarget)
    const parsed = contactSubmissionSchema.safeParse({
      ...(feedback
        ? { mode: "feedback", topic, task, outcome, ease }
        : { mode: "contact", type, sourceSubject: intent.sourceSubject }),
      name,
      email,
      message,
      steps: isIssue ? steps : undefined,
      context,
      website: form.get("website") ?? "",
    })
    if (!parsed.success) {
      setError(t("invalid"))

      return
    }
    setSending(true)
    setError("")
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(45000),
      })
      if (!response.ok) {
        setError(t(response.status === 429 ? "rateLimited" : "error"))

        return
      }
      const result = await response.json()
      if (result.ok !== true) throw new Error("Submission was not accepted")
      setReference(
        typeof result.reference === "string"
          ? result.reference.slice(0, 8).toUpperCase()
          : ""
      )
      setSent(true)
      requestAnimationFrame(() => headingRef.current?.focus())
    } catch {
      setError(t("error"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !sending) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          ref={panelRef}
          aria-modal="true"
          className={styles.modal}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            panelRef.current
              ?.querySelector<HTMLElement>(
                "input[type=radio]:checked, select, textarea"
              )
              ?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (trigger?.isConnected) trigger.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (sending) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (sending) event.preventDefault()
          }}
        >
          <ContactHeader
            feedback={feedback}
            sent={sent}
            step={step}
            sending={sending}
            headingRef={headingRef}
          />
          {sent ? (
            <SuccessReceipt reference={reference} onClose={onClose} />
          ) : (
            <form className={styles.form} onSubmit={submit}>
              <div className={styles.body}>
                <fieldset disabled={sending} className={styles.fields}>
                  {step === "questions" ? (
                    <FeedbackQuestions
                      topic={topic}
                      setTopic={setTopic}
                      task={task}
                      setTask={setTask}
                      outcome={outcome}
                      setOutcome={setOutcome}
                      ease={ease}
                      setEase={setEase}
                    />
                  ) : (
                    <ContactDetails
                      feedback={feedback}
                      type={type}
                      setType={setType}
                      topic={topic}
                      task={task}
                      intent={intent}
                      context={context}
                      messageRef={messageRef}
                      message={message}
                      setMessage={setMessage}
                      steps={steps}
                      setSteps={setSteps}
                      name={name}
                      setName={setName}
                      email={email}
                      setEmail={setEmail}
                    />
                  )}
                </fieldset>
                {error ? (
                  <p role="alert" className={styles.error}>
                    {error}
                  </p>
                ) : null}
              </div>
              <ContactFooter
                feedback={feedback}
                step={step}
                sending={sending}
                onBack={() => {
                  setStep("questions")
                  setError("")
                  requestAnimationFrame(() => headingRef.current?.focus())
                }}
              />
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ContactHeader({
  feedback,
  sent,
  step,
  sending,
  headingRef,
}: {
  feedback: boolean
  sent: boolean
  step: string
  sending: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const t = useTranslations("contactModal")

  return (
    <div className={styles.header}>
      <div className={styles.eyebrow}>
        <MessageSquare size={14} aria-hidden="true" />{" "}
        {feedback ? t("feedback.eyebrow") : t("contact.eyebrow")}
      </div>
      <Dialog.Title asChild>
        <h2 className={styles.title} tabIndex={-1} ref={headingRef}>
          {sent
            ? t("successTitle")
            : feedback
              ? t("feedback.title")
              : t("contact.title")}
        </h2>
      </Dialog.Title>
      <Dialog.Description className={styles.description}>
        {sent
          ? feedback
            ? t("feedback.success")
            : t("contact.success")
          : feedback
            ? t("feedback.description")
            : t("contact.description")}
      </Dialog.Description>
      <Dialog.Close
        className={styles.close}
        aria-label={t("close")}
        disabled={sending}
      >
        <X size={20} aria-hidden="true" />
      </Dialog.Close>
      {feedback && !sent ? (
        <div
          className={styles.progress}
          aria-label={t("step", {
            current: step === "questions" ? 1 : 2,
          })}
        >
          <span />
          <span data-active={step === "details"} />
          <p>
            {t(step === "questions" ? "feedback.stepOne" : "feedback.stepTwo")}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function SuccessReceipt({
  reference,
  onClose,
}: {
  reference: string
  onClose: () => void
}) {
  const t = useTranslations("contactModal")

  return (
    <div className={styles.success}>
      <span className={styles.successIcon}>
        <Check size={28} aria-hidden="true" />
      </span>
      <p>{t("received")}</p>
      {reference ? (
        <p className={styles.hint}>{t("reference", { reference })}</p>
      ) : null}
      <button type="button" className={styles.primary} onClick={onClose}>
        {t("done")}
      </button>
    </div>
  )
}

function ContactFooter({
  feedback,
  step,
  sending,
  onBack,
}: {
  feedback: boolean
  step: string
  sending: boolean
  onBack: () => void
}) {
  const t = useTranslations("contactModal")

  return (
    <div className={styles.footer}>
      {feedback && step === "details" ? (
        <button
          className={styles.secondary}
          type="button"
          disabled={sending}
          onClick={onBack}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </button>
      ) : (
        <span className={styles.footerNote}>
          {t(step === "questions" ? "feedback.short" : "private")}
        </span>
      )}
      <button className={styles.primary} type="submit" disabled={sending}>
        {sending
          ? t("sending")
          : step === "questions"
            ? t("continue")
            : feedback
              ? t("feedback.send")
              : t("contact.send")}
        {step === "questions" ? (
          <ArrowRight size={16} aria-hidden="true" />
        ) : (
          <Send size={16} aria-hidden="true" />
        )}
      </button>
      <span role="status" className="sr-only">
        {sending ? t("sending") : ""}
      </span>
    </div>
  )
}
