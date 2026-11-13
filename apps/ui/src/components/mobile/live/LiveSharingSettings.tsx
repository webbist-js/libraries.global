"use client"
import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
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
  /** The library is in a team workspace: per-person switches apply. */
  readonly team: boolean
  readonly members: StaffTeam
  readonly onNote: (note: { tone: "ok" | "danger"; text: string }) => void
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

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
      onNote({
        tone: "ok",
        text: tStatic("mobile.live_sharing_settings_saved"),
      })
      setPrivacy(false)
      setAccepted(false)
    } catch {
      onNote({
        tone: "danger",
        text: tStatic(
          "mobile.the_settings_could_not_be_saved_check_your_access_and_try_again"
        ),
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
          description={tStatic(
            "mobile.when_off_the_library_page_always_shows_the_timetable"
          )}
          checked={settings.enabled}
          disabled={locked}
          onChange={(value) => {
            if (value) setPrivacy(true)
            else void save({ enabled: false })
          }}
        />
        {!owner && (
          <p className="m-0 mt-2 text-sm" style={{ color: T.ink.dim }}>
            {tStatic("mobile.only_owners_can_change_live_sharing_settings")}
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
          {tStatic("mobile.who_can_go_live")}
        </h3>
        {team ? (
          <>
            <p className="my-2 text-sm" style={{ color: T.ink.dim }}>
              {tStatic("mobile.owners_choose_who_can_go_live_person_by_person")}{" "}
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
                            ? tExisting("teamInvitation.owner")
                            : tExisting("authorBadges.editor")
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
                            text: tStatic(
                              "mobile.this_permission_could_not_be_changed"
                            ),
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
                {tStatic("mobile.ask_an_owner_to_change_who_can_go_live")}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="my-2 text-sm" style={{ color: T.ink.dim }}>
              {tStatic(
                "mobile.every_verified_staff_member_for_this_library_can_go_live_restrictions_already_set_stay_in_force"
              )}
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
                {tStatic(
                  "mobile.in_a_free_team_workspace_owners_choose_who_can_go_live_person_by_person"
                )}{" "}
                <Link
                  href={staffHref("/team")}
                  className="font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  {tStatic("mobile.see_the_team_tab")}
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
          {tStatic("mobile.what_the_public_sees")}
        </h3>
        <fieldset className="m-0 mt-4 border-0 p-0" disabled={locked}>
          <legend className="sr-only">
            {tStatic("mobile.position_precision")}
          </legend>
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
                  {tStatic("mobile.stops_only")}{" "}
                  <Badge label={tUi("default")} color="dim" />
                </span>
              }
              hint={tStatic(
                "mobile.the_public_sees_which_stop_the_vehicle_is_at_and_on_the_road_between_stops"
              )}
            />
            <ChoiceCard
              name="precision"
              value="approximate"
              checked={settings.precision === "approximate"}
              onChange={() => save({ precision: "approximate" })}
              icon="mdi:crosshairs-gps"
              tint={{ bg: T.accent.chip, fg: T.accent.primary }}
              title={tUi("approximate_position_between_stops")}
              hint={tStatic(
                "mobile.shown_as_a_circle_about_250_m_wide_a_minute_behind_only_when_a_crew_member_shares_position"
              )}
            />
          </div>
        </fieldset>
        <label className="mt-5 flex flex-wrap items-center gap-3 text-base">
          {tStatic("mobile.stop_sharing_automatically")}
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
          {tStatic(
            "mobile.staff_can_share_check_ins_from_the_vehicle_approximate_position_when_enabled_is_shown_only_between_s"
          )}
        </p>
        <label className="my-5 flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-(--t-accent-primary)"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          {tStatic(
            "mobile.i_confirm_the_service_allows_its_staff_to_share_the_vehicle_s_position"
          )}
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
