# Email setup and testing

Two apps send email, through different transports and with different environment variables. Both need configuring before launch.

| App                                | Sends                                                                                                                                   | Transport                                         | Variables                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Site (`apps/ui`, Better Auth)      | Email confirmation after sign-up (and again on resend, or when an unconfirmed account tries to sign in), sign-in links, password resets | SMTP via nodemailer (`src/lib/email.ts`)          | `MAILTRAP_USER`/`MAILTRAP_PASS`, else `MAILGUN_SMTP_USER`/`MAILGUN_SMTP_PASS`/`MAILGUN_SMTP_HOST`; `EMAIL_FROM` |
| Strapi (content-moderation plugin) | Submission decisions to the submitter; new Role Applications and Location Requests to `MODERATORS_EMAIL`                                | Mailgun HTTP API, else SMTP (`config/plugins.ts`) | `MAILGUN_API_KEY`/`MAILGUN_DOMAIN`/`MAILGUN_HOST`, else `MAILTRAP_USER`/`MAILTRAP_PASS`                         |

The two apps check providers in opposite orders: the site uses Mailtrap if it's set, Strapi uses Mailgun if it's set. Set one provider per environment, never both.

Links in the emails are built from `APP_PUBLIC_URL` in each app. If it's wrong, every link in every email is wrong.

## Where things stand today

- `apps/ui/.env.local` has `MAILTRAP_API_TOKEN` and `MAILTRAP_TEST_INBOX_ID`. Nothing reads them. The site needs the inbox's SMTP username and password (`MAILTRAP_USER`, `MAILTRAP_PASS`), so locally no auth email is sent: the links are printed in the Next.js terminal instead.
- `apps/strapi/.env` has no email variables, so moderation emails are logged and skipped.
- In production the site throws instead of logging a link when no provider is set. Sign-up then fails with a server error after the account row has been created, so don't deploy the site without the Mailgun variables.

## 1. Local testing

### Quick check: no provider

With no email variables set, `pnpm dev` prints each auth link in the terminal running the site:

```
[email] No provider configured. Verification link for you@example.test: http://localhost:3000/api/auth/verify-email?token=…
```

Open that link to confirm the account. This is enough to test the page flow, but you don't see the email itself.

### Real emails: Mailtrap sandbox

A Mailtrap sandbox inbox accepts mail for any address and never delivers it, so you can register with made-up addresses.

1. In Mailtrap, open **Email Testing → Inboxes** and pick (or create) an inbox.
2. Open the inbox's **Integration** tab, choose **SMTP**, and copy the username and password. These are not the API token.
3. Add to `apps/ui/.env.local`:
   ```
   MAILTRAP_USER=<username>
   MAILTRAP_PASS=<password>
   # optional, these are the defaults
   MAILTRAP_HOST=sandbox.smtp.mailtrap.io
   MAILTRAP_PORT=2525
   ```
4. Add the same `MAILTRAP_USER` and `MAILTRAP_PASS` to `apps/strapi/.env` to catch moderation emails as well.
5. Restart both dev servers. Environment variables are read at boot.
6. Register with any address, for example `test1@example.test`. The confirmation email appears in the Mailtrap inbox within a few seconds. Mailtrap's **Spam Analysis** and **HTML Check** tabs are worth a look once.

Remove the Mailtrap variables from any environment that should send real email.

## 2. Production: Mailgun

1. **Create the domain in the EU region.** In Mailgun, **Sending → Domains → Add new domain**, region **EU**. Use a sending subdomain, `mg.libraries.global`, so Mailgun's DNS records don't touch the root domain's mail setup (the `info@` and `legal@` mailboxes).
2. **Add the DNS records Mailgun lists** at your DNS host. Mailgun shows the exact values. Expect:
   - TXT on `mg.libraries.global`: `v=spf1 include:mailgun.org ~all`
   - TXT on `<selector>._domainkey.mg.libraries.global`: the DKIM key
   - MX on `mg.libraries.global`: `mxa.eu.mailgun.org` and `mxb.eu.mailgun.org`, priority 10 (bounce handling)
   - CNAME `email.mg.libraries.global` → `eu.mailgun.org` (tracking; optional once tracking is off, see step 4)

   Then press **Verify DNS settings** and wait for every record to go green.

