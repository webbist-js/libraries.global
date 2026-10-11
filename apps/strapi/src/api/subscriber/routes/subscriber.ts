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
      method: "GET",
      path: "/subscribers/account",
      handler: "subscriber.account",
      config: { auth: false },
    },
    {
      method: "PUT",
      path: "/subscribers/account",
      handler: "subscriber.accountUpdate",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/subscribers/email-action",
      handler: "subscriber.emailAction",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/subscribers/export",
      handler: "subscriber.export",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/subscribers",
      handler: "subscriber.subscribe",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
