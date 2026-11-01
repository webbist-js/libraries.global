"use client"
import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { Badge, ChoiceCard, Sheet, Switch } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import { T } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { Link, useRouter } from "@/lib/navigation"
import type { StaffTeam } from "@/lib/staff/types"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { liveRequest } from "./ConfirmIdentity"
import { registerLiveIcons } from "./icons"

const card = "rounded-[24px] border p-5 sm:p-6"
const cardStyle = { background: T.bg.deep, borderColor: T.border.line }

/**
 * "Live sharing settings": allow live updates, who can go live, what the
 * public sees and the automatic stop. Owners change them; everyone reads.
 */
registerLiveIcons()

export function LiveSharingSettings({
  initial,
  owner,
  team,
  members,
  onNote,
}: {
  readonly initial: LiveSettingsResponse
  readonly owner: boolean
  /** The library is covered by a Team: per-person switches apply. */
  readonly team: boolean
  readonly members: StaffTeam
  readonly onNote: (note: { tone: "ok" | "danger"; text: string }) => void
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const id = initial.library.id,
    name = initial.library.name,
    [settings, setSettings] = useState(initial.settings),
    [busy, setBusy] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [accepted, setAccepted] = useState(false)
  const staffHref = useStaffLibraryHref(id)
  async function save(patch: Record<string, unknown>) {
    setBusy(true)
    try {
      const r = await liveRequest<LiveSettingsResponse>(
        `/api/mobile/${id}/live-settings`,
        patch,
        undefined,
        "PUT"
      )
      setSettings(r.settings)
      onNote({ tone: "ok", text: "Live sharing settings saved." })
      setPrivacy(false)
      setAccepted(false)
    } catch {
      onNote({
        tone: "danger",
        text: "The settings could not be saved. Check your access and try again.",
      })
    } finally {
      setBusy(false)
    }
  }
  const locked = !owner || busy

  return (
    <div className="flex flex-col gap-5">
      <section className={card} style={cardStyle}>
        <Switch
          label={`Allow live updates for ${name}`}
          description="When off, the library page always shows the timetable."
          checked={settings.enabled}
          disabled={locked}
          onChange={(value) => {
            if (value) setPrivacy(true)
            else void save({ enabled: false })
          }}
        />
        {!owner && (
          <p className="m-0 mt-2 text-sm" style={{ color: T.ink.dim }}>
            Only owners can change live sharing settings.
          </p>
        )}
      </section>

      <section
        className={card}
        style={cardStyle}
        aria-labelledby="who-can-go-live"
      >
        <h3
          id="who-can-go-live"
          className="type-small-heading m-0"
          style={{ color: T.ink.base }}
        >
          Who can go live
        </h3>
        {team ? (
          <>
            <p className="my-2 text-sm" style={{ color: T.ink.dim }}>
              Owners choose who can go live, person by person.{" "}
              <Badge
                label={tUi("team")}
                color="aurora"
                icon="mdi:account-group-outline"
              />
            </p>
            {owner ? (
              <ul className="m-0 mt-3 flex list-none flex-col p-0">
                {members.members.map((member) => (
                  <li
                    key={member.affiliationDocumentId}
                    className="border-t"
                    style={{ borderColor: T.border.divider }}
                  >
                    <Switch
                      label={member.name}
                      description={
                        member.staffRole
                          ? member.staffRole === "owner"
                            ? "Owner"
                            : "Editor"
                          : undefined
                      }
                      checked={member.canGoLive !== false}
                      disabled={busy}
                      onChange={async (value) => {
                        setBusy(true)
                        try {
                          const r = await fetch(
                            `/api/staff/${id}/team/members/${member.affiliationDocumentId}`,
                            {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ canGoLive: value }),
                            }
                          )
                          if (!r.ok)
                            throw new Error("Permission could not be saved")
                          onNote({
                            tone: "ok",
                            text: `${member.name} can ${value ? "now" : "no longer"} go live.`,
                          })
                          router.refresh()
                        } catch {
                          onNote({
                            tone: "danger",
                            text: "This permission could not be changed.",
                          })
                        } finally {
                          setBusy(false)
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm">
                Ask an owner to change who can go live.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="my-2 text-sm" style={{ color: T.ink.dim }}>
              Every verified staff member for this library can go live.
              Restrictions already set stay in force.
            </p>
            <p
              className="m-0 mt-3 flex items-start gap-2 rounded-[14px] px-4 py-3 text-sm"
              style={{ background: T.bg.surface, color: T.ink.dim }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:lock-outline"
                width={18}
                className="mt-0.5 shrink-0"
              />
              <span>
                With the Team plan, owners choose who can go live, person by
                person.{" "}
                <Link
                  href={staffHref("/team")}
                  className="font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  See the Team tab
                </Link>
              </span>
            </p>
          </>
        )}
      </section>

      <section className={card} style={cardStyle} aria-labelledby="public-sees">
        <h3
          id="public-sees"
          className="type-small-heading m-0"
          style={{ color: T.ink.base }}
        >
          What the public sees
        </h3>
        <fieldset className="m-0 mt-4 border-0 p-0" disabled={locked}>
          <legend className="sr-only">Position precision</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              name="precision"
              value="stops"
              checked={settings.precision === "stops"}
              onChange={() => save({ precision: "stops" })}
              icon="mdi:map-marker-outline"
              tint={{ bg: T.accent.chip, fg: T.accent.primary }}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  Stops only <Badge label={tUi("default")} color="dim" />
                </span>
              }
              hint="The public sees which stop the vehicle is at, and “On the road” between stops."
            />
            <ChoiceCard
              name="precision"
              value="approximate"
              checked={settings.precision === "approximate"}
              onChange={() => save({ precision: "approximate" })}
              icon="mdi:crosshairs-gps"
              tint={{ bg: T.accent.chip, fg: T.accent.primary }}
              title={tUi("approximate_position_between_stops")}
              hint="Shown as a circle about 250 m wide, a minute behind. Only when a crew member shares position."
            />
          </div>
        </fieldset>
        <label className="mt-5 flex flex-wrap items-center gap-3 text-base">
          Stop sharing automatically
          <SelectField
            label={tUi("minutes_after_the_last_stop")}
            className="min-h-11 rounded-[14px] border px-3"
            style={{ borderColor: T.border.hi, background: T.bg.deep }}
            value={String(settings.autoStopMinutes ?? "")}
            disabled={locked}
            onValueChange={(selectedValue) =>
              save({ autoStopMinutes: Number(selectedValue) })
            }
            options={[15, 30, 60].map((n) => ({
              value: String(n),
              label: String([n, "minutes"].join(" ")),
            }))}
          />
          after the last stop
        </label>
      </section>

      <Sheet
        open={privacy}
        onClose={() => setPrivacy(false)}
        side="right"
        title={tUi("allow_live_updates")}
      >
        <p>
          Staff can share check-ins from the vehicle. Approximate position, when
          enabled, is shown only between stops, rounded to about 250 m and a
          minute behind. Positions are removed when the route ends.
        </p>
        <label className="my-5 flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-(--t-accent-primary)"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I confirm the service allows its staff to share the vehicle’s
          position.
        </label>
        <button
          type="button"
          disabled={!accepted || busy}
          className="inline-flex min-h-11 items-center rounded-full bg-(--t-action-primary) px-5 font-semibold text-white transition-colors hover:bg-(--t-action-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => save({ enabled: true, privacyAccepted: true })}
        >
          {tUi("allow_live_updates")}
        </button>
      </Sheet>
    </div>
  )
}
