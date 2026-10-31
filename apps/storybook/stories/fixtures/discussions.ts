import type { DiscussionRecord } from "@/components/discussions/api"

export const openingMessage = {
  id: "example-mobile-library",
  subjectId: "example-library-life",
  title: "Making mobile library stops easier to find",
  body: "Our mobile library visits three villages. How do you make the next stop easy to find when timings change?",
  state: "visible",
  version: 1,
  language: "en",
  author: { name: "Maya S.", background: "violet" },
  createdAt: "2026-01-15T10:00:00Z",
  reactions: { like: 3, love: 1 },
  myReaction: null,
  replyCount: 3,
  attachments: [],
} satisfies DiscussionRecord

export const conversationReplies: DiscussionRecord[] = [
  {
    ...openingMessage,
    id: "example-stop-notices",
    title: undefined,
    threadId: openingMessage.id,
    body: "We put the next stop first, with the arrival time. A clear delay notice helps people plan their visit.",
    author: { name: "Ben T.", background: "mint" },
    createdAt: "2026-01-15T11:15:00Z",
    reactions: { like: 2, love: 0 },
  },
  {
    ...openingMessage,
    id: "example-timetable",
    title: undefined,
    threadId: openingMessage.id,
    parentId: "example-stop-notices",
    body: "That would help us too. Do you keep the printed timetable alongside the live notice?",
    author: { name: "Maya S.", background: "violet" },
    createdAt: "2026-01-15T11:30:00Z",
    reactions: { like: 0, love: 0 },
  },
  {
    ...openingMessage,
    id: "example-accessibility",
    title: undefined,
    threadId: openingMessage.id,
    body: "We include a phone number for anyone who cannot check the online timetable.",
    author: { name: "Ari L.", background: "amber" },
    createdAt: "2026-01-15T11:45:00Z",
    reactions: { like: 1, love: 1 },
  },
]
