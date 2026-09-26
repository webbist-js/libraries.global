/**
 * Constant-time string comparison for secrets. Pure JS so it runs in any
 * runtime (Node route handlers and the proxy/middleware alike). Always walks
 * the longer input so timing does not reveal the matching prefix length.
 */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  const length = Math.max(ea.length, eb.length)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < length; i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  }

  return diff === 0
}
