import admin from "./admin"
import contentApi from "./content-api"

export default {
  admin: {
    type: "admin",
    routes: admin,
  },
  "content-api": {
    type: "content-api",
    routes: contentApi,
  },
}
