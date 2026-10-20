import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  Field,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Tabs,
  Textarea,
  TextInput,
  Typography,
} from "@strapi/design-system"
import {
  Layouts,
  Page,
  useAuth,
  useFetchClient,
  useRBAC,
} from "@strapi/strapi/admin"
import { useCallback, useEffect, useRef, useState } from "react"

const permission = (action: string) => [
  { action: `plugin::discussions.${action}`, subject: null },
]
const permissions = {
  read: permission("read"),
  review: permission("review"),
  manage: permission("manage"),
  sanction: permission("sanction"),
}
const initialSubject = {
  name: "",
  slug: "",
  description: "",
  visibility: "public",
  createPolicy: "members",
  languages: "",
}
const errorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  "The request failed. Reload and try again."

type Revision = {
  id: string
  recordId: string
  recordType: string
  threadId: string
  threadTitle: string
  threadVersion: number
  title?: string
  body: string
  attachments?: { id: string; altText: string; caption?: string }[]
  contentFlags?: { terms: string[]; covered: boolean }
  previousBody: string
  baseVersion: number
  currentVersion: number
  author: { name: string } | null
}
type Report = {
  id: string
  recordType: string
  recordId: string
  reason: string
  version: number
  reportedBody: string
  currentBody: string
  currentVersion: number
  recordVersion: number
  reportedAttachments?: { id: string; altText: string; caption?: string }[]
  currentAttachments?: { id: string; altText: string; caption?: string }[]
}
type Thread = {
  id: string
  title: string
  body: string
  version: number
  locked: boolean
  pinned: boolean
  state: string
}

type ReviewDraft = {
  note: string
  feedback: string
  profanityException: boolean
  exceptionReason: string
}
const EMPTY_REVIEW: ReviewDraft = {
  note: "",
  feedback: "",
  profanityException: false,
  exceptionReason: "",
}
function ReviewNotes({
  id,
  value,
  onChange,
  exception,
  disabled,
}: {
  id: string
  value: ReviewDraft
  onChange: (patch: Partial<ReviewDraft>) => void
  exception: boolean
  disabled: boolean
}) {
  return (
    <Box
      background="neutral100"
      padding={4}
      marginTop={4}
      marginBottom={4}
      hasRadius
    >
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Field.Root
          name={`${id}-note`}
          hint="Visible only to moderators. Applies to this record."
        >
          <Field.Label>Private review note</Field.Label>
          <Textarea
            disabled={disabled}
            maxLength={2000}
            value={value.note}
            onChange={(event) => onChange({ note: event.target.value })}
          />
          <Field.Hint />
        </Field.Root>
        <Field.Root
          name={`${id}-feedback`}
          hint="Sent to the contributor when requesting changes, removing content or applying a restriction."
        >
          <Field.Label>Contributor feedback</Field.Label>
          <Textarea
            disabled={disabled}
            maxLength={2000}
            value={value.feedback}
            onChange={(event) => onChange({ feedback: event.target.value })}
          />
          <Field.Hint />
        </Field.Root>
        {exception && (
          <Checkbox
            disabled={disabled}
            checked={value.profanityException}
            onCheckedChange={(checked) =>
              onChange({ profanityException: checked === true })
            }
          >
            Approve an explicit word-policy exception
          </Checkbox>
        )}
        {exception && value.profanityException && (
          <Field.Root name={`${id}-exception`} required>
            <Field.Label>Private exception reason</Field.Label>
            <TextInput
              disabled={disabled}
              maxLength={1000}
              value={value.exceptionReason}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ exceptionReason: event.target.value })
              }
            />
          </Field.Root>
        )}
      </Flex>
    </Box>
  )
}

