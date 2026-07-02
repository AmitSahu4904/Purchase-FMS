# Data Model

The workbook is the database. Rows are arrays, and column indexes are central to application behavior. Indexes below are zero-based, matching code.

## Important Sheets

### `Master`

Used for login and permissions.

- `0`: Username
- `1`: Full Name
- `2`: Password
- `3`: Role
- `4`: Page Access, comma-separated
- `6`: Stage Name for report responsibility mapping
- `7`: Responsible Person for report mapping

Hardcoded local users bypass the sheet:

- `admin/admin123`
- `user/user123`

### `INDENT-LIFT`

Main purchase workflow sheet. Most early and PO-related stages read/write this sheet. Data rows are treated as starting at row 7, so code usually uses `slice(6)`.

Core indent columns:

- `0`: Timestamp
- `1`: Indent No
- `2`: Created By
- `3`: Category / Party in some dashboard views
- `4`: Item Name
- `5`: Quantity
- `6`: Warehouse
- `7`: Item Code or expected delivery in older dashboard mapping
- `8`: Lead Time
- `9`: Stage 2 planned date
- `10`: Stage 2 actual date
- `11`: Stage 2 delay
- `12`: Approver
- `13`: Status
- `14`: Approved Quantity
- `15`: Vendor Type
- `16`: Remarks
- `17`: Attachment
- `69`: UOM

Vendor quotation blocks:

- Vendor 1 starts at `21`
  - `21`: Name
  - `22`: Rate
  - `23`: Payment Terms
  - `24`: Expected Delivery
  - `25`: Warranty Type
  - `26`: Warranty From
  - `27`: Warranty To
  - `28`: Attachment/Remarks, usage varies by component
- Vendor 2 starts at `29`
- Vendor 3 starts at `37`

Quotation / approved vendor / PO gates:

- `45`: Quotation planned
- `46`: Quotation actual
- `47`: Selected vendor id or delay, usage is inconsistent across components
- `48`: Selected vendor name
- `49`: Final approved by
- `50`: Negotiation/approval remarks
- `51`: PO planned / approved vendor completion gate
- `52`: PO actual
- `53`: PO delay
- `54`: PO number
- `55`: Basic value
- `56`: Total with tax
- `57`: HSN
- `58`: PO copy
- `59`: GST

Payment and lifting gates:

- `60`: Lifting / follow-up planned
- `61`: Lifting / follow-up actual
- `62`: Lifting / follow-up delay
- `67`: Follow-up status
- `72`: Payment planned
- `73`: Payment actual

Routing behavior implemented in the mock backend:

- When status becomes `approved`, vendor type controls next step:
  - `regular` skips quotation and plans PO at `51`.
  - `new vendor` plans quotation at `45`.
- When PO actual exists, selected vendor payment terms control next step:
  - `Advance` plans payment at `72`.
  - Other terms plan lifting/follow-up at `60`.
- When payment actual exists, lifting/follow-up is planned at `60`.

### `RECEIVING-ACCOUNTS`

Used by lifting downstream screens, receiving, billing, transporter follow-up, and reports. Data rows start at row 7.

Common columns:

- `1`: Indent No
- `2`: Unit Tracking No / Lift No
- `3`: Vendor Name
- `4`: PO Number
- `5`: Next Follow-up Date
- `6`: Stage 6 remarks
- `7`: Item Name
- `8`: Lifting Quantity
- `9`: Transporter Name
- `10`: Vehicle No
- `11`: Contact No
- `12`: LR No
- `13`: Dispatch Date
- `14`: Freight Amount
- `15`: Advance Amount
- `16`: Payment Date
- `17`: Payment Status
- `18`: Bilty/LR Copy
- `19`: Material Received planned
- `20`: Material Received actual
- `22`: Invoice Type
- `23`: Invoice Date
- `24`: Invoice Number
- `25`: Received Quantity
- `26`: Received Item Image
- `27`: SRN Number
- `28`: QC Requirement
- `29`: Bill Attachment
- `30`: Hydra payment amount
- `31`: Labour payment amount
- `32`: Hamali payment amount
- `33`: Material received remarks
- `35`: Billing planned
- `36`: Billing actual
- `38`: Billing done by
- `39`: Billing done date
- `40`: Billing remarks
- `41`: Checked status
- `42`: Checked by accounts
- `88`: Transporter follow-up planned
- `89`: Transporter follow-up actual
- `90`: Transporter follow-up delay
- `93`: Expected date from transporter follow-up/report logic
- `116`: Damage quantity
- `117`: Damage reason
- `118`: Damage image

### `Partial QC`

Used for purchase return logic. Data rows are treated as starting at row 8 in sidebar logic.

Key observed columns:

- `1`: Indent No
- `2`: Unit Tracking No
- `3`: Item Name
- `4`: UOM
- `5`: QC Status, for example `rejected`
- `12`: Return marker
- `13`: Purchase return planned
- `14`: Purchase return actual

### `Material-Testing`

Referenced by `purchase-return.tsx` for return actions and damage/QC integration. This sheet is not present in the mock defaults except through code references, so live backend support is expected.

### `VENDOR-PAYMENTS`

Used by `VendorPayment`.

Observed columns:

- `1`: Invoice No
- `2`: Invoice Copy
- `3`: Invoice Date
- `4`: Vendor Name
- `5`: PO Number
- `6`: PO Copy
- `10`: Quantity / received quantity list
- `11`: Total value
- `12`: Received items
- `13`: Payment planned
- `14`: Payment actual
- `16`: Stored paid amount
- `17`: Current pending amount
- `21`: Due date

### `FREIGHT-PAYMENTS`

Used by `FreightPayments`.

Observed columns:

- `1`: LR No
- `2`: Bilty image
- `3`: Freight Amount
- `4`: Transporter
- `5`: Vehicle No
- `6`: Contact
- `7`: Advance Amount
- `8`: Payment Date
- `9`: Planned
- `10`: Actual
- `12`: Total paid
- `13`: Current pending
- `14`: Invoice No
- `15`: Invoice Copy

### `PAID-DATA`

Shared payment ledger for vendor and freight payments.

Observed columns:

- `0`: Timestamp
- `1`: Payment type, for example `Vendor Payment` or `Freight Payment`
- `2`: Invoice No or LR No
- `3`: Vendor/transporter
- `4`: Amount paid
- `5`: Status
- `6`: Date
- `7`: Payment mode
- `8`: Proof URL

### `Dropdown`

Lookup data for form dropdowns.

Observed columns:

- `0`: Created By
- `1`: Warehouse Location
- `2`: Item Code
- `3`: Category
- `4`: Item Name
- `8`: Approver
- `10`: Transporter
- `11`: QC Engineer
- `12`: Accountant
- `13`: UOM
- `15`: Checklist Item
- `16`: Reject Reason

### Other Sheets

- `Order-Cancel`: order cancellation records.
- `Transport Flw-Up`: transporter status history and expected-date mapping.
- `Serial-Generation`: serial number data used by dashboard/warranty/report-adjacent logic.

## Backend Contract

Expected Apps Script actions:

- `GET ?sheet=SHEET_NAME&action=getAll`: return `{ success: true, data: any[][] }`.
- `POST action=update`: sparse merge `rowData` into a row.
- `POST action=append` or `action=insert`: append a row.
- `POST action=batchInsert`: write multiple rows.
- `POST action=updateCell`: update one cell using 1-based row and column.
- `POST action=insertIndent`: append indent rows and generate indent numbers.
- `POST action=uploadFile`: upload a file and return URL.
- `POST action=uploadReport`: upload generated PDF report and return file URL.
