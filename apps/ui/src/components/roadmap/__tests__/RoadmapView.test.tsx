// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { normaliseRoadmap } from "@/lib/roadmap"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  composed: [] as unknown[],
}))

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string
    "aria-label"?: string
  }) => (
    <a href={href} aria-label={rest["aria-label"]}>
      {children}
    </a>
  ),
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: state.session, isPending: false }),
  },
}))
vi.mock("@/components/discussions/DiscussionComposerDrawer", () => ({
  DiscussionComposerDrawer: (props: {
    target: unknown
    contextTitle: string
  }) => {
    state.composed.push(props.target)

    return (
      <div role="dialog" aria-label={props.contextTitle}>
        New discussion
      </div>
    )
  },
}))
vi.mock("@/components/discussions/useDiscussionActor", () => ({
  useDiscussionActor: () => ({
    ready: true,
    signedIn: true,
    canModerate: false,
    scope: "ba-1",
  }),
}))
vi.mock("@/components/discussions/api", () => ({
  discussionRequest: async () => ({
    data: [{ slug: "roadmap", name: "Roadmap", createPolicy: "members" }],
  }),
}))

import { RoadmapView } from "../RoadmapView"

const content = normaliseRoadmap({
  title: "Roadmap",
  footnote: "Votes help us order the work but don’t decide it alone.",
  features: [
    {
      key: "save-views",
      title: "Save views and searches",
      description: "Keep an Atlas view.",
      stage: "now",
      area: "atlas",
      plans: [{ plan: "free", detail: "3 saved" }],
      noteKind: "target",
      note: "Aiming for December",
    },
    {
      key: "watch-library",
      title: "Watch a library for changes",
      description: "Hear when its hours change.",
      stage: "next",
      area: "watching",
      plans: [{ plan: "contributor" }],
    },
    {
      key: "embed",
      title: "Embeddable library finder",
      description: "A finder for your website.",
      stage: "later",
      area: "widgets",
      plans: [{ plan: "staff" }],
    },
  ],
  dataImports: [
    {
      key: "germany",
      place: "Germany",
      code: "DE",
      source: "Deutsche Bibliotheksstatistik",
      libraries: 2140,
      stage: "validating",
      stageNote: "About 70% of records checked",
    },
    {
      key: "portugal",
      place: "Portugal",
      code: "PT",
      source: "Rede Nacional de Bibliotecas Públicas",
      stage: "listed",
    },
  ],
})!

const engagement = {
  engagement: {
    "save-views": { votes: 214, posts: 0, activityAt: null, threadId: null },
    germany: { votes: 12, posts: 3, activityAt: null, threadId: "t-germany" },
  },
  voted: [] as string[],
  suggestions: [],
}

beforeEach(() => {
  state.session = null
  state.composed = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/relations/locales"))
        return Response.json({ data: [] })
      if (url.startsWith("/api/roadmap/votes"))
        return Response.json({
          data: {
            voted: JSON.parse(String(init?.body)).voted,
            votes: 215,
          },
        })

      return Response.json({ data: engagement })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("lays features out by stage and filters them by area", async () => {
  render(<RoadmapView content={content} />)
  const now = screen.getByRole("region", { name: /Now/ })
  expect(
    within(now).getByRole("heading", { name: "Save views and searches" })
  ).toBeTruthy()
  expect(within(now).getByText("Aiming for December")).toBeTruthy()
  expect(screen.getByRole("region", { name: /Later/ })).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Widgets & embeds" }))
  expect(
    screen.queryByRole("heading", { name: "Save views and searches" })
  ).toBeNull()
  expect(
    screen.getByRole("heading", { name: "Embeddable library finder" })
  ).toBeTruthy()
  expect(
    screen.getByText("Votes help us order the work but don’t decide it alone.")
  ).toBeTruthy()
})

it("asks a signed-out visitor to sign in to vote", async () => {
  render(<RoadmapView content={content} />)
  const link = await screen.findByRole("link", {
    name: "214: Sign in to vote for Save views and searches (214 votes)",
  })
  expect(link.getAttribute("href")).toContain("/auth/signin?callbackUrl=")
})

it("shows each dataset's step and lists the ones not started", () => {
  render(<RoadmapView content={content} />)
  const progress = screen.getByRole("progressbar", {
    name: "Validating the data",
  })
  expect(progress.getAttribute("aria-valuenow")).toBe("1")
  expect(progress.getAttribute("aria-valuetext")).toBe(
    "1 of 4 steps done: Validating the data"
  )
  expect(screen.getByText("libraries in the source")).toBeTruthy()
  expect(screen.getByText("Libraries on the way")).toBeTruthy()
  const list = screen
    .getByRole("heading", { name: "Next on our list" })
    .closest("div")!
  expect(within(list).getByText("Portugal")).toBeTruthy()
  expect(within(list).queryByRole("progressbar")).toBeNull()
})

it("records a signed-in vote and shows the new total", async () => {
  state.session = { user: { id: "ba-1" } }
  render(<RoadmapView content={content} />)
  fireEvent.click(
    await screen.findByRole("button", {
      name: "214: Vote for Save views and searches (214 votes)",
    })
  )
  const voted = await screen.findByRole("button", {
    name: "215: Remove your vote for Save views and searches (215 votes)",
  })
  expect(voted.getAttribute("aria-pressed")).toBe("true")
  expect(fetch).toHaveBeenCalledWith(
    "/api/roadmap/votes",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ key: "save-views", voted: true }),
    })
  )
})

it("links to an item's discussion once it has one", async () => {
  render(<RoadmapView content={content} />)
  const link = await screen.findByRole("link", {
    name: "Discuss Germany (3 posts)",
  })
  expect(link.getAttribute("href")).toBe("/community/discussions/t-germany")
})

it("starts a discussion in the shared composer drawer", async () => {
  render(<RoadmapView content={content} />)
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Discuss: Start a discussion about Save views and searches",
    })
  )
  expect(
    await screen.findByRole("dialog", { name: "Save views and searches" })
  ).toBeTruthy()
  await waitFor(() =>
    expect(state.composed.at(-1)).toEqual({
      uid: "api::roadmap.roadmap-item",
      documentId: "save-views",
      locale: "en",
    })
  )
})

it("sends a dataset suggestion from the drawer footer", async () => {
  state.session = { user: { id: "ba-1" } }
  render(<RoadmapView content={content} />)
  fireEvent.click(
    await screen.findByRole("button", { name: "Suggest a dataset" })
  )
  const drawer = await screen.findByRole("dialog", {
    name: "Suggest a dataset",
  })
  fireEvent.change(within(drawer).getByLabelText("Country or region"), {
    target: { value: "Portugal" },
  })
  fireEvent.change(within(drawer).getByLabelText("Dataset or publisher"), {
    target: { value: "Rede Nacional de Bibliotecas Públicas" },
  })
  fireEvent.click(
    within(drawer).getByRole("button", { name: "Send suggestion" })
  )
  expect(
    await within(drawer).findByText(/A moderator will check the source/)
  ).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(
    "/api/roadmap/suggestions",
    expect.objectContaining({ method: "POST" })
  )
})
