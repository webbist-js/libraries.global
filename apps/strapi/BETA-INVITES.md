# Beta invitations

Open **Beta invites** in the Strapi sidebar. The dashboard reads the existing Subscriber collection, restricted to beta access requests. Its admin permission is **Beta invites → Manage beta invitations**; it does not use end-user roles.

Choose **Send invite** beside a waiting request. This queues an individual email using the application's shared HTML/text template and existing email worker. Nothing is sent automatically when someone joins the waitlist. The newsletter remains a separate consent record.

The regular CMS cron delivery job processes the queue when `CRON_ENABLED=true`. Hosts that keep general CMS cron disabled must schedule the existing private `/api/notifications/operations` endpoint with action `betaInvites` and the service bridge secret. This runs invitation cleanup and the same delivery worker restricted to beta mail, preserving unrelated pending email. Never expose this operator call to the browser.

The dashboard shows Waiting, Queued, Sent, Accepted, Failed, Expired, Revoked and Unavailable. Search by email and filter by language or status. Counts reflect the email and language filters, before the status filter. History shows issuance, sending, acceptance, expiry, revocation and failed delivery attempts. **Sent** means the email provider accepted the message; it does not confirm inbox delivery.

- **Retry** requeues a failed delivery with the same code, if the invitation is still usable.
- **Resend** issues a replacement, invalidating all previous invitations and browser passes for that request. Resends are limited to once a minute.
- **Revoke** ends all invitations and browser passes for that request. It does not unsubscribe their independent newsletter record.
- **Preview email** shows fictional English, Czech or French content according to the language filter and sends nothing.

Each invitation has a random single-use code and expires seven days after issuance. The email link carries it in the browser fragment, so ordinary server request URLs do not contain the credential. Opening the link only fills the entrance form; pressing Enter redeems it. Mail scanners cannot consume it with a GET. Acceptance gives that browser an independent signed 30-day cookie and does not create or sign into an account. Another browser or an expired/cleared pass needs a replacement invitation.

Strapi stores the code's hash and temporarily encrypts the code while delivery is pending, using the existing stable `EMAIL_LINK_SECRET` of at least 32 characters. The email queue stores only the invitation ID. Sending clears the encrypted code; redemption/revocation clears the hash too. Daily housekeeping clears expired unsent credentials. No live code is shown in admin responses or previews.

The UI checks accepted invitations through the bridge on protected requests. Revoked, withdrawn, suppressed, deleted or expired grants are refused, including when a browser still holds its signed cookie. CMS outages refuse access. `BETA_ACCESS_SECRET` signs cookies; rotating it or `BETA_ACCESS_VERSION` ends all browser passes. The shared `BETA_PASSWORD` is retired and old shared-password cookies are invalid.

Deployment needs the existing SMTP provider, `EMAIL_LINK_SECRET`, matching `STRAPI_BRIDGE_SECRET`, `APP_PUBLIC_URL`, `BETA_ACCESS_SECRET` and a running CMS email cron (`CRON_ENABLED=true`). The new plugin adds its invitation table and a beta email kind. Generate Strapi types, build the plugin and both applications, and follow the private production database acceptance and rollback runbook before promotion. Existing waitlist records need no conversion or bulk mailing.

The plugin adds its invitation table to Strapi's core persisted-table list so an older image's schema sync preserves issued invitations during rollback. Rolling back restores the earlier shared-password application behavior; returning to the new image resumes individual grant checks. Do not restore an older database over current invitation records without following the recovery procedure.

SMTP delivery and database updates cannot form one atomic transaction. A provider acceptance followed by a lost connection or database failure may cause a retry of the same invitation email. Retrying never generates a different credential or grants access twice.
