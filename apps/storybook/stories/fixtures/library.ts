import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

import { weeklyHours } from "./opening-times"

/** A synthetic catalogue record, never read from a live CMS or customer account. */
export const libraryFixture = {
  id: 1,
  documentId: "example-library",
  name: "Northbridge Community Library",
  slug: "northbridge-community-library",
  locale: "en",
  createdAt: "2026-01-01T12:00:00Z",
  updatedAt: "2026-01-15T12:00:00Z",
  publishedAt: "2026-01-15T12:00:00Z",
  openingTimes: {
    version: 2,
    days: weeklyHours.days.map((entry) => ({
      day: entry.day,
      enabled: entry.enabled,
      timeframes: entry.timeframes.map((frame, index) => ({
        id: frame.id ?? `${entry.day}-${index}`,
        startTime: frame.startTime,
        endTime: frame.endTime,
        staffing: frame.staffing ?? "open",
      })),
    })),
  },
  timezone: "Europe/London",
  operationalStatus: "open",
  libraryType: { id: 1, documentId: "example-public-type", name: "Public" },
  streetAddress: "1 Example Square, Northbridge",
  phone: "+44 20 7946 0000",
  email: "library@example.invalid",
  website: "https://example.invalid/library",
  description: [
    {
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "A welcoming community library with accessible reading rooms and a local history collection.",
        },
      ],
    },
  ],
  location: { type: "Point", coordinates: [-0.1, 51.5] },
  services: [],
  amenities: [],
  accessibility: [],
} satisfies PopulatedLibraryData
