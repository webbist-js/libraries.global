import { getTranslations } from "next-intl/server"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import { ConnectFeedForm } from "@/components/event-feeds/ConnectFeedForm"
import { withMessages } from "@/i18n/scoped-messages"
import { T } from "@/lib/design-tokens"
import { fetchEventFeedProviders } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"
import { loadStaffPage } from "@/lib/staff/server"

import { FeedsAside } from "../_components/FeedsAside"

export const metadata = privateMetadata("Connect a feed")

/**
 * Connect a new event feed to this library (the library is pre-selected).
 * Same two-column layout as the Event feeds tab, with the explainer aside;
 * the active tab above is the way back, so there is no back link.
 */
async function ConnectEventFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const tExisting = await getTranslations()

  const { slug } = await params
  const { user, overview, documentId } = await loadStaffPage(
    slug,
    await staffPathname()
  )
  const providers = await fetchEventFeedProviders(user)
  const oauth = providers.body?.data?.oauth ?? { eventbrite: false }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
      <div className="flex min-w-0 flex-col gap-6">
        <h2
          className="type-h2 m-0"
          style={{
            color: T.ink.base,
          }}
        >
          {tExisting("libraryPage.connectEvents")}
        </h2>
        <ConnectFeedForm
          libraries={[
            {
              documentId,
              name: overview.library.name,
              slug: overview.library.slug,
            },
          ]}
          initialLibrary={documentId}
          oauth={oauth}
        />
      </div>
      <FeedsAside />
    </div>
  )
}

export default withMessages(
  ConnectEventFeedPage,
  "[locale]/(dashboard)/staff/[slug]/events/connect/page"
)
