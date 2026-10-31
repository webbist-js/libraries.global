# Feature entry pages

Selected workspace entry points explain the feature before asking a visitor to
sign in. The page stays at the destination they chose, with benefits, access
requirements, a section-specific sign-in action, free registration and a public
alternative. Members without a Team see Team plans and setup actions instead of
another sign-in prompt.

## Redirect audit and decisions

| Destination                                              | Visitor experience                                  | Member without the relevant access                                                                 |
| -------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/staff`                                                 | Keep the existing staff introduction                | Keep the free claim and verification journey                                                       |
| `/staff/networks`                                        | Explain affiliations and service management         | Keep the existing affiliation/request workspace; a Team purchase is not required to request access |
| `/staff/teams`                                           | Explain Teams before sign-in                        | Offer Team plans, setup or an invitation from an organiser                                         |
| `/staff/teams/widgets`                                   | Explain connected maps, directories and charts      | Explain the active Team requirement and offer plans/setup                                          |
| `/developers`                                            | Public API docs and metered playground              | Explain that API access is a separate Team add-on; personal Pro is insufficient                    |
| `/staff/claim`, `/contribute/claim`                      | Explain free staff claims and review                | Keep the existing claim workspace                                                                  |
| `/contribute/index`                                      | Invite small, sourced improvements                  | Keep the existing record finder and contribution workflow                                          |
| `/contribute/index/new`                                  | Explain adding a missing library before sign-in     | Keep the existing wizard and its staff-routing rules                                               |
| `/contribute/knowledge`                                  | Invite Journal writing and explain Knowledge roles  | Keep the existing writing workspace, owned stories and editorial checks                            |
| `/contribute/knowledge/apply`                            | Explain contributor roles and reviewed applications | Keep the existing application and eligibility checks                                               |
| `/community/propose`                                     | Keep its existing in-page sign-in explanation       | Keep contribution-history eligibility checks                                                       |
| `/plans`, public drives and public library/network pages | Remain public                                       | Keep contextual, in-place actions and plan prompts                                                 |

Staff navigation exposes the networks, Teams, widgets, API and claim entry pages
without requiring an existing Team. Billing appears only for an existing Team;
staff-only library creation still follows its eligibility check. The writing
hub and contributor-role introduction are separate entry points; existing
editor-role navigation and publication checks remain in force.

## API workspace

`/developers` is linked from the main navigation and Teams. Its overview links
to `/developers/reference` and `/developers/playground`, which visitors can read
without signing in or buying a Team. Signed-in accounts without a Team see
plans and setup actions. Guests see a sign-in action that returns to their
chosen API page. Existing beta and staging gates still apply.

Team accounts also see `/developers/keys` and `/developers/usage`. The server
rechecks Team membership before loading private controls. Organisers retain key
and billing management; members can inspect usage. An active Team and API add-on
are required to create usable keys for application access.

The playground requires active Team API coverage and an existing Team API key.
The form calls the normal versioned API endpoints, so successful requests and
response bytes consume the same shared allowance as application traffic. This is
stated above the form and beside Run. Each “Read this record” action is another
metered request. Guests and accounts without coverage see login or upgrade
prompts, with no token entry or runnable controls. There is no unauthenticated
demo endpoint; entering the page does not make a request automatically.

The old `/staff/teams/api` entry redirects to the API overview, preserving locale,
payment confirmation and guided setup parameters.

## Keep direct gates for private work and actions

Billing, checkout/setup actions, invitation tokens, private widget builders,
publication and management pages, individual record/article editors, draft
resumption, submissions, profile settings, notifications, password changes and
moderation keep their existing authentication and authorisation behaviour.
These destinations concern a particular account, private record or action;
an introduction would interrupt the intended task or reveal inappropriate
navigation. Staff record deep links keep the existing public-identity claim
introduction and denial rules.

## Implementation boundary

`FeatureAccessLanding` renders product copy only. Guest and no-Team branches
return before loading private workspace records, keys, drafts, usage or claim
details. Paid membership never grants staff verification or editorial authority.
The API, submission policies and backend permission checks remain authoritative.

`feature-access.ts` lists exact entry paths for the guest account boundary.
It does not match descendants: allowing `/staff/teams/widgets` does not allow a
private widget, builder or publication page. Account changes and failed session
verification still hide previously authorised content.

Sign-in callbacks preserve the destination, supported locale and relevant query
context, including selected networks, library claims, contribution places and
editor-role choices. Return paths use the existing same-origin validator.
Registration uses the standard account flow. No private IDs, query values or
account details are added to analytics. Existing staff `noindex` and private
cache policy remain in force because the same URLs also host workspaces.

Copy lives in the `featureAccess` locale messages for English, French and Czech.
No CMS schema or authentication-provider change is required.
