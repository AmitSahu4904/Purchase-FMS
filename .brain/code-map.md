# Code Map

## Root Configuration

- `package.json`: scripts and dependencies.
- `next.config.mjs`: ignores TypeScript build errors and disables image optimization.
- `tsconfig.json`: strict TypeScript, `@/*` path alias, `allowJs: true`.
- `components.json`: shadcn-style component configuration.
- `vercel.json`: daily cron configuration.
- `.env.local`: local environment values; do not commit secrets.

## App Routes

- `app/layout.tsx`: root layout, providers, shell, analytics, toaster.
- `app/page.tsx`: dashboard route.
- `app/login/page.tsx`: login route.
- `app/quotation-form/page.tsx`: public vendor quote route.
- `app/stages/[slug]/page.tsx`: dynamic stage route.
- `app/api/upload/route.ts`: local image upload.
- `app/api/cron/generate-report/route.ts`: scheduled PDF report generation/upload.

## Core Components

- `components/dashboard.tsx`: main dashboard, metrics, charts, filters, add forms.
- `components/sidebar.tsx`: navigation and live pending counts.
- `components/layout-wrapper.tsx`: auth guard and app shell.
- `components/providers.tsx`: context providers and mock fetch installation.
- `components/login-page.tsx`: login UI.
- `components/footer.tsx`: app footer.
- `components/report-pdf.tsx`: PDF document for cron report.

## Context and Utilities

- `lib/auth-context.tsx`: login/session/page access state.
- `lib/workflow-context.tsx`: local workflow records, mostly secondary to sheet data.
- `lib/mock-fetch.ts`: local in-browser mock backend.
- `lib/constants.ts`: stage definitions and icons.
- `lib/utils.ts`: class merge, date parsing/formatting, timestamp, warranty helper.

## Stage Components

- `components/stages/create-indent.tsx`
- `components/stages/indent-approval.tsx`
- `components/stages/quotation.tsx`
- `components/stages/approved-vendor.tsx`
- `components/stages/po-entry.tsx`
- `components/stages/payment.tsx`
- `components/stages/lifting.tsx`
- `components/stages/transporter-follow-up.tsx`
- `components/stages/material-received.tsx`
- `components/stages/billing.tsx`
- `components/stages/purchase-return.tsx`
- `components/stages/vendor-payment.tsx`
- `components/stages/freight-payments.tsx`
- `components/stages/order-cancel.tsx`
- `components/stages/stage-table.tsx`: shared stage table helper/component.
- `components/stages/serial-pdf.tsx`: PDF/helper for serial-related flow.

## UI Components

`components/ui` contains the local design system wrappers for Radix/shadcn-style primitives, including buttons, cards, dialogs, tables, forms, inputs, select, tabs, toast, sidebar, and many other reusable UI elements.

## Assets

- `public/divine-logo.svg`: favicon/logo.
- `public/placeholder*`: placeholder image assets.
- `public/purchase-images`: locally uploaded purchase images.

## Deleted/Legacy Stage Names Seen in Git Status

The worktree has deleted or renamed legacy stage files such as:

- `negotiation.tsx` -> `quotation.tsx`
- `follow-up-vendor.tsx` -> currently represented by `lifting.tsx`
- `tally-entry.tsx` -> currently represented by `billing.tsx`
- older stages like `ims`, `verification`, `serial-generation`, `submit-invoice`, `warranty-claim`, and others

Do not restore these unless a current route or business requirement needs them.
