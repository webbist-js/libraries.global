import { T } from "@/lib/design-tokens"

import { renderValue } from "./submissionMeta"

/**
 * Label/value pairs as a description list. Only http(s) values become
 * links (contributor text, so no other scheme is trusted).
 */
export function KeyValueList({
  rows,
}: {
  readonly rows: { label: string; value: unknown }[]
}) {
  if (rows.length === 0) return null

  return (
    <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(({ label, value }) => {
        const { text, isUrl } = renderValue(value)

        return (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm font-semibold" style={{ color: T.ink.dim }}>
              {label}
            </dt>
            <dd
              className="m-0 text-base break-words"
              style={{ color: text === "—" ? T.ink.faint : T.ink.base }}
            >
              {isUrl ? (
                <a
                  href={text}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline"
                  style={{ color: T.accent.primary, wordBreak: "break-all" }}
                >
                  {text.length > 60 ? `${text.slice(0, 60)}…` : text}
                </a>
              ) : (
                text
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
