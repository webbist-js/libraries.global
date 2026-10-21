# Existing lint warnings

`pnpm lint:ratchet` runs the same configured workspace checks as `pnpm lint` and fails on every error, any warning in a new file/rule pair, or an increased warning count in an existing pair. CI uses this gate. The baseline records existing maintenance debt; it does not suppress ESLint diagnostics or certify that the old warnings are harmless.

Fix the underlying problem rather than raising the allowance. After a cleanup passes, run `pnpm lint:ratchet --tighten` to reduce the checked-in baseline to the remaining counts. It refuses to write if there is any increase. Review baseline changes with the associated source diff. Normal `pnpm lint` still prints all findings for investigation.
