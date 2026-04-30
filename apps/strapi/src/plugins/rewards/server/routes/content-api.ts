export default [
  {
    method: "GET",
    path: "/leaderboard",
    handler: "rewards.leaderboard",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/my-standing",
    handler: "rewards.myStanding",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/my-history",
    handler: "rewards.myHistory",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/how-it-works",
    handler: "rewards.howItWorks",
    config: { auth: false, policies: [] },
  },
]
