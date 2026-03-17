"use client"

import Typography from "@/components/typography"

export default function ComponentsList({
  components,
}: {
  components: string[]
}) {
  if (components.length === 0) {
    return (
      <Typography>
        The current `page` schema does not include page-builder content blocks.
      </Typography>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6">
        {components?.map((component) => (
          <div key={component}>
            <Typography variant="large">{component}</Typography>
          </div>
        ))}
      </div>
    </div>
  )
}
