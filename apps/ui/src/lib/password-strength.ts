// A light guide for the sign-up meter. The server enforces the length rule;
// everything above it is advice, so it rewards length and passphrases over
// symbol-stuffing.

export type PasswordStrengthLabel =
  | "Empty"
  | "Too short"
  | "Weak"
  | "Fair"
  | "Good"
  | "Strong"

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: PasswordStrengthLabel
}

const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/]

export function passwordStrength(
  password: string,
  minLength: number
): PasswordStrength {
  if (password.length === 0) return { score: 0, label: "Empty" }
  if (password.length < minLength) return { score: 1, label: "Too short" }
  // "aaaaaaaaaa" or "abababab…" clears the length rule but guesses instantly.
  if (new Set(password).size <= 3) return { score: 1, label: "Weak" }

  const classes = CHARACTER_CLASSES.filter((re) => re.test(password)).length
  const words = password
    .split(/[\s._-]+/)
    .filter((word) => word.length >= 3).length

  if (
    words >= 4 ||
    password.length >= 20 ||
    (password.length >= 14 && classes >= 3)
  ) {
    return { score: 4, label: "Strong" }
  }
  if (words >= 3 || password.length >= 14 || classes >= 3) {
    return { score: 3, label: "Good" }
  }

  return { score: 2, label: "Fair" }
}
