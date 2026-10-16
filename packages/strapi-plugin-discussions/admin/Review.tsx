import { useFetchClient, useRBAC } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

const permission = (action: string) => [
  { action: `plugin::discussions.${action}`, subject: null },
]
const permissions = {
  read: permission("read"),
  review: permission("review"),
  manage: permission("manage"),
}
const panel = {
  padding: "1.25rem",
  border: "1px solid #a1a1aa",
  borderRadius: 6,
  marginBlock: "1rem",
}
const button = { padding: ".5rem .75rem", margin: ".25rem", cursor: "pointer" }
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

export default function Review() {
  const { get, post, put } = useFetchClient()
  const { allowedActions, isLoading: checkingPermissions } =
    useRBAC(permissions)
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
    [note, setNote] = useState("")
  const [subjectForm, setSubjectForm] = useState(initialSubject),
    [editingSubject, setEditingSubject] = useState<any>(null)
  const load = useCallback(async () => {
    if (!allowedActions.canRead) return
    setBusy(true)
    try {
      const [queue, reportQueue, subjectList, threadList] = await Promise.all([
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
      ])
      setRevisions(queue.data.data)
      setNextOffset(queue.data.nextOffset)
      setReports(reportQueue.data.data)
      setNextReportOffset(reportQueue.data.nextOffset)
      setSubjects(subjectList.data.data)
      setThreads(threadList.data.data)
      setNextThreadOffset(threadList.data.nextOffset)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }, [
    allowedActions.canRead,
    get,
    offset,
    reportOffset,
    threadOffset,
    threadState,
  ])
  useEffect(() => {
    void load()
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
  if (checkingPermissions)
    return <main style={{ padding: "2rem" }}>Checking permissions…</main>
  if (!allowedActions.canRead)
    return (
      <main style={{ padding: "2rem" }}>
        You do not have permission to access discussions.
      </main>
    )

  return (
    <main style={{ padding: "2rem", maxWidth: 1100 }}>
      <h1>Discussions</h1>
      <p>
        Review immutable proposals before they become visible. Plain text is
        displayed exactly as submitted.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <button style={button} disabled={busy} onClick={() => void load()}>
        Refresh
      </button>
      <label style={{ display: "block", marginBlock: "1rem" }}>
        Private review note{" "}
        <textarea
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{ width: "100%", minHeight: 70 }}
        />
      </label>
      <h2>Pending revisions</h2>
      {!revisions.length && <p>No pending proposals on this page.</p>}
      {revisions.map((revision) => (
        <article key={revision.id} style={panel}>
          <h3>{revision.title || revision.threadTitle}</h3>
          <p>
            {revision.recordType} by{" "}
            {revision.author?.name || "Community member"} · base{" "}
            {revision.baseVersion} · current {revision.currentVersion}
          </p>
          {revision.baseVersion !== revision.currentVersion && (
            <p role="status">
              Content changed after this proposal. Reject it or ask the author
              to resubmit.
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <h4>Current text</h4>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {revision.previousBody || "(not published)"}
              </pre>
            </div>
            <div>
              <h4>Proposed text</h4>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {revision.body}
              </pre>
            </div>
          </div>
          <button
            style={button}
            disabled={
              busy ||
              !allowedActions.canReview ||
              revision.baseVersion !== revision.currentVersion
            }
            onClick={() =>
              void mutate(`revisions/${revision.id}`, {
                decision: "approve",
                baseVersion: revision.baseVersion,
                note,
              })
            }
          >
            Approve
          </button>
          <button
            style={button}
            disabled={busy || !allowedActions.canReview}
            onClick={() =>
              void mutate(`revisions/${revision.id}`, {
                decision: "reject",
                baseVersion: revision.baseVersion,
                note,
              })
            }
          >
            Reject
          </button>
          <button
            style={button}
            disabled={busy || !allowedActions.canReview}
            onClick={() =>
              void mutate(`records/thread/${revision.threadId}`, {
                action: "lock",
                baseVersion: revision.threadVersion,
                note,
              })
            }
          >
            Lock thread
          </button>
          <button
            style={button}
            disabled={busy || !allowedActions.canReview}
            onClick={() =>
              void mutate(
                `records/${revision.recordType}/${revision.recordId}`,
                { action: "remove", baseVersion: revision.currentVersion, note }
              )
            }
          >
            Remove content
          </button>
        </article>
      ))}
      <nav aria-label="Revision pages">
        <button
          style={button}
          disabled={busy || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous
        </button>
        <button
          style={button}
          disabled={busy || nextOffset === null}
          onClick={() => nextOffset !== null && setOffset(nextOffset)}
        >
          Next
        </button>
      </nav>
      <h2>Open reports</h2>
      {!reports.length && <p>No open reports on this page.</p>}
      {reports.map((report) => (
        <article key={report.id} style={panel}>
          <h3>Reported {report.recordType}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{report.reason}</p>
          <h4>Reported text (version {report.recordVersion})</h4>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {report.reportedBody}
          </pre>
          <h4>Current text (version {report.currentVersion})</h4>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {report.currentBody}
          </pre>
          <button
            style={button}
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
          </button>
          <button
            style={button}
            disabled={busy || !allowedActions.canReview}
            onClick={() =>
              void mutate(`reports/${report.id}`, {
                decision: "remove",
                baseVersion: report.version,
                recordBaseVersion: report.currentVersion,
                note,
              })
            }
          >
            Remove reported content
          </button>
        </article>
      ))}
      <nav aria-label="Report pages">
        <button
          style={button}
          disabled={busy || reportOffset === 0}
          onClick={() => setReportOffset(Math.max(0, reportOffset - 20))}
        >
          Previous
        </button>
        <button
          style={button}
          disabled={busy || nextReportOffset === null}
          onClick={() =>
            nextReportOffset !== null && setReportOffset(nextReportOffset)
          }
        >
          Next
        </button>
      </nav>
      <h2>Threads</h2>
      <label>
        Publication state{" "}
        <select
          value={threadState}
          onChange={(event) => {
            setThreadState(event.target.value)
            setThreadOffset(0)
          }}
        >
          {["visible", "pending", "rejected", "removed"].map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      {threads.map((thread) => (
        <article key={thread.id} style={panel}>
          <h3>{thread.title}</h3>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {thread.body}
          </pre>
          <p>
            {thread.state} · version {thread.version}
          </p>
          <button
            style={button}
            disabled={
              busy || !allowedActions.canReview || thread.state === "removed"
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
          </button>
          <button
            style={button}
            disabled={
              busy || !allowedActions.canReview || thread.state === "removed"
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
          </button>
          <button
            style={button}
            disabled={
              busy || !allowedActions.canReview || thread.state === "removed"
            }
            onClick={() =>
              void mutate(`records/thread/${thread.id}`, {
                action: "remove",
                baseVersion: thread.version,
                note,
              })
            }
          >
            Remove
          </button>
        </article>
      ))}
      <nav aria-label="Thread pages">
        <button
          style={button}
          disabled={busy || threadOffset === 0}
          onClick={() => setThreadOffset(Math.max(0, threadOffset - 20))}
        >
          Previous
        </button>
        <button
          style={button}
          disabled={busy || nextThreadOffset === null}
          onClick={() =>
            nextThreadOffset !== null && setThreadOffset(nextThreadOffset)
          }
        >
          Next
        </button>
      </nav>
      <h2>Subjects</h2>
      <ul>
        {subjects.map((subject) => (
          <li key={subject.id}>
            {subject.name} · {subject.visibility}{" "}
            <button
              style={button}
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
            </button>
          </li>
        ))}
      </ul>
      {allowedActions.canManage && (
        <form
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
                ? put(`/discussions/subjects/${editingSubject.id}`, body)
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
          style={panel}
        >
          <h3>{editingSubject ? "Edit subject" : "Create subject"}</h3>
          {(["name", "slug", "description", "languages"] as const).map(
            (field) => (
              <label
                key={field}
                style={{ display: "block", marginBlock: ".75rem" }}
              >
                {field}
                <input
                  required={field === "name" || field === "slug"}
                  maxLength={field === "description" ? 2000 : 120}
                  value={subjectForm[field]}
                  onChange={(event) =>
                    setSubjectForm((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  style={{ display: "block", width: "100%", padding: ".5rem" }}
                />
              </label>
            )
          )}
          <label>
            Visibility{" "}
            <select
              value={subjectForm.visibility}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  visibility: event.target.value,
                }))
              }
            >
              <option value="public">Public</option>
              <option value="members">Members</option>
              <option value="private">Moderators</option>
            </select>
          </label>
          <label>
            {" "}
            Creation{" "}
            <select
              value={subjectForm.createPolicy}
              onChange={(event) =>
                setSubjectForm((current) => ({
                  ...current,
                  createPolicy: event.target.value,
                }))
              }
            >
              <option value="members">Members</option>
              <option value="moderators">Moderators</option>
            </select>
          </label>
          <button type="submit" style={button} disabled={busy}>
            Save subject
          </button>
          <button
            type="button"
            style={button}
            onClick={() => {
              setEditingSubject(null)
              setSubjectForm(initialSubject)
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </main>
  )
}
