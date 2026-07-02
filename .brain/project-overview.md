# Project Overview

NewPurchaseFMS is a purchase workflow management application. It provides authenticated users with a dashboard and multiple workflow stage screens for moving purchase records from indent creation through approval, quotation, purchase order, payment, lifting, receiving, billing, returns, vendor payment, freight payment, and order cancellation.

The app is not backed by a conventional SQL database. The source of truth is a Google Sheets workbook accessed through a Google Apps Script endpoint stored in `NEXT_PUBLIC_API_URI`. Most screens read full sheets with `GET ?sheet=...&action=getAll` and write sparse row updates with `POST` payloads such as `action=update`, `sheetName`, `rowIndex`, and `rowData`.

The app also contains a local mock backend in `lib/mock-fetch.ts`. This replaces `window.fetch` in the browser for Google Script calls, or when `NEXT_PUBLIC_API_URI` is absent, and stores mock sheet data in `localStorage` under `mockSheets_data`. This lets the workflow run locally without a live Apps Script backend.

Primary user surfaces:

- `/login`: login screen backed by hardcoded users or the `Master` sheet.
- `/`: purchase dashboard with summary metrics, stage counts, charts, received/in-transit/pending/warranty tables, and lightweight add-item/vendor/transporter dialogs.
- `/stages/[slug]`: dynamic route that renders a specific stage component.
- `/quotation-form?id=IND-xxx_rowIndex&v=1|2|3`: public vendor quotation submission form.
- `/api/upload`: local filesystem upload endpoint for purchase images.
- `/api/cron/generate-report`: scheduled report generator that renders a PDF and uploads it through Apps Script.

Authentication model:

- `lib/auth-context.tsx` manages client-side auth state in `localStorage`.
- Built-in credentials:
  - `admin` / `admin123`
  - `user` / `user123`
- External users are loaded from the `Master` sheet.
- Page permissions come from the `page access` column in the `Master` sheet and are stored as `pageAccess`.
- Empty `pageAccess` means unrestricted access.

Workflow persistence model:

- The real workflow state is sheet-based.
- `lib/workflow-context.tsx` also exists and stores records in `localStorage`, but the active stage screens mostly use Google Sheet rows directly rather than this context.

Deployment model:

- Vercel is expected.
- `vercel.json` schedules `/api/cron/generate-report` daily at `30 1 * * *`.
- `@vercel/analytics` is enabled in the root layout.
