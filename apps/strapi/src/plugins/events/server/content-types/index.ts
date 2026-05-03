import eventSchema from "./event/schema.json"
import eventCredentialSchema from "./event-credential/schema.json"
import importRunSchema from "./import-run/schema.json"
import syncCommandSchema from "./sync-command/schema.json"

export default {
  "event-credential": { schema: eventCredentialSchema },
  event: { schema: eventSchema },
  "import-run": { schema: importRunSchema },
  "sync-command": { schema: syncCommandSchema },
}
