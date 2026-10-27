"use client"

import { COMMUNITY_PALETTE, type ProfileBackground } from "@repo/shared-data"
import { useId } from "react"

import { T } from "@/lib/design-tokens"

export function ProfileAppearance({
  background,
  onBackgroundChange,
}: {
  background: ProfileBackground
  onBackgroundChange: (value: ProfileBackground) => void
}) {
  const id = useId()

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: T.border.line }}
    >
      <div>
        <h3 className="type-h3 m-0">Avatar colour</h3>
        <p
          id={`${id}-hint`}
          className="mt-1 mb-0 text-sm"
          style={{ color: T.ink.dim }}
        >
          Used behind your initials when you haven’t uploaded a photo. Saved
          with the rest of your profile.
        </p>
      </div>
      <fieldset aria-describedby={`${id}-hint`}>
        <legend className="mb-2 text-sm font-semibold">Colour palette</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COMMUNITY_PALETTE.map((choice) => (
            <label
              key={choice.key}
              className="relative flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary)"
              style={{
                background: choice.bg,
                color: choice.fg,
                borderColor:
                  background === choice.key ? choice.fg : "transparent",
              }}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${id}-avatar-colour`}
                value={choice.key}
                checked={background === choice.key}
                onChange={() => onBackgroundChange(choice.key)}
              />
              {background === choice.key ? (
                <span className="mr-1" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
