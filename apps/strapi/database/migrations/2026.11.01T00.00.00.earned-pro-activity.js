"use strict"

// Replace the old tier-based 90-day holds with the latest real contribution +30d.
// No rollout-day grace: existing members are assessed against their recorded work.
const actions = [
  "new_library_approved",
  "edit_accepted_minor",
  "edit_accepted_major",
  "correction_approved",
  "claim_approved",
  "photo_licensed_cc",
  "hours_verified",
  "status_verified",
  "wiki_translated",
  "journal_accepted",
  "journal_edit_accepted",
  "journal_translated",
  "knowledge_article_published",
  "knowledge_edit_accepted",
  "source_added",
  "drive_task_accepted",
  "drive_proposal_accepted",
  "discussion_thread_accepted",
  "discussion_reply_accepted",
  "discussion_edit_accepted",
  "event_feed_accepted",
  "option_suggestion_accepted",
]
module.exports = {
  async up(knex) {
    if (!(await knex.schema.hasTable("user_profiles"))) return
    if (!(await knex.schema.hasTable("rw_point_events"))) return
    if (!(await knex.schema.hasColumn("user_profiles", "earned_pro_until")))
      return
    await knex.raw(
      `UPDATE user_profiles AS p SET earned_pro_until = (
      SELECT MAX(e.awarded_at) + INTERVAL '30 days' FROM rw_point_events e
      WHERE e.ba_user_id = p.ba_user_id AND e.points > 0
      AND e.action IN (${actions.map(() => "?").join(",")})
    )`,
      actions
    )
  },
  async down() {
    throw new Error(
      "Restore the pre-migration backup to reinstate tier-based earned Pro"
    )
  },
}
