# Workflow Stages

`lib/constants.ts` defines the user-facing stage list. `app/stages/[slug]/page.tsx` maps stage slugs to concrete components.

## Stage List

1. Create Indent (`create-indent`)
2. Indent Approval (`indent-approval`)
3. Quotation (`quotation`)
4. Approved Vendor (`approved-vendor`)
5. Make PO (`po-entry`)
6. Payment (`payment`)
7. Lifting (`follow-up-vendor`)
8. Transporter Follow-Up (`transporter-follow-up`)
9. Material Received (`material-received`)
10. Billing (`receipt-in-tally`)
11. Purchase Return (`purchase-return`)
12. Vendor Payment (`vendor-payment`)
13. Freight Payments (`freight-payments`)
14. Order Cancel (`order-cancel`)

## Stage Behavior Summary

### Create Indent

File: `components/stages/create-indent.tsx`

- Reads `INDENT-LIFT`.
- Shows rows where indent exists and approval/status is not completed.
- Reads dropdown options from `Dropdown`.
- Can insert item master values into `Dropdown`.
- Creates indent rows via `action=insertIndent`.
- Uploads attachments via Apps Script `uploadFile`.
- Key write columns: timestamp, created by, category, item name, quantity, warehouse, item code, lead time, attachment, UOM.

### Indent Approval

File: `components/stages/indent-approval.tsx`

- Reads `INDENT-LIFT`.
- Works on rows with stage 2 planned/actual gates.
- Approval updates status, approved quantity, vendor type, approver, remarks, and next-stage planning columns.
- Vendor type controls whether the workflow goes to Quotation or directly to PO.

### Quotation

File: `components/stages/quotation.tsx`

- Reads `INDENT-LIFT`.
- Pending when `row[45]` exists and `row[46]` is missing.
- Manages three vendor quote blocks.
- Generates public quotation links using `/quotation-form?id=<indent>_<rowIndex>&v=<slot>`.
- Writes quote details and marks quotation actual completion.

### Public Quotation Form

File: `app/quotation-form/page.tsx`

- Public unauthenticated route.
- Parses `id` query parameter to find sheet row.
- Parses `v` query parameter to select vendor slot.
- Updates the correct vendor block in `INDENT-LIFT` with rate, terms, expected delivery, and default selected status.

### Approved Vendor

File: `components/stages/approved-vendor.tsx`

- Reads `INDENT-LIFT`.
- Pending when quotation actual `row[46]` exists and PO plan `row[51]` is missing.
- Lets a user select/finalize the vendor.
- Reads approver options from `Dropdown` column `8`.
- Writes selected vendor, selected vendor name, final approved by, remarks, and PO planning gate.

### Make PO

File: `components/stages/po-entry.tsx`

- Reads `INDENT-LIFT`.
- Pending when PO plan `row[51]` exists and PO actual `row[52]` is missing.
- Displays selected vendor and quotation context.
- Writes PO number, values, tax/HSN, PO copy, and actual completion.
- Uploads PO copy through Apps Script file upload.
- Mock routing then plans Payment or Lifting based on vendor payment terms.

### Payment

File: `components/stages/payment.tsx`

- Reads `INDENT-LIFT`.
- Pending when payment plan `row[72]` exists and actual `row[73]` is missing.
- Used for advance-payment flow before lifting/follow-up.
- Completion should route the record to lifting/follow-up by setting the lifting plan.

### Lifting

File: `components/stages/lifting.tsx`

- Rendered by slug `follow-up-vendor`.
- Reads `INDENT-LIFT` and usually writes downstream receiving/freight rows.
- Represents vendor follow-up/lifting after PO or advance payment.
- Works around the `row[60]`, `row[61]`, `row[62]`, and `row[67]` follow-up/lifting fields.

### Transporter Follow-Up

File: `components/stages/transporter-follow-up.tsx`

- Reads `RECEIVING-ACCOUNTS`.
- Reads/writes `Transport Flw-Up` status history.
- Pending when `row[88]` exists and `row[89]` is missing.
- Uses unit tracking number/lift number in `row[2]`.
- On completion, updates `RECEIVING-ACCOUNTS` actual date and appends status history.

### Material Received

File: `components/stages/material-received.tsx`

- Reads `RECEIVING-ACCOUNTS`.
- Pending when material received plan `row[19]` exists and actual `row[20]` is missing.
- Captures receipt details such as invoice, received quantity, SRN, QC requirement, images, and billing-related fields.

### Billing

File: `components/stages/billing.tsx`

- Reads `RECEIVING-ACCOUNTS` and `INDENT-LIFT`.
- Pending when billing plan `row[35]` exists and actual `row[36]` is missing.
- Reads accountant options from `Dropdown` column `12`.
- Writes billing completion, done by/date, remarks, checked status, and account checker fields.

### Purchase Return

File: `components/stages/purchase-return.tsx`

- Reads `RECEIVING-ACCOUNTS`, `INDENT-LIFT`, and `Material-Testing`.
- Also has sidebar count logic based on `Partial QC`.
- Handles rejected/damaged material return actions.
- Uses `updateCell` against `Material-Testing` in observed code.

### Vendor Payment

File: `components/stages/vendor-payment.tsx`

- Reads `VENDOR-PAYMENTS` and `PAID-DATA`.
- Pending when planned payment exists and actual is missing or current pending amount remains greater than 1.
- Appends payment entries to `PAID-DATA`.
- Tracks partial payments through stored paid/current pending amounts.

### Freight Payments

File: `components/stages/freight-payments.tsx`

- Reads `FREIGHT-PAYMENTS` and `PAID-DATA`.
- Pending when current pending freight amount is greater than 1.
- Appends freight payment records to `PAID-DATA`.
- Tracks freight invoice/copy and payment history.

### Order Cancel

File: `components/stages/order-cancel.tsx`

- Uses `Order-Cancel` and related workflow context to record cancellations.
- Always visible in sidebar access logic.

## Dashboard Counts

`components/dashboard.tsx` computes overview metrics from:

- `INDENT-LIFT`
- `RECEIVING-ACCOUNTS`
- payment/serial/warranty-related sheets

`components/sidebar.tsx` separately computes sidebar counts, so count logic can drift unless both files are updated together.
