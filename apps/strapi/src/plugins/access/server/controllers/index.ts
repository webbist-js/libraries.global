import apiAccounts from "./api-accounts"
import apiData from "./api-data"
import apiResources from "./api-resources"
import networks from "./networks"
import people from "./people"
import teamApi from "./team-api"
import teams from "./teams"
import widgets from "./widgets"

export default {
  networks,
  widgets,
  people,
  teams,
  "team-api": teamApi,
  "api-data": apiData,
  "api-accounts": apiAccounts,
  "api-resources": apiResources,
}
