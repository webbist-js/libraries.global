"use strict"

module.exports = {
  async up(knex) {
    await require("./shared/atlas-analysis-grants")(knex)
  },
  async down() {},
}
