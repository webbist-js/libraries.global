/** Synthetic WebAuthn device for local acceptance; keys exist only in memory. */
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto"
import { createRequire } from "node:module"

// Use the pinned verifier's CBOR implementation for its wire-format fixtures.
const passkeyRequire = createRequire(
  import.meta.resolve("@better-auth/passkey")
)
const verifierRequire = createRequire(
  passkeyRequire.resolve("@simplewebauthn/server")
)
const { encodeCBOR } = verifierRequire("@levischuck/tiny-cbor")
const digest = (value) => createHash("sha256").update(value).digest()
const encoded = (value) => Buffer.from(value).toString("base64url")

export function testAuthenticator(origin) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  })
  const jwk = publicKey.export({ format: "jwk" })
  const credential = randomBytes(32)
  const coseKey = encodeCBOR(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, "base64url")],
      [-3, Buffer.from(jwk.y, "base64url")],
    ])
  )
  const clientData = (type, challenge, currentOrigin = origin) =>
    Buffer.from(
      JSON.stringify({
        type,
        challenge,
        origin: currentOrigin,
        crossOrigin: false,
      })
    )
  const authenticatorData = (rpId, flags, counter) => {
    const bytes = Buffer.alloc(37)
    digest(rpId).copy(bytes)
    bytes[32] = flags
    bytes.writeUInt32BE(counter, 33)

    return bytes
  }
  const base = {
    id: encoded(credential),
    rawId: encoded(credential),
    type: "public-key",
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  }

  return {
    registration(options, counter) {
      const length = Buffer.alloc(2)
      length.writeUInt16BE(credential.length)
      const authData = Buffer.concat([
        authenticatorData(options.rp.id, 0x45, counter),
        Buffer.alloc(16),
        length,
        credential,
        Buffer.from(coseKey),
      ])

      return {
        ...base,
        response: {
          clientDataJSON: encoded(
            clientData("webauthn.create", options.challenge)
          ),
          attestationObject: encoded(
            encodeCBOR(
              new Map([
                ["fmt", "none"],
                ["attStmt", new Map()],
                ["authData", authData],
              ])
            )
          ),
          transports: ["internal"],
        },
      }
    },
    authentication(options, counter, currentOrigin = origin) {
      const data = clientData("webauthn.get", options.challenge, currentOrigin)
      const authData = authenticatorData(options.rpId, 0x05, counter)

      return {
        ...base,
        response: {
          clientDataJSON: encoded(data),
          authenticatorData: encoded(authData),
          signature: encoded(
            sign("sha256", Buffer.concat([authData, digest(data)]), privateKey)
          ),
          userHandle: null,
        },
      }
    },
  }
}
