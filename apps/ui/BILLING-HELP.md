# API Access billing and payments

Every library record, individual record download, contribution, follow and saved event remains free. Signed-in accounts get the Explorer tools (comparison, context layers, alerts, notes, change history and exports of up to 10,000 rows, 20 times a day) at no charge. Contributor and Supporter recognition are earned through accepted contributions and cannot be bought. Verified Staff tools are free and depend on verified library authority, never on payment.

API Access is the only paid offer. It costs £100 per month, a tax-inclusive base GBP price, and includes 10,000 successful requests, 250 MiB of response data and 100 analysis credits per billing period. Sponsorship is arranged separately by agreement and never buys API capacity, ranking or editorial treatment.

## Buying API Access

Open `/developers` and choose **Buy API access**. Sign in or create a free account and verify your email. If you do not belong to an organisation, a single-member organisation is created for the API account. Read the API purchase terms and consent to the offer. Stripe Managed Payments hosts the payment page and confirms tax, any local currency conversion and the final recurring total before payment.

The Libraries Global operator identified in the published terms is the seller and supplier of the API service. Stripe Managed Payments is merchant of record for the payment transaction. Access starts only when the first invoice is settled; the return page alone grants nothing.

## Allowances and overage

Allowances reset at the start of each paid billing period, not on a calendar date. A first partial period gets the full allowance. A new allowance starts only when the next period's invoice is settled.

Overage is off unless an organiser opts in and accepts the overage terms. With overage on, usage beyond the included amounts costs 1p per request, 10p per MiB of response data and 50p per analysis credit, up to a monthly cap the organiser chooses between £10 and £500. The cap applies to total overage before tax. When an allowance or the cap is reached, new requests and jobs are refused with a documented 429 response. Failed, refused or timed-out work is never charged. The dashboard shows used and remaining units, the accrued overage and the estimated next invoice, and warns at 50%, 80% and 100%.

## Managing billing

Organisers use **Manage API billing** on `/developers` to update payment details, view invoices or stop renewal. Members of the organisation can see usage but cannot buy, change billing or create keys. A failed renewal does not create a new allowance, and past-due time never allows overage.

## Cancellation, refunds and account deletion

Cancelling stops future renewal; settled access normally continues to the paid period end. A refund request is separate from cancellation. Read the cancellation and refund policy and the Link terms shown at checkout. Link's refund policy prevails over a more restrictive policy we set, and statutory rights remain unchanged. Contact info@libraries.global for product and access help, and use the transaction-support route on the Stripe confirmation for payment or refund help.

A refund or dispute can suspend the refunded API access. Deleting an account first cancels any API subscription it alone owns and expires open checkout sessions; if that cannot be confirmed, deletion is refused so billing cannot continue against an erased account. The last organiser of an organisation that others rely on must hand over before deleting their account. Provider financial records and minimal reconciliation references can remain where needed for accounting, disputes or legal obligations.

## Troubleshooting

- Missing invoice or uncertain payment: use the same account and the secure billing page. Do not share sign-in links, full card details, API keys or passwords with support.
- Apple Pay or Google Pay absent: availability depends on the device, browser, wallet and location. Use another payment method Stripe offers.
- API access still confirming: allow time for synchronisation, then contact support with the invoice reference shown on your billing page.
- Requests refused: check the remaining allowance headers, the overage setting and cap, key scopes and whether the subscription is still paid.

Essential billing and access notices do not subscribe you to marketing. Newsletter, product updates and weekly emails have their own Settings choices.
