import admin from "./admin"
import contentApi from "./content-api"

export default {
  "content-api": { type: "content-api", routes: contentApi },
  admin: { type: "admin", routes: admin },
}
