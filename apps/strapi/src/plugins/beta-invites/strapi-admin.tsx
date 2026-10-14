function BetaIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: "/plugins/beta-invites",
      icon: BetaIcon,
      intlLabel: { id: "beta-invites.name", defaultMessage: "Beta invites" },
      permissions: [{ action: "plugin::beta-invites.manage", subject: null }],
      Component: async () => (await import("./admin/App")).App,
    })
  },
  bootstrap() {},
}
