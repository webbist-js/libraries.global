"use client"

import { Icon } from "@iconify/react"
import { useId } from "react"

import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

export function PlaceSearchForm({
  name,
  level,
  slug,
}: {
  readonly name: string
  readonly level: "continent" | "country" | "region"
  readonly slug: string
}) {
  const router = useRouter()
  const id = useId()

  return (
    <form
      className="mt-6 flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const params = new URLSearchParams({ [level]: slug })
        const q = String(data.get("q") ?? "").trim()
        if (q) params.set("q", q)
        router.push("/libraries?" + params.toString())
      }}
    >
      <label className="sr-only" htmlFor={id}>
        Search libraries in {name}
      </label>
      <div
        className="flex min-h-12 min-w-40 flex-1 items-center gap-2 rounded-full border bg-(--t-bg-deep) px-4"
        style={{ borderColor: T.border.hi }}
      >
        <Icon
          icon="mdi:magnify"
          aria-hidden="true"
          width={18}
          style={{ color: T.ink.dim }}
        />
        <input
          id={id}
          name="q"
          type="search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={"Library name, town or region in " + name}
        />
      </div>
      <button
        type="submit"
        className="min-h-12 rounded-full px-5 text-sm font-semibold text-white"
        style={{ background: T.action.primary }}
      >
        Search libraries
      </button>
    </form>
  )
}
