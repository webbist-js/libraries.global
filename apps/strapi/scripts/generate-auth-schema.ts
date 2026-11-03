/** Generate the adapter schema without booting Strapi or touching a database. */
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { getAuthTables } from "better-auth/db"

async function main() {
  // Configuration-only placeholders. No network connection is made.
  process.env.BETTER_AUTH_SECRET ??=
    "schema-generation-placeholder-not-a-runtime-secret"
  process.env.APPLICATION_DATABASE_URL ??=
    "postgres://localhost/schema_generation_only"
  const { auth } = await import("../src/auth/config")
  const tables = getAuthTables(auth.options)
  const kebab = (name: string) =>
    name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  for (const [model, table] of Object.entries(tables)) {
    if (table.disableMigrations) continue
    const singularName = kebab(model)
    const attributes: Record<string, any> = {}
    for (const [key, field] of Object.entries(table.fields)) {
      if (["id", "createdAt", "updatedAt"].includes(key)) continue
      const name = field.fieldName ?? key
      let type = Array.isArray(field.type)
        ? "enumeration"
        : (
            {
              string: "text",
              number: "integer",
              boolean: "boolean",
              date: "datetime",
              json: "json",
              "string[]": "json",
              "number[]": "json",
            } as Record<string, string>
          )[String(field.type)]
      if (field.references?.field === "id") type = "integer"
      if (name === "email") type = "email"
      if (name === "name") type = "string"
      // PostgreSQL int4 cannot hold epoch milliseconds. Adapter returns a number.
      if (
        field.bigint ||
        (model === "rateLimit" && name === "lastRequest") ||
        (model === "passkey" && name === "counter")
      )
        type = "biginteger"
      attributes[name] = {
        type,
        private: true,
        configurable: false,
        pluginOptions: { "better-auth": { managed: true } },
        ...(field.required ? { required: true } : {}),
        ...(field.unique ? { unique: true } : {}),
        ...(Array.isArray(field.type) ? { enum: field.type } : {}),
        ...(field.defaultValue !== undefined &&
        typeof field.defaultValue !== "function"
          ? { default: field.defaultValue }
          : {}),
      }
    }
    const directory = path.resolve(
      __dirname,
      "../src/extensions/better-auth/content-types",
      singularName
    )
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      path.resolve(directory, "schema.json"),
      JSON.stringify(
        {
          kind: "collectionType",
          collectionName: `ba_${kebab(table.modelName ?? model).replaceAll("-", "_")}`,
          info: {
            singularName,
            pluralName: `${singularName}s`,
            displayName: `Auth ${model}`,
          },
          options: { draftAndPublish: false },
          pluginOptions: {
            "content-manager": { visible: model === "user" },
            "content-type-builder": { visible: false },
          },
          attributes,
        },
        null,
        2
      ) + "\n"
    )
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
