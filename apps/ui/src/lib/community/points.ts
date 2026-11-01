// How points are earned, for the Noticeboard and Leaderboard's "how points
// work" reference. Keep in sync with the rewards controller's rules catalogue
// and the moderation, discussion and drive award handlers.

export const POINTS_TABLE: [label: string, value: number][] = [
  ["New library approved", 50],
  ["Journal article accepted", 30],
  ["New Knowledge article approved", 25],
  ["Drive completion bonus (5+ accepted tasks)", 25],
  ["Major edit approved", 15],
  ["Knowledge translation approved", 15],
  ["Journal translation approved", 15],
  ["Library or network claim approved", 10],
  ["Drive proposal accepted", 10],
  ["Knowledge article edit approved", 8],
  ["Journal article edit approved", 8],
  ["CC-licensed photo accepted", 8],
  ["Minor edit approved", 5],
  ["Hours checked", 5],
  ["Status checked", 5],
  ["Event feed accepted", 5],
  ["Option suggestion accepted", 5],
  ["Source added to a record", 3],
  ["Correction approved", 2],
  ["Drive task accepted", 2],
  ["Discussion thread approved", 2],
  ["Discussion reply approved", 1],
  ["Discussion edit approved", 1],
  ["Daily streak bonus", 1],
]
