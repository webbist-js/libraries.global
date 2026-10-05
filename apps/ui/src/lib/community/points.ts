// How points are earned, for the Noticeboard and Leaderboard's "how points
// work" reference. Keep in sync with the rewards plugin's point values
// (`apps/strapi/src/plugins/rewards/server/services/points.ts`).

export const POINTS_TABLE: [label: string, value: number][] = [
  ["New library approved", 50],
  ["Major edit approved", 15],
  ["Knowledge translation", 15],
  ["Minor edit approved", 5],
  ["Hours checked", 5],
  ["Status checked", 5],
  ["Daily streak", 1],
]
