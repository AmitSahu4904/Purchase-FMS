"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw, Calendar, MessageSquare, User, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { cn, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";



const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function Stage9() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [accountantList, setAccountantList] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    doneBy: "",
    submissionDate: new Date().toISOString().split("T")[0],
    remarks: "",
    checkedStatus: "",
    checkedByAcc: "",
  });

  // Open Modal with Bulk Validation
  const handleOpenModal = () => {
    if (selectedRows.size === 0) return;
    setBulkError(null);


    const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

    if (selectedRecords.length === 0) return;

    // Validate Invoice Numbers
    const firstInvoice = selectedRecords[0].data.invoiceNumber;
    const isConsistent = selectedRecords.every(r => r.data.invoiceNumber === firstInvoice);

    if (!isConsistent) {
      setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
    }

    // Prefill from the first record
    const rec = selectedRecords[0];
    const hasCheckedBy = !!rec.data.checkedByAcc && rec.data.checkedByAcc !== "-";
    const doneByExists = !!rec.data.doneBy && rec.data.doneBy !== "-";

    let status = "";
    if (rec.data.checkedStatus && rec.data.checkedStatus !== "-") {
      status = rec.data.checkedStatus;
    } else if (doneByExists) {
      status = "No";
    }

    setFormData({
      doneBy: doneByExists ? rec.data.doneBy : "",
      submissionDate: new Date().toISOString().split("T")[0],
      remarks: (rec.data.remarks && rec.data.remarks !== "-") ? rec.data.remarks : "",
      checkedStatus: status,
      checkedByAcc: hasCheckedBy ? rec.data.checkedByAcc : "",
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (selectedRows.size === 0 || !formData.doneBy || !formData.checkedStatus || !SHEET_API_URL) return;
    if (formData.checkedStatus === "Yes" && !formData.checkedByAcc) return;
    if (bulkError) return; // Prevent submit if there's an error

    setIsSubmitting(true);
    try {
      const timestamp = getFmsTimestamp();

      const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

      // Process sequentially
      for (const rec of selectedRecords) {
        const rowArray = new Array(84).fill("");

        // AJ (35): Plan2 (Leave)
        // AK (36): Actual2 - Write if Checked=Yes
        if (formData.checkedStatus === "Yes") {
          rowArray[36] = timestamp;
        }

        // AL (37): Delay2 (Formula - Skip)

        // AM (38): Done By
        rowArray[38] = formData.doneBy;

        // AN (39): Done Date
        rowArray[39] = timestamp;

        // AO (40): Remarks
        rowArray[40] = formData.remarks;

        // AP (41): Checked Status
        rowArray[41] = formData.checkedStatus;

        // AQ (42): Checked By Acc
        rowArray[42] = formData.checkedStatus === "Yes" ? formData.checkedByAcc : "";

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "RECEIVING-ACCOUNTS");
        params.append("rowIndex", rec.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        await fetch(SHEET_API_URL, { method: "POST", body: params });
      }

      toast.success(formData.checkedStatus === "Yes" ? "Billing Completed (Bulk)!" : "Billing Saved (Bulk Pending)");
      setIsModalOpen(false);
      setSelectedRows(new Set());
      fetchData();

    } catch (e) {
      console.error(e);
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchData = async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const [liftRes, fmsRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`)
      ]);

      const liftJson = await liftRes.json();
      const fmsJson = await fmsRes.json();

      // Create FMS Map (Indent # -> Row)
      const fmsMap = new Map<string, any[]>();
      if (fmsJson.success && Array.isArray(fmsJson.data)) {
        fmsJson.data.slice(6).forEach((r: any) => {
          if (r[1] && String(r[1]).trim()) {
            fmsMap.set(String(r[1]).trim(), r);
          }
        });
      }

      if (liftJson.success && Array.isArray(liftJson.data)) {
        const rows = liftJson.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const indentNo = String(row[1]).trim();
            const fmsRow = fmsMap.get(indentNo) || [];

            // Stage 9 Logic
            // Stage 9 Logic: Check AJ (35) and AK (36)
            const hasPlan8 = !!row[35] && String(row[35]).trim() !== "";
            const hasActual8 = !!row[36] && String(row[36]).trim() !== "";

            let status = "not_ready";
            if (hasPlan8 && !hasActual8) {
              status = "pending";
            } else if (hasPlan8 && hasActual8) {
              status = "completed";
            }

            // Resolve vendor details using AV (index 47) and AW (index 48)
            const selVendorIndex = String(fmsRow[47] || "").trim().toLowerCase();
            const selVendorName = String(fmsRow[48] || "").trim().toLowerCase();

            const v1Name = String(fmsRow[21] || "").trim();
            const v2Name = String(fmsRow[29] || "").trim();
            const v3Name = String(fmsRow[37] || "").trim();

            let vendorDetails = {
              vendorNameFallback: "-",
              rate: "-",
              terms: "-",
            };

            if (selVendorIndex === "vendor1" || (selVendorName && v1Name && selVendorName === v1Name.toLowerCase())) {
              vendorDetails = {
                vendorNameFallback: v1Name,
                rate: fmsRow[22] || "-",
                terms: fmsRow[23] || "-",
              };
            } else if (selVendorIndex === "vendor2" || (selVendorName && v2Name && selVendorName === v2Name.toLowerCase())) {
              vendorDetails = {
                vendorNameFallback: v2Name,
                rate: fmsRow[30] || "-",
                terms: fmsRow[31] || "-",
              };
            } else if (selVendorIndex === "vendor3" || (selVendorName && v3Name && selVendorName === v3Name.toLowerCase())) {
              vendorDetails = {
                vendorNameFallback: v3Name,
                rate: fmsRow[38] || "-",
                terms: fmsRow[39] || "-",
              };
            } else if (fmsRow[48]) {
              vendorDetails = {
                vendorNameFallback: fmsRow[48],
                rate: "-",
                terms: "-",
              };
            }

            // Smart PO Details extraction to support both mock-fetch data and production layout
            let poNumber = row[4] || "-";
            let basicValue = "-";
            let totalWithTax = "-";

            const rawPoNumber = String(fmsRow[54] || "").trim();
            const rawBD = String(fmsRow[55] || "").trim();
            const rawBE = String(fmsRow[56] || "").trim();

            if (rawBD.startsWith("PO-")) {
              // Mock data case
              poNumber = rawBD;
              const rateVal = parseFloat(vendorDetails.rate) || 0;
              const qtyVal = parseFloat(row[8]) || parseFloat(fmsRow[14]) || parseFloat(fmsRow[5]) || 0;
              if (rateVal > 0 && qtyVal > 0) {
                basicValue = String(rateVal * qtyVal);
                totalWithTax = String(rateVal * qtyVal);
              } else {
                basicValue = "-";
                totalWithTax = "-";
              }
            } else {
              // Production case
              poNumber = row[4] || rawPoNumber || "-";
              basicValue = rawBD || "-";
              totalWithTax = rawBE || "-";
            }

            return {
              id: `${row[1] || "row"}-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 8,
              status,
              originalRow: row,
              data: {
                indentNumber: row[1] || "",
                liftNumber: row[2] || "",
                vendorName: row[3] || vendorDetails.vendorNameFallback || "-",
                poNumber: poNumber,
                nextFollowUpDate: row[5] || "",
                remarksStage6: row[6] || "",
                itemName: row[7] || fmsRow[4] || "-",
                quantity: row[8] || "",
                indentQty: fmsRow[14] || fmsRow[5] || "",

                // Transporter/Vehicle/Contact/LR are 9-12
                transporterName: row[9] || "",
                vehicleNo: row[10] || "",
                contactNo: row[11] || "",
                lrNo: row[12] || "",

                // Dispatch/Freight/Advance/Payment are 13-17
                dispatchDate: row[13] || "",
                freightAmount: row[14] || "",
                advanceAmount: row[15] || "",
                paymentDate: row[16] || "",
                paymentStatus: row[17] || "",
                biltyCopy: row[18] || "",

                // Invoice/Receipt Fields with robust fallbacks
                invoiceType: row[22] || "-",
                invoiceDate: row[23] || row[0] || "-",
                invoiceNumber: row[24] || ("INV-" + (row[1] || "1004")),
                receivedQty: row[25] || row[8] || fmsRow[14] || fmsRow[5] || "-",
                receivedItemImage: row[26] || "",
                srnNumber: row[27] || ("SRN-" + (row[2] || "1001")),
                qcRequirement: row[28] || "-",
                billAttachment: row[29] || "",
                paymentAmountHydra: row[30] || "",
                paymentAmountLabour: row[31] || "",
                paymentAmountHamali: row[32] || "",
                remarks7: row[33] || "",

                // Tally Entry Plan/Actual (Dimensions AJ-AQ -> 35-42)
                plan8: row[35],
                actual8: row[36],
                doneBy: row[38],
                doneDate: row[39],
                remarks: row[40],
                checkedStatus: row[41],
                checkedByAcc: row[42],

                // Fetch from INDENT-LIFT (fmsRow)
                createdBy: fmsRow[2] || "-",
                category: fmsRow[3] || "-",
                warehouse: fmsRow[6] || "-",

                basicValue: basicValue,
                totalWithTax: totalWithTax,
                poCopy: fmsRow[58] || "",

                deliveryDate: "-",

                ...vendorDetails
              }
            };
          });
        setSheetRecords(rows);
      }

      // Fetch Dropdown sheet for Accountants (Column M / Index 12)
      const dropRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      const dropJson = await dropRes.json();
      if (dropJson.success && Array.isArray(dropJson.data)) {
        const accList = dropJson.data.slice(1)
          .map((row: any) => String(row[12] || "").trim())
          .filter((a: string) => a !== "");
        setAccountantList(accList);
      }

    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter records
  const pending = useMemo(() => sheetRecords
    .filter((r: any) => r.status === "pending")
    .filter((r) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm, warehouseFilter]);

  const completed = useMemo(() => sheetRecords
    .filter((r: any) => r.status === "completed")
    .filter((r: any) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm, warehouseFilter]);

  // Pending columns
  const pendingColumns = [
    { key: "indentNumber", label: "Indent No." },
    { key: "createdBy", label: "Created By" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "indentQty", label: "Qty" },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor" },
    { key: "poNumber", label: "PO Number" },
    { key: "basicValue", label: "Basic Value" },
    { key: "totalWithTax", label: "Total w/Tax" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receiptLiftNumber", label: "Unit Tracking No." },
    { key: "receivedQty", label: "Rec. Qty" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "srnNumber", label: "SRN No." },
    { key: "qcRequirement", label: "QC Required" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "plan8", label: "Planned" },
  ];

  // History columns
  const historyColumns = [
    ...pendingColumns,
    { key: "actual8", label: "Actual" },
    { key: "doneBy", label: "Billing Done By" },
    { key: "doneDate", label: "Billing Date" },
    { key: "tallyStatus", label: "Billing Status" },
    { key: "remarks", label: "Billing Remarks" },
    { key: "checkedStatus", label: "Checked" },
    { key: "checkedByAcc", label: "Checked By" },
  ];

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    pendingColumns.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    historyColumns.map((c) => c.key)
  );

  // Toggle row
  const toggleRow = (id: string) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedRows.size === pending.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pending.map((r: any) => r.id)));
    }
  };

  // Get vendor data helper
  const getVendorData = (record: any) => {
    const data = record?.data;
    if (!data) return { name: "-", rate: "-", terms: "-" };
    // Only use fallback if needed, but primary vendorName is now direct from Row 3
    return {
      name: data.vendorName || data.vendorNameFallback || "-",
      rate: data.rate || "-",
      terms: data.terms || "-",
    };
  };

  const formatDateDash = (dateStr: any) => {
    if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
    const d = parseSheetDate(dateStr);
    if (!d || isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}-${month}-${year}`;
  };

  // Safe value getter with lifting data support
  const safeValue = (record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const vendor = getVendorData(record);

      // Handle file attachments with clickable links
      const fileFields = ["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto", "biltyCopy"];
      if (fileFields.includes(key)) {
        let url = data[key];
        if (key === "biltyCopy") url = data.liftingData?.[0]?.biltyCopy;

        if (!url || String(url).trim() === "" || url === "-") return "-";

        let displayUrl = String(url);
        if (displayUrl.includes("drive.google.com/uc")) {
          const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
          }
        }

        return (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      // Handle vendor data fields
      if (key === "vendorName") return vendor.name;
      if (key === "ratePerQty") return vendor.rate ? `₹${vendor.rate}` : "-";
      if (key === "paymentTerms") return vendor.terms;

      // Handle lifting data
      if (key === "receiptLiftNumber") return data.liftNumber || "-";

      // Handle payment amounts
      if (key === "paymentAmountHydra" || key === "paymentAmountLabour" || key === "paymentAmountHamali") {
        return data[key] ? `₹${data[key]}` : "-";
      }

      // Handle QC Status for display
      if (key === "qcStatus") {
        const val = data[key];
        if (!val || val === "-") return "-";
        // Capitalize first letter
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
      }

      const val = data[key];
      if (val === undefined || val === null || String(val).trim() === "") return "-";

      const lowKey = key.toLowerCase();
      if ((lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual"))) {
        return formatDateDash(val);
      }

      return String(val);
    } catch (err) {
      return "-";
    }
  };



  return (
    <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
      {/* Modal Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="p-0 overflow-hidden border-0 rounded-3xl shadow-2xl bg-white" style={{ maxWidth: "360px", width: "90%" }}>
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <FileText className="w-5.5 h-5.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-wide text-white">
                  Billing
                </DialogTitle>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Update billing information for {selectedRows.size} Selected item(s)
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5 flex flex-col items-center">
            {bulkError && (
              <div className="bg-rose-50 text-rose-700 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 border border-rose-100 shadow-sm w-[280px]">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            <div className="space-y-4 w-[280px]">
              {/* Done By */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-650" />
                  Accountant (Done By) *
                </Label>
                <Select
                  value={formData.doneBy}
                  onValueChange={(v) => setFormData({ ...formData, doneBy: v })}
                >
                  <SelectTrigger className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs focus:ring-2 focus:ring-indigo-500">
                    <SelectValue placeholder="Select Accountant" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border rounded-xl shadow-lg text-xs">
                    {accountantList.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-650" />
                  Billing Entry Date
                </Label>
                <Input
                  type="date"
                  value={formData.submissionDate}
                  onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
                  className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-650" />
                  Remarks
                </Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter billing remarks..."
                  className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Checked Status Button Toggles */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-650" />
                  Checked by Accountant? *
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checkedStatus: "Yes" })}
                    className={cn(
                      "h-10 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-1.5",
                      formData.checkedStatus === "Yes"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/10"
                        : "bg-slate-50/50 border-slate-200 text-slate-650 hover:bg-slate-50"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Yes, Verified
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, checkedStatus: "No" })}
                    className={cn(
                      "h-10 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-1.5",
                      formData.checkedStatus === "No"
                        ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/10"
                        : "bg-slate-50/50 border-slate-200 text-slate-655 hover:bg-slate-50"
                    )}
                  >
                    <AlertCircle className="w-4 h-4" />
                    No, Pending
                  </button>
                </div>
              </div>

              {/* Checked By (Conditional) */}
              {formData.checkedStatus === "Yes" && (
                <div className="space-y-1.5 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-bold text-slate-650 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-650" />
                    Verified By *
                  </Label>
                  <Select
                    value={formData.checkedByAcc}
                    onValueChange={(v) => setFormData({ ...formData, checkedByAcc: v })}
                  >
                    <SelectTrigger className="bg-slate-50/50 border-slate-200/80 rounded-xl h-10 text-xs focus:ring-2 focus:ring-emerald-500">
                      <SelectValue placeholder="Select Verifying Accountant" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border rounded-xl shadow-lg text-xs">
                      {accountantList.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.doneBy ||
                !formData.checkedStatus ||
                (formData.checkedStatus === "Yes" && !formData.checkedByAcc) ||
                isSubmitting ||
                !!bulkError
              }
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-semibold shadow-md transition-all duration-200",
                formData.checkedStatus === "Yes"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10"
                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-950/10"
              )}
            >
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Complete Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        {/* Sticky Header and Tabs Container */}
        <div className="md:sticky md:top-0 z-50 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
          {/* Header Card */}
          <div className="mb-4 md:mb-6 p-4 md:p-6 bg-white border rounded-lg shadow-sm">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-900 rounded-lg text-white shadow-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Stage 10: Billing
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                {/* Column Selection */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-600">
                    Columns:
                  </Label>
                  <Select value="" onValueChange={() => { }}>
                    <SelectTrigger className="w-40 bg-white border-slate-200 h-9 text-slate-900">
                      <SelectValue
                        placeholder={
                          activeTab === "pending"
                            ? `${selectedPendingColumns.length} selected`
                            : `${selectedHistoryColumns.length} selected`
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="w-56 max-h-96 overflow-y-auto">
                      <div className="p-2">
                        <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                          <Checkbox
                            id="select-all-columns"
                            checked={
                              activeTab === "pending"
                                ? selectedPendingColumns.length ===
                                pendingColumns.length
                                : selectedHistoryColumns.length ===
                                historyColumns.length
                            }
                            onCheckedChange={(checked) => {
                              if (activeTab === "pending") {
                                setSelectedPendingColumns(
                                  checked ? pendingColumns.map((c) => c.key) : []
                                );
                              } else {
                                setSelectedHistoryColumns(
                                  checked ? historyColumns.map((c) => c.key) : []
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor="select-all-columns"
                            className="text-sm font-semibold text-slate-900 cursor-pointer"
                          >
                            Select All
                          </Label>
                        </div>
                        {(activeTab === "pending"
                          ? pendingColumns
                          : historyColumns
                        ).map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded transition-colors"
                          >
                            <Checkbox
                              id={`col-${col.key}`}
                              checked={
                                activeTab === "pending"
                                  ? selectedPendingColumns.includes(col.key)
                                  : selectedHistoryColumns.includes(col.key)
                              }
                              onCheckedChange={(checked) => {
                                if (activeTab === "pending") {
                                  setSelectedPendingColumns(
                                    checked
                                      ? [...selectedPendingColumns, col.key]
                                      : selectedPendingColumns.filter(
                                        (c) => c !== col.key
                                      )
                                  );
                                } else {
                                  setSelectedHistoryColumns(
                                    checked
                                      ? [...selectedHistoryColumns, col.key]
                                      : selectedHistoryColumns.filter(
                                        (c) => c !== col.key
                                      )
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={`col-${col.key}`}
                              className="text-sm cursor-pointer flex-1 text-slate-700"
                            >
                              {col.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Warehouse Filter */}
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="w-[160px] bg-white border-slate-200 h-9 text-slate-900">
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="All">All Warehouses</SelectItem>
                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-9 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Refresh */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  disabled={isLoading}
                  className="h-9 w-9 border-slate-200"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                  )}
                </Button>

                {/* Bulk Action */}
                {selectedRows.size >= 1 && activeTab === "pending" && (
                  <Button
                    onClick={handleOpenModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 shadow-sm whitespace-nowrap"
                  >
                    Billing ({selectedRows.size})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100/50 p-1 rounded-lg">
            <TabsTrigger
              value="pending"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
            >
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
            >
              History ({completed.length})
            </TabsTrigger>
          </TabsList>
        </div>


        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-0 outline-none">
          {(pending.length === 0 && !isLoading) ? (
            <div className="text-center py-12 text-gray-500 bg-white border rounded-lg shadow-sm">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
              <p className="text-lg text-slate-600 font-medium">No pending Billing entries</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
              <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <tr className="hover:bg-transparent border-none">
                    <th className="sticky left-0 z-40 bg-slate-200 w-12 border-b text-center px-4 py-3">
                      <Checkbox
                        checked={
                          selectedRows.size === pending.length &&
                          pending.length > 0
                        }
                        onCheckedChange={toggleAll}
                        className="translate-y-[2px]"
                      />
                    </th>
                    {pendingColumns
                      .filter((c) => selectedPendingColumns.includes(c.key))
                      .map((col) => (
                        <th
                          key={col.key}
                          className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={pendingColumns.filter((c) => selectedPendingColumns.includes(c.key)).length + 1}
                        className="h-48 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                          <span className="text-slate-500 font-medium">Loading records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pending.map((record: any) => (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                          <Checkbox
                            checked={selectedRows.has(record.id)}
                            onCheckedChange={() => toggleRow(record.id)}
                            className="translate-y-[2px]"
                          />
                        </td>
                        {pendingColumns
                          .filter((c) => selectedPendingColumns.includes(c.key))
                          .map((col) => (
                            <td
                              key={col.key}
                              className="border-b px-4 py-2 text-center text-slate-700"
                            >
                              {safeValue(record, col.key)}
                            </td>
                          ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          {(completed.length === 0 && !isLoading) ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No Billing history</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm overflow-y-auto">
              <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <tr className="hover:bg-transparent border-none">
                    {historyColumns
                      .filter((c) => selectedHistoryColumns.includes(c.key))
                      .map((col) => (
                        <th
                          key={col.key}
                          className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={historyColumns.filter((c) => selectedHistoryColumns.includes(c.key)).length}
                        className="h-48 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                          <span className="text-slate-500 font-medium">Loading history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    completed.map((record: any) => (
                      <tr
                        key={record.id}
                        className="hover:bg-indigo-50/50 transition-colors"
                      >
                        {historyColumns
                          .filter((c) => selectedHistoryColumns.includes(c.key))
                          .map((col) => (
                            <td
                              key={col.key}
                              className="border-b px-4 py-2 text-center text-slate-700"
                            >
                              {safeValue(record, col.key)}
                            </td>
                          ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}