3. **Add a DMARC record** on the root domain if there isn't one: TXT on `_dmarc.libraries.global`, `v=DMARC1; p=none; rua=mailto:<a mailbox you read>`. Start at `p=none`. After a few weeks of clean reports, move to `p=quarantine`.
4. **Turn off click and open tracking** for the domain (**Domain settings → Tracking**). Click tracking rewrites every link through Mailgun's redirect host, which sends confirmation and sign-in tokens through a third party and makes spam filters suspicious.
5. **Create SMTP credentials for the site.** **Domain settings → SMTP credentials → Add new SMTP user**, for example `auth@mg.libraries.global`. Copy the password when it's shown; Mailgun won't show it again.
6. **Create an API key for Strapi.** **Domain settings → Sending API keys → Add sending key** (scoped to this domain). Strapi only sends, so a sending key is enough.
7. **Check the plan.** A trial account only delivers to authorised recipients. Make sure the plan's daily limit covers launch sign-ups.

## 3. Environment variables

### Vercel (site)

| Variable              | Value                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `MAILGUN_SMTP_USER`   | the SMTP username from step 5, e.g. `auth@mg.libraries.global`                                |
| `MAILGUN_SMTP_PASS`   | its password                                                                                  |
| `MAILGUN_SMTP_HOST`   | `smtp.eu.mailgun.org`. The code defaults to the US host, which rejects EU-domain credentials. |
| `EMAIL_FROM`          | `"Libraries Global" <noreply@libraries.global>` (the default if unset)                        |
| `APP_PUBLIC_URL`      | `https://libraries.global`. Better Auth's base URL; every auth link starts with it.           |
| `NEXT_PUBLIC_APP_URL` | the same URL. The browser auth client calls it.                                               |

No `MAILTRAP_*` variables in production or preview.

### Strapi Cloud

| Variable           | Value                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `MAILGUN_API_KEY`  | the sending key from step 6                                                                                                    |
| `MAILGUN_DOMAIN`   | `mg.libraries.global`                                                                                                          |
| `MAILGUN_HOST`     | `https://api.eu.mailgun.net` (the default)                                                                                     |
| `MAILGUN_EMAIL`    | leave unset. It sets both From and Reply-To; unset gives From `noreply@libraries.global` and Reply-To `info@libraries.global`. |
| `MODERATORS_EMAIL` | a mailbox someone reads (default `moderators@libraries.global`)                                                                |
| `APP_PUBLIC_URL`   | `https://libraries.global`, for the links in moderation emails                                                                 |

## 4. Test checklist

Run these locally against Mailtrap first, then once on staging or production with real inboxes.

### Sign-up

- [ ] **Register.** `/auth/register` → `/auth/verify-email-sent`. The page names your address, and step 2 of 3 ("Confirm your email") is active on the left. One email arrives with the subject "Confirm your Libraries Global email address".
- [ ] **Confirm.** The link signs you in and lands on `/profile/onboarding`.
- [ ] **Resend.** On the verify page, "Resend in 30s" counts down, then "Resend the email" sends a second email. Either link confirms the account.
- [ ] **Sign in before confirming.** At `/auth/signin` with the new account's password you land on "Confirm your email first", and a new email arrives. Its link goes to onboarding, then to the page you were signing in for.
- [ ] **Expired link.** Confirmation links last one hour (`VERIFICATION_LINK_TTL_SECONDS` in `apps/ui/src/lib/auth-links.ts`). To test without waiting, set it to `60` locally, restart, and open the link after a minute. You land on "That link has expired" with a field to send a new one. Put the value back afterwards.
- [ ] **Broken link.** Change a character in the token and open it: "That link didn't work".
- [ ] **Used link.** Open a confirmation link a second time in a signed-out browser. You land on the sign-in page. That's expected: the email is already confirmed.
- [ ] **Existing address.** Register again with the same address: "An account with this email already exists."
- [ ] **Google.** Continue with Google from `/auth/register`. No email is sent; you go straight to onboarding.

