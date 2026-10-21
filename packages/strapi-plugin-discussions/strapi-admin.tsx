function DiscussionIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: "plugins/discussions",
      icon: DiscussionIcon,
      intlLabel: { id: "discussions.name", defaultMessage: "Discussions" },
      permissions: [{ action: "plugin::discussions.read", subject: null }],
      Component: () => import("./admin/Review"),
    })
    app.registerPlugin({ id: "discussions", name: "Discussions" })
  },
  bootstrap() {},
}
