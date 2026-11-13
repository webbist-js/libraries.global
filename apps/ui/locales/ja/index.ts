// Generated from CATALOGUE_FILES in ../catalogue.ts. Keep the two lists in step.
import { mergeCatalogue } from "../catalogue"

import about from "./about.json"
import articles from "./articles.json"
import atlas from "./atlas.json"
import auth from "./auth.json"
import beta from "./beta.json"
import common from "./common.json"
import community from "./community.json"
import contact from "./contact.json"
import contribute from "./contribute.json"
import developers from "./developers.json"
import events from "./events.json"
import home from "./home.json"
import libraries from "./libraries.json"
import membership from "./membership.json"
import mobile from "./mobile.json"
import moderation from "./moderation.json"
import networks from "./networks.json"
import places from "./places.json"
import profile from "./profile.json"
import staff from "./staff.json"
import widgetPublic from "./widget-public.json"
import widgets from "./widgets.json"

export default mergeCatalogue(
  common,
  home,
  about,
  auth,
  beta,
  contact,
  atlas,
  places,
  libraries,
  networks,
  mobile,
  events,
  articles,
  contribute,
  community,
  moderation,
  profile,
  membership,
  staff,
  developers,
  widgets,
  widgetPublic
)
