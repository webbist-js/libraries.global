import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import {
  type ApplicationRole,
  ROLE_APPLICATION_COOLDOWN_DAYS,
} from "@/lib/role-application"

type Power = { can: boolean; lead: string; rest: string }

const POWERS: Record<ApplicationRole, Power[]> = {
  wiki_editor: [
    {
      can: true,
      lead: "Publish",
      rest: "approved new and edited Knowledge pages in your permitted languages.",
    },
    {
      can: true,
      lead: "Translate",
      rest: "pages into the languages you choose.",
    },
    {
      can: false,
      lead: "Not",
      rest: "review other people’s suggestions; moderators do that.",
    },
    {
      can: false,
      lead: "Not",
      rest: "edit library records directly. Those still go through review.",
    },
  ],
  journal_editor: [
    {
      can: true,
      lead: "Publish",
      rest: "approved new and edited Journal articles in your permitted languages.",
    },
    {
      can: true,
      lead: "Translate",
      rest: "articles into the languages you choose.",
    },
    {
      can: false,
      lead: "Not",
      rest: "review other people’s suggestions; moderators do that.",
    },
    {
      can: false,
      lead: "Not",
      rest: "edit library records directly. Those still go through review.",
    },
  ],
  moderator: [
    {
      can: true,
      lead: "Review",
      rest: "submissions in the queue and languages you choose.",
    },
    {
      can: true,
      lead: "Approve,",
      rest: "reject or ask for changes, always with a reason.",
    },
    {
      can: true,
      lead: "Publish",
      rest: "approved Knowledge or Journal suggestions in your queue.",
    },
    { can: false, lead: "Not", rest: "review your own submissions." },
    { can: false, lead: "Not", rest: "appoint other moderators." },
  ],
}

const ROLE_NOUN: Record<ApplicationRole, string> = {
  wiki_editor: "knowledge editor",
  journal_editor: "journal editor",
  moderator: "moderator",
}

const card = "rounded-[20px] p-5 sm:p-6"
const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}
const titleClass = "m-0 text-[16px] font-semibold"

/**
 * The apply page's side column: what the chosen role can do, how
 * applications are reviewed, and the one role that isn't applied for here.
 */
export function RoleApplicationAside({
  role,
}: {
  readonly role: ApplicationRole
}) {
  const tUi = useUiTranslations("ui")

  const reviewer = role === "moderator" ? "The editorial board" : "A moderator"

  return (
    <>
      <section
        aria-labelledby="apply-powers"
        className={card}
        style={cardStyle}
      >
        <h2
          id="apply-powers"
          className={titleClass}
          style={{ color: T.ink.base }}
        >
          What a {ROLE_NOUN[role]} can do
        </h2>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {POWERS[role].map((p) => (
            <li
              key={`${p.lead}${p.rest}`}
              className="flex items-start gap-2.5 text-[14.5px] leading-[1.5]"
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
                <strong className="font-semibold">{p.lead}</strong> {p.rest}
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
          className={titleClass}
          style={{ color: T.ink.base }}
        >
          How applications are reviewed
        </h2>
        <ol
          className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14.5px] leading-[1.5]"
          style={{ color: T.ink.base }}
        >
          <li>{reviewer} reads your application and accepted changes.</li>
          <li>
            They may ask a question in{" "}
            <Link
              href="/contribute/submissions"
              className="underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              {tUi("my_submissions")}{" "}
            </Link>
            .
          </li>
          <li>
            You get a decision with a reason. If it’s a no, you can apply again
            after {ROLE_APPLICATION_COOLDOWN_DAYS} days.
          </li>
        </ol>
        <p
          className="mt-4 mb-0 text-[13.5px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          Roles are never bought or earned through points. Paid membership
          doesn’t affect your application.
        </p>
      </section>

      <section
        aria-labelledby="apply-other"
        className="rounded-[20px] p-5 sm:p-6"
        style={{ background: T.bg.space, border: `1px solid ${T.border.line}` }}
      >
        <h2
          id="apply-other"
          className={titleClass}
          style={{ color: T.ink.base }}
        >
          Looking for a different role?
        </h2>
        <Link
          href="/contribute/index?intent=claim"
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
            <span className="text-[15px] font-semibold group-hover:underline">
              Library staff
            </span>
            <span
              className="text-[14px] leading-[1.5]"
              style={{ color: T.ink.dim }}
            >
              Verify that you work at a library to look after its record.
            </span>
          </span>
        </Link>
      </section>
    </>
  )
}
