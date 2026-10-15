# Libraries Global — remaining work

The invitation-only beta is running on DigitalOcean. `dev` is the integration branch and `main` releases production through checked images and the guarded host agent. Public launch and live payments are separate decisions.

## Analytics beta release

- Merge the reviewed cookie-consent/GTM release candidate into `dev`, then review a release PR into `main`.
- Publish accurate cookie, privacy and beta notices before enabling collection. Review the existing material-change notice promise. Keep consent optional and advertising disabled.
- Verify the GTM draft, publish the accepted version at activation, and test refusal, grant, withdrawal, locale/navigation, private-route suppression and representative events on the deployed beta. [Analytics contract and acceptance](apps/ui/ANALYTICS.md).
- Verify exact-main CI, CodeQL, image publication, host acceptance and deployed revision. Dependency/data-sensitive changes require the private operator acceptance record. [Generic release checks](scripts/release/README.md).

## Product follow-ups

- Connect server-side GA4 reports to each authorised Team Library’s Staff Traffic tab. Enforce staff scope, the `library.traffic` entitlement and report completeness; never expose property-wide credentials to browsers. Platform tracking is implemented; Staff reporting is separate.
- Complete controlled sandbox checkout acceptance before considering live payments.
- Continue production-readiness work for bounded Atlas queries/exports, archives, derived search state, recovery and operational alerts.
- Review remaining moderation, contribution, notification and accessibility work against the current source before scheduling it.

Historical product audits, unverified findings, fixture identities, operator decisions and detailed acceptance records are retained privately. They are not evidence of the current deployment state.
