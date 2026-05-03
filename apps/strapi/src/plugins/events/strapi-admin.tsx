// apps/strapi/src/plugins/events/strapi-admin.tsx

function CalendarIcon() {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/events`,
      icon: CalendarIcon,
      intlLabel: { id: "events.plugin.name", defaultMessage: "Events" },
      Component: async () => {
        const { App } = await import("./admin/src/index")

        return App
      },
    })
  },
  bootstrap() {},
}
