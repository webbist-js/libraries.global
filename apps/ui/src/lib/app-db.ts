import "server-only"
import { Pool } from "pg"

const state = globalThis as typeof globalThis & { _applicationPool?: Pool }

export const appDbPool =
  state._applicationPool ??
  new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== "production") state._applicationPool = appDbPool