function ProtectedImage({ id, altText }: { id: string; altText: string }) {
  const { get } = useFetchClient()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true,
      objectUrl: string | undefined
    get(`/discussions/attachments/${encodeURIComponent(id)}`, {
      responseType: "blob",
    })
      .then(({ data }) => {
        if (
          !active ||
          !["image/jpeg", "image/png", "image/webp"].includes(data.type)
        )
          return
        objectUrl = URL.createObjectURL(data)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (active) setUrl(null)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [get, id])

  return url ? (
    <img src={url} alt={altText} style={{ maxWidth: "100%", maxHeight: 300 }} />
  ) : (
    <Typography tag="p" textColor="neutral600" paddingBottom={3}>
      Protected image unavailable.
    </Typography>
  )
}

const renderImages = (
  images?: { id: string; altText: string; caption?: string }[]
) =>
  images?.map((image) => (
    <figure key={image.id}>
      <ProtectedImage id={image.id} altText={image.altText} />
      {image.caption && (
        <Typography tag="figcaption" variant="pi" textColor="neutral600">
          {image.caption}
        </Typography>
      )}
    </figure>
  ))

export default function Review() {
  const loading = useAuth("Discussions", (state) => state.isLoading)
  const user = useAuth("Discussions", (state) => state.user)
  const granted = useAuth("Discussions", (state) => state.permissions)
  if (loading) return <Page.Loading />

  return <ReviewContent key={`${user?.id}:${JSON.stringify(granted)}`} />
}
function ReviewContent() {
  const { get, post, put } = useFetchClient()
  const {
    allowedActions,
    isLoading: checkingPermissions,
    error: permissionError,
  } = useRBAC(Object.values(permissions).flat())
  const [revisions, setRevisions] = useState<Revision[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [subjects, setSubjects] = useState<any[]>([])
  const [threads, setThreads] = useState<Thread[]>([]),
    [threadOffset, setThreadOffset] = useState(0),
    [nextThreadOffset, setNextThreadOffset] = useState<number | null>(null),
    [threadState, setThreadState] = useState("visible")
  const [offset, setOffset] = useState(0),
    [nextOffset, setNextOffset] = useState<number | null>(null)
  const [reportOffset, setReportOffset] = useState(0),
    [nextReportOffset, setNextReportOffset] = useState<number | null>(null)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sanctions, setSanctions] = useState<any[]>([]),
    [sanctionOffset, setSanctionOffset] = useState(0),
    [nextSanctionOffset, setNextSanctionOffset] = useState<number | null>(null)
  const [tab, setTab] = useState("revisions")
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>(
    {}
  )
  const [confirmation, setConfirmation] = useState<{
    title: string
    run: () => Promise<void>
  } | null>(null)
  const generation = useRef(0)
  const reviewFor = (id: string) => reviewDrafts[id] ?? EMPTY_REVIEW
  const notesFor = (id: string, exception = false) => (
    <ReviewNotes
      id={id}
      value={reviewFor(id)}
      exception={exception}
      disabled={busy}
      onChange={(patch) =>
        setReviewDrafts((current) => ({
          ...current,
          [id]: { ...(current[id] ?? EMPTY_REVIEW), ...patch },
        }))
      }
    />
  )
  const [subjectForm, setSubjectForm] = useState(initialSubject),
    [editingSubject, setEditingSubject] = useState<any>(null)
  const load = useCallback(async () => {
    if (!allowedActions.canRead) return
    const request = ++generation.current
    setBusy(true)
    try {
      const [queue, reportQueue, subjectList, threadList, sanctionQueue] =
        await Promise.all([
          get<{ data: Revision[]; nextOffset: number | null }>(
            `/discussions/revisions?limit=20&offset=${offset}`
          ),
          get<{ data: Report[]; nextOffset: number | null }>(
            `/discussions/reports?limit=20&offset=${reportOffset}`
          ),
          get<{ data: any[] }>("/discussions/subjects?limit=50"),
          get<{ data: Thread[]; nextOffset: number | null }>(
            `/discussions/threads?state=${threadState}&limit=20&offset=${threadOffset}`
          ),
          get<{ data: any[]; nextOffset: number | null }>(
            `/discussions/sanctions?limit=20&offset=${sanctionOffset}`
          ),
        ])
      if (request !== generation.current) return
      setSanctions(sanctionQueue.data.data)
      setNextSanctionOffset(sanctionQueue.data.nextOffset)
      setRevisions(queue.data.data)
      setNextOffset(queue.data.nextOffset)
      setReports(reportQueue.data.data)
      setNextReportOffset(reportQueue.data.nextOffset)
      setSubjects(subjectList.data.data)
      setThreads(threadList.data.data)
      setNextThreadOffset(threadList.data.nextOffset)
    } catch (error) {
      if (request === generation.current) setMessage(errorMessage(error))
    } finally {
      if (request === generation.current) setBusy(false)
    }
  }, [
    allowedActions.canRead,
    get,
    offset,
    reportOffset,
    threadOffset,
    threadState,
    sanctionOffset,
  ])
  useEffect(() => {
    void load()

    return () => {
      // This is an invalidation counter, not a DOM ref; invalidate pending reads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
    }
  }, [load])
  const mutate = async (path: string, body: unknown) => {
    setBusy(true)
    setMessage("")
    try {
      await put(`/discussions/${path}`, body)
      setMessage("Saved.")
      await load()
    } catch (error) {
      setMessage(errorMessage(error))
      setBusy(false)
    }
  }
  const applySanction = async (
    kind: string,
    recordId: string,
    mode: "mute" | "ban",
    note: string,
    feedback: string
  ) => {
    if (!note.trim() || !feedback.trim()) {
      setMessage("Supply private evidence and separate contributor feedback.")

      return
    }
    setConfirmation({
      title: `Apply a discussion subject ${mode}? The member can appeal.`,
      run: async () => {
        setBusy(true)
        try {
          await post(`/discussions/records/${kind}/${recordId}/sanctions`, {
            mode,
            scope: "subject",
            reason: note,
            contributorFeedback: feedback,
          })
          await load()
        } catch (error) {
          setMessage(errorMessage(error))
          setBusy(false)
        }
      },
    })
  }
  if (checkingPermissions) return <Page.Loading />
  if (permissionError) return <Page.Error />
  if (!allowedActions.canRead) return <Page.NoPermissions />

  return (
    <Page.Main>
      <Layouts.Root>
        <Layouts.Header
          title="Discussions"
          subtitle="Review proposals and reports, manage threads and subjects, and resolve restrictions."
          primaryAction={
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </Button>
          }
        />
        <Layouts.Content>
          {message && (
            <Box paddingBottom={5}>
              <Alert
                variant={
                  message === "Saved." || message === "Subject saved."
                    ? "success"
                    : "danger"
                }
                title={
                  message === "Saved." || message === "Subject saved."
                    ? "Saved"
                    : "Action needed"
                }
                closeLabel="Dismiss"
                onClose={() => setMessage("")}
              >
                {message}
              </Alert>
            </Box>
          )}
          <Tabs.Root value={tab} onValueChange={setTab}>
            <Box
              color="neutral500"
              style={{
                overflowX: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "currentColor transparent",
              }}
            >
              <Tabs.List
                aria-label="Discussion management"
                style={{ minWidth: "max-content", whiteSpace: "nowrap" }}
              >
                <Tabs.Trigger value="revisions">Revisions</Tabs.Trigger>
                <Tabs.Trigger value="reports">Reports</Tabs.Trigger>
                <Tabs.Trigger value="threads">Threads</Tabs.Trigger>
                <Tabs.Trigger value="restrictions">
                  Restrictions & appeals
                </Tabs.Trigger>
                <Tabs.Trigger value="subjects">Subjects</Tabs.Trigger>
              </Tabs.List>
            </Box>
            <Box paddingTop={6} color="neutral800">
              <Tabs.Content value="revisions">
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                >
                  <Typography tag="h2" variant="beta" paddingBottom={3}>
                    Pending revisions
                  </Typography>
                  {!revisions.length && (
                    <Typography
                      tag="p"
                      textColor="neutral600"
                      paddingBottom={3}
                    >
                      {busy
                        ? "Loading proposals…"
                        : "No pending proposals on this page."}
                    </Typography>
                  )}
                  {revisions.map((revision) => {
                    const {
                      note,
                      feedback,
                      profanityException,
                      exceptionReason,
                    } = reviewFor(`revision:${revision.id}`)

                    return (
                      <Box
                        background="neutral0"
                        padding={6}
                        marginBottom={5}
                        hasRadius
                        shadow="tableShadow"
                        key={revision.id}
                      >
                        <Typography tag="h3" variant="delta" paddingBottom={3}>
                          {revision.title || revision.threadTitle}
                        </Typography>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                        >
                          {revision.recordType} by{" "}
                          {revision.author?.name || "Community member"} · base{" "}
                          {revision.baseVersion} · current{" "}
                          {revision.currentVersion}
                        </Typography>
                        {revision.baseVersion !== revision.currentVersion && (
                          <Typography
                            tag="p"
                            textColor="neutral600"
                            paddingBottom={3}
                            role="status"
                          >
                            Content changed after this proposal. Reject it or
                            ask the author to resubmit.
                          </Typography>
                        )}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            <Typography
                              tag="h4"
                              variant="sigma"
                              paddingBottom={3}
                            >
                              Current text
                            </Typography>
                            <Box
                              tag="pre"
                              background="neutral100"
                              padding={4}
                              hasRadius
                              marginBottom={4}
                              style={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {revision.previousBody || "(not published)"}
                            </Box>
                          </div>
                          <div>
                            <Typography
                              tag="h4"
                              variant="sigma"
                              paddingBottom={3}
                            >
                              Proposed text
                            </Typography>
                            <Box
                              tag="pre"
                              background="neutral100"
                              padding={4}
                              hasRadius
                              marginBottom={4}
                              style={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {revision.body}
                            </Box>
                          </div>
                        </div>
                        {renderImages(revision.attachments)}
                        {revision.contentFlags && (
                          <Typography
                            tag="p"
                            textColor="neutral600"
                            paddingBottom={3}
                          >
                            Configured word policy:{" "}
                            {revision.contentFlags.covered
                              ? revision.contentFlags.terms.join(", ") ||
                                "No matched terms"
                              : "No dictionary coverage for this language"}
                            .
                          </Typography>
                        )}
                        {(allowedActions.canReview ||
                          allowedActions.canSanction) && (
                          <>
                            {" "}
                            {notesFor(`revision:${revision.id}`, true)}
                            <Flex gap={2} wrap="wrap">
                              <Button
                                variant="default"
                                disabled={
                                  busy ||
                                  !allowedActions.canReview ||
                                  revision.baseVersion !==
                                    revision.currentVersion ||
                                  (profanityException &&
                                    !exceptionReason.trim())
                                }
                                onClick={() =>
                                  void mutate(`revisions/${revision.id}`, {
                                    decision: "approve",
                                    profanityException,
                                    ...(profanityException
                                      ? { exceptionReason }
                                      : {}),
                                    baseVersion: revision.baseVersion,
                                    note,
                                  })
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                variant="danger-light"
                                disabled={busy || !allowedActions.canReview}
                                onClick={() =>
                                  void mutate(`revisions/${revision.id}`, {
                                    decision: "reject",
                                    baseVersion: revision.baseVersion,
                                    contributorFeedback: feedback,
                                    note,
                                  })
                                }
                              >
                                Reject
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={
                                  busy ||
                                  !allowedActions.canReview ||
                                  !feedback.trim()
                                }
                                onClick={() =>
                                  void mutate(`revisions/${revision.id}`, {
                                    decision: "request_changes",
                                    baseVersion: revision.baseVersion,
                                    contributorFeedback: feedback,
                                    note,
                                  })
                                }
                              >
                                Request changes
                              </Button>
                              {allowedActions.canSanction && (
                                <>
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      void applySanction(
                                        revision.recordType,
                                        revision.recordId,
                                        "mute",
                                        note,
                                        feedback
                                      )
                                    }
                                  >
                                    Mute writer in subject
                                  </Button>
                                  <Button
                                    variant="danger-light"
                                    disabled={busy}
                                    onClick={() =>
                                      void applySanction(
                                        revision.recordType,
                                        revision.recordId,
                                        "ban",
                                        note,
                                        feedback
                                      )
                                    }
                                  >
                                    Ban writer from subject
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="secondary"
                                disabled={busy || !allowedActions.canReview}
                                onClick={() =>
                                  void mutate(
                                    `records/thread/${revision.threadId}`,
                                    {
                                      action: "lock",
                                      baseVersion: revision.threadVersion,
                                      note,
                                    }
                                  )
                                }
                              >
                                Lock thread
                              </Button>
                              <Button
                                variant="danger-light"
                                disabled={busy || !allowedActions.canReview}
                                onClick={() =>
                                  void mutate(
                                    `records/${revision.recordType}/${revision.recordId}`,
                                    {
                                      action: "remove",
                                      baseVersion: revision.currentVersion,
                                      note,
                                      contributorFeedback: feedback,
                                    }
                                  )
                                }
                              >
                                Remove content
                              </Button>
                            </Flex>{" "}
                          </>
                        )}
                      </Box>
                    )
                  })}
                  <Flex
                    gap={3}
                    paddingTop={4}
                    paddingBottom={4}
                    tag="nav"
                    aria-label="Revision pages"
                  >
                    <Button
                      variant="secondary"
                      disabled={busy || offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - 20))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || nextOffset === null}
                      onClick={() =>
                        nextOffset !== null && setOffset(nextOffset)
                      }
                    >
                      Next
                    </Button>
                  </Flex>
                </Box>
              </Tabs.Content>
              <Tabs.Content value="reports">
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                >
                  <Typography tag="h2" variant="beta" paddingBottom={3}>
                    Open reports
                  </Typography>
                  {!reports.length && (
                    <Typography
                      tag="p"
                      textColor="neutral600"
                      paddingBottom={3}
                    >
                      {busy
                        ? "Loading reports…"
                        : "No open reports on this page."}
                    </Typography>
                  )}
                  {reports.map((report) => {
                    const { note, feedback } = reviewFor(`report:${report.id}`)

                    return (
                      <Box
                        background="neutral0"
                        padding={6}
                        marginBottom={5}
                        hasRadius
                        shadow="tableShadow"
                        key={report.id}
                      >
                        <Typography tag="h3" variant="delta" paddingBottom={3}>
                          Reported {report.recordType}
                        </Typography>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                          style={{ whiteSpace: "pre-wrap" }}
                        >
                          {report.reason}
                        </Typography>
                        <Typography tag="h4" variant="sigma" paddingBottom={3}>
                          Reported text (version {report.recordVersion})
                        </Typography>
                        <Box
                          tag="pre"
                          background="neutral100"
                          padding={4}
                          hasRadius
                          marginBottom={4}
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {report.reportedBody}
                        </Box>
                        {renderImages(report.reportedAttachments)}
                        <Typography tag="h4" variant="sigma" paddingBottom={3}>
                          Current text (version {report.currentVersion})
                        </Typography>
                        <Box
                          tag="pre"
                          background="neutral100"
                          padding={4}
                          hasRadius
                          marginBottom={4}
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {report.currentBody}
                        </Box>
                        {renderImages(report.currentAttachments)}
                        {allowedActions.canReview && (
                          <>
                            {" "}
                            {notesFor(`report:${report.id}`, false)}
                            <Flex gap={2} wrap="wrap">
                              <Button
                                variant="secondary"
                                disabled={busy || !allowedActions.canReview}
                                onClick={() =>
                                  void mutate(`reports/${report.id}`, {
                                    decision: "dismiss",
                                    baseVersion: report.version,
                                    note,
                                  })
                                }
                              >
                                Dismiss report
                              </Button>
                              <Button
                                variant="danger-light"
                                disabled={busy || !allowedActions.canReview}
                                onClick={() =>
                                  void mutate(`reports/${report.id}`, {
                                    decision: "remove",
                                    baseVersion: report.version,
                                    recordBaseVersion: report.currentVersion,
                                    contributorFeedback: feedback,
                                    note,
                                  })
                                }
                              >
                                Remove reported content
                              </Button>
                            </Flex>{" "}
                          </>
                        )}
                      </Box>
                    )
                  })}
                  <Flex
                    gap={3}
                    paddingTop={4}
                    paddingBottom={4}
                    tag="nav"
                    aria-label="Report pages"
                  >
                    <Button
                      variant="secondary"
                      disabled={busy || reportOffset === 0}
                      onClick={() =>
                        setReportOffset(Math.max(0, reportOffset - 20))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || nextReportOffset === null}
                      onClick={() =>
                        nextReportOffset !== null &&
                        setReportOffset(nextReportOffset)
                      }
                    >
                      Next
                    </Button>
                  </Flex>
                </Box>
              </Tabs.Content>
              <Tabs.Content value="threads">
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                >
                  <Typography tag="h2" variant="beta" paddingBottom={3}>
                    Threads
                  </Typography>
                  <Field.Root name="thread-publication-state">
                    <Field.Label>Publication state</Field.Label>
                    <SingleSelect
                      disabled={busy}
                      value={threadState}
                      onChange={(value) => {
                        setThreadState(String(value))
                        setThreadOffset(0)
                      }}
                    >
                      {["visible", "pending", "rejected", "removed"].map(
                        (state) => (
                          <SingleSelectOption key={state} value={state}>
                            {state.charAt(0).toUpperCase() + state.slice(1)}
                          </SingleSelectOption>
                        )
                      )}
                    </SingleSelect>
                  </Field.Root>
                  {!threads.length && (
                    <Typography textColor="neutral600">
                      {busy ? "Loading threads…" : "No threads in this state."}
                    </Typography>
                  )}
                  {threads.map((thread) => {
                    const { note, feedback } = reviewFor(`thread:${thread.id}`)

                    return (
                      <Box
                        background="neutral0"
                        padding={6}
                        marginBottom={5}
                        hasRadius
                        shadow="tableShadow"
                        key={thread.id}
                      >
                        <Typography tag="h3" variant="delta" paddingBottom={3}>
                          {thread.title}
                        </Typography>
                        <Box
                          tag="pre"
                          background="neutral100"
                          padding={4}
                          hasRadius
                          marginBottom={4}
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {thread.body}
                        </Box>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                        >
                          {thread.state} · version {thread.version}
                        </Typography>
                        {(allowedActions.canReview ||
                          allowedActions.canSanction) && (
                          <>
                            {" "}
                            {notesFor(`thread:${thread.id}`, false)}
                            <Flex gap={2} wrap="wrap">
                              <Button
                                variant="secondary"
                                disabled={
                                  busy ||
                                  !allowedActions.canReview ||
                                  thread.state === "removed"
                                }
                                onClick={() =>
                                  void mutate(`records/thread/${thread.id}`, {
                                    action: thread.locked ? "unlock" : "lock",
                                    baseVersion: thread.version,
                                    note,
                                  })
                                }
                              >
                                {thread.locked ? "Unlock" : "Lock"}
                              </Button>
                              <Button
                                variant="secondary"
                                disabled={
                                  busy ||
                                  !allowedActions.canReview ||
                                  thread.state === "removed"
                                }
                                onClick={() =>
                                  void mutate(`records/thread/${thread.id}`, {
                                    action: thread.pinned ? "unpin" : "pin",
                                    baseVersion: thread.version,
                                    note,
                                  })
                                }
                              >
                                {thread.pinned ? "Unpin" : "Pin"}
                              </Button>
                              <Button
                                variant="danger-light"
                                disabled={
                                  busy ||
                                  !allowedActions.canReview ||
                                  thread.state === "removed"
                                }
                                onClick={() =>
                                  void mutate(`records/thread/${thread.id}`, {
                                    action: "remove",
                                    baseVersion: thread.version,
                                    contributorFeedback: feedback,
                                    note,
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </Flex>{" "}
                          </>
                        )}
                      </Box>
                    )
                  })}
                  <Flex
                    gap={3}
                    paddingTop={4}
                    paddingBottom={4}
                    tag="nav"
                    aria-label="Thread pages"
                  >
                    <Button
                      variant="secondary"
                      disabled={busy || threadOffset === 0}
                      onClick={() =>
                        setThreadOffset(Math.max(0, threadOffset - 20))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || nextThreadOffset === null}
                      onClick={() =>
                        nextThreadOffset !== null &&
                        setThreadOffset(nextThreadOffset)
                      }
                    >
                      Next
                    </Button>
                  </Flex>
                </Box>
              </Tabs.Content>
              <Tabs.Content value="restrictions">
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                >
                  <Typography tag="h2" variant="beta" paddingBottom={3}>
                    Discussion restrictions and appeals
                  </Typography>
                  <Typography tag="p" textColor="neutral600" paddingBottom={3}>
                    These restrictions apply to discussion participation/access.
                    They do not ban a host account from other services.
                  </Typography>
                  {!sanctions.length && (
                    <Typography
                      tag="p"
                      textColor="neutral600"
                      paddingBottom={3}
                    >
                      No active discussion restrictions on this page.
                    </Typography>
                  )}
                  {sanctions.map((sanction) => {
                    const { note, feedback } = reviewFor(
                      `sanction:${sanction.id}`
                    )

                    return (
                      <Box
                        background="neutral0"
                        padding={6}
                        marginBottom={5}
                        hasRadius
                        shadow="tableShadow"
                        key={sanction.id}
                      >
                        <Typography tag="h3" variant="delta" paddingBottom={3}>
                          {sanction.author?.name || "Community member"}:{" "}
                          {sanction.mode}
                        </Typography>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                        >
                          {sanction.subjectId
                            ? sanction.subjectName
                            : "All discussion subjects"}{" "}
                          · version {sanction.version} ·{" "}
                          {sanction.expiresAt
                            ? `Expires ${sanction.expiresAt}`
                            : "No automatic expiry"}
                        </Typography>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                        >
                          Private evidence: {sanction.reason}
                        </Typography>
                        <Typography
                          tag="p"
                          textColor="neutral600"
                          paddingBottom={3}
                        >
                          Contributor feedback: {sanction.contributorFeedback}
                        </Typography>
                        {sanction.appeal && (
                          <Typography
                            tag="p"
                            textColor="neutral600"
                            paddingBottom={3}
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            Appeal: {sanction.appeal}
                          </Typography>
                        )}
                        {allowedActions.canSanction && (
                          <>
                            {" "}
                            {notesFor(`sanction:${sanction.id}`, false)}
                            <Flex gap={2} wrap="wrap">
                              <Button
                                variant="secondary"
                                disabled={
                                  busy ||
                                  !allowedActions.canSanction ||
                                  !sanction.canLift ||
                                  !note.trim() ||
                                  !feedback.trim()
                                }
                                onClick={() => {
                                  setConfirmation({
                                    title: "Lift this discussion restriction?",
                                    run: async () => {
                                      await mutate(`sanctions/${sanction.id}`, {
                                        baseVersion: sanction.version,
                                        reason: note,
                                        contributorFeedback: feedback,
                                      })
                                    },
                                  })
                                }}
                              >
                                Lift restriction
                              </Button>
                            </Flex>{" "}
                          </>
                        )}
                      </Box>
                    )
                  })}
                  <Flex
                    gap={3}
                    paddingTop={4}
                    paddingBottom={4}
                    tag="nav"
                    aria-label="Restriction pages"
                  >
                    <Button
                      variant="secondary"
                      disabled={busy || sanctionOffset === 0}
                      onClick={() =>
                        setSanctionOffset(Math.max(0, sanctionOffset - 20))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || nextSanctionOffset === null}
                      onClick={() =>
                        nextSanctionOffset !== null &&
                        setSanctionOffset(nextSanctionOffset)
                      }
                    >
                      Next
                    </Button>
                  </Flex>
                </Box>
              </Tabs.Content>
              <Tabs.Content value="subjects">
                <Box
                  padding={6}
                  background="neutral0"
                  hasRadius
                  shadow="tableShadow"
                >
                  <Typography tag="h2" variant="beta" paddingBottom={3}>
                    Subjects
                  </Typography>
                  {!subjects.length && (
                    <Typography textColor="neutral600">
                      {busy
                        ? "Loading subjects…"
                        : "No subjects yet. Create one to start a discussion space."}
                    </Typography>
                  )}
                  <Box tag="ul" padding={0} style={{ listStyle: "none" }}>
                    {subjects.map((subject) => (
                      <Flex
                        tag="li"
                        key={subject.id}
                        padding={4}
                        marginBottom={3}
                        background="neutral0"
                        hasRadius
                        gap={4}
                        justifyContent="space-between"
                      >
                        <Typography textColor="neutral800">
                          {subject.name} · {subject.visibility}
                        </Typography>
                        <Button
                          variant="secondary"
                          disabled={busy || !allowedActions.canManage}
                          onClick={() => {
                            setEditingSubject(subject)
                            setSubjectForm({
                              ...subject,
                              languages: (subject.languages || []).join(", "),
                            })
                          }}
                        >
                          Edit
                        </Button>
                      </Flex>
                    ))}
                  </Box>
                  {allowedActions.canManage && (
                    <Box
                      tag="form"
                      background="neutral0"
                      padding={6}
                      marginTop={5}
                      hasRadius
                      shadow="tableShadow"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        setBusy(true)
                        setMessage("")
                        const body = {
                          ...subjectForm,
                          languages: subjectForm.languages
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                          ...(editingSubject
                            ? { baseVersion: editingSubject.version }
                            : {}),
                        }
                        try {
                          await (editingSubject
                            ? put(
                                `/discussions/subjects/${editingSubject.id}`,
                                body
                              )
                            : post("/discussions/subjects", body))
                          setSubjectForm(initialSubject)
                          setEditingSubject(null)
                          setMessage("Subject saved.")
                          await load()
                        } catch (error) {
                          setMessage(errorMessage(error))
                          setBusy(false)
                        }
                      }}
                    >
                      <Typography tag="h3" variant="delta" paddingBottom={3}>
                        {editingSubject ? "Edit subject" : "Create subject"}
                      </Typography>
                      <Flex direction="column" alignItems="stretch" gap={4}>
                        {(
                          [
                            {
                              name: "name",
                              label: "Name",
                              hint: "The subject name shown to readers.",
                            },
                            {
                              name: "slug",
                              label: "URL name",
                              hint: "Used in discussion links. Use lowercase letters, numbers and hyphens.",
                            },
                            {
                              name: "description",
                              label: "Description",
                              hint: "Explain which discussions belong in this subject.",
                            },
                            {
                              name: "languages",
                              label: "Languages",
                              hint: "Comma-separated language codes, such as en, fr. Leave blank for all languages.",
                            },
                          ] as const
                        ).map(({ name: field, label, hint }) => {
                          const Input =
                            field === "description" ? Textarea : TextInput

                          return (
                            <Field.Root
                              key={field}
                              name={`subject-${field}`}
                              required={field === "name" || field === "slug"}
                              hint={hint}
                            >
                              <Field.Label>{label}</Field.Label>
                              <Input
                                disabled={busy}
                                maxLength={field === "description" ? 2000 : 120}
                                value={subjectForm[field]}
                                onChange={(event) =>
                                  setSubjectForm((current) => ({
                                    ...current,
                                    [field]: event.target.value,
                                  }))
                                }
                              />
                              <Field.Hint />
                            </Field.Root>
                          )
                        })}
                        <Field.Root name="subject-visibility">
                          <Field.Label>Visibility</Field.Label>
                          <SingleSelect
                            disabled={busy}
                            value={subjectForm.visibility}
                            onChange={(value) =>
                              setSubjectForm((current) => ({
                                ...current,
                                visibility: String(value),
                              }))
                            }
                          >
                            <SingleSelectOption value="public">
                              Public
                            </SingleSelectOption>
                            <SingleSelectOption value="members">
                              Members
                            </SingleSelectOption>
                            <SingleSelectOption value="private">
                              Moderators
                            </SingleSelectOption>
                          </SingleSelect>
                        </Field.Root>
                        <Field.Root name="subject-creation">
                          <Field.Label>Who can start threads</Field.Label>
                          <SingleSelect
                            disabled={busy}
                            value={subjectForm.createPolicy}
                            onChange={(value) =>
                              setSubjectForm((current) => ({
                                ...current,
                                createPolicy: String(value),
                              }))
                            }
                          >
                            <SingleSelectOption value="members">
                              Members
                            </SingleSelectOption>
                            <SingleSelectOption value="moderators">
                              Moderators
                            </SingleSelectOption>
                          </SingleSelect>
                        </Field.Root>
                        <Flex gap={3}>
                          <Button type="submit" disabled={busy} loading={busy}>
                            Save subject
                          </Button>
                          <Button
                            variant="tertiary"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditingSubject(null)
                              setSubjectForm(initialSubject)
                            }}
                          >
                            Cancel
                          </Button>
                        </Flex>
                      </Flex>
                    </Box>
                  )}
                </Box>
              </Tabs.Content>
            </Box>
          </Tabs.Root>
          <Dialog.Root
            open={!!confirmation}
            onOpenChange={(open) => {
              if (!open && !busy) setConfirmation(null)
            }}
          >
            <Dialog.Content>
              <Dialog.Header>Confirm discussion action</Dialog.Header>
              <Dialog.Body>
                <Dialog.Description>{confirmation?.title}</Dialog.Description>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.Cancel>
                  <Button
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => setConfirmation(null)}
                  >
                    Cancel
                  </Button>
                </Dialog.Cancel>
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={busy}
                  onClick={() => {
                    const action = confirmation
                    setConfirmation(null)
                    if (action) action.run()
                  }}
                >
                  Confirm action
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </Layouts.Content>
      </Layouts.Root>
    </Page.Main>
  )
}
