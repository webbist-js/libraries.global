import {
  appendReviewResponse,
  reviewResponses,
  type ReviewResponseContext,
} from "@repo/shared-data"
import {
  Box,
  Button,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system"
import { useState } from "react"

export function ReviewResponsePicker({
  context,
  note,
  onChange,
  disabled = false,
}: {
  context: ReviewResponseContext
  note: string
  onChange: (note: string) => void
  disabled?: boolean
}) {
  const [selected, setSelected] = useState("")
  const responses = reviewResponses(context)
  const response = responses.find((item) => item.id === selected)
  const next = response ? appendReviewResponse(note, response.text) : null

  return (
    <Box paddingTop={3} paddingBottom={3} width="100%">
      <details>
        <summary style={{ cursor: "pointer" }}>Suggested responses</summary>
        <Flex direction="column" alignItems="stretch" gap={3} paddingTop={3}>
          <Typography variant="pi" textColor="neutral600">
            Choose a starting point, then edit it to fit your review. Nothing is
            sent until you submit your decision.
          </Typography>
          <Field.Root name="suggestedResponse">
            <Field.Label>Response</Field.Label>
            <SingleSelect
              value={selected}
              disabled={disabled}
              placeholder="Choose a response…"
              onChange={(value: string | number) => setSelected(String(value))}
            >
              {responses.map((item) => (
                <SingleSelectOption key={item.id} value={item.id}>
                  {item.label}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Field.Root>
          {response && (
            <>
              <Typography aria-live="polite">{response.text}</Typography>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || next === null}
                onClick={() => {
                  if (next !== null) onChange(next)
                }}
              >
                {note.trim() ? "Append to note" : "Use response"}
              </Button>
              {next === null && (
                <Typography role="status">
                  Shorten your note before adding this response (2,000
                  characters maximum).
                </Typography>
              )}
            </>
          )}
        </Flex>
      </details>
    </Box>
  )
}
