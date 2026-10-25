"use strict"

/** Match existing Atlas writers; never grant CMS access or assume a role name. */
module.exports = async function grantAnalysisWriters(knex) {
  await knex.raw(`DO $$ DECLARE writer RECORD; BEGIN
    FOR writer IN
      SELECT grantee FROM information_schema.role_table_grants
      WHERE table_schema = current_schema() AND table_name = 'atlas_records'
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE') AND grantee <> 'PUBLIC'
      GROUP BY grantee HAVING count(DISTINCT privilege_type) = 3
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON atlas_analysis_jobs, atlas_analysis_budgets TO %I', writer.grantee);
    END LOOP;
  END $$;`)
}
