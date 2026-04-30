// Simple inline SVG icon — avoids importing peerDeps in the static entry bundle
function ModerationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/content-moderation`,
      icon: ModerationIcon,
      intlLabel: {
        id: "content-moderation.plugin.name",
        defaultMessage: "Moderation",
      },
      Component: async () => {
        const { App } = await import("./admin/src/index")

        return App
      },
    })
  },
  bootstrap() {},
}
