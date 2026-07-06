if (typeof window !== "undefined") {
  // Define default mock spreadsheet structures
  // 6 header rows + data rows
  const headers = Array(6).fill([]);

  const defaultSheets: Record<string, any[][]> = {
    "Master": [
      [], [], [], [], [], [], // 6 headers
      ["admin", "Admin User", "admin123", "Admin", "", "", "PO Creation"],
      ["user", "Normal User", "user123", "User", "", "", "Quotation, Approved Vendor"]
    ],
    "INDENT-LIFT": [
      ...headers
    ],
    "RECEIVING-ACCOUNTS": [
      ...headers
    ],
    "Partial QC": [
      ...headers
    ],
    "VENDOR-PAYMENTS": [
      ...headers
    ],
    "FREIGHT-PAYMENTS": [
      ...headers
    ],
    "Dropdown": [
      [
        "Created By", "Warehouse Location", "Item Code", "Category", "Item Name",
        "", "", "", "Approver", "", "Transporter", "QC Engineer", "Accountant",
        "UOM", "", "Checklist Item", "Reject Reason"
      ], // Header row (index 0)
      [
        "Admin User", "Division A", "IT-LAP-001", "Corporate", "Dell Laptop",
        "", "", "", "Director A", "", "Express Logistics", "QC Engineer A", "Accountant A",
        "Nos", "", "Box Integrity Check", "Wrong Model Delivered"
      ],
      [
        "HR Manager", "Division B", "HR-CHR-002", "HR", "Office Chairs",
        "", "", "", "VP Operations", "", "BlueDart", "QC Engineer B", "Accountant B",
        "Sets", "", "Functional Check", "Transit Defect"
      ],
      [
        "IT Exec", "Division C", "IT-PROJ-003", "IT", "Projector",
        "", "", "", "Admin User", "", "DHL Express", "QC Inspector C", "Finance Exec C",
        "Kgs", "", "Visual Inspection", "Damage on Box"
      ],
      [
        "IT Admin", "Main Store", "IT-SW-004", "IT", "Network Switches",
        "", "", "", "Finance Head", "", "VRL Logistics", "", "",
        "Meters", "", "Quantity Check", "Functional Defect"
      ],
      [
        "Purchase Manager", "Delhi Depot", "IT-MOU-005", "IT", "Wireless Mouse",
        "", "", "", "", "", "SafeExpress", "", "",
        "Boxes", "", "", ""
      ],
      [
        "Project Manager", "Mumbai Warehouse", "OFF-PEN-006", "Office Supplies", "Ball Pens (Box of 10)",
        "", "", "", "", "", "", "", "",
        "Pack", "", "", ""
      ]
    ],
    "Order-Cancel": [
      []
    ],
    "PAID-DATA": [
      []
    ],
    "Transport Flw-Up": [
      []
    ],

    "Material-Testing": [
      ...headers
    ],
    "Serial-Generation": [
      ...headers
    ]
  };

  // Load mockSheets from localStorage or default
  const STORAGE_KEY = "mockSheets_data_clean_v1";
  let mockSheets: Record<string, any[][]> = {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const firstDataRow = parsed["INDENT-LIFT"]?.[6];
      if (firstDataRow && firstDataRow.length < 70) {
        console.log("Old INDENT-LIFT mock data format detected, resetting mock database to new structure...");
        localStorage.removeItem(STORAGE_KEY);
      } else {
        mockSheets = parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load mock sheets from localStorage:", e);
  }

  if (Object.keys(mockSheets).length === 0) {
    mockSheets = JSON.parse(JSON.stringify(defaultSheets));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSheets));
    } catch (e) {
      console.error("Failed to save default mock sheets to localStorage:", e);
    }
  }

  // Ensure Material-Testing sheet exists with 6 header rows
  if (!mockSheets["Material-Testing"] || mockSheets["Material-Testing"].length === 0) {
    mockSheets["Material-Testing"] = [[], [], [], [], [], []];
    saveMockSheets();
  } else if (mockSheets["Material-Testing"].length > 0 && mockSheets["Material-Testing"].length < 6) {
    // Pad with empty header rows if sheet exists but doesn't have 6 headers
    while (mockSheets["Material-Testing"].length < 6) {
      mockSheets["Material-Testing"].unshift([]);
    }
    saveMockSheets();
  }

  function saveMockSheets() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSheets));
    } catch (e) {
      console.error("Failed to save mock sheets to localStorage:", e);
    }
  }

  function getFmsTimestamp() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  async function parseBody(body: any): Promise<Record<string, any>> {
    if (!body) return {};
    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch {
        const params: Record<string, string> = {};
        new URLSearchParams(body).forEach((val, key) => {
          params[key] = val;
        });
        return params;
      }
    }
    if (body instanceof URLSearchParams) {
      const params: Record<string, string> = {};
      body.forEach((val, key) => {
        params[key] = val;
      });
      return params;
    }
    if (body instanceof FormData) {
      const params: Record<string, any> = {};
      for (const [key, val] of body.entries()) {
        params[key] = val;
      }
      return params;
    }
    return {};
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Intercept Google Sheets API script calls, local sheets API routes, or fall back if env variable is missing
    const isGoogleScript = url && (url.includes("script.google.com") || url.includes("script.googleusercontent.com"));
    const isLocalMock = url && (url.includes("/api/sheets") || url.startsWith("api/sheets") || url.includes("undefined?sheet="));
    const isEnvMissing = !process.env.NEXT_PUBLIC_API_URI;

    if (url && (isGoogleScript || isLocalMock || isEnvMissing)) {
      try {
        const urlObj = new URL(url, window.location.origin);
        const method = (init?.method || "GET").toUpperCase();

        let sheet = urlObj.searchParams.get("sheet");
        let action = urlObj.searchParams.get("action") || "getAll";

        let bodyParams: Record<string, any> = {};
        if (method === "POST" && init?.body) {
          bodyParams = await parseBody(init.body);
          if (bodyParams.action) action = bodyParams.action;
          if (bodyParams.sheetName) sheet = bodyParams.sheetName;
          if (bodyParams.sheet) sheet = bodyParams.sheet;
        }

        if (sheet || action === "insertIndent" || action === "insertLift" || action === "uploadFile") {
          console.log(`[Mock Fetch] Intercepted: method=${method}, sheet="${sheet}", action="${action}"`);

          if (method === "GET" || action === "getAll") {
            const sheetData = mockSheets[sheet || ""] || [
              [], [], [], [], [], [],
              []
            ];
            return new Response(
              JSON.stringify({
                success: true,
                message: `Fetched mock sheet: ${sheet}`,
                data: sheetData
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          if (method === "POST") {
            if (action === "update") {
              const rowIndex = parseInt(bodyParams.rowIndex || urlObj.searchParams.get("rowIndex") || "", 10);
              let rowData = bodyParams.rowData;
              if (typeof rowData === "string") {
                try { rowData = JSON.parse(rowData); } catch { }
              }

              if (!isNaN(rowIndex) && Array.isArray(rowData)) {
                if (!mockSheets[sheet || ""]) mockSheets[sheet || ""] = [];
                const idx = rowIndex - 1;
                while (mockSheets[sheet || ""].length <= idx) {
                  mockSheets[sheet || ""].push([]);
                }

                // Sparse merge to preserve other columns
                const existingRow = mockSheets[sheet || ""][idx] || [];
                const mergedRow = [...existingRow];
                rowData.forEach((val, i) => {
                  if (val !== undefined && val !== null && val !== "") {
                    mergedRow[i] = val;
                  }
                });

                // Apply workflow routing logic for INDENT-LIFT
                if (sheet === "INDENT-LIFT") {
                  const finalStatus = mergedRow[13]; // N: Status
                  const vendorType = mergedRow[15];  // P: Vendor Type

                  if (finalStatus === "approved" && !mergedRow[45] && !mergedRow[51]) {
                    const timestamp = getFmsTimestamp();
                    if (vendorType === "regular") {
                      // Regular Vendor -> Skip Stage 3, go directly to PO Entry (Stage 4)
                      mergedRow[45] = ""; // clear plan3 (AT)
                      mergedRow[46] = ""; // clear actual3 (AU)
                      mergedRow[51] = timestamp; // plan4 = timestamp (AZ)
                    } else if (vendorType === "new vendor") {
                      // New Vendor -> Go to Purchase Enquiry (Stage 3)
                      mergedRow[45] = timestamp; // plan3 = timestamp (AT)
                      mergedRow[46] = ""; // clear actual3 (AU)
                      mergedRow[51] = ""; // clear plan4 (AZ)
                    }
                  }

                  // 1. Stage 5 (Make PO) -> Payment (Advance) OR Follow-Up (Other)
                  const actual4 = mergedRow[52]; // BA: actual4 (PO Entry completed date)
                  const planPayment = mergedRow[72]; // plan_payment
                  const planned5 = mergedRow[60]; // BI: planned5 (Follow-Up Vendor plan date)

                  if (actual4 && !planPayment && !planned5) {
                    const selectedVendor = String(mergedRow[47] || "").trim();
                    let terms = "";
                    if (selectedVendor === "vendor1") terms = String(mergedRow[23] || "").trim();
                    else if (selectedVendor === "vendor2") terms = String(mergedRow[31] || "").trim();
                    else if (selectedVendor === "vendor3") terms = String(mergedRow[39] || "").trim();

                    const timestamp = getFmsTimestamp();
                    if (terms === "Advance") {
                      // Next workflow is Payment
                      mergedRow[72] = timestamp; // plan_payment (index 72)
                      mergedRow[73] = "";        // clear actual_payment (index 73)
                      mergedRow[60] = "";        // clear planned5 (index 60)
                    } else {
                      // Skip Payment, go directly to Follow-Up Vendor
                      mergedRow[60] = timestamp; // planned5 (index 60)
                      mergedRow[67] = "Pending"; // BP: Follow-up status (index 67)
                      mergedRow[72] = "";
                      mergedRow[73] = "";
                    }
                  }

                  // 2. Stage 6 (Payment) -> Follow-Up Vendor
                  const actualPayment = mergedRow[73]; // actual_payment
                  if (actualPayment && !planned5) {
                    const timestamp = getFmsTimestamp();
                    mergedRow[60] = timestamp; // planned5 (index 60)
                    mergedRow[67] = "Pending"; // BP: Follow-up status (index 67)
                  }
                }

                mockSheets[sheet || ""][idx] = mergedRow;
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully updated and routed row ${rowIndex} in sheet ${sheet}`);
                return new Response(
                  JSON.stringify({ success: true, message: `Updated row ${rowIndex}` }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "insert" || action === "append") {
              let rowData = bodyParams.rowData;
              if (typeof rowData === "string") {
                try { rowData = JSON.parse(rowData); } catch { }
              }

              if (Array.isArray(rowData)) {
                if (!mockSheets[sheet || ""]) mockSheets[sheet || ""] = [];
                mockSheets[sheet || ""].push(rowData);
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully inserted row into sheet ${sheet}`);
                return new Response(
                  JSON.stringify({ success: true, message: `Inserted row` }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "batchInsert") {
              let rowsData = bodyParams.rowsData;
              if (typeof rowsData === "string") {
                try { rowsData = JSON.parse(rowsData); } catch { }
              }

              const startRow = parseInt(bodyParams.startRow || urlObj.searchParams.get("startRow") || "", 10);
              const startIdx = !isNaN(startRow) ? startRow - 1 : (mockSheets[sheet || ""]?.length || 0);

              if (Array.isArray(rowsData)) {
                if (!mockSheets[sheet || ""]) mockSheets[sheet || ""] = [];
                rowsData.forEach((row: any, i: number) => {
                  const idx = startIdx + i;
                  while (mockSheets[sheet || ""].length <= idx) {
                    mockSheets[sheet || ""].push([]);
                  }
                  mockSheets[sheet || ""][idx] = row;
                });
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully batch inserted ${rowsData.length} rows into sheet ${sheet}`);
                return new Response(
                  JSON.stringify({ success: true, message: `Batch inserted rows` }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "updateCell") {
              const rowIndex = parseInt(bodyParams.rowIndex || urlObj.searchParams.get("rowIndex") || "", 10);
              const columnIndex = parseInt(bodyParams.columnIndex || bodyParams.column || urlObj.searchParams.get("columnIndex") || "", 10);
              const value = bodyParams.value !== undefined ? bodyParams.value : urlObj.searchParams.get("value");

              if (!isNaN(rowIndex) && !isNaN(columnIndex)) {
                if (!mockSheets[sheet || ""]) mockSheets[sheet || ""] = [];
                const rIdx = rowIndex - 1;
                const cIdx = columnIndex - 1;
                while (mockSheets[sheet || ""].length <= rIdx) {
                  mockSheets[sheet || ""].push([]);
                }
                const row = mockSheets[sheet || ""][rIdx] || [];
                while (row.length <= cIdx) {
                  row.push("");
                }
                row[cIdx] = value;
                mockSheets[sheet || ""][rIdx] = row;
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully updated cell (${rowIndex}, ${columnIndex}) in sheet ${sheet} to value: ${value}`);
                return new Response(
                  JSON.stringify({ success: true, message: `Updated cell` }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "insertIndent") {
              let rowsData = bodyParams.rowsData;
              if (typeof rowsData === "string") {
                try { rowsData = JSON.parse(rowsData); } catch { }
              }

              if (Array.isArray(rowsData)) {
                if (!mockSheets["INDENT-LIFT"]) mockSheets["INDENT-LIFT"] = [];

                // Find max indent number
                let maxNum = 0;
                mockSheets["INDENT-LIFT"].forEach(r => {
                  const id = r[1];
                  if (id && typeof id === "string" && id.startsWith("IND-")) {
                    const num = parseInt(id.replace("IND-", ""), 10);
                    if (!isNaN(num) && num > maxNum) {
                      maxNum = num;
                    }
                  }
                });

                const generatedIds: string[] = [];
                rowsData.forEach((row: any) => {
                  maxNum++;
                  const indentId = `IND-${String(maxNum).padStart(3, '0')}`;
                  row[1] = indentId; // Column B (index 1)
                  mockSheets["INDENT-LIFT"].push(row);
                  generatedIds.push(indentId);
                });
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully executed insertIndent, generated: ${generatedIds.join(", ")}`);
                return new Response(
                  JSON.stringify({ success: true, generatedIds }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "insertLift") {
              let rowsData = bodyParams.rowsData;
              if (typeof rowsData === "string") {
                try { rowsData = JSON.parse(rowsData); } catch { }
              }

              if (Array.isArray(rowsData)) {
                if (!mockSheets["RECEIVING-ACCOUNTS"]) mockSheets["RECEIVING-ACCOUNTS"] = [];
                rowsData.forEach((row: any) => {
                  mockSheets["RECEIVING-ACCOUNTS"].push(row);
                });
                saveMockSheets();
                console.log(`[Mock Fetch] Successfully executed insertLift for ${rowsData.length} rows`);
                return new Response(
                  JSON.stringify({ success: true, message: "Lifts inserted successfully" }),
                  { status: 200, headers: { "Content-Type": "application/json" } }
                );
              }
            }

            if (action === "uploadFile") {
              const fileName = bodyParams.fileName || "mock_file.png";
              const fileUrl = `https://mock-drive.google.com/file/d/mock-file-${Date.now()}/view?usp=drivesdk`;
              console.log(`[Mock Fetch] Simulating file upload for ${fileName}. Returning mock URL: ${fileUrl}`);
              return new Response(
                JSON.stringify({
                  success: true,
                  url: fileUrl,
                  fileUrl: fileUrl,
                  message: "Simulated file upload successfully"
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (err) {
        console.error("[Mock Fetch] Error intercepting request:", err);
      }
    }

    return originalFetch(input, init);
  };

  console.log("[Mock Fetch] Global interceptor loaded successfully.");
}
