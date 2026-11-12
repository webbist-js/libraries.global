import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import {
  type ApplicationRole,
  ROLE_APPLICATION_COOLDOWN_DAYS,
} from "@/lib/role-application"

const POWERS = {
  wiki_editor: [
    { can: true, key: "publishKnowledge" },
    { can: true, key: "translateKnowledge" },
    { can: false, key: "noReview" },
    { can: false, key: "noRecords" },
  ],
  journal_editor: [
    { can: true, key: "publishJournal" },
    { can: true, key: "translateJournal" },
    { can: false, key: "noReview" },
    { can: false, key: "noRecords" },
  ],
  moderator: [
    { can: true, key: "review" },
    { can: true, key: "approve" },
    { can: true, key: "publishQueue" },
    { can: false, key: "noOwn" },
    { can: false, key: "noAppoint" },
  ],
} as const

const card = "rounded-[20px] p-5 sm:p-6"
const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}
const titleClass = "m-0 text-base font-semibold"

/**
 * The apply page's side column: what the chosen role can do, how
 * applications are reviewed, and the one role that isn't applied for here.
 */
export function RoleApplicationAside({
  role,
}: {
  readonly role: ApplicationRole
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()
  const tPower = useTranslations("rolePowers")

  return (
    <>
      <section
        aria-labelledby="apply-powers"
        className={card}
        style={cardStyle}
      >
        <h2
          id="apply-powers"
          className={`type-h2 ${titleClass}`}
          style={{ color: T.ink.base }}
        >
          {tPower(role)}
        </h2>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {POWERS[role].map((p) => (
            <li
              key={p.key}
              className="flex items-start gap-2.5 text-sm leading-[1.5]"
              style={{ color: T.ink.base }}
            >
              <Icon
                aria-hidden="true"
                icon={p.can ? "mdi:check" : "mdi:close"}
                width={18}
                height={18}
                className="mt-0.5 shrink-0"
                style={{ color: p.can ? T.accent.ok : T.accent.danger }}
              />
              <span>
                {tPower.rich(p.key, {
                  strong: (chunks) => (
                    <strong className="font-semibold">{chunks}</strong>
                  ),
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="apply-review"
        className={card}
        style={cardStyle}
      >
        <h2
          id="apply-review"
          className={`type-h2 ${titleClass}`}
          style={{ color: T.ink.base }}
        >
          {tStatic("contribute.how_applications_are_reviewed")}
        </h2>
        <ol
          className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm leading-[1.5]"
          style={{ color: T.ink.base }}
        >
          <li>
            {tPower(role === "moderator" ? "readsBoard" : "readsModerator")}
          </li>
          <li>
            {tPower.rich("question", {
              link: (chunks) => (
                <Link
                  href="/contribute/submissions"
                  className="underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  {chunks}
                </Link>
              ),
            })}
          </li>
          <li>
            {tPower("decision", { days: ROLE_APPLICATION_COOLDOWN_DAYS })}
          </li>
        </ol>
        <p
          className="mt-4 mb-0 text-sm leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {tStatic(
            "contribute.roles_are_never_bought_or_earned_through_points_api_access_and_sponsorship_don_t_affect_your_applica"
          )}
        </p>
      </section>

      <section
        aria-labelledby="apply-other"
        className="rounded-[20px] p-5 sm:p-6"
        style={{ background: T.bg.space, border: `1px solid ${T.border.line}` }}
      >
        <h2
          id="apply-other"
          className={`type-h2 ${titleClass}`}
          style={{ color: T.ink.base }}
        >
          {tStatic("contribute.looking_for_a_different_role")}
        </h2>
        <Link
          href="/contribute/claim"
          className="group mt-3 flex items-start gap-3 rounded-[14px] border-t pt-3 no-underline"
          style={{ borderColor: T.border.line, color: T.ink.base }}
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: T.bg.deep, color: T.accent.primary }}
          >
            <Icon icon="mdi:bank-outline" width={18} height={18} />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold group-hover:underline">
              {tExisting("staffOnboarding.eyebrow")}
            </span>
            <span
              className="text-sm leading-[1.5]"
              style={{ color: T.ink.dim }}
            >
              {tStatic(
                "contribute.verify_that_you_work_at_a_library_to_look_after_its_record"
              )}
            </span>
          </span>
        </Link>
      </section>
    </>
  )
}
