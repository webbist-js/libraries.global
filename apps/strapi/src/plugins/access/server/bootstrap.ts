/**
 * Registers the plugin's admin permissions (Settings → Roles → Plugins).
 * `manage-roles` moved here from content-moderation, which no longer
 * registers it.
 */
export async function registerPermissions(strapi: any): Promise<void> {
  await strapi.service("admin::permission").actionProvider.registerMany([
    {
      section: "plugins",
      displayName: "Manage people (contributor roles)",
      uid: "manage-roles",
      pluginName: "access",
    },
    {
      section: "plugins",
      displayName: "Manage teams",
      uid: "manage-teams",
      pluginName: "access",
    },
    {
      section: "plugins",
      displayName: "Manage plans",
      uid: "manage-plans",
      pluginName: "access",
    },
  ])
}
