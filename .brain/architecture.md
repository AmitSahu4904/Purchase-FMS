# Architecture

## Application Shell

`app/layout.tsx` is the root App Router layout. It loads:

- `app/globals.css`
- `Providers`
- `LayoutWrapper`
- `sonner` toaster
- Vercel Analytics

`components/providers.tsx` wraps all pages with:

1. `AuthProvider`
2. `WorkflowProvider`

It also imports `@/lib/mock-fetch`, which installs the browser fetch interceptor globally on the client.

`components/layout-wrapper.tsx` handles route protection and the logged-in shell:

- Shows a full-screen spinner while auth initializes.
- Redirects unauthenticated users to `/login`.
- Redirects authenticated users away from `/login`.
- Allows `/quotation-form` without authentication.
- Checks stage access against `STAGES` and `pageAccess`.
- Renders the sidebar, main content area, and footer for authenticated pages.

## Routing

Routes:

- `app/page.tsx` -> `components/dashboard.tsx`
- `app/login/page.tsx` -> login page component
- `app/quotation-form/page.tsx` -> public quotation form
- `app/stages/[slug]/page.tsx` -> dynamic stage dispatcher
- `app/api/upload/route.ts` -> local file upload
- `app/api/cron/generate-report/route.ts` -> scheduled PDF report

The dynamic stage route maps slugs to components:

- `create-indent` -> `CreateIndent`
- `indent-approval` -> `IndentApproval`
- `quotation` and `purchase-enquiry` -> `Quotation`
- `approved-vendor` -> `ApprovedVendor`
- `po-entry` -> `POEntry`
- `payment` -> `Payment`
- `follow-up-vendor` -> `Lifting`
- `transporter-follow-up` -> `TransporterFollowUp`
- `material-received` -> `MaterialReceived`
- `receipt-in-tally` -> `BillingStage`
- `purchase-return` -> `PurchaseReturn`
- `vendor-payment` -> `VendorPayment`
- `freight-payments` -> `FreightPayments`
- `order-cancel` -> `OrderCancelPage`

## Navigation

`lib/constants.ts` defines `STAGES`, which drives sidebar display and stage access checks. The current list has 14 stages.

`components/sidebar.tsx`:

- Filters stages based on `pageAccess`.
- Always allows `Order Cancel`.
- Fetches sheet data and computes pending counts per stage.
- Refreshes counts on route changes and every 60 seconds.

## UI System

The UI is mostly shadcn/Radix-style components under `components/ui`. Config lives in `components.json`.

Styling:

- Tailwind CSS v4 through `app/globals.css`.
- Design tokens are CSS variables using OKLCH colors.
- `lib/utils.ts` exports `cn`, date parsing/formatting helpers, timestamp helper, and warranty helper.

## State

State layers:

- Auth: client-side React context plus `localStorage`.
- Workflow records: `WorkflowProvider`, mostly legacy/local-only.
- Real workflow rows: Google Sheets via Apps Script.
- Local mock database: `localStorage.mockSheets_data`, installed by `lib/mock-fetch.ts`.
- Per-screen UI state: stage components and dashboard maintain their own local state.

## Data Access Pattern

Most screens follow the same pattern:

1. Fetch one or more sheets from `NEXT_PUBLIC_API_URI`.
2. Skip header/meta rows using `slice(6)` or `slice(7)`.
3. Filter rows by planned/actual column gates.
4. Build display records with `rowIndex` equal to the real 1-based sheet row.
5. Submit sparse row arrays to `POST action=update`.

Sparse updates rely on backend behavior that merges non-empty values into the existing row. The mock layer implements that behavior.
