// apps/sync-worker/src/index.ts
import "dotenv/config"
import { registerCronJobs } from "./cron"
import { startHealthServer } from "./server"

const port = Number(process.env.WORKER_PORT ?? "3100")

startHealthServer(port)
registerCronJobs()

console.log(`[worker] Sync worker started. Port: ${port}`)
