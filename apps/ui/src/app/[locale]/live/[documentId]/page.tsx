import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { SignInForm } from "@/app/[locale]/auth/signin/_components/SignInForm"
import { LiveConsole } from "@/components/mobile/live/LiveConsole"
import { staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { Link } from "@/lib/navigation"
import { fetchStaff } from "@/lib/staff-proxy"

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ locale: string; documentId: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale, documentId } = await params
  if (!isDocumentIdParam(documentId)) notFound()
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    return (
      <div className="live-controls">
        <p className="mb-5">
          Sign in to open your mobile library’s live console.
        </p>
        <SignInForm returnTo={`/${locale}/live/${documentId}`} />
      </div>
    )
  const library = staffLibrariesOf(session.user).find(
    (l) => l.id === documentId && l.libraryType === "Mobile"
  )
  if (!library) notFound()
  const result = await fetchStaff<LiveSettingsResponse>(
    session.user,
    `libraries/${documentId}/live-settings`,
    "mobile-libraries"
  )
  if (result.status === 403 || result.status === 404) notFound()
  if (!result.body)
    return (
      <section className="live-controls">
        <h1
          className="my-3 text-[26px]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          {library.name}
        </h1>
        <p className="my-4">
          The live service is temporarily unavailable. Try again shortly.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* A plain GET form, so the retry works before the console's scripts load. */}
          <form action={`/${locale}/live/${documentId}`} method="get">
            <button
              className="live-button live-primary rounded-full"
              type="submit"
            >
              {tUi("try_again")}{" "}
            </button>
          </form>
          <Link className="live-button rounded-full" href="/live">
            Back to your libraries
          </Link>
        </div>
      </section>
    )

  return (
    <LiveConsole
      initial={result.body}
      locale={locale}
      role={library.role}
      canGoLive={library.canGoLive}
    />
  )
}
