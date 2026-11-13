import { useTranslations } from "next-intl"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Notice } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { Link } from "@/lib/navigation"

/** Older accounts must be reconciled explicitly before using the single-Team workspace. */
export function TeamMembershipConflict() {
  const tStatic = useTranslations("staticUi")

  return (
    <>
      <WorkspacePageHeader
        title={tStatic("staff.let_s_confirm_your_team")}
        lead={tStatic(
          "staff.your_account_has_more_than_one_existing_team_membership"
        )}
      />
      <Container className="py-10">
        <Notice
          icon="mdi:account-alert-outline"
          title={tStatic("staff.a_membership_check_is_needed")}
          tone="warn"
        >
          <p>
            {tStatic(
              "staff.each_account_now_belongs_to_one_team_contact_us_to_choose_which_membership_to_keep_we_ll_check_your_"
            )}
          </p>
          <Link
            href="/contact"
            className="font-semibold underline underline-offset-4"
          >
            {tStatic("common.contactSiteTeam")}
          </Link>
        </Notice>
      </Container>
    </>
  )
}
