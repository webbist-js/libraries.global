import type { SuggestionReviewRound } from "@repo/shared-data"
import { Box, Button, Flex, Typography } from "@strapi/design-system"
import { useFetchClient, useNotification } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

export function SuggestionRoundPanel() {
  const { get, put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [round, setRound] = useState<SuggestionReviewRound | null>(null)
  const [cutoff, setCutoff] = useState("")
  const [review, setReview] = useState("")
  const [capacity, setCapacity] = useState(5)
  const [busy, setBusy] = useState(false)
  function adopt(value: SuggestionReviewRound) {
    setRound(value)
    setCutoff(value.cutoffAt.slice(0, 16))
    setReview(value.reviewAt.slice(0, 16))
    setCapacity(value.capacity)
  }
  useEffect(() => {
    let live = true
    get("/content-moderation/suggestion-round")
      .then((r: any) => {
        if (live && r.data?.data) adopt(r.data.data)
      })
      .catch(() => {})

    return () => {
      live = false
    }
  }, [get])
  async function save() {
    if (!round || busy) return
    setBusy(true)
    try {
      const r = await put("/content-moderation/suggestion-round", {
        version: round.version,
        action: round.state === "voting" ? "schedule" : "close",
        cutoffAt: new Date(`${cutoff}Z`).toISOString(),
        reviewAt: new Date(`${review}Z`).toISOString(),
        capacity,
      })
      adopt((r as any).data.data)
      toggleNotification({ type: "success", message: "Review round saved." })
    } catch (e) {
      toggleNotification({
        type: "danger",
        message:
          (e as any).response?.data?.error?.message ??
          "Could not save this review round.",
      })
    } finally {
      setBusy(false)
    }
  }
  if (!round) return null

  return (
    <Box background="neutral0" padding={5} marginBottom={5} hasRadius>
      <Typography variant="beta">Review round</Typography>
      <Flex gap={4} wrap="wrap" paddingTop={3} paddingBottom={3}>
        {round.state === "voting" ? (
          <>
            <label>
              Voting cutoff (UTC)
              <input
                type="datetime-local"
                value={cutoff}
                onChange={(e) => setCutoff(e.target.value)}
              />
            </label>
            <label>
              Board review (UTC)
              <input
                type="datetime-local"
                value={review}
                onChange={(e) => setReview(e.target.value)}
              />
            </label>
            <label>
              Places
              <input
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </label>
          </>
        ) : (
          <ol>
            {round.shortlist.map((item) => (
              <li key={item.documentId}>
                {item.name} — {item.votes} votes at cutoff
              </li>
            ))}
          </ol>
        )}
      </Flex>
      <Button loading={busy} onClick={() => void save()}>
        {round.state === "voting"
          ? "Save schedule"
          : "Complete review and open next round"}
      </Button>
    </Box>
  )
}
