import { Icon } from "@iconify/react"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type ClaimableStaffLibrary = {
  documentId: string
  name: string
  slug: string
  entityRef?: string | null
  path?: string | null
}

/** Only public library identity is shown; no staff data is passed to this page. */
export function StaffAccessRequired({
  library,
  signedIn = false,
  returnTo = "/staff",
}: {
  readonly library?: ClaimableStaffLibrary
  readonly signedIn?: boolean
  readonly returnTo?: string
}) {
  const query = library
    ? new URLSearchParams({
        librarySlug: library.slug,
        libraryName: library.name,
        libraryDocumentId: library.documentId,
        ...(library.entityRef ? { libraryEntityRef: library.entityRef } : {}),
      })
    : null
  const claimHref = `/contribute/claim${query ? `?${query}` : ""}`
  const publicHref = library?.path ?? "/libraries"

  return (
    <>
      <PageHero
        compact
        eyebrow="Library staff"
        eyebrowIcon="mdi:shield-account-outline"
        title="Do you *work here?*"
        lead={
          library
            ? `The Staff area for ${library.name} is for verified library staff.`
            : "The Staff area is for verified library staff."
        }
      />
      <Container className="py-10">
        <section
          className="max-w-[640px] rounded-[20px] border p-6 sm:p-8"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
          aria-labelledby="claim-staff-access"
        >
          <h2
            id="claim-staff-access"
            className="m-0 text-[26px]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            Claim {library ? "this" : "your"} library
          </h2>
          <p className="mt-3 text-[16px]" style={{ color: T.ink.dim }}>
            If you work here, claim the library to keep its record up to date,
            manage event feeds and post notices. A moderator checks your claim
            before you get staff access.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href={
                signedIn
                  ? claimHref
                  : `/auth/signin?callbackUrl=${encodeURIComponent(claimHref)}`
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
            >
              Claim {library ? "this" : "your"} library
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
            </Link>
            <Link
              href={publicHref}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              style={{ color: T.accent.primary }}
            >
              {library ? "View the public library page" : "Browse libraries"}
            </Link>
          </div>
          <p className="mt-5 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            {signedIn ? (
              "Already submitted a claim? You’ll get access once it has been approved."
            ) : (
              <>
                Already verified?{" "}
                <Link
                  href={`/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`}
                  className="font-semibold underline underline-offset-4"
                  style={{ color: T.accent.primary }}
                >
                  Sign in to your staff account
                </Link>
                .
              </>
            )}
          </p>
        </section>
      </Container>
    </>
  )
}
