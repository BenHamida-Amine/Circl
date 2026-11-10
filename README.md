# Circl

The first clickable layer of Circl follows the [Figma prototype](https://www.figma.com/proto/s9FpYfZ7nxcmwlerSkLL1B?node-id=4-58&starting-point-node-id=4%3A58). It includes the overview, discovery, Standard and Special circle details, creation, charity, agreement and end-of-cycle previews.

## Run locally

Install Node.js 20 or newer. From the repository directory, run:

```sh
npm start
```

Open <http://127.0.0.1:4173/>. The app uses native HTML, CSS and JavaScript and requires no package installation or credentials.

## Account preview

Choose **I’m new to Circl** or **I already have an account**, then choose **Person** or **Organization**. Use **Fill sample details** to try either form. Sign-up shows a sample inbox with a confirmation code. The demo sends no email, creates no account, and keeps only the sample account type in the current browser tab.

## Connect real accounts

1. Create a dedicated Supabase project and run [the account schema](supabase/circl-accounts.sql) in its SQL editor. It validates the profile fields, reserves a case-insensitive username for each person, and restricts profile reads to the owner.
2. Enable email and password sign-in and email confirmation. Set the signup password policy to at least 12 characters with uppercase, lowercase, digits, and symbols for both account types. In the confirmation email template, include the six-digit code as `{{ .Token }}`. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) before inviting real users.
3. Set the project URL and its `sb_publishable_` key in [account-config.js](account-config.js). Keep the secret and service-role keys out of the frontend. When deploying, serve over HTTPS and test registration, verification, duplicate usernames, sign-in and sign-out with both account types.

See Supabase’s [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [password settings](https://supabase.com/docs/guides/auth/password-security). The hosted preview has demo mode enabled. Connecting accounts gives you authentication and profiles. The circle and payment screens still use sample data.

Try **Review payment** from the overview, **Review commitment** from discovery, or **Create a circle** to see how the contribution and member count affect the payout. Drafts can be saved in this browser. The screens use sample data. Checkout, joining, signing and settlement are previews.

## Circle advisor

Open **Find a circle → Open circle advisor**. Every interview starts with the same income question, then asks only for missing details relevant to the selected goal. The report compares affordability across each paying month, net payout after the holdback, target timing, and alternatives such as a trusted-group draft, independent saving, or a one-time gift. Recommendations use sample circle data and never create a circle, join one, or move money.

The private hosted preview and standalone file use the guided mode. To try live question selection locally, put an `OPENAI_API_KEY` in the ignored `.env.local` (Node.js 20.12 or newer) or in the server environment, run `npm start`, and select **Use live AI to choose follow-ups** in the advisor. The key stays on the server. The OpenAI request includes the selected answers and approximate amounts, while any goal name stays in the browser. Circl calculates all estimates in both modes.

## PayPal and AI demo

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), select **Sandbox → Apps & Credentials**. Use a Sandbox merchant app and copy its Client ID and Secret. Add them to `.env.local` as `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_SECRET`. Keep the Secret local. Use [Testing Tools → Sandbox Accounts](https://developer.paypal.com/sandbox-testing/accounts) for a separate personal test buyer.
2. Configure the OpenAI key and API quota for live follow-ups, then start or restart Circl with `npm start`. Open the local preview and sign in with sample details.
3. Open the circle advisor and enable **Use live AI to choose follow-ups**. For example, choose variable income and a purchase goal, then enter a $300 target, $50 already saved, and $100 safely available per month after non-Circl commitments. Use a target month in or after July 2027 for the seeded circles.
4. On a matching circle, choose **Review commitment → Try first contribution in PayPal Sandbox**. Approve in the PayPal window as the personal Sandbox buyer. Circl displays the capture ID only after the server checks that PayPal completed the order for the expected amount and currency.

The local server uses Sandbox exclusively and keeps demo orders and receipts in memory. The test payment does not join a real circle, change the mock ledger, move real money, or enable payouts. The hosted static preview illustrates the flow without these credentials. See the [PayPal Checkout quickstart](https://developer.paypal.com/checkout/integrate).

Open **Charity → Help a circle recover** to see how the seven-day exit rule, holdback distribution, recovery donations and member repayment fit together. The repayment example credits the holdback against the debt and reconciles donor support so members recover each loss once. The demo does not enforce account blocks or transfer funds.
