export async function headers() {
  return new Headers()
}
export async function cookies() {
  return {
    get: () => {},
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }
}
export async function draftMode() {
  return { isEnabled: false, enable: () => {}, disable: () => {} }
}
