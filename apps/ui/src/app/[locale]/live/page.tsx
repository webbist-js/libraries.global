import { fromMinutes, localDateTime, scheduleState } from "@repo/shared-data"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { SignInForm } from "@/app/[locale]/auth/signin/_components/SignInForm"
import { staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { mobileAppConfig, mobilePath, mobileSignInHref } from "@/lib/mobile-app"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { Link } from "@/lib/navigation"
import { greetingFor, weekdayCopy } from "@/lib/staff/format"
import { staffLibraryHref } from "@/lib/staff/paths"
import { fetchStaff } from "@/lib/staff-proxy"

export default async function LiveEntry({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale } = await params
  const requestHeaders = await headers()
  const mobile = requestHeaders.get("x-mobile-app") === "true"
  const site = mobile
    ? `${mobileAppConfig()!.site.origin}${locale === "en" ? "" : `/${locale}`}`
    : ""
  const session = await getSessionSSR(requestHeaders)
  if (mobile && !session?.user)
    redirect(mobileSignInHref(mobilePath(undefined, locale)))
  if (!session?.user)
    return (
      <div className="live-controls">
        <p className="mb-5">
          Sign in to Libraries Global Live. Your route stays on this phone.
        </p>
        <SignInForm returnTo={`/${locale}/live`} />
      </div>
    )
  const libraries = staffLibrariesOf(session.user).filter(
    (l) => l.libraryType === "Mobile"
  )
  const rows = await Promise.all(
    libraries.map(async (l) => ({
      library: l,
      result: await fetchStaff<LiveSettingsResponse>(
        session.user,
        `libraries/${l.id}/live-settings`,
        "mobile-libraries"
      ),
    }))
  )

  // The greeting follows the clock where the vehicle is: the first library's
  // zone, else the server's.
  const zone = rows.find((r) => r.result.body)?.result.body?.library.timezone
  const now = new Date()
  const hour = zone
    ? Math.floor(localDateTime(now, zone).minute / 60)
    : now.getHours()
  /** "Next: Wednesday, 09:30" from the timetable when today has no service. */
  const nextCopy = (body: LiveSettingsResponse) => {
    if (!body.library.timetable) return "No service today."
    const local = localDateTime(now, body.library.timezone)
    const state = scheduleState(
      body.library.timetable,
      [],
      now,
      body.library.timezone
    )
    const next = "nextService" in state ? state.nextService : null

    return next
      ? `No service today. Next: ${weekdayCopy(next.date, local.date)}, ${next.arrive}. You can choose a swapped day in the console.`
      : "No service today. You can choose a swapped day in the console."
  }

  return (
    <>
      <header className="mb-6">
        <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
          Staff area · Your libraries
        </p>
        <h1
          className="my-3 text-[32px]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          {greetingFor(hour)}, {session.user.name.split(" ")[0]}.
        </h1>
        <p className="m-0" style={{ color: T.ink.dim }}>
          Choose the vehicle you’re running today.
        </p>
      </header>
      {!rows.length ? (
        <section>
          <h2
            className="text-2xl"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            You’re not set up to go live
          </h2>
          <p className="my-4">
            Claim your mobile library first. Once a Moderator approves the
            claim, an owner of the library can allow live updates.
          </p>
          <Link className="live-button rounded-full" href={`${site}/staff`}>
            Go to the Staff area
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {rows.map(({ library: l, result }) => (
            <section
              key={l.id}
              className="rounded-[20px] border p-5"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <p
                className="m-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                Mobile library
              </p>
              <h2
                className="my-2 text-2xl"
                style={{ fontFamily: T.font.serif }}
              >
                {l.name}
              </h2>
              <p className="my-3">
                {!result.body
                  ? "The live service is temporarily unavailable."
                  : !l.canGoLive
                    ? "The owner can turn on your permission to go live."
                    : !result.body.settings.enabled
                      ? "The owner needs to allow live updates."
                      : result.body.activeSession
                        ? `Live now, started by ${result.body.activeSession.startedByName ?? "Library staff"} at ${fromMinutes(localDateTime(new Date(result.body.activeSession.startedAt), result.body.library.timezone).minute)} · taking over stops the other phone’s updates.`
                        : result.body.route.length
                          ? `${result.body.route.length} stops · ${result.body.route[0]!.arrive}–${result.body.route.at(-1)!.depart}`
                          : nextCopy(result.body)}
              </p>
              <Link
                className={`live-button rounded-full ${l.canGoLive && result.body?.settings.enabled && !result.body.activeSession ? "live-primary" : ""}`}
                href={
                  l.canGoLive && result.body?.settings.enabled
                    ? mobile
                      ? `/${l.id}`
                      : `/live/${l.id}`
                    : `${site}${staffLibraryHref(l.slug, "/live")}`
                }
              >
                {result.body?.activeSession
                  ? "Take over"
                  : l.canGoLive && result.body?.settings.enabled
                    ? tUi("go_live")
                    : "Go to settings"}
              </Link>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-[13px]" style={{ color: T.ink.dim }}>
        Also on the library page, in the “You run this mobile library” card.
      </p>
      <Link className="live-button mt-4 rounded-full" href={`${site}/staff`}>
        {tUi("staff_area")}
      </Link>
    </>
  )
}
