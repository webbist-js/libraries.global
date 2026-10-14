import { betaInvitationNotice } from "./beta-invitation-notice.mjs"

const paragraph = (...parts) => ({
  type: "paragraph",
  children: parts.map((part) =>
    typeof part === "string"
      ? { type: "text", text: part }
      : {
          type: "link",
          url: part.url,
          children: [{ type: "text", text: part.text }],
        }
  ),
})
const link = (text, slug) => ({ text, url: `/legal/${slug}` })
const section = (heading, inShort, ...body) => ({ heading, inShort, body })

/** Temporary entrance notice. It supplements, rather than replaces, site policies. */
export function betaLegalContent(operator, postalAddress, email) {
  const document = {
    slug: "beta",
    title: "Beta terms & privacy",
    heroTitle: "Beta terms *& privacy.*",
    navLabel: "Beta notice",
    lead: "A temporary notice for the closed-beta entrance, access requests and feedback. The main site's standard policies apply once you enter.",
    order: 99,
    summaryPoints: [
      {
        text: "Beta access is an invitation to test; it does not create an account or membership.",
      },
      {
        text: "The waitlist is for requested beta access only. No newsletter enrolment.",
      },
      {
        text: "Standard site and membership policies remain available before and after entry.",
      },
    ],
    sections: [
      section(
        "Beta access",
        "Keep the shared invitation password private, and expect changes during testing.",
        paragraph(
          `Libraries Global is operated by ${operator}, who is the controller of the personal information described here. Contact: ${email}. Postal contact: ${postalAddress}.`
        ),
        paragraph(
          "The closed beta is a limited invitation to test a developing service. Please do not share the invitation password publicly, misuse access or submit harmful or unlawful content. Features can change, become unavailable or contain errors. Test data may be reset; do not rely on beta records as your only copy of important information. These limitations do not remove statutory rights or change the promises made for any paid membership."
        ),
        paragraph(
          "Entering the shared beta password remembers access in this browser. It does not identify you, sign you in, create an account, grant staff permissions or buy a membership. Creating an account is a separate step under the standard site terms, including the requirement to be 18 or over."
        )
      ),
      section(
        "Privacy",
        "Your access request and feedback stay private and are used for their stated purpose.",
        paragraph(
          "If you request beta access, we store your email address, preferred language, request time and a record of what you requested. We use your consent to contact you about that access. Joining does not create an account or subscribe you to newsletters, product updates or marketing. Email us to withdraw the request or ask for deletion; withdrawal does not affect processing already carried out."
        ),
        paragraph(
          "If you send feedback or contact us, we receive your message, any name and email you provide, and technical context such as the page, browser, language and device dimensions. We use our legitimate interest in answering requests, fixing faults and protecting the service. Please avoid including passwords, payment details or sensitive personal information in feedback."
        ),
        paragraph(
          "Hosting and security services receive IP addresses, browser details and requested pages. We use these for our legitimate interest in delivering and protecting the service. Our providers include Vercel for website hosting, Strapi Cloud for stored content and access requests, Brevo for email delivery, Namecheap Private Email for correspondence, and Sentry for error reporting. We do not sell access-request information or use it for advertising. The full privacy notice explains recipients, international-transfer safeguards and how to request details."
        ),
        paragraph(
          "Access-request records are kept while needed to arrange beta access. A withdrawn or blocked record may be retained to prevent a later retry or import from re-enrolling you. Correspondence is kept for up to two years after the matter closes, unless needed longer for a legal claim. Provider server logs are kept for up to 30 days and error reports for up to 90 days, as described in the full privacy notice. Short-lived beta attempt counters expire after 15 minutes; expired database records are removed by housekeeping."
        ),
        paragraph(
          `You can ask ${email} for access, correction, deletion, restriction or portability of your information, object to processing based on legitimate interests, or withdraw consent. These rights have legal limits. You can complain to the `,
          {
            text: "Information Commissioner's Office",
            url: "https://ico.org.uk/make-a-complaint/",
          },
          " or your local data protection authority where applicable. See the ",
          link("full privacy notice", "privacy"),
          " for further details."
        )
      ),
      section(
        "Essential cookies",
        "A signed cookie remembers beta access for up to 30 days.",
        paragraph(
          "After you enter the invitation password, the essential lg-beta-access cookie stores a signed expiry and access version. It contains no email address or account identifier and lasts up to 30 days. It is protected from script access and sent securely over HTTPS in production. Rotating the beta password or access version invalidates existing passes. Clearing or blocking the cookie means you will need to enter the password again."
        ),
        paragraph(
          "Other essential storage may support security, interface choices and feedback. After entry, account and payment features use the storage described in the ",
          link("standard cookie policy", "cookies"),
          ". This notice does not add advertising or analytics cookies."
        )
      ),
      section(
        "After you enter",
        "Use the standard legal documents for the main site, accounts and payments.",
        paragraph(
          "This temporary notice covers the beta entrance and access requests. Once you enter, the site shows its normal navigation, footer and legal documents: ",
          link("Terms of use", "terms"),
          ", ",
          link("Privacy", "privacy"),
          " and ",
          link("Cookies", "cookies"),
          ". Those policies also remain directly readable without a beta pass."
        ),
        paragraph(
          "If you choose a paid membership during beta, read the separate ",
          link("Membership terms", "membership"),
          " and ",
          link("Cancellation & refunds policy", "cancellation-refunds"),
          ". Beta entry does not change billing, renewal, cancellation or refund rights. This notice will be removed from the beta entrance when the gate is retired; it is not part of the main site's legal navigation."
        )
      ),
    ],
  }

  return { ...document, sections: betaInvitationNotice(document) }
}
