import { Notice, PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { Link } from "@/lib/navigation"

/** Older accounts must be reconciled explicitly before using the single-Team workspace. */
export function TeamMembershipConflict() {
  return (
    <>
      <PageHero
        staff
        eyebrow="Team membership"
        title="Let’s confirm your Team"
        lead="Your account has more than one existing Team membership."
      />
      <Container className="py-10">
        <Notice
          icon="mdi:account-alert-outline"
          title="A membership check is needed"
          tone="warn"
        >
          <p>
            Each account now belongs to one Team. Contact us to choose which
            membership to keep. We’ll check billing and Library assignments
            before changing your access.
          </p>
          <Link
            href="/contact"
            className="font-semibold underline underline-offset-4"
          >
            Contact the site team
          </Link>
        </Notice>
      </Container>
    </>
  )
}
