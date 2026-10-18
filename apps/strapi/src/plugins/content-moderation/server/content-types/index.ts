import optionSuggestionSchema from "./option-suggestion/schema.json"
import optionVoteSchema from "./option-vote/schema.json"
import reviewEventSchema from "./review-event/schema.json"
import submissionSchema from "./submission/schema.json"
import submissionUploadSchema from "./submission-upload/schema.json"
import suggestionRoundSchema from "./suggestion-round/schema.json"
import uploadReservationSchema from "./upload-reservation/schema.json"

export default {
  "suggestion-round": { schema: suggestionRoundSchema },
  submission: { schema: submissionSchema },
  "submission-upload": { schema: submissionUploadSchema },
  "upload-reservation": { schema: uploadReservationSchema },
  "option-suggestion": { schema: optionSuggestionSchema },
  "option-vote": { schema: optionVoteSchema },
  "review-event": { schema: reviewEventSchema },
}
