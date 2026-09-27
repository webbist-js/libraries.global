"use client"

import { useState } from "react"

export function ArticleShareButtons({
  title,
  slug,
}: {
  readonly title?: string | null
  readonly slug?: string | null
}) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const href = window.location.href
    navigator.clipboard.writeText(href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title ?? "")}&url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : `/journal/${slug ?? ""}`)}`

  return (
    <div className="flex items-center gap-2">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X / Twitter"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-(--t-border-line) bg-(--t-bg-surface) text-(--t-ink-faint) transition-colors hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-(--t-border-line) bg-(--t-bg-surface) text-(--t-ink-faint) transition-colors hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
      >
        {copied ? (
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              d="M3 8l3.5 3.5L13 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="2" y="5" width="9" height="9" rx="1.5" />
            <path d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2H12a2 2 0 0 1 2 2v5.5A1.5 1.5 0 0 1 12.5 11H11" />
          </svg>
        )}
      </button>
    </div>
  )
}
