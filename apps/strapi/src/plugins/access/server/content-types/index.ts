import libraryAuthorityGrant from "./library-authority-grant/schema.json"
import networkAffiliation from "./network-affiliation/schema.json"
import networkMandate from "./network-mandate/schema.json"
import networkEvent from "./network-mandate-event/schema.json"
import team from "./team/schema.json"
import teamMember from "./team-member/schema.json"
import widget from "./widget/schema.json"
import widget_audit from "./widget-audit/schema.json"
import widget_release from "./widget-release/schema.json"
import widget_selection from "./widget-selection/schema.json"

export default {
  "network-mandate-event": { schema: networkEvent },
  "network-affiliation": { schema: networkAffiliation },
  "network-mandate": { schema: networkMandate },
  "library-authority-grant": { schema: libraryAuthorityGrant },
  "widget-audit": { schema: widget_audit },
  "widget-release": { schema: widget_release },
  widget: { schema: widget },
  "widget-selection": { schema: widget_selection },
  team: { schema: team },
  "team-member": { schema: teamMember },
}
