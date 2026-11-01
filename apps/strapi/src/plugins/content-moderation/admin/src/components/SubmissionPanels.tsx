import {
  EVENT_PROVIDERS,
  FEED_TEST_COPY,
  FEED_TEST_LABEL,
  submittedSourceRecords,
} from "@repo/shared-data"
import {
  Alert,
  Badge,
  Box,
  Divider,
  Flex,
  Grid,
  Link,
  Typography,
} from "@strapi/design-system"
import { useFetchClient } from "@strapi/strapi/admin"
import { useEffect, useState } from "react"

import {
  assetPath,
  EVIDENCE_TYPE_LABELS,
  EXCLUDE_FROM_OTHER,
  FIELD_GROUPS,
  humanise,
  isHttpUrl,
  renderValue,
  type SocialLink,
  type Submission,
  type UploadedImage,
} from "./submissionMeta"
import { RevealCredentialButton } from "../../../../events/admin/src/components/RevealCredentialButton"

// ── Building blocks ────────────────────────────────────────────────────────

/** A titled block inside the review modal. */
export function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Box paddingTop={2} paddingBottom={2}>
      <Box paddingBottom={2}>
        <Typography variant="sigma" textColor="neutral600">
          {title}
        </Typography>
      </Box>
      <Divider />
      <Box paddingTop={3}>{children}</Box>
    </Box>
  )
}

function ValueText({ value }: { value: unknown }) {
  const { text, isUrl } = renderValue(value)
  if (isUrl)
    return (
      <Link
        href={text}
        isExternal
        style={{ wordBreak: "break-all", maxWidth: "100%" }}
      >
        {text.length > 60 ? `${text.slice(0, 60)}…` : text}
      </Link>
    )

  return (
    <Typography
      variant="omega"
      textColor={text === "—" ? "neutral400" : "neutral800"}
      style={{ wordBreak: "break-word" }}
    >
      {text}
    </Typography>
  )
}

/** Label/value pairs in a responsive grid. */
export function KeyValueGrid({
  rows,
  columns = 3,
}: {
  rows: { label: string; value: unknown }[]
  columns?: 2 | 3 | 4
}) {
  const col = 12 / columns

  return (
    <Grid.Root gap={4}>
      {rows.map(({ label, value }) => (
        <Grid.Item
          key={label}
          col={col}
          s={6}
          xs={12}
          direction="column"
          alignItems="stretch"
          style={{ minWidth: 0 }}
        >
          <Typography variant="pi" textColor="neutral600">
            {label}
          </Typography>
          <Box paddingTop={1}>
            <ValueText value={value} />
          </Box>
        </Grid.Item>
      ))}
    </Grid.Root>
  )
}

// ── Relations ──────────────────────────────────────────────────────────────

