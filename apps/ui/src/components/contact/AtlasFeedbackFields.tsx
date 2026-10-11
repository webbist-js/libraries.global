"use client"

import { useTranslations } from "next-intl"
import { useId, type RefObject } from "react"

import styles from "@/components/contact/contact.module.css"
import {
  ATLAS_FEEDBACK_FEATURES,
  type AtlasFeedbackFeature,
} from "@/lib/contact/model"

export default function AtlasFeedbackFields({
  features,
  setFeatures,
  featureError,
  firstFeatureRef,
  clarity,
  setClarity,
}: {
  readonly features: AtlasFeedbackFeature[]
  readonly setFeatures: (value: AtlasFeedbackFeature[]) => void
  readonly featureError: boolean
  readonly firstFeatureRef: RefObject<HTMLInputElement | null>
  readonly clarity?: number
  readonly setClarity: (value: number) => void
}) {
  const t = useTranslations("contactModal")
  const id = useId()
  const hintId = `${id}-features-hint`
  const errorId = `${id}-features-error`

  return (
    <>
      <fieldset
        className={styles.group}
        aria-describedby={featureError ? `${hintId} ${errorId}` : hintId}
        aria-invalid={featureError || undefined}
      >
        <legend className={styles.label}>{t("atlas.features.label")}</legend>
        <p id={hintId} className={styles.featureHint}>
          {t("atlas.features.hint")}
        </p>
        <div className={styles.features}>
          {ATLAS_FEEDBACK_FEATURES.map((value, index) => (
            <label
              key={value}
              className={styles.feature}
              data-selected={features.includes(value)}
            >
              <input
                ref={index === 0 ? firstFeatureRef : undefined}
                type="checkbox"
                name="features"
                value={value}
                checked={features.includes(value)}
                aria-describedby={featureError ? errorId : undefined}
                onChange={(event) =>
                  setFeatures(
                    event.target.checked
                      ? [...features, value]
                      : features.filter((feature) => feature !== value)
                  )
                }
              />
              <span>{t(`atlas.features.options.${value}`)}</span>
            </label>
          ))}
        </div>
        {featureError ? (
          <p id={errorId} role="alert" className={styles.featureError}>
            {t("atlas.features.required")}
          </p>
        ) : null}
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.label}>
          {t("atlas.clarity")}{" "}
          <span className={styles.optional}>{t("optional")}</span>
        </legend>
        <div className={styles.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} data-selected={clarity === value}>
              <input
                type="radio"
                name="clarity"
                value={value}
                checked={clarity === value}
                onChange={() => setClarity(value)}
                aria-label={t("atlas.clarityScore", { value })}
              />
              {value}
            </label>
          ))}
        </div>
        <div className={styles.ratingLabels}>
          <span>{t("atlas.unclear")}</span>
          <span>{t("atlas.clear")}</span>
        </div>
      </fieldset>
    </>
  )
}
