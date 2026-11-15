import type { Capability } from "@repo/access"
import type { useTranslations } from "next-intl"

import { editorApplyHref, isArticleEditor } from "@/lib/editor-gate"

import type { ArticleKind } from "./article-editor/article.types"
import type { ActionId } from "./wizard.logic"

type ActionTranslate = ReturnType<typeof useTranslations<"contributeActions">>

/** The chooser's two groups: quick record edits, and longer written pieces. */
export type ActionGroup = "index" | "write"

export function createActionGroups(t: ActionTranslate): readonly {
  id: ActionGroup
  icon: string
  title: string
  subtitle: string
}[] {
  return [
    {
      id: "index",
      icon: "mdi:bank-outline",
      title: t("improve_the_index"),
      subtitle: t("library_records_quick_edits"),
    },
    {
      id: "write",
      icon: "mdi:pencil-outline",
      title: t("write_for_the_community"),
      subtitle: t("longer_pieces"),
    },
  ]
}

export type ActionMeta = {
  id: ActionId
  group: ActionGroup
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  minutes: number
  /** Extra line after the time, e.g. that it leaves the hub. */
  note?: string
  /** One line of advice under the wizard's step rail. */
  tip: string
  /** Set for actions that open a full editor instead of the wizard. */
  handoff?: { href: string; blurb: string; cta: string; heading?: string }
  /**
   * The handoff opens the Knowledge editor, which needs this kind's editor
   * role. Everyone else is sent to the role application with this copy.
   */
  editorsOnly?: {
    kind: ArticleKind
    note: string
    heading: string
    blurb: string
    cta: string
  }
}

export function createActions(t: ActionTranslate): readonly ActionMeta[] {
  return [
    {
      id: "add",
      group: "index",
      tip: t(
        "search_first_improving_a_record_that_s_already_there_beats_adding_a_duplicate"
      ),
      icon: "mdi:plus",
      tintBg: "var(--t-palette-amber-bg)",
      tintFg: "var(--t-palette-amber-fg)",
      title: t("add_a_missing_library"),
      description: t(
        "a_library_that_isn_t_in_the_index_yet_anywhere_in_the_world"
      ),
      minutes: 5,
      note: t("opens_the_full_form"),
      handoff: {
        href: "/contribute/index/new",
        blurb: t(
          "a_new_record_starts_in_the_guided_form_name_and_place_opening_hours_then_your_sources_it_s"
        ),
        cta: t("open_the_full_form"),
      },
    },
    {
      id: "correction",
      group: "index",
      tip: t("multiple_changes_per_suggestion_makes_it_quicker_to_review"),
      icon: "mdi:pencil-outline",
      tintBg: "var(--t-accent-chip)",
      tintFg: "var(--t-accent-primary)",
      title: t("suggest_a_correction"),
      description: t(
        "opening_hours_address_accessibility_or_anything_out_of_date"
      ),
      minutes: 2,
    },
    {
      id: "photo",
      group: "index",
      tip: t(
        "only_share_photos_you_took_or_that_already_carry_an_open_licence"
      ),
      icon: "mdi:camera-outline",
      tintBg: "var(--tint-public-bg)",
      tintFg: "var(--tint-public-fg)",
      title: t("share_a_photo"),
      description: t(
        "a_photo_you_took_or_have_permission_to_share_under_an_open_licence"
      ),
      minutes: 3,
    },
    {
      id: "source",
      group: "index",
      tip: t("a_link_to_the_library_s_own_page_is_the_strongest_source"),
      icon: "mdi:link-variant",
      tintBg: "var(--tint-national-bg)",
      tintFg: "var(--tint-national-fg)",
      title: t("add_a_source"),
      description: t("a_reference_that_backs_up_details_already_in_a_record"),
      minutes: 2,
    },
    {
      id: "journal",
      group: "write",
      tip: t(
        "editors_may_suggest_changes_before_a_piece_is_published_you_re_credited_either_way"
      ),
      icon: "mdi:newspaper-variant-outline",
      tintBg: "var(--tint-special-bg)",
      tintFg: "var(--tint-special-fg)",
      title: t("write_for_the_journal"),
      description: t(
        "a_story_profile_or_essay_about_a_library_its_collections_or_its_people"
      ),
      minutes: 20,
      note: t("opens_the_article_editor"),
      handoff: {
        href: "/contribute/knowledge/new?type=journal",
        blurb: t(
          "journal_pieces_are_written_in_the_article_editor_a_title_a_short_summary_then_the_body_dra"
        ),
        cta: t("start_a_journal_article"),
      },
      editorsOnly: {
        kind: "journal",
        note: t("opens_the_editor_application"),
        heading: t("apply_to_write_for_the_journal"),
        blurb: t(
          "journal_pieces_are_written_by_journal_editors_apply_to_become_one_say_what_you_d_like_to_w"
        ),
        cta: t("apply_to_be_a_journal_editor"),
      },
    },
    {
      id: "knowledge",
      group: "write",
      tip: t(
        "translations_are_welcome_pick_a_page_then_choose_the_language_you_re_writing_in"
      ),
      icon: "mdi:book-open-page-variant-outline",
      tintBg: "var(--tint-academic-bg)",
      tintFg: "var(--tint-academic-fg)",
      title: t("improve_the_knowledge_base"),
      description: t(
        "edit_a_knowledge_page_write_a_new_guide_or_translate_one"
      ),
      minutes: 10,
      note: t("opens_the_knowledge_editor"),
      handoff: {
        href: "/contribute/knowledge",
        blurb: t(
          "pick_a_knowledge_page_to_improve_or_translate_or_start_a_new_guide_changes_go_to_review_be"
        ),
        cta: t("open_the_knowledge_editor"),
      },
      editorsOnly: {
        kind: "knowledge",
        note: t("opens_the_editor_application"),
        heading: t("apply_to_edit_the_knowledge_base"),
        blurb: t(
          "knowledge_pages_are_written_and_translated_by_knowledge_editors_spotted_a_mistake_use_repo"
        ),
        cta: t("apply_to_be_a_knowledge_editor"),
      },
    },
  ]
}

export function actionMeta(id: ActionId, t: ActionTranslate): ActionMeta {
  return createActions(t).find((a) => a.id === id)!
}

/**
 * `actionMeta` for this viewer: an editors-only handoff sends anyone
 * without that editor role to the role application instead. UI only; the
 * editor pages redirect too.
 */
export function actionFor(
  id: ActionId,
  has: (cap: Capability) => boolean,
  t: ActionTranslate
): ActionMeta {
  const meta = actionMeta(id, t)
  const gate = meta.editorsOnly
  if (!gate || !meta.handoff || isArticleEditor(has, gate.kind)) return meta

  return {
    ...meta,
    note: gate.note,
    handoff: {
      href: editorApplyHref(gate.kind),
      heading: gate.heading,
      blurb: gate.blurb,
      cta: gate.cta,
    },
  }
}