function RelationTags({ type, ids }: { type: string; ids: unknown }) {
  const { get } = useFetchClient()
  const [labels, setLabels] = useState<Record<string, string>>({})
  const idArr = Array.isArray(ids) ? (ids as string[]) : []

  useEffect(() => {
    if (idArr.length === 0) return
    get(`/content-moderation/relation-labels?type=${encodeURIComponent(type)}`)
      .then(({ data }) =>
        setLabels((data as { data?: Record<string, string> })?.data ?? {})
      )
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  if (idArr.length === 0) return null

  return (
    <Flex gap={1} wrap="wrap">
      {idArr.map((id) => (
        <Badge key={id} size="S">
          {labels[id] ?? `${id.slice(0, 8)}…`}
        </Badge>
      ))}
    </Flex>
  )
}

// ── Photos ─────────────────────────────────────────────────────────────────

function SubmittedPhoto({
  image,
  index,
  single,
}: {
  image: UploadedImage
  index: number
  single: boolean
}) {
  const [failed, setFailed] = useState(false)
  const src = assetPath(image.url)

  return (
    <Box
      position="relative"
      style={{ maxWidth: "100%", width: single ? "24rem" : "12rem" }}
    >
      {src ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block" }}
        >
          {failed ? (
            <Box
              background="neutral100"
              borderColor="neutral200"
              padding={5}
              hasRadius
            >
              <Typography tag="p" textColor="neutral600">
                Preview unavailable
              </Typography>
              <Typography tag="p" variant="pi" textColor="primary600">
                Open original image ↗
              </Typography>
            </Box>
          ) : (
            <Box
              tag="img"
              src={src}
              alt={`Submitted photo ${index + 1}${image.isHero ? " (hero)" : ""}`}
              width="100%"
              hasRadius
              borderColor="neutral150"
              onError={() => setFailed(true)}
              style={{
                aspectRatio: "3 / 2",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}
        </a>
      ) : (
        <Typography variant="pi" textColor="neutral600">
          Image address not accepted
        </Typography>
      )}
      {image.isHero && !failed && src ? (
        <Box position="absolute" top={1} left={1}>
          <Badge active size="S">
            Hero
          </Badge>
        </Box>
      ) : null}
    </Box>
  )
}

export function PhotosPanel({
  images,
  title = "Photos",
  note,
}: {
  images: UploadedImage[]
  title?: string
  note?: string
}) {
  if (images.length === 0) return null

  return (
    <Section title={title}>
      {note ? (
        <Box paddingBottom={3}>
          <Typography variant="omega" textColor="neutral600">
            {note}
          </Typography>
        </Box>
      ) : null}
      <Flex gap={2} wrap="wrap">
        {images.map((img, i) => (
          <SubmittedPhoto
            key={`${img.strapiId ?? i}:${img.url}`}
            image={img}
            index={i}
            single={images.length === 1}
          />
        ))}
      </Flex>
    </Section>
  )
}

// ── Social links ───────────────────────────────────────────────────────────

function SocialLinksPanel({ links }: { links: SocialLink[] }) {
  const active = links.filter((l) => l.url)
  if (active.length === 0) return null

  return (
    <Section title="Social links">
      <Flex direction="column" alignItems="stretch" gap={1}>
        {active.map((l, i) => (
          <Flex key={i} gap={3} alignItems="center">
            <Box width="8rem">
              <Typography
                variant="pi"
                textColor="neutral600"
                style={{ textTransform: "capitalize" }}
              >
                {l.platform}
              </Typography>
            </Box>
            {isHttpUrl(l.url) ? (
              <Link href={l.url} isExternal>
                {l.url}
              </Link>
            ) : (
              <Typography
                variant="omega"
                textColor="neutral800"
                style={{ wordBreak: "break-all" }}
              >
                {String(l.url)}
              </Typography>
            )}
          </Flex>
        ))}
      </Flex>
    </Section>
  )
}

// ── Opening times ──────────────────────────────────────────────────────────

type CanonicalDay = {
  day: string
  enabled: boolean
  timeframes: { startTime?: string; endTime?: string }[]
}

function OpeningTimesPanel({ data }: { data: unknown }) {
  if (
    !data ||
    typeof data !== "object" ||
    !Array.isArray((data as { days?: unknown }).days)
  )
    return null
  const days = (data as { days: CanonicalDay[] }).days

  return (
    <Section title="Opening times">
      <KeyValueGrid
        columns={4}
        rows={days.map((day) => ({
          label: day.day.charAt(0).toUpperCase() + day.day.slice(1),
          value: day.enabled
            ? day.timeframes.length > 0
              ? day.timeframes
                  .map((tf) => `${tf.startTime ?? "?"}–${tf.endTime ?? "?"}`)
                  .join(", ")
              : "Open"
            : "",
        }))}
      />
    </Section>
  )
}

// ── Sources ────────────────────────────────────────────────────────────────

export function SourcesPanel({ sub }: { sub: Submission }) {
  const f = sub.fields ?? {}
  const rows = [
    ...(sub.evidenceType
      ? [
          {
            label: "Evidence type",
            value: EVIDENCE_TYPE_LABELS[sub.evidenceType] ?? sub.evidenceType,
          },
        ]
      : []),
    ...(sub.evidenceUrl
      ? [{ label: "Evidence URL", value: sub.evidenceUrl }]
      : []),
    ...(f.source ? [{ label: "Source", value: f.source }] : []),
    ...(f.sourceUrl ? [{ label: "Source URL", value: f.sourceUrl }] : []),
    ...submittedSourceRecords(f.sourceRecords).map((record, index) => ({
      label: record.label || `Public reference ${index + 1}`,
      value: record.url,
    })),
    ...(f.sourceReference
      ? [{ label: "Reference", value: f.sourceReference }]
      : []),
  ]
  if (rows.length === 0) return null

  return (
    <Section title="Sources">
      <KeyValueGrid rows={rows} />
    </Section>
  )
}

// ── Library claim ──────────────────────────────────────────────────────────

export function LibraryClaimPanel({ sub }: { sub: Submission }) {
  const f = sub.fields ?? {}
  const hasDomains = !!(f.userEmailDomain && f.libraryWebsiteDomain)
  const domainMatch = hasDomains && f.userEmailDomain === f.libraryWebsiteDomain
  const rows = [
    { label: "Library", value: f.name ?? sub.targetSlug ?? "" },
    ...(sub.teamReview
      ? [
          { label: "Filed by team", value: sub.teamReview.name },
          { label: "Assigned level", value: sub.teamReview.staffRole },
        ]
      : []),
    { label: "Entity ref", value: f.entityRef ?? "" },
    {
      label: "Role",
      value: typeof f.role === "string" ? f.role.replaceAll("_", " ") : "",
    },
    { label: "Department", value: f.department ?? "" },
    { label: "Submitter email", value: sub.submittedByEmail },
    { label: "Verification method", value: f.verificationMethod ?? "" },
    { label: "User email domain", value: f.userEmailDomain ?? "" },
    {
      label: "Website given by claimant (unverified)",
      value: f.libraryWebsiteDomain ?? f.claimedWebsiteDomain ?? "",
    },
  ].filter((r) => r.value)

  return (
    <>
      {hasDomains && (
        <Box paddingBottom={4}>
          <Alert
            variant={domainMatch ? "success" : "warning"}
            title={domainMatch ? "Domain match" : "Domain mismatch"}
            closeLabel="Dismiss"
            onClose={() => {}}
          >
            {domainMatch
              ? "The claimant's email domain matches the library's website. Check their relationship to the library before approving."
              : "The claimant's email domain doesn't match the library's website. Verify by another route before approving."}
          </Alert>
        </Box>
      )}
      <Section title="Claim details">
        <KeyValueGrid rows={rows} columns={2} />
      </Section>
      <Alert
        variant="default"
        title="On approval"
        closeLabel="Dismiss"
        onClose={() => {}}
      >
        Approving records the affiliation and raises the claimant to Verified
        librarian. Roles are never lowered.
      </Alert>
    </>
  )
}

// ── New library / free-form fields ─────────────────────────────────────────

export function FieldsPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  if (Object.keys(fields).length === 0) return null

  const used = new Set(FIELD_GROUPS.flatMap((g) => g.keys))
  const ungrouped = Object.entries(fields).filter(
    ([k, v]) =>
      !used.has(k) && !EXCLUDE_FROM_OTHER.has(k) && v !== "" && v != null
  )
  const uploadedImages = Array.isArray(fields.uploadedImages)
    ? (fields.uploadedImages as UploadedImage[])
    : []
  // "Share a photo" sends one file as photoId + photoUrl.
  const shared =
    fields.kind === "photo" && typeof fields.photoUrl === "string"
      ? [
          {
            strapiId: Number(fields.photoId) || 0,
            url: fields.photoUrl,
            isHero: false,
          } satisfies UploadedImage,
        ]
      : []
  const socialLinks = Array.isArray(fields.socialLinks)
    ? (fields.socialLinks as SocialLink[])
    : []

  return (
    <>
      {FIELD_GROUPS.map((group) => {
        const rows = group.keys
          .filter(
            (k) =>
              fields[k] !== undefined && fields[k] !== null && fields[k] !== ""
          )
          .map((k) => ({ label: humanise(k), value: fields[k] }))
        if (rows.length === 0) return null

        return (
          <Section key={group.label} title={group.label}>
            <KeyValueGrid rows={rows} />
          </Section>
        )
      })}
      {ungrouped.length > 0 && (
        <Section title="Other">
          <KeyValueGrid
            rows={ungrouped.map(([k, v]) => ({ label: humanise(k), value: v }))}
          />
        </Section>
      )}
      {(["services", "amenities", "accessibility"] as const).map((key) =>
        Array.isArray(fields[key]) && (fields[key] as unknown[]).length > 0 ? (
          <Section key={key} title={key.charAt(0).toUpperCase() + key.slice(1)}>
            <RelationTags type={key} ids={fields[key]} />
          </Section>
        ) : null
      )}
      <PhotosPanel
        images={shared}
        title="Photo"
        note="Approving adds it to the library: as the main image if it has none, otherwise to its gallery. The credit and licence go in the image caption."
      />
      <PhotosPanel images={uploadedImages} />
      <SocialLinksPanel links={socialLinks} />
      <OpeningTimesPanel data={fields.openingTimes} />
    </>
  )
}

// ── Event feed ─────────────────────────────────────────────────────────────

export function EventFeedPanel({ sub }: { sub: Submission }) {
  const f = (sub.fields ?? {}) as Record<string, any>
  const replace = f.kind === "replace"
  const test = f.test?.result as keyof typeof FEED_TEST_LABEL | undefined
  const hints = (f.hints ?? {}) as Record<string, string>
  const previous = (f.previousHints ?? {}) as Record<string, string>

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Alert
        variant={test === "ok" ? "success" : "warning"}
        title={`Connection test: ${test ? FEED_TEST_LABEL[test] : "not run"}`}
        closeLabel="Dismiss"
        onClose={() => {}}
      >
        {test && test !== "ok"
          ? FEED_TEST_COPY[test]
          : "The test read events with these details when they were sent."}
      </Alert>
      <KeyValueGrid
        rows={[
          {
            label: "Platform",
            value:
              EVENT_PROVIDERS[f.provider as keyof typeof EVENT_PROVIDERS]
                ?.label ?? f.provider,
          },
          {
            label: "Kind",
            value: replace
              ? "New details for an active feed"
              : "New connection",
          },
          ...Object.entries(hints).map(([k, v]) => ({
            label: replace ? `${k} (new)` : k,
            value: v,
          })),
          ...(replace
            ? Object.entries(previous).map(([k, v]) => ({
                label: `${k} (current)`,
                value: v,
              }))
            : []),
        ]}
      />
      <Flex gap={2}>
        <RevealCredentialButton
          documentId={f.credentialDocumentId}
          slot={replace ? "pending" : "current"}
        />
      </Flex>
      <Alert
        variant="default"
        title="On approval"
        closeLabel="Dismiss"
        onClose={() => {}}
      >
        {replace
          ? "The new details replace the current ones and the feed syncs again."
          : "The feed becomes active and the worker syncs it within a few minutes."}
      </Alert>
    </Flex>
  )
}
