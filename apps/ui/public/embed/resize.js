/* Optional Libraries Global iframe resizing. No analytics or network requests. */
;(() => {
  "use strict"
  const script = document.currentScript
  if (!script?.src) return
  const trustedOrigin = new URL(script.src).origin
  window.addEventListener("message", (event) => {
    if (event.origin !== trustedOrigin) return
    const message = event.data
    if (
      !message ||
      message.type !== "libraries-global-widget-resize" ||
      typeof message.publicId !== "string" ||
      !Number.isInteger(message.height) ||
      message.height < 240 ||
      message.height > 1600
    )
      return
    for (const frame of document.querySelectorAll("iframe[data-lg-widget]")) {
      let url
      try {
        url = new URL(frame.src)
      } catch {
        continue
      }
      if (
        url.origin !== trustedOrigin ||
        url.pathname !== `/embed/w/${message.publicId}` ||
        frame.dataset.lgWidget !== message.publicId ||
        event.source !== frame.contentWindow
      )
        continue
      frame.style.height = `${message.height}px`
    }
  })
})()
