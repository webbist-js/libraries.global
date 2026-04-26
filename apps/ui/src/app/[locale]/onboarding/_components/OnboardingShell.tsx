"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

import { OnboardingAffiliation } from "./OnboardingAffiliation"
import { OnboardingIdentity } from "./OnboardingIdentity"
import { OnboardingInterests } from "./OnboardingInterests"
import { OnboardingLinks } from "./OnboardingLinks"
import { OnboardingVisibility } from "./OnboardingVisibility"

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

const STEPS = ["Identity", "Affiliation", "Interests", "Links", "Visibility"]

export function OnboardingShell({
  sessionUser,
  initialProfile,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const saveSection = async (data: Partial<UserProfile>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) toast.error("Failed to save — your progress is not lost")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const advance = async (data?: Partial<UserProfile>) => {
    if (data) await saveSection(data)
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      router.push("/profile")
    }
  }

  const skip = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      router.push("/profile")
    }
  }

  const finishLater = async () => {
    router.push("/")
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 32px",
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          libraries.global / profile setup
        </span>
        <button
          type="button"
          onClick={() => void finishLater()}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: T.font.sans,
          }}
        >
          Finish later
        </button>
      </div>

      {/* Step progress */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "0 32px",
          marginTop: "24px",
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: "2px",
              borderRadius: "2px",
              background: i <= step ? T.accent.aurora : T.border.line,
              transition: "background 300ms",
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <div style={{ padding: "16px 32px 0" }}>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.accent.aurora,
          }}
        >
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </span>
      </div>

      {/* Step content */}
      <div
        style={{
          flex: 1,
          padding: "32px",
          maxWidth: "640px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {step === 0 && (
          <OnboardingIdentity
            sessionUser={sessionUser}
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 1 && (
          <OnboardingAffiliation
            sessionUser={sessionUser}
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 2 && (
          <OnboardingInterests
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 3 && (
          <OnboardingLinks
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
        {step === 4 && (
          <OnboardingVisibility
            initialProfile={initialProfile}
            saving={saving}
            onNext={(data) => void advance(data)}
            onSkip={skip}
          />
        )}
      </div>
    </div>
  )
}
