"use client"

import AppLink from "@/components/elementary/AppLink"
import Typography from "@/components/typography"

export default function PageList({
  pages,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages: any[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {pages?.map((page) => (
          <div key={page.documentId ?? page.id ?? page.slug}>
            <Typography variant="large">{page.title}</Typography>
            <AppLink href={page.slug ?? ""} openInNewTab className="mb-2 p-0">
              {page.slug}
            </AppLink>
          </div>
        ))}
      </div>
    </div>
  )
}