### Other auth emails

- [ ] **Sign-in link.** "Email me a sign-in link" → `/auth/magic-link-sent` names the address. The link works once, within 5 minutes, and lands on onboarding (new account) or home. Opening it a second time lands on `/auth/magic-link` ("That link didn't work") with a field to send a new one.
- [ ] **Password reset.** `/auth/forgot-password` → "Check your inbox" → the email ("Reset your Libraries Global password") → `/auth/reset-password` → "Password saved". Every session for the account is signed out, so sign in again. Opening the same link again shows "That link no longer works".
- [ ] **Change password.** Settings → Sign-in methods → "Change password". A wrong current password shows under that field. With "Sign out on my other devices" ticked, other browsers are signed out and this one stays in.
- [ ] **Add a password (Google accounts).** For an account that only uses Google, Settings shows "Add a password", and `/auth/change-password` offers "Email me a link". The reset email's link adds a password, and the account can then sign in either way.

### Strapi

- [ ] Approve a submission from a test account: the submitter gets the decision email (unless they turned off "edits reviewed" in Settings).
- [ ] Submit a Role Application: `MODERATORS_EMAIL` gets the notice.

### Production deliverability (once)

- [ ] Sign up with addresses you own at Gmail, Outlook and iCloud. Each email should land in the inbox, not spam.
- [ ] In Gmail, open the email → **⋮ → Show original**. SPF, DKIM and DMARC should all say `PASS`. If DMARC fails while DKIM passes, the From domain and the Mailgun domain don't align: verify the root domain in Mailgun, or send from `noreply@mg.libraries.global`.
- [ ] Send one to the address on [mail-tester.com](https://www.mail-tester.com) and aim for 9/10 or better.
- [ ] Check every link in the emails points at `https://libraries.global`, not `localhost` or a Mailgun tracking host.
- [ ] In Mailgun, **Sending → Logs** shows each send as Delivered.

## 5. Troubleshooting

| Symptom                                                                                 | Likely cause                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up shows a server error in production; logs say "Email delivery is not configured" | `MAILGUN_SMTP_USER`/`MAILGUN_SMTP_PASS` missing. The account was created anyway: once mail is fixed, the person can sign in, which sends a new confirmation link. |
| SMTP error `535 Authentication failed`                                                  | EU-domain credentials against the US host: set `MAILGUN_SMTP_HOST=smtp.eu.mailgun.org`. Or the SMTP password was regenerated.                                     |
| Links point at `localhost:3000`                                                         | `APP_PUBLIC_URL` not set in that app.                                                                                                                             |
| Emails go to spam                                                                       | DNS records not verified, DMARC failing (check Show original), or click tracking still on.                                                                        |
| Strapi logs "No email provider is configured" at boot                                   | `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` missing in Strapi's environment.                                                                                           |
| A link lands on the sign-in page with no message                                        | The link was already used (see "Used link" above).                                                                                                                |
| Locally, no email arrives in Mailtrap                                                   | `MAILTRAP_USER`/`MAILTRAP_PASS` not set, or the server wasn't restarted. Check the terminal for the logged link.                                                  |

## Known gaps

- The emails are plain: one paragraph and a bare link, no branded template or button.
- The site sends auth emails inside the request, so sign-up waits on the SMTP round trip. Better Auth can hand them to a background task (`advanced.backgroundTasks` with Vercel's `waitUntil`) if that becomes noticeable.
- No automated test reads a real inbox. A Playwright spec could register, fetch the confirmation email through Mailtrap's API (the `MAILTRAP_API_TOKEN` and inbox id already in `.env.local`, plus the account id) and follow the link.
- `apps/ui/package.json` depends on the `mailtrap` package, but nothing imports it.
