import type { Core } from "@strapi/strapi"

/** The native request context accepted by Strapi controllers and policies. */
export type AuthRequestContext = Parameters<Core.Controller[string]>[0]
