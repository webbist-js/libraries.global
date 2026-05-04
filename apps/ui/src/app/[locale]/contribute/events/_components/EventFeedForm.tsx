"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

type ProviderType =
  | "eventbrite"
  | "meetup"
  | "ical_feed"
  | "json_api"
  | "ticketmaster"
  | "other"

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "eventbrite", label: "Eventbrite" },
  { value: "meetup", label: "Meetup" },
  { value: "ticketmaster", label: "Ticketmaster" },
  { value: "ical_feed", label: "iCal / .ics feed URL" },
  { value: "json_api", label: "Custom JSON API" },
  { value: "other", label: "Other" },
]

export function EventFeedForm() {
  const [form, setForm] = useState({
    libraryEntityRef: "",
    providerType: "" as ProviderType | "",
    feedUrl: "",
    notes: "",
    submittedByName: "",
    submittedByEmail: "",
  })
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")

  function set(key: keyof typeof form) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("submitting")

    const res = await fetch("/api/contribute/event-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    setStatus(res.ok ? "success" : "error")
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: T.font.mono,
    fontSize: "13px",
    background: T.bg.deep,
    border: `1px solid ${T.border.line}`,
    borderRadius: "8px",
    color: T.ink.base,
    padding: "10px 14px",
    width: "100%",
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: T.font.mono,
    fontSize: "9px",
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: T.ink.faint,
  }

  if (status === "success") {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border p-12 text-center"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <Icon
          icon="mdi:check-circle-outline"
          className="size-12"
          style={{ color: T.accent.ok }}
        />
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          Submission received.
        </p>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".12em",
            color: T.ink.faint,
          }}
        >
          We review all feed submissions within 48 hours. You will receive an
          email confirmation.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Library ref */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Library Entity Ref *</label>
        <input
          type="text"
          required
          placeholder="e.g. GB-BL-001"
          value={form.libraryEntityRef}
          onChange={set("libraryEntityRef")}
          style={inputStyle}
        />
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".1em",
            color: T.ink.faint,
          }}
        >
          Find your library&apos;s entity ref on its libraries.global page.
        </p>
      </div>

      {/* Provider type */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Event Platform *</label>
        <select
          required
          value={form.providerType}
          onChange={set("providerType")}
          style={inputStyle}
        >
          <option value="">Select platform…</option>
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Feed URL */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Feed URL / Organiser URL</label>
        <input
          type="url"
          placeholder="https://..."
          value={form.feedUrl}
          onChange={set("feedUrl")}
          style={inputStyle}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Additional notes</label>
        <textarea
          rows={3}
          placeholder="API keys, access requirements, scheduling preferences…"
          value={form.notes}
          onChange={set("notes")}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label style={labelStyle}>Your name *</label>
          <input
            type="text"
            required
            value={form.submittedByName}
            onChange={set("submittedByName")}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label style={labelStyle}>Email address *</label>
          <input
            type="email"
            required
            value={form.submittedByEmail}
            onChange={set("submittedByEmail")}
            style={inputStyle}
          />
        </div>
      </div>

      {status === "error" && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.accent.danger,
          }}
        >
          Submission failed — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)] disabled:opacity-60"
        style={{
          fontFamily: T.font.mono,
          background: "rgba(127,223,255,0.1)",
          border: "1px solid rgba(127,223,255,0.3)",
          color: T.accent.aurora,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        <Icon icon="mdi:send-outline" className="size-4" />
        {status === "submitting" ? "Submitting…" : "Submit feed"}
      </button>
    </form>
  )
}
