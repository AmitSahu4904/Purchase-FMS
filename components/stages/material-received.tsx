"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StageTable } from "./stage-table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileText, Upload, X, Loader2, Search, Eye, Package } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { parseSheetDate, formatDate, getFmsTimestamp } from "@/lib/utils";

const formatDateDash = (date: any) => {
    if (!date || date === "-" || date === "—") return "-";
    const d = date instanceof Date ? date : parseSheetDate(date);
    if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

// ─── Module-level helpers (stable references, no re-creation on render) ────
const GST_RATES: Record<string, number> = {
    "5%": 0.05,
    "12%": 0.12,
    "18%": 0.18,
    "28%": 0.28,
};

const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

const convertToDownloadUrl = (url: string) => {
    if (!url || !url.includes("drive.google.com")) return url;
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
};

const uploadFileToDrive = async (
    file: File,
    apiUrl: string,
    folderId: string
): Promise<string> => {
    const uploadParams = new URLSearchParams();
    uploadParams.append("action", "uploadFile");
    uploadParams.append("base64Data", await toBase64(file));
    uploadParams.append("fileName", file.name);
    uploadParams.append("mimeType", file.type);
    uploadParams.append("folderId", folderId);
    const res = await fetch(apiUrl, { method: "POST", body: uploadParams });
    const json = await res.json();
    return json.success ? convertToDownloadUrl(json.fileUrl) : "";
};

/* --------------------------------------------------------------- */
/*  COLUMNS FOR PENDING TAB (Same as Follow-Up Vendor History)     */
/* --------------------------------------------------------------- */
const PENDING_COLUMNS = [
    { key: "indentNumber", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "planned6", label: "Planned" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "liftingQty", label: "Dispatch Qty" },
    { key: "transporterName", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No" },
    { key: "contactNo", label: "Contact No" },
    { key: "lrNo", label: "LR No" },
    { key: "dispatchDate", label: "Dispatch Date" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "biltyCopy", label: "Bilty Copy" },
    { key: "poCopy", label: "PO Copy" },
] as const;

// ─── COLUMNS FOR HISTORY TAB (SHOW ALL) ─────────────────────────────────────
const HISTORY_COLUMNS = [
    ...PENDING_COLUMNS.slice(0, 6),
    { key: "actual6", label: "Actual" },
    ...PENDING_COLUMNS.slice(6),
    { key: "invoiceType", label: "Invoice Type" },
    { key: "receiptLiftNumber", label: "Receipt Unit Tracking No." },
    { key: "receivedQty", label: "Received Qty" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceNumber", label: "Invoice No." },
    { key: "extraFreight", label: "Extra Freight" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "damagedQty", label: "Damaged Qty" },
    { key: "damageReason", label: "Damage Reason" },
    { key: "damageImage", label: "Damage Image" },
] as const;

export default function Stage7() {

    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [selectedPendingColumns, setSelectedPendingColumns] = useState<
        string[]
    >(PENDING_COLUMNS.map((c) => c.key));
    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<
        string[]
    >(HISTORY_COLUMNS.map((c) => c.key));

    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");

    // Bulk State
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkItems, setBulkItems] = useState<{
        recordId: string;
        indentNumber: string;
        liftNumber: string;
        itemName: string;
        receivedQty: string;
        receivedItemImage: File | null;
        damageReceived: string;
        damagedQty: string;
        damageReason: string;
        damageImage: File | null;
        index: number;
    }[]>([]);
    const [commonData, setCommonData] = useState({
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        remarks: "",
    });

    // Stable helper: Packaging/Forwarding totals
    const getPkgTotals = useCallback((
        pkgAmount: string, pkgGST: string, count: number
    ) => {
        const base = parseFloat(pkgAmount) || 0;
        const gstRate = GST_RATES[pkgGST] ?? 0;
        const totalPkg = base + base * gstRate;
        const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
        const perItemPkgBase = count > 0 ? base / count : 0;
        return { totalPkg, perItemPkgTotal, perItemPkgBase };
    }, []);


    const fetchData = useCallback(async () => {
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [liftRes, fmsRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`)
            ]);

            const liftJson = await liftRes.json();
            const fmsJson = await fmsRes.json();

            // Create FMS Map (Indent No. -> Row)
            const fmsMap = new Map<string, any[]>();
            if (fmsJson.success && Array.isArray(fmsJson.data)) {
                // FMS data usually starts after header rows, typically slice(7) based on other stages
                fmsJson.data.slice(7).forEach((r: any) => {
                    if (r[1] && String(r[1]).trim()) {
                        fmsMap.set(String(r[1]).trim(), r);
                    }
                });
            }

            if (liftJson.success && Array.isArray(liftJson.data)) {
                // Data starts from row 7 (index 6)
                const rows = liftJson.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        // Column T (index 19) = Planned
                        // Column U (index 20) = Actual
                        const hasColumnT = !!row[19] && String(row[19]).trim() !== "";
                        const hasColumnU = !!row[20] && String(row[20]).trim() !== "";

                        // Filtering logic:
                        // - If column T is not null AND column U is null => pending
                        // - If both columns T and U are not null => completed
                        let status = "not_ready";
                        if (hasColumnT && !hasColumnU) {
                            status = "pending";
                        } else if (hasColumnT && hasColumnU) {
                            status = "completed";
                        }

                        const indentNum = String(row[1] || "").trim();
                        const fmsRow = fmsMap.get(indentNum);

                        // Use composite key (indentNumber + "_" + liftNo) for uniqueness
                        const liftNoKey = String(row[2] || "").trim();
                        const indentKey = String(row[1] || "").trim();
                        const compositeId = indentKey && liftNoKey ? `${indentKey}_${liftNoKey}` : (indentKey || `row-${originalIndex}`);
                        return {
                            id: compositeId,
                            rowIndex: originalIndex,
                            stage: 7,
                            status: status,
                            data: {
                                // RECEIVING-ACCOUNTS Columns (B-S)
                                indentNumber: row[1] || "",     // B: Indent Number
                                liftNo: row[2] || "",            // C: Unit Tracking No.
                                vendorName: row[3] || "",        // D: Vendor Name
                                poNumber: row[4] || "",          // E: PO Number
                                nextFollowUpDate: row[5] || "", // F: Next Follow-Up Date
                                remarks: row[6] || "",           // G: Remarks
                                itemName: row[7] || "",          // H: Item Name
                                liftingQty: row[8] || "",        // I: Dispatch Qty
                                transporterName: row[9] || "",  // J: Transporter Name
                                vehicleNo: row[10] || "",        // K: Vehicle No
                                contactNo: row[11] || "",        // L: Contact No
                                lrNo: row[12] || "",             // M: LR No
                                dispatchDate: row[13] || "",     // N: Dispatch Date
                                freightAmount: row[14] || "",    // O: Freight Amount
                                advanceAmount: row[15] || "",    // P: Advance Amount
                                paymentDate: row[16] || "",      // Q: Payment Date
                                paymentStatus: row[17] || "",    // R: Payment Status
                                biltyCopy: row[18] || "",        // S: Bilty Copy
                                poCopy: fmsRow ? (fmsRow[58] || "") : "", // From INDENT-LIFT Column BG (index 58)
                                warehouse: fmsRow ? (fmsRow[6] || "") : "", // From INDENT-LIFT Column G (index 6)
                                invoiceNumber: row[24] || "",    // Y: Invoice Number
                                qcRequirement: row[28] || "",    // AC: QC Required

                                // Columns T and U for status determination & data
                                planned6: row[19] || "",          // T: Planned
                                actual6: row[20] || "",           // U: Actual

                                // History fields (not in data but in HISTORY_COLUMNS)
                                invoiceType: row[22] || "",       // W
                                receivedQty: row[25] || "",       // Z
                                invoiceDate: row[23] || "",       // X
                                extraFreight: row[27] || "",      // AB
                                receivedItemImage: row[26] || "", // AA
                                billAttachment: row[29] || "",    // AD
                                paymentAmountHydra: row[30] || "",// AE
                                paymentAmountLabour: row[31] || "",// AF
                                paymentAmountHamali: row[32] || "",// AG
                                receiptLiftNumber: row[2] || "",  // C: Reuse Lift No
                                damagedQty: row[116] || "",
                                damageReason: row[117] || "",
                                damageImage: row[118] || "",
                                productClaim: row[120] || "",     // DQ: Product Claim
                            }
                        };
                    });
                setSheetRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const fetchDropdown = async () => {
            const API = process.env.NEXT_PUBLIC_API_URI;
            if (!API) return;
            try {
                const res = await fetch(`${API}?sheet=Dropdown&action=getAll`);
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    const mapping: Record<string, string> = {};
                    json.data.slice(1).forEach((row: any) => {
                        const code = String(row[2] || "").trim(); // C
                        const name = String(row[4] || "").trim(); // E
                        if (name && code) mapping[name] = code;
                    });
                    setItemCodeMap(mapping);
                }
            } catch (e) {
                console.error("Error fetching dropdowns:", e);
            }
        };
        fetchDropdown();
    }, []);


    useEffect(() => { fetchData(); }, [fetchData]);

    const [form, setForm] = useState({
        itemName: "",
        liftNumber: "",
        receivedQty: "",
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        receivedItemImage: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        extraFreight: "",
        qcRequirement: "no",
        warrantyClaim: "",
        productClaim: "",
        duration: "",
        warrantyExpiry: "",
        productExpiry: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
        damageReceived: "no",
        damagedQty: "",
        damageReason: "",
        damageImage: null as File | null,
    });

    // Build a fast lookup map for records
    const recordMap = useMemo(
        () => new Map(sheetRecords.map((r) => [r.id, r])),
        [sheetRecords]
    );

    // Check Vendor/PO Match
    const checkVendorPOMatch = useCallback((ids: string[]) => {
        if (ids.length === 0) return { match: false, vendor: "", po: "" };
        const first = recordMap.get(ids[0]);
        if (!first) return { match: false, vendor: "", po: "" };
        const v = first.data.vendorName;
        const p = first.data.poNumber;
        for (let i = 1; i < ids.length; i++) {
            const rec = recordMap.get(ids[i]);
            if (!rec || rec.data.vendorName !== v || rec.data.poNumber !== p)
                return { match: false, vendor: "", po: "" };
        }
        return { match: true, vendor: v, po: p };
    }, [recordMap]);

    const handleBulkOpen = useCallback(() => {
        if (selectedRecordIds.length === 0) return;
        const { match } = checkVendorPOMatch(selectedRecordIds);
        if (selectedRecordIds.length > 1 && !match) {
            toast.error("All selected items must have the same Vendor and PO Number.", {
                style: { background: "red", color: "white", border: "none" }
            });
            return;
        }
        setIsBulkMode(true);
        setCommonData({
            invoiceNumber: "",
            invoiceDate: "",
            billAttachment: null,
            remarks: "",
        });
        const items = selectedRecordIds.map(id => {
            const rec = recordMap.get(id);
            return {
                recordId: id,
                indentNumber: rec?.data?.indentNumber || "",
                liftNumber: rec?.data?.liftNo || "",
                itemName: rec?.data?.itemName || "",
                receivedQty: "",
                receivedItemImage: null,
                damageReceived: "no",
                damagedQty: "",
                damageReason: "",
                damageImage: null,
                index: rec?.rowIndex || 0
            };
        });
        setBulkItems(items);
        setOpen(true);
    }, [selectedRecordIds, checkVendorPOMatch, recordMap]);

    const handleBulkSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) return;
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
        setIsSubmitting(true);
        try {
            // Upload bill attachment once (shared across all items)
            const billUrlPromise = commonData.billAttachment
                ? uploadFileToDrive(commonData.billAttachment, SHEET_API_URL, folderId)
                : Promise.resolve("");

            const timestamp = getFmsTimestamp();

            const billUrl = await billUrlPromise;

            // Parallelize processing of all bulk items
            await Promise.all(bulkItems.map(async (item) => {
                // For each item, upload its specific image and handle QR concurrently
                const itemImgUrl = item.receivedItemImage
                    ? await uploadFileToDrive(item.receivedItemImage, SHEET_API_URL, folderId)
                    : "";

                // Damage Image
                let damageImageUrl = "";
                if (item.damageImage) {
                    damageImageUrl = await uploadFileToDrive(item.damageImage, SHEET_API_URL, folderId);
                }

                const rowArray = new Array(121).fill("");
                rowArray[20] = timestamp;               // U: Actual6
                rowArray[22] = "independent";         // W: Invoice Type
                rowArray[23] = commonData.invoiceDate;  // X
                rowArray[24] = commonData.invoiceNumber; // Y
                rowArray[25] = item.receivedQty;        // Z
                rowArray[26] = itemImgUrl;              // AA
                rowArray[27] = "";                      // AB: Extra Freight (removed)
                rowArray[28] = "";                      // AC: QC Required (removed)
                rowArray[29] = billUrl;                 // AD
                rowArray[30] = "";                      // AE: Hydra (removed)
                rowArray[31] = "";                      // AF: Labour (removed)
                rowArray[32] = "";                      // AG: Hamali (removed)
                rowArray[33] = commonData.remarks;      // AH
                rowArray[99] = "";                      // CV: Pkg Amount (removed)
                rowArray[100] = "";                     // CW: Pkg GST (removed)
                rowArray[104] = "";                     // DA: Warranty Claim (removed)
                rowArray[105] = "";                     // DB: Duration (removed)
                rowArray[106] = "";                     // DC: Warranty Expiry (removed)
                rowArray[107] = "";                     // DD: Product Expiry (removed)

                // Damage Columns
                rowArray[116] = item.damagedQty || "";   // DM
                rowArray[117] = item.damageReason || ""; // DN
                rowArray[118] = damageImageUrl;          // DO

                const params = new URLSearchParams();
                params.append("action", "update");
                params.append("sheetName", "RECEIVING-ACCOUNTS");
                params.append("rowData", JSON.stringify(rowArray));
                params.append("rowIndex", item.index.toString());

                return fetch(SHEET_API_URL, { method: "POST", body: params });
            }));

            toast.success("Bulk Receipt recorded successfully!");
            setOpen(false);
            setSelectedRecordIds([]);
            setIsBulkMode(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error submitting bulk form");
        } finally {
            setIsSubmitting(false);
        }
    }, [commonData, bulkItems, fetchData, itemCodeMap]);



    /* --------------------------------------------------------------- */
    /*  Open Modal                                                     */
    /* --------------------------------------------------------------- */
    const openModal = useCallback((recordId: string) => {
        const rec = recordMap.get(recordId);
        if (!rec) {
            toast.error("Record not found locally. Please refresh.");
            return;
        }
        setSelectedRecordIds([]);
        setIsBulkMode(false);
        setSelectedRecordId(recordId);
        setForm({
            itemName: rec.data.itemName || "",
            liftNumber: rec.data.liftNo || "",
            receivedQty: rec.data.liftingQty || "",
            invoiceNumber: rec.data.invoiceNumber || "",
            invoiceDate: "",
            billAttachment: null,
            receivedItemImage: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            extraFreight: "",
            qcRequirement: "no",
            warrantyClaim: "",
            productClaim: "",
            duration: "",
            warrantyExpiry: "",
            productExpiry: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
            damageReceived: "no",
            damagedQty: "",
            damageReason: "",
            damageImage: null,
        });
        setOpen(true);
    }, [recordMap]);

    /* --------------------------------------------------------------- */
    /*  Submit                                                         */
    /* --------------------------------------------------------------- */
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!selectedRecordId || !SHEET_API_URL) return;
        const rec = recordMap.get(selectedRecordId);
        if (!rec) return;
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
        setIsSubmitting(true);
        try {
            // Parallelize file uploads and QR generation/upload
            const billPromise = form.billAttachment instanceof File
                ? uploadFileToDrive(form.billAttachment, SHEET_API_URL, folderId)
                : Promise.resolve(typeof form.billAttachment === "string" ? form.billAttachment : "");

            const imagePromise = form.receivedItemImage instanceof File
                ? uploadFileToDrive(form.receivedItemImage, SHEET_API_URL, folderId)
                : Promise.resolve(typeof form.receivedItemImage === "string" ? form.receivedItemImage : "");

            const [billUrl, imageUrl] = await Promise.all([billPromise, imagePromise]);

            const timestamp = getFmsTimestamp();
            const rowArray = new Array(121).fill("");

            rowArray[20] = timestamp;               // U: Actual6
            rowArray[22] = "independent";         // W: Invoice Type
            rowArray[23] = form.invoiceDate;      // X
            rowArray[24] = form.invoiceNumber;    // Y
            rowArray[25] = form.receivedQty;      // Z
            rowArray[26] = imageUrl;              // AA
            rowArray[27] = "";                      // AB: Extra Freight (removed)
            rowArray[28] = "";                      // AC: QC Required (removed)
            rowArray[29] = billUrl;               // AD
            rowArray[30] = "";                      // AE: Hydra (removed)
            rowArray[31] = "";                      // AF: Labour (removed)
            rowArray[32] = "";                      // AG: Hamali (removed)
            rowArray[33] = form.remarks;          // AH
            rowArray[99] = "";                     // CV: Pkg Amount (removed)
            rowArray[100] = "";                    // CW: Pkg GST (removed)
            rowArray[104] = "";                    // DA: Warranty Claim (removed)
            rowArray[105] = "";                    // DB: Duration (removed)
            rowArray[106] = "";                    // DC: Warranty Expiry (removed)
            rowArray[107] = "";                    // DD: Product Expiry (removed)
            rowArray[120] = "";                    // DQ: Product Claim (removed)

            // Damage Data
            let damageImageUrl = "";
            if (form.damageImage) {
                damageImageUrl = await uploadFileToDrive(form.damageImage, SHEET_API_URL, folderId);
            }
            rowArray[116] = form.damagedQty || "";  // DM
            rowArray[117] = form.damageReason || ""; // DN
            rowArray[118] = damageImageUrl;          // DO

            const params = new URLSearchParams();
            params.append("action", "update");
            params.append("sheetName", "RECEIVING-ACCOUNTS");
            params.append("rowData", JSON.stringify(rowArray));
            params.append("rowIndex", rec.rowIndex.toString());

            const updateRes = await fetch(SHEET_API_URL, { method: "POST", body: params });
            const updateJson = await updateRes.json();
            if (updateJson.success) {
                toast.success("Receipt recorded successfully!");
                setOpen(false);
                fetchData();
            } else {
                toast.error("Failed to update sheet: " + (updateJson.error || "Unknown error"));
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Error submitting form");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecordId, recordMap, form, fetchData]);

    const removeFile = useCallback((key: "billAttachment" | "receivedItemImage") => {
        setForm((f) => ({ ...f, [key]: null }));
    }, []);

    const formValid = useMemo(() =>
        form.receivedQty &&
        form.invoiceNumber &&
        form.invoiceDate &&
        form.billAttachment,
        [
            form.receivedQty,
            form.invoiceNumber,
            form.invoiceDate,
            form.billAttachment,
        ]);

    // Memoized filtered lists – only recompute when records or search change
    const pending = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "pending") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);

    const completed = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "completed") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                String(r.data.indentNumber || "").toLowerCase().includes(lower) ||
                String(r.data.itemName || "").toLowerCase().includes(lower) ||
                String(r.data.vendorName || "").toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);



    return (
        <div className="p-4 md:p-6 min-h-screen bg-[#f8fafc]">
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                {/* Sticky Header and Tabs Container */}
                <div className="md:sticky md:top-0 z-30 bg-[#f8fafc] -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    {/* ==================== HEADER ==================== */}
                    <div className="p-4 md:p-6 bg-white border rounded-lg shadow-sm mb-4 md:mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-900 rounded-lg text-white shadow-xl">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage 9: Material Received</h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Bulk Button */}
                                {activeTab === "pending" && selectedRecordIds.length > 1 && (
                                    <Button
                                        onClick={handleBulkOpen}
                                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                    >
                                        Bulk Record ({selectedRecordIds.length})
                                    </Button>
                                )}

                                <Label className="text-sm font-medium text-slate-600 hidden md:inline-block">Show Columns:</Label>
                                <Select value="" onValueChange={() => { }}>
                                    <SelectTrigger className="w-40 bg-white border-slate-200">
                                        <SelectValue
                                            placeholder={
                                                activeTab === "pending"
                                                    ? `${selectedPendingColumns.length} selected`
                                                    : `${selectedHistoryColumns.length} selected`
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="w-40 bg-white">
                                        <div className="p-2">
                                            <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                                <Checkbox
                                                    checked={
                                                        activeTab === "pending"
                                                            ? selectedPendingColumns.length ===
                                                            PENDING_COLUMNS.length
                                                            : selectedHistoryColumns.length ===
                                                            HISTORY_COLUMNS.length
                                                    }
                                                    onCheckedChange={(c) => {
                                                        if (activeTab === "pending") {
                                                            setSelectedPendingColumns(
                                                                c ? PENDING_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        } else {
                                                            setSelectedHistoryColumns(
                                                                c ? HISTORY_COLUMNS.map((col) => col.key) : []
                                                            );
                                                        }
                                                    }}
                                                />
                                                <Label className="text-sm font-medium">All Columns</Label>
                                            </div>
                                            {(activeTab === "pending"
                                                ? PENDING_COLUMNS
                                                : HISTORY_COLUMNS
                                            ).map((col) => (
                                                <div
                                                    key={col.key}
                                                    className="flex items-center space-x-2 py-1"
                                                >
                                                    <Checkbox
                                                        checked={
                                                            activeTab === "pending"
                                                                ? selectedPendingColumns.includes(col.key)
                                                                : selectedHistoryColumns.includes(col.key)
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            } else {
                                                                setSelectedHistoryColumns((prev) =>
                                                                    checked
                                                                        ? [...prev, col.key]
                                                                        : prev.filter((c) => c !== col.key)
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <Label className="text-sm">{col.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Search Filter */}
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>

                            {/* Warehouse Filter */}
                            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                                <SelectTrigger className="w-[150px] bg-white border-slate-200">
                                    <SelectValue placeholder="Select warehouse" />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="All">All Warehouses</SelectItem>
                                    <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                                    <SelectItem value="Others">Others</SelectItem>
                                </SelectContent>
                            </Select>
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

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
                        <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        {/* ---------- PENDING ---------- */}
                        <TabsContent value="pending" className="mt-0 outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg">No pending receipts</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <TableRow className="hover:bg-transparent border-none">
                                                {activeTab === "pending" && (
                                                    <TableHead className="sticky left-0 z-40 bg-slate-200 w-[50px] border-b text-center">
                                                        <Checkbox
                                                            checked={
                                                                pending.length > 0 &&
                                                                selectedRecordIds.length === pending.length
                                                            }
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedRecordIds(pending.map((r) => r.id));
                                                                } else {
                                                                    setSelectedRecordIds([]);
                                                                }
                                                            }}
                                                        />
                                                    </TableHead>
                                                )}
                                                <TableHead className="sticky left-[50px] z-40 bg-slate-200 w-[150px] border-b text-center whitespace-nowrap px-4">Actions</TableHead>
                                                {PENDING_COLUMNS.filter((c) =>
                                                    selectedPendingColumns.includes(c.key)
                                                ).map((c) => (
                                                    <TableHead key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pending.map((rec) => (
                                                <TableRow key={rec.id} className="hover:bg-gray-50 group">
                                                    {activeTab === "pending" && (
                                                        <TableCell className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center">
                                                            <Checkbox
                                                                checked={selectedRecordIds.includes(rec.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedRecordIds((prev) =>
                                                                        checked
                                                                            ? [...prev, rec.id]
                                                                            : prev.filter((id) => id !== rec.id)
                                                                    );
                                                                }}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="sticky left-[50px] z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openModal(rec.id)}
                                                            className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                        >
                                                            Record Receipt
                                                        </Button>
                                                    </TableCell>

                                                    {PENDING_COLUMNS.filter((c) =>
                                                        selectedPendingColumns.includes(c.key)
                                                    ).map((col) => {
                                                        const val = rec.data[col.key];

                                                        // Handle Bilty Copy as a link
                                                        if (col.key === "biltyCopy") {
                                                            const biltyRaw = rec.data.biltyCopy;
                                                            let biltyUrl = biltyRaw;
                                                            if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                                const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                    {biltyUrl ? (
                                                                        <a
                                                                            href={biltyUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center justify-center gap-1 text-xs text-green-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View Bilty</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle PO Copy as a link
                                                        if (col.key === "poCopy") {
                                                            const poRaw = rec.data.poCopy;
                                                            let poUrl = poRaw;
                                                            if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                                const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                    {poUrl ? (
                                                                        <a
                                                                            href={poUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View PO</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle date columns - format as DD-MM-YYYY
                                                        if (col.key === "nextFollowUpDate" || col.key === "dispatchDate" || col.key === "paymentDate" || col.key === "planned6") {
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? formatDateDash(val) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle currency columns
                                                        if (col.key === "freightAmount" || col.key === "advanceAmount") {
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? `₹${val}` : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Default rendering
                                                        return (
                                                            <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                {val || "-"}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ---------- HISTORY ---------- */}
                        <TabsContent value="history" className="mt-6">
                            {completed.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p className="text-lg">No completed receipts</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <TableRow className="hover:bg-transparent border-none">
                                                {HISTORY_COLUMNS.filter((c) =>
                                                    selectedHistoryColumns.includes(c.key)
                                                ).map((c) => (
                                                    <TableHead key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {completed.map((record) => {
                                                const historyData = record.data;

                                                return (
                                                    <TableRow key={record.id} className="bg-green-50 hover:bg-green-100 transition-colors">
                                                        {HISTORY_COLUMNS.filter((c) =>
                                                            selectedHistoryColumns.includes(c.key)
                                                        ).map((col) => {
                                                            const val = (historyData[col.key] !== undefined && historyData[col.key] !== "")
                                                                ? historyData[col.key]
                                                                : record.data[col.key];

                                                            // Handle date fields (dispatchDate, paymentDate, etc.)
                                                            if (
                                                                col.key === "dispatchDate" ||
                                                                col.key === "paymentDate" ||
                                                                col.key === "nextFollowUpDate" ||
                                                                col.key === "invoiceDate" ||
                                                                col.key === "actual6" ||
                                                                col.key === "planned6"
                                                            ) {
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                        {formatDateDash(val)}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle file fields
                                                            if (col.key === "biltyCopy") {
                                                                const biltyRaw = historyData.biltyCopy;
                                                                let biltyUrl = biltyRaw;
                                                                if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                                    const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {biltyUrl ? (
                                                                            <a
                                                                                href={biltyUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-green-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span>View Bilty</span>
                                                                            </a>
                                                                        ) : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle PO Copy as a link
                                                            if (col.key === "poCopy") {
                                                                const poRaw = historyData.poCopy;
                                                                let poUrl = poRaw;
                                                                if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                                    const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {poUrl ? (
                                                                            <a
                                                                                href={poUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span>View PO</span>
                                                                            </a>
                                                                        ) : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            if (
                                                                col.key === "receivedItemImage" ||
                                                                col.key === "billAttachment" ||
                                                                col.key === "damageImage"
                                                            ) {
                                                                const file = historyData[col.key];
                                                                let fileUrl = typeof file === "string" ? file : undefined;
                                                                if (fileUrl && fileUrl.includes("drive.google.com/uc")) {
                                                                    const m = fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                    if (m?.[1]) fileUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                                }
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center">
                                                                        {fileUrl ? (
                                                                            <a
                                                                                href={fileUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:underline"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                                <span className="truncate max-w-20">
                                                                                    View {col.label}
                                                                                </span>
                                                                            </a>
                                                                        ) : (
                                                                            "-"
                                                                        )}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Handle currency columns
                                                            if (
                                                                col.key === "freightAmount" ||
                                                                col.key === "advanceAmount" ||
                                                                col.key === "extraFreight"
                                                            ) {
                                                                return (
                                                                    <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                        {val ? `₹${val}` : "-"}
                                                                    </TableCell>
                                                                );
                                                            }

                                                            // Default: show from historyData
                                                            return (
                                                                <TableCell key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                    {val ? String(val) : "-"}
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            {/* ==================== MODAL ==================== */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-6">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>
                            {isBulkMode
                                ? "Bulk Material Receipt"
                                : "Record Material Receipt"}
                        </DialogTitle>
                        <p></p>
                    </DialogHeader>

                    {isBulkMode ? (
                        /* BULK FORM */
                        <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-4 p-4 pb-8 pr-2">
                            {/* Individual Items Table */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Items ({bulkItems.length})</h3>
                                <div className="border rounded-lg overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="w-[200px]">Item Details</TableHead>
                                                <TableHead className="w-[120px]">Received Qty <span className="text-red-500">*</span></TableHead>
                                                <TableHead className="w-[150px]">Item Image</TableHead>
                                                <TableHead className="w-[120px]">Damage Received</TableHead>
                                                {bulkItems.some(i => i.damageReceived === "yes") && (
                                                    <>
                                                        <TableHead className="w-[100px]">Damaged Qty</TableHead>
                                                        <TableHead className="w-[150px]">Reason</TableHead>
                                                        <TableHead className="w-[150px]">Damage Image</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bulkItems.map((item, idx) => (
                                                <TableRow key={item.recordId}>
                                                    <TableCell className="text-xs">
                                                        <div className="font-bold">Ind: {item.indentNumber}</div>
                                                        <div>Lift: {item.liftNumber}</div>
                                                        <div className="text-gray-500 truncate max-w-[150px]" title={item.itemName}>{item.itemName}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            value={item.receivedQty}
                                                            onChange={(e) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].receivedQty = e.target.value;
                                                                setBulkItems(newItems);
                                                            }}
                                                            className="h-8"
                                                            required
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <input
                                                                id={`bulkItemImage-${idx}`}
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx].receivedItemImage = e.target.files?.[0] || null;
                                                                    setBulkItems(newItems);
                                                                }}
                                                                className="hidden"
                                                            />
                                                            {!item.receivedItemImage ? (
                                                                <label
                                                                    htmlFor={`bulkItemImage-${idx}`}
                                                                    className="flex items-center justify-center h-8 border border-dashed rounded cursor-pointer hover:bg-gray-50 px-2"
                                                                >
                                                                    <Upload className="w-3 h-3 mr-1" />
                                                                    <span className="text-[10px]">Upload</span>
                                                                </label>
                                                            ) : (
                                                                <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 border rounded">
                                                                    <span className="text-[10px] truncate max-w-[60px]">{item.receivedItemImage.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].receivedItemImage = null;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="text-red-600"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select
                                                            value={item.damageReceived}
                                                            onValueChange={(v) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].damageReceived = v;
                                                                if (v === "no") {
                                                                    newItems[idx].damagedQty = "";
                                                                    newItems[idx].damageReason = "";
                                                                    newItems[idx].damageImage = null;
                                                                }
                                                                setBulkItems(newItems);
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="yes">Yes</SelectItem>
                                                                <SelectItem value="no">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    {bulkItems.some(i => i.damageReceived === "yes") && (
                                                        <>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={item.damagedQty}
                                                                        onChange={(e) => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].damagedQty = e.target.value;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="h-8"
                                                                        placeholder="Qty"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <Input
                                                                        value={item.damageReason}
                                                                        onChange={(e) => {
                                                                            const newItems = [...bulkItems];
                                                                            newItems[idx].damageReason = e.target.value;
                                                                            setBulkItems(newItems);
                                                                        }}
                                                                        className="h-8"
                                                                        placeholder="Reason"
                                                                    />
                                                                ) : "-"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.damageReceived === "yes" ? (
                                                                    <div className="space-y-1">
                                                                        <input
                                                                            id={`bulkDamageImage-${idx}`}
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={(e) => {
                                                                                const newItems = [...bulkItems];
                                                                                newItems[idx].damageImage = e.target.files?.[0] || null;
                                                                                setBulkItems(newItems);
                                                                            }}
                                                                            className="hidden"
                                                                        />
                                                                        {!item.damageImage ? (
                                                                            <label
                                                                                htmlFor={`bulkDamageImage-${idx}`}
                                                                                className="flex items-center justify-center h-8 border border-dashed rounded cursor-pointer hover:bg-gray-50 px-2"
                                                                            >
                                                                                <Upload className="w-3 h-3 mr-1" />
                                                                                <span className="text-[10px]">Upload</span>
                                                                            </label>
                                                                        ) : (
                                                                            <div className="flex items-center justify-between gap-1 p-1 bg-gray-50 border rounded">
                                                                                <span className="text-[10px] truncate max-w-[60px]">{item.damageImage.name}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newItems = [...bulkItems];
                                                                                        newItems[idx].damageImage = null;
                                                                                        setBulkItems(newItems);
                                                                                    }}
                                                                                    className="text-red-600"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : "-"}
                                                            </TableCell>
                                                        </>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Common Details */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Common Details</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Invoice Date <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="date"
                                            value={commonData.invoiceDate}
                                            onChange={(e) => setCommonData({ ...commonData, invoiceDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Invoice No. <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={commonData.invoiceNumber}
                                            onChange={(e) => setCommonData({ ...commonData, invoiceNumber: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                        <input
                                            id="bulkBillAttachment"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={(e) => setCommonData({ ...commonData, billAttachment: e.target.files?.[0] || null })}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="bulkBillAttachment"
                                            className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                        >
                                            <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                            <span className="text-xs text-gray-500 font-medium">Upload Bill</span>
                                        </label>
                                        {commonData.billAttachment && (
                                            <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                    <span className="text-sm text-gray-700">
                                                        {commonData.billAttachment.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCommonData(prev => ({ ...prev, billAttachment: null }))}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Remarks</Label>
                                    <textarea
                                        value={commonData.remarks}
                                        onChange={(e) => setCommonData({ ...commonData, remarks: e.target.value })}
                                        className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* SINGLE FORM (Existing) */
                        <form
                            onSubmit={handleSubmit}
                            className="flex-1 overflow-y-auto space-y-4 p-4 pb-8 pr-2"
                        >
                            <div className="grid grid-cols-4 gap-3">
                                <div className="space-y-1.5 col-span-2">
                                    <Label>Item Name</Label>
                                    <Input
                                        value={form.itemName}
                                        readOnly
                                        className="bg-gray-50 border-blue-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Unit Tracking No.</Label>
                                    <Input
                                        value={form.liftNumber}
                                        readOnly
                                        className="bg-gray-50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>
                                        Received Qty <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        value={form.receivedQty}
                                        onChange={(e) =>
                                            setForm({ ...form, receivedQty: e.target.value })
                                        }
                                        required
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>
                                        Invoice Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        value={form.invoiceDate}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceDate: e.target.value })
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label>
                                        Invoice No. <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={form.invoiceNumber}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceNumber: e.target.value })
                                        }
                                        required
                                        placeholder="Invoice #"
                                    />
                                </div>
                            </div>



                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Damage Received</Label>
                                        <Select
                                            value={form.damageReceived}
                                            onValueChange={(v) => {
                                                const newForm = { ...form, damageReceived: v };
                                                if (v === "no") {
                                                    newForm.damagedQty = "";
                                                    newForm.damageReason = "";
                                                    newForm.damageImage = null;
                                                }
                                                setForm(newForm);
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {form.damageReceived === "yes" && (
                                <div className="grid grid-cols-3 gap-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Damaged Qty</Label>
                                        <Input
                                            type="number"
                                            value={form.damagedQty}
                                            onChange={(e) => setForm({ ...form, damagedQty: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Reason</Label>
                                        <Input
                                            value={form.damageReason}
                                            onChange={(e) => setForm({ ...form, damageReason: e.target.value })}
                                            placeholder="Why is it damaged?"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-red-900 font-medium">Damage Image</Label>
                                        <input
                                            id="damageImage"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setForm({ ...form, damageImage: e.target.files?.[0] || null })}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="damageImage"
                                            className="flex items-center justify-center w-full h-10 border border-dashed border-red-300 rounded cursor-pointer hover:bg-red-100"
                                        >
                                            <Upload className="w-4 h-4 mr-2 text-red-500" />
                                            <span className="text-sm">Upload</span>
                                        </label>
                                        {form.damageImage && (
                                            <div className="mt-1 flex items-center justify-between text-xs text-red-700">
                                                <span className="truncate">{form.damageImage.name}</span>
                                                <button type="button" onClick={() => setForm({ ...form, damageImage: null })}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Media Row */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Received Item Image */}
                                <div className="space-y-1.5">
                                    <Label>Received Item Image</Label>
                                    <input
                                        id="receivedItemImage"
                                        type="file"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                receivedItemImage: e.target.files?.[0] ?? null,
                                            })
                                        }
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="receivedItemImage"
                                        className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                    >
                                        <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                        <span className="text-xs text-gray-500 font-medium">Upload Image</span>
                                    </label>
                                    {form.receivedItemImage && (
                                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                            <div className="flex items-center">
                                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                <span className="text-sm text-gray-700">
                                                    {form.receivedItemImage.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile("receivedItemImage")}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Bill Attachment */}
                                <div className="space-y-1.5">
                                    <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                    <input
                                        id="billAttachment"
                                        type="file"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                billAttachment: e.target.files?.[0] ?? null,
                                            })
                                        }
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="billAttachment"
                                        className="flex items-center justify-center w-full p-2 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-all h-[80px]"
                                    >
                                        <Upload className="w-4 h-4 text-gray-400 mr-2" />
                                        <span className="text-xs text-gray-500 font-medium">Upload Bill</span>
                                    </label>
                                    {form.billAttachment && (
                                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                            <div className="flex items-center">
                                                <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                <span className="text-sm text-gray-700">
                                                    {form.billAttachment.name}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFile("billAttachment")}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5">
                                <Label>Remarks</Label>
                                <textarea
                                    value={form.remarks}
                                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                    className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                    rows={3}
                                />
                            </div>
                        </form>
                    )}

                    <DialogFooter className="flex-shrink-0 border-t pt-4 flex sm:justify-end items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={isBulkMode ? handleBulkSubmit : handleSubmit}
                            disabled={
                                isSubmitting ||
                                (isBulkMode
                                    ? !(
                                        commonData.invoiceDate &&
                                        commonData.invoiceNumber &&
                                        commonData.billAttachment &&
                                        bulkItems.every((item) => item.receivedQty)
                                    )
                                    : !formValid)
                            }
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Record Receipt"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}                                                                                   