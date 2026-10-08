/** New taxonomy entries, created only when absent; existing editorial text is preserved. */
export async function seedMobileFacilities(strapi: any): Promise<void> {
  for (const name of [
    "Step-free lift",
    "Low-height shelves",
    "Wheelchair space inside",
  ]) {
    const uid = "api::accessibility.accessibility"
    const found = await strapi
      .documents(uid)
      .findFirst({ filters: { name }, fields: ["documentId"] })
    if (!found)
      await strapi
        .documents(uid)
        .create({ status: "published", data: { name, category: "Mobility" } })
  }
}
