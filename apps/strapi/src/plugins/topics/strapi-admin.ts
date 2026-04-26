export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/topics`,
      icon: () => "🏷️",
      intlLabel: { id: "topics.plugin.name", defaultMessage: "Topics" },
      Component: async () => {
        const { App } = await import("./admin/src/index")

        return App
      },
    })
  },
  bootstrap() {},
}
