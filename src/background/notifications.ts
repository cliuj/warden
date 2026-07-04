export function notify(title: string, msg: string) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon.svg"),
    title,
    message: msg
  })
}
