import type { Core } from "@strapi/strapi"

import { LOCATION_PICKER_FIELD_NAME } from "./customFields/locationPicker/shared"
import { OPENING_TIMES_FIELD_NAME } from "./customFields/openingTimes/shared"
import { registerChangeRecordsMiddleware } from "./documentMiddlewares/change-records"
import { registerAdminUserSubscriber } from "./lifeCycles/adminUser"
import { registerEntityRefSubscriber } from "./lifeCycles/entityRef"
import { registerRoleGrantSubscriber } from "./lifeCycles/roleGrant"
import { registerUserSubscriber } from "./lifeCycles/user"
import { seedDatasets } from "./seeds/datasets"
import { seedLegalDocuments } from "./seeds/legal-documents"
import { ensureHotPathIndexes } from "./utils/ensure-hot-path-indexes"
import { ensureUniqueIndexes } from "./utils/ensure-unique-indexes"
import { backfillLibraryCompleteness } from "./utils/library-completeness"
import { migrateContributorRolesToGrants } from "./utils/role-grants"

const SEED_TOPICS = [
  "Rare Books",
  "Manuscripts",
  "Digital Libraries",
  "Open Access",
  "Archival Science",
  "Cataloguing",
  "Library History",
  "Conservation",
  "Information Science",
  "Academic Libraries",
  "Public Libraries",
  "National Libraries",
  "Special Collections",
  "Interlibrary Loan",
  "Reference Services",
  "Library Architecture",
  "Metadata",
  "Linked Data",
  "Library Law",
  "Accessibility",
  "Indigenous Knowledge",
  "Children's Libraries",
  "Mobile Libraries",
  "Prison Libraries",
  "Hospital Libraries",
]

async function seedTopics(strapi: Core.Strapi) {
  for (const name of SEED_TOPICS) {
    const existing = await strapi
      .documents("api::topic.topic" as any)
      .findFirst({ filters: { name } } as any)
    if (!existing) {
      const slug = name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-|-$/g, "")
      await strapi
        .documents("api::topic.topic" as any)
        .create({ data: { name, slug, status: "approved" } })
    }
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: LOCATION_PICKER_FIELD_NAME,
      type: "json",
    })
    strapi.customFields.register({
      name: OPENING_TIMES_FIELD_NAME,
      type: "json",
    })
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    registerAdminUserSubscriber({ strapi })
    registerUserSubscriber({ strapi })
    registerEntityRefSubscriber({ strapi })
    registerRoleGrantSubscriber({ strapi })
    // Change Records / Article Changes: audit every library and article write.
    registerChangeRecordsMiddleware({ strapi })

    // Seed approved topics (idempotent — skips existing names)
    await seedTopics(strapi)

    // Draft legal documents with placeholder copy on first boot (idempotent)
    await seedLegalDocuments(strapi)

    // Provenance registry for imported datasets (idempotent, by key)
    await seedDatasets(strapi)

    // I2 fresh-DB follow-up: re-ensure the unique indexes the migration
    // creates, in case this is a first deploy where the migration ran
    // before schema sync created the tables. See ensure-unique-indexes.ts.
    await ensureUniqueIndexes(strapi)

    // E1 fresh-DB follow-up for the hot-path indexes migration, same reason.
    await ensureHotPathIndexes(strapi)

    // One-off: store `completeness` on every library row that lacks it
    // (the lifecycle keeps it current from here on).
    await backfillLibraryCompleteness(strapi)

    // One-off: back-fill Role Grants from the legacy contributorRole enum
    // (core-store guarded). A failure is logged and never blocks boot.
    try {
      await migrateContributorRolesToGrants(strapi)
    } catch (err) {
      strapi.log.error("[role-grants] Contributor role migration failed:", err)
    }

    // Accounts are owned by Better Auth; Strapi users are created only via the
    // auth-bridge. Keep users-permissions self-registration off everywhere so
    // nobody can mint a Strapi JWT by POSTing to /api/auth/local/register.
    await disableUsersPermissionsRegistration(strapi)
  },
}

async function disableUsersPermissionsRegistration(strapi: Core.Strapi) {
  const store = strapi.store({
    type: "plugin",
    name: "users-permissions",
    key: "advanced",
  })
  const advanced = ((await store.get()) ?? {}) as Record<string, unknown>
  if (advanced.allow_register !== false) {
    await store.set({ value: { ...advanced, allow_register: false } })
    strapi.log.info("[security] Disabled users-permissions self-registration")
  }
}
