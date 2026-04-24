export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/content-moderation`,
      icon: () => "📋",
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
