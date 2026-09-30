/**
 * subscriber router
 *
 * Replaces the core router: no REST find/findOne/create/update/delete over
 * subscribers. Sign-up is the one custom action, called only by the UI's
 * `/api/newsletter` route (bridge secret checked in the controller).
 */

export default {
  routes: [
    {
      method: "POST",
      path: "/subscribers",
      handler: "subscriber.subscribe",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
