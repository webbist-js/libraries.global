"use client"

import { EVENT_PROVIDERS, type EventProviderKey } from "@repo/shared-data"
import { useId, useState } from "react"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "@/app/[locale]/contribute/index/_components/wizard.constants"
import { T } from "@/lib/design-tokens"

/** One provider's fields from the registry. Secrets are write-only inputs. */
export function FeedValuesFields({
  provider,
  values,
  onChange,
  currentHints,
  errorField,
}: {
  readonly provider: EventProviderKey
  readonly values: Record<string, string>
  readonly onChange: (next: Record<string, string>) => void
  readonly currentHints?: Record<string, string>
  readonly errorField?: string
}) {
  const id = useId()
  const [shown, setShown] = useState<Record<string, boolean>>({})

  return (
    <div className="flex flex-col gap-5">
      {EVENT_PROVIDERS[provider].fields.map((f) => {
        const inputId = `${id}-${f.key}`
        const hintId = `${inputId}-hint`
        const currentHint = currentHints?.[f.key]
        const hasHint = Boolean(f.hint || currentHint)

        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} style={fieldLabelStyle}>
              {f.label}
              {f.required ? null : (
                <span style={{ color: T.ink.dim, fontWeight: 400 }}>
                  {" "}
                  (optional)
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={inputId}
                name={f.key}
                type={
                  f.secret && !shown[f.key]
                    ? "password"
                    : f.kind === "url"
                      ? "url"
                      : "text"
                }
                autoComplete={f.secret ? "new-password" : "off"}
                data-1p-ignore={f.secret || undefined}
                data-lpignore={f.secret ? "true" : undefined}
                spellCheck={false}
                data-sentry-mask
                aria-describedby={hasHint ? hintId : undefined}
                aria-invalid={errorField === f.key || undefined}
                placeholder={currentHint ? `Now: ${currentHint}` : undefined}
                value={values[f.key] ?? ""}
                maxLength={f.maxLength}
                onChange={(e) =>
                  onChange({ ...values, [f.key]: e.target.value })
                }
                style={{ ...fieldInputStyle, flex: 1 }}
              />
              {f.secret ? (
                <button
                  type="button"
                  className="rounded-full border px-3 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: T.border.hi,
                    color: T.ink.base,
                    background: T.bg.deep,
                  }}
                  aria-label={`${shown[f.key] ? "Hide" : "Show"} ${f.label}`}
                  aria-pressed={!!shown[f.key]}
                  onClick={() =>
                    setShown((s) => ({ ...s, [f.key]: !s[f.key] }))
                  }
                >
                  {shown[f.key] ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
            {hasHint ? (
              <p id={hintId} style={fieldHintStyle}>
                {f.hint}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
