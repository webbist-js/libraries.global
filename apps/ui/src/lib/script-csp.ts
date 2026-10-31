/** First-stage site-wide policy. The live console retains its stricter enforced
 * policy. Promote this policy only after collecting browser acceptance evidence.
 */
export function scriptCsp(nonce: string) {
  return `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; object-src 'none'; base-uri 'self'`
}
