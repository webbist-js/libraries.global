import optionSuggestionSchema from "./option-suggestion/schema.json"
import optionVoteSchema from "./option-vote/schema.json"
import reviewEventSchema from "./review-event/schema.json"
import submissionSchema from "./submission/schema.json"
import submissionUploadSchema from "./submission-upload/schema.json"

export default {
  submission: { schema: submissionSchema },
  "submission-upload": { schema: submissionUploadSchema },
  "option-suggestion": { schema: optionSuggestionSchema },
  "option-vote": { schema: optionVoteSchema },
  "review-event": { schema: reviewEventSchema },
}
