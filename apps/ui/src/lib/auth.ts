import "server-only"

// Authentication is hosted by Strapi. Next owns only the transport and application data.
export { authGateway as auth } from "./auth-gateway"
export type { Session } from "./auth-contract"
export { appDbPool as authDbPool } from "./app-db"
