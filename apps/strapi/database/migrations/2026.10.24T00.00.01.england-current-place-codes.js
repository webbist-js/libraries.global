"use strict"

/** Current directory placement and historical population reporting are distinct. */
module.exports = {
  async up(knex) {
    for (const [name, before, after] of [
      ["Barnsley", "E08000016", "E08000038"],
      ["Sheffield", "E08000019", "E08000039"],
    ]) {
      const rows = await knex("areas as a")
        .join("areas_country_lnk as l", "l.area_id", "a.id")
        .join("countries as c", "c.id", "l.country_id")
        .where("c.iso_2", "GB-ENG")
        .where("a.name", name)
        .where("a.gss_code", before)
        .select("a.document_id")
        .distinct()
      if (rows.length > 1)
        throw new Error(`Ambiguous current England place: ${name}`)
      if (rows.length)
        await knex("areas")
          .where("document_id", rows[0].document_id)
          .where("gss_code", before)
          .update({ gss_code: after })
    }
  },
  async down() {},
}
