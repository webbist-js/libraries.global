function RewardsIcon() {
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
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  )
}

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/rewards`,
      icon: RewardsIcon,
      intlLabel: {
        id: "rewards.plugin.name",
        defaultMessage: "Rewards",
      },
      Component: async () => {
        const { App } = await import("./admin/src/index")

        return App
      },
    })
  },
  bootstrap() {},
}
