import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

// Anyone signed in can pitch; editors review. Journal editors apply in the app.
const JOURNAL_PITCH_HREF = "/contribute/knowledge?type=journal"
const JOURNAL_EDITOR_APPLY_HREF =
  "/contribute/knowledge/apply?role=journal_editor"

/** Journal counterpart of the Knowledge page's "Help write these articles". */
export function JournalWriteCta() {
  const t = useTranslations("editorial")

  return (
    <section
      aria-labelledby="journal-write-with-us"
      className="rounded-[20px] p-5"
      style={{ background: T.ink.base, color: "#fff" }}
    >
      <h2
        className="m-0 text-[21px]"
        id="journal-write-with-us"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        {t("pitchTitle")}
      </h2>
      <p
        className="mt-2 mb-0 text-[14px] leading-[1.55]"
        style={{ color: "rgba(255,255,255,.75)" }}
      >
        {t("pitchIntro")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <GlobalLink
          className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-semibold transition-opacity hover:opacity-90"
          href={JOURNAL_PITCH_HREF}
          style={{ background: "#fff", color: T.ink.base }}
        >
          {t("pitchStory")}
        </GlobalLink>
        <GlobalLink
          className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-white/10"
          href={JOURNAL_EDITOR_APPLY_HREF}
          style={{
            borderColor: "rgba(255,255,255,.35)",
            color: "#fff",
          }}
        >
          {t("applyEditor")}
        </GlobalLink>
      </div>
    </section>
  )
}

export default JournalWriteCta
