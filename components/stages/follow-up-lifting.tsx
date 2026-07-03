"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  X,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  Truck,
  ClipboardList,
  History,
  Search,
  Download,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, parseSheetDate, formatDate, getFmsTimestamp } from "@/lib/utils";

interface LiftingEntry {
  liftNumber: string;
  liftingQty: string;
  transporterName: string;
  vehicleNumber: string;
  contactNumber: string;
  billNo?: string;
  billDate?: string;
  areaLifting?: string;
  transportRateType?: string;
  freightAmount: string;
  advanceAmount: string;
  paymentDate: string;
  paymentStatus?: string;
  expectedDeliveryDate?: string;
  hasBilty?: string;
  biltyNumber?: string;
  biltyCopy: File | null;
  dispatchDate: string;
}

interface RecordLifting {
  recordId: string;
  status: string;
  followUpDate?: string;
  remarks?: string;
  quantity?: number | string;
  liftingData: LiftingEntry;
  indentNumber: string;
}

const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const TransporterCombobox = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-10 justify-between bg-white border-green-200 shadow-sm"
        >
          {value ? value : "Select transporter..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search transporter..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground pb-2">No transporter found.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-8"
                  onClick={() => {
                    onChange(query);
                    setOpen(false);
                  }}
                >
                  Create "{query}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const defaultLiftingData = (existLift: any = {}, recordQty: string = "0"): LiftingEntry => ({
  liftNumber: existLift.liftNumber || "",
  liftingQty: existLift.liftingQty || recordQty,
  transporterName: existLift.transporterName || "",
  vehicleNumber: existLift.vehicleNumber || "",
  contactNumber: existLift.contactNumber || "",
  billNo: existLift.billNo || "",
  billDate: existLift.billDate || "",
  areaLifting: existLift.areaLifting || "",
  transportRateType: existLift.transportRateType || "",
  freightAmount: existLift.freightAmount || "",
  advanceAmount: existLift.advanceAmount || "",
  paymentDate: existLift.paymentDate || "",
  paymentStatus: existLift.paymentStatus || "",
  expectedDeliveryDate: existLift.expectedDeliveryDate || "",
  hasBilty: existLift.hasBilty || "No",
  biltyNumber: existLift.biltyNumber || existLift.lrNumber || "",
  biltyCopy: existLift.biltyCopy || null,
  dispatchDate: existLift.dispatchDate || new Date().toISOString().split("T")[0],
});

export default function FollowUpLifting() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkFormData, setBulkFormData] = useState<RecordLifting[]>([]);
  const [liftCounter, setLiftCounter] = useState(1);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [receivingAccountsData, setReceivingAccountsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Unified form mode state
  const [isUnifiedMode, setIsUnifiedMode] = useState(false);
  const [commonVendorPO, setCommonVendorPO] = useState<{ vendor: string; poNumber: string } | null>(null);
  const [vendorPOMismatchError, setVendorPOMismatchError] = useState<string | null>(null);
  const [unifiedFormData, setUnifiedFormData] = useState<{
    status: string;
    followUpDate: string;
    remarks: string;
    liftingData: LiftingEntry;
  } | null>(null);
  const [unifiedLiftingQtys, setUnifiedLiftingQtys] = useState<Record<string, string>>({});
  const [processMode, setProcessMode] = useState<"follow-up" | "lift-material">("follow-up");

  const baseColumns = [
    { key: "indentNumber", label: "Indent No.", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
    { key: "planned5", label: "Planned", icon: null },
    { key: "totalLifted", label: "Total Dispatch Qty", icon: null },
    { key: "pendingLifted", label: "Pending Dispatch Qty", icon: null },
    { key: "estimatedDate", label: "Estimated Date", icon: null },
    { key: "remarksFollowUp", label: "Remark", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const [transporterList, setTransporterList] = useState<string[]>([]);
  const [areaList, setAreaList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      // Parallelize fetches for FMS, RECEIVING-ACCOUNTS, and Dropdown
      const [resFMS, resReceiving, dropRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`),
      ]);

      const [jsonFMS, jsonReceiving, dropJson] = await Promise.all([
        resFMS.json(),
        resReceiving.json(),
        dropRes.json(),
      ]);

      // Process RECEIVING-ACCOUNTS data for history
      if (jsonReceiving.success && Array.isArray(jsonReceiving.data)) {
        const historyRows = jsonReceiving.data.slice(6)
          .filter((row: any) => row && row[1] && String(row[1]).trim() !== "")
          .map((row: any, i: number) => ({
            id: `receiving-${i}`,
            indentNumber: row[1] || "",     // B: Indent Number
            liftNo: row[2] || "",            // C: Unit Tracking No.
            vendorName: row[3] || "",        // D: Vendor Name
            poNumber: row[4] || "",          // E: PO Number
            nextFollowUpDate: row[5] || "", // F: Next Follow-Up Date
            remarks: row[6] || "",           // G: Remarks
            itemName: row[7] || "",          // H: Item Name
            liftingQty: row[8] || "",        // I: Lifting Qty
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
          }));
        setReceivingAccountsData(historyRows);
      }

      if (dropJson.success && Array.isArray(dropJson.data)) {
        const tList = dropJson.data.slice(1)
          .map((row: any) => {
            const val = String(row[10] || "").trim();
            if (val.startsWith("{")) {
              try {
                return JSON.parse(val).transporterName || "";
              } catch (e) {
                return val;
              }
            }
            return val;
          })
          .filter((t: string) => t !== "");
        setTransporterList(tList);

        const aList = dropJson.data.slice(1)
          .map((row: any) => String(row[1] || "").trim())
          .filter((a: string) => a !== "");
        setAreaList(Array.from(new Set(aList)));
      }
      const completedIndentIds = new Set<string>();

      if (jsonFMS.success && Array.isArray(jsonFMS.data)) {
        const rows = jsonFMS.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const hasPlan5 = !!row[60] && String(row[60]).trim() !== "" && String(row[60]).trim() !== "-";
            const indentId = row[1] || `row-${originalIndex}`;

            let status = "not_ready";
            if (hasPlan5) {
              const colBPValue = String(row[67] || "").trim();
              if (colBPValue === "Pending") {
                status = "pending";
              } else if (colBPValue === "Complete") {
                status = "completed";
              }
            }

            return {
              id: indentId,
              rowIndex: originalIndex,
              row: row,
              stage: 5,
              status: status,
              createdAt: parseSheetDate(row[0]),
              history: (status === "completed") ? [{ stage: 5, date: parseSheetDate(row[61] || row[60] || row[0]), data: {} }] : [],
              data: {
                timestamp: row[0],
                indentNumber: row[1],
                createdBy: row[2],
                category: row[3],
                itemName: row[4],
                quantity: row[14],
                warehouseLocation: row[6],
                deliveryDate: row[7] ? formatDate(row[7]) : "",
                leadTime: row[8],
                planned1: row[9] ? formatDate(row[9]) : "",
                actual1: row[10] ? formatDate(row[10]) : "",
                delay1: row[11],
                approvedBy: row[12],
                indentStatus: row[13],
                approvedQty: row[14],
                vendorType: row[15],
                indentRemarks: row[16],
                img: row[17],
                selectedVendor: row[47],
                vendor1Name: row[21],
                vendor1PoNumber: row[54],
                vendor2Name: row[29],
                vendor2PoNumber: row[54],
                vendor3Name: row[37],
                vendor3PoNumber: row[54],
                finalVendorName: row[48],
                estimatedDate: row[76],
                remarksFollowUp: row[77],
                liftingData: {
                  liftNumber: `LIFT-${originalIndex}`,
                  liftingQty: row[64],
                  transporterName: row[65],
                  vehicleNumber: row[66],
                  contactNumber: row[67],
                  lrNumber: row[68],
                  dispatchDate: row[69],
                  freightAmount: row[70],
                  advanceAmount: row[71],
                  paymentDate: row[72],
                  biltyCopy: row[73],
                },
              },
            };
          })
          .filter((item: any) => item.status !== "not_ready");

        setSheetRecords(rows);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getVendorData = (record: any) => {
    if (!record) return { name: "", poNumber: "" };
    const sel = String(record.data.selectedVendor || "").trim();
    const po = record.data.vendor1PoNumber || record.data.vendor2PoNumber || record.data.vendor3PoNumber || "-";
    
    // Resolve vendor name by checking finalVendorName first, then falls back to vendor indices
    let name = String(record.data.finalVendorName || "").trim();
    if (!name || name === "-") {
      if (sel === "vendor1") {
        name = record.data.vendor1Name || "";
      } else if (sel === "vendor2") {
        name = record.data.vendor2Name || "";
      } else if (sel === "vendor3") {
        name = record.data.vendor3Name || "";
      }
    }
    
    return { name: name || "-", poNumber: po };
  };

  const checkVendorPOMatch = (ids: string[]) => {
    if (ids.length <= 1) return { isMatched: true, vendor: "", poNumber: "" };
    let vendor = "";
    let poNumber = "";

    for (let i = 0; i < ids.length; i++) {
      const record = sheetRecords.find((r) => r.id === ids[i]);
      if (!record) continue;
      const vInfo = getVendorData(record);
      if (i === 0) {
        vendor = String(vInfo.name).trim();
        poNumber = String(vInfo.poNumber).trim();
      } else {
        if (String(vInfo.name).trim() !== vendor || String(vInfo.poNumber).trim() !== poNumber) {
          return { isMatched: false, vendor: "", poNumber: "" };
        }
      }
    }
    return { isMatched: true, vendor, poNumber };
  };

  const handleProcessDirect = (recordId: string) => {
    setSelectedRecordIds([recordId]);
    setProcessMode("follow-up");
    setIsUnifiedMode(false);
    setVendorPOMismatchError(null);
    setCommonVendorPO(null);
    setUnifiedFormData(null);

    const record = sheetRecords.find((r) => r.id === recordId)!;
    const existLift = record.data.liftingData || {};

    const initialData = [
      {
        recordId: recordId,
        status: "follow-up",
        followUpDate: "",
        remarks: "",
        liftingData: defaultLiftingData(existLift, String(record.data.quantity || 0)),
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      }
    ];
    setBulkFormData(initialData);
    setOpen(true);
  };

  const handleBulkProcessDirect = () => {
    if (selectedRecordIds.length === 0) return;
    setProcessMode("follow-up");
    setIsUnifiedMode(selectedRecordIds.length > 1);
    setVendorPOMismatchError(null);
    setCommonVendorPO(null);

    setUnifiedFormData({
      status: "follow-up",
      followUpDate: "",
      remarks: "",
      liftingData: defaultLiftingData(),
    });

    const initialData = selectedRecordIds.map((id) => {
      const record = sheetRecords.find((r) => r.id === id)!;
      const existLift = record.data.liftingData || {};

      return {
        recordId: id,
        status: "follow-up",
        followUpDate: "",
        remarks: "",
        liftingData: defaultLiftingData(existLift, String(record.data.quantity || 0)),
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      };
    });
    setBulkFormData(initialData);
    setOpen(true);
  };

  const toggleDialogMode = (newMode: "follow-up" | "lift-material") => {
    if (newMode === processMode) return;
    setProcessMode(newMode);

    if (newMode === "follow-up") {
      setVendorPOMismatchError(null);
      setUnifiedFormData(null);
      setBulkFormData(prev => prev.map(item => ({
        ...item,
        status: "follow-up",
      })));
    } else {
      if (selectedRecordIds.length > 1) {
        const matchResult = checkVendorPOMatch(selectedRecordIds);
        if (!matchResult.isMatched) {
          setIsUnifiedMode(false);
          setVendorPOMismatchError("Vendor Name or PO number not matched for the selected items.");
          setCommonVendorPO(null);
          setUnifiedFormData(null);
          setBulkFormData([]);
          return;
        }
        setIsUnifiedMode(true);
        setCommonVendorPO({ vendor: matchResult.vendor, poNumber: matchResult.poNumber });
      } else {
        setIsUnifiedMode(false);
      }

      setVendorPOMismatchError(null);
      setUnifiedFormData({
        status: "lift-material",
        followUpDate: "",
        remarks: "",
        liftingData: defaultLiftingData(),
      });

      const qtys: Record<string, string> = {};
      selectedRecordIds.forEach(id => {
        const record = sheetRecords.find(r => r.id === id);
        const existLift = record?.data.liftingData || {};
        qtys[id] = existLift.liftingQty || String(record?.data.quantity || 0);
      });
      setUnifiedLiftingQtys(qtys);

      setBulkFormData(prev => prev.map(item => {
        const record = sheetRecords.find(r => r.id === item.recordId)!;
        const existLift = record.data.liftingData || {};
        return {
          ...item,
          status: "lift-material",
          liftingData: defaultLiftingData(existLift, String(record.data.quantity || 0)),
        };
      }));
    }
  };

  const handleUnifiedQtyChange = (id: string, value: string) => {
    setUnifiedLiftingQtys(prev => ({ ...prev, [id]: value }));
  };

  const updateLiftingEntry = (
    recordIndex: number,
    field: keyof LiftingEntry | 'paymentStatus',
    value: any
  ) => {
    setBulkFormData((prev) => {
      const updated = [...prev];
      updated[recordIndex].liftingData = {
        ...updated[recordIndex].liftingData,
        [field]: value,
      };
      return updated;
    });
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const timestamp = getFmsTimestamp();

      const API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!API_URL) {
        toast.error("API URL not configured");
        return;
      }

      const rowsToInsert: any[] = [];
      const updatesToFMS: { rowIndex: number, rowData: any[] }[] = [];

      let commonFileUrl = "";
      let fileToUpload: File | null = null;

      if (isUnifiedMode && unifiedFormData?.status === "lift-material" && unifiedFormData.liftingData.biltyCopy instanceof File) {
        fileToUpload = unifiedFormData.liftingData.biltyCopy;
      } else if (!isUnifiedMode && bulkFormData.length === 1 && bulkFormData[0].status === "lift-material" && bulkFormData[0].liftingData.biltyCopy instanceof File) {
        fileToUpload = bulkFormData[0].liftingData.biltyCopy;
      }

      if (fileToUpload) {
        try {
          const fileBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(fileToUpload!);
          });

          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("base64Data", fileBase64);
          uploadParams.append("fileName", fileToUpload!.name);
          uploadParams.append("mimeType", fileToUpload!.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(API_URL, {
            method: "POST",
            body: uploadParams,
          });
          const uploadResult = await uploadRes.json();
          if (uploadResult.success) {
            commonFileUrl = uploadResult.fileUrl;
          } else {
            toast.warning(`File upload failed, proceeding without it.`);
          }
        } catch (e) {
          console.error("Upload error", e);
        }
      }

      for (let i = 0; i < bulkFormData.length; i++) {
        let record = bulkFormData[i];

        if (isUnifiedMode && unifiedFormData) {
          record = {
            ...record,
            status: unifiedFormData.status,
            followUpDate: unifiedFormData.followUpDate,
            remarks: unifiedFormData.remarks,
            liftingData: {
              ...record.liftingData,
              ...unifiedFormData.liftingData,
              liftingQty: unifiedLiftingQtys[record.recordId] || "",
              liftNumber: record.liftingData.liftNumber || "",
              biltyCopy: unifiedFormData.liftingData.biltyCopy
            }
          };
        }

        const sheetRecord = sheetRecords.find((r) => r.id === record.recordId)!;
        const v = getVendorData(sheetRecord);
        const lift = record.liftingData;
        let biltyLink = typeof lift.biltyCopy === 'string' ? lift.biltyCopy : "";
        if (record.status === "lift-material" && lift.biltyCopy instanceof File) {
          biltyLink = commonFileUrl;
        }

        const toYMD = (dateStr: string) => {
          if (!dateStr) return "";
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return "";
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        const currentTimestamp = timestamp;
        const followUpDateFormatted = toYMD(record.followUpDate || "");
        const paymentDateFormatted = toYMD(lift.paymentDate || "");
        const expectedDeliveryDateFormatted = toYMD(lift.expectedDeliveryDate || "");

        if (record.status === "lift-material") {
          const receivingAccountRow = new Array(76).fill("");

          receivingAccountRow[0] = currentTimestamp;                            // 0/A: Timestamp
          receivingAccountRow[1] = sheetRecord.data.indentNumber || "";         // 1/B: Indent Number
          receivingAccountRow[2] = lift.liftNumber || "";                       // 2/C: Unit Tracking No.
          receivingAccountRow[3] = v.name || "";                                // 3/D: Vendor Name
          receivingAccountRow[4] = v.poNumber || "";                            // 4/E: PO Number
          receivingAccountRow[5] = followUpDateFormatted;                       // 5/F: Next Flw-Up Date (YYYY-MM-DD)
          receivingAccountRow[6] = record.remarks || "";                        // 6/G: Remarks
          receivingAccountRow[7] = sheetRecord.data.itemName || "";             // 7/H: Item Name
          receivingAccountRow[8] = lift.liftingQty || "";                       // 8/I: Lifting Qty
          receivingAccountRow[9] = lift.transporterName || "";                  // 9/J: Transporter Name
          receivingAccountRow[10] = lift.vehicleNumber || "";                   // 10/K: Vehicle No.
          receivingAccountRow[11] = lift.contactNumber || "";                   // 11/L: Contact No.

          // Bilty Details
          receivingAccountRow[12] = lift.hasBilty === "Yes" ? (lift.biltyNumber || "") : ""; // 12/M: Bilty Number (LR No)
          receivingAccountRow[18] = lift.hasBilty === "Yes" ? biltyLink : "";  // 18/S: Bilty Image (Bilty Copy)

          receivingAccountRow[13] = currentTimestamp.split(" ")[0];             // 13/N: Dispatch Date (Default to current date)
          receivingAccountRow[14] = lift.freightAmount || "";                   // 14/O: Total Transporting Amount
          receivingAccountRow[15] = lift.advanceAmount || "";                   // 15/P: Advance Amount
          receivingAccountRow[16] = paymentDateFormatted;                       // 16/Q: Payment Date (YYYY-MM-DD)
          receivingAccountRow[17] = lift.paymentStatus || "";                   // 17/R: Payment Status
          receivingAccountRow[21] = lift.areaLifting || "";                     // 21/V: Area Lifting
          receivingAccountRow[22] = lift.transportRateType || "";               // 22/W: Type of Transporting Rate
          receivingAccountRow[23] = lift.billDate ? toYMD(lift.billDate) : "";  // 23/X: Bill Date
          receivingAccountRow[24] = lift.billNo || "";                          // 24/Y: Bill No
          receivingAccountRow[30] = lift.hasBilty || "No";                      // 30/AE: Has Bilty (Yes/No)

          receivingAccountRow[34] = expectedDeliveryDateFormatted;              // 34/AI: Expected Delivery Date

          rowsToInsert.push(receivingAccountRow);
        }

        if (!sheetRecord.row || !Array.isArray(sheetRecord.row)) {
          console.error("Missing row data for", record.recordId);
          continue;
        }

        const fmsRow = new Array(78).fill("");

        if (record.status === "lift-material") {
          fmsRow[61] = timestamp; // BJ: Actual Date
        } else if (record.status === "follow-up") {
          fmsRow[76] = followUpDateFormatted; // BY
          fmsRow[77] = record.remarks || "";  // BZ
        } else {
          fmsRow[61] = timestamp;
        }

        updatesToFMS.push({
          rowIndex: sheetRecord.rowIndex,
          rowData: fmsRow
        });
      }

      if (rowsToInsert.length > 0) {
        const uParams = new URLSearchParams();
        uParams.append("action", "insertLift");
        uParams.append("rowsData", JSON.stringify(rowsToInsert));
        const insertRes = await fetch(API_URL, { method: "POST", body: uParams });
        const insertJson = await insertRes.json();
        if (!insertJson.success) {
          console.error("insertLift failed:", insertJson.error);
          toast.error("Failed to insert lift rows: " + (insertJson.error || "Unknown error"));
        }
      }

      if (updatesToFMS.length > 0) {
        const updatePromises = updatesToFMS.map(update => {
          const fmsParams = new URLSearchParams();
          fmsParams.append("action", "update");
          fmsParams.append("sheetName", "INDENT-LIFT");
          fmsParams.append("rowIndex", update.rowIndex.toString());
          fmsParams.append("rowData", JSON.stringify(update.rowData));
          return fetch(API_URL, { method: "POST", body: fmsParams });
        });
        await Promise.all(updatePromises);
      }

      setOpen(false);
      resetBulk();
      await fetchData();
    } catch (error: any) {
      console.error("Bulk submit error:", error);
      toast.error(error.message || "Failed to submit updates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBulk = () => {
    setOpen(false);
    setSelectedRecordIds([]);
    setBulkFormData([]);
    setIsUnifiedMode(false);
    setCommonVendorPO(null);
    setVendorPOMismatchError(null);
    setUnifiedFormData(null);
    setUnifiedLiftingQtys({});
  };

  const toggleSelect = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  const isBulkValid = (() => {
    if (vendorPOMismatchError) return false;

    if (processMode === "follow-up") {
      if (isUnifiedMode) {
        return !!(unifiedFormData && unifiedFormData.followUpDate);
      }
      return bulkFormData.length > 0 && !!bulkFormData[0].followUpDate;
    }

    if (isUnifiedMode && unifiedFormData) {
      if (!unifiedFormData.status) return false;
      if (unifiedFormData.status === "lift-material") {
        const e = unifiedFormData.liftingData;
        const allQtysFilled = selectedRecordIds.every(id => {
          const val = unifiedLiftingQtys[id];
          return val !== undefined && val !== null && String(val).trim() !== "";
        });

        return !!(
          e.transporterName &&
          e.vehicleNumber &&
          e.contactNumber &&
          e.billNo &&
          e.billDate &&
          e.areaLifting &&
          e.freightAmount &&
          (e.hasBilty === "No" || (e.hasBilty === "Yes" && e.biltyNumber && e.biltyCopy)) &&
          allQtysFilled
        );
      }
      return false;
    }

    return bulkFormData.length > 0 &&
      bulkFormData.every((item) => {
        if (!item.status) return false;
        if (item.status === "lift-material") {
          const e = item.liftingData;
          return !!(
            e.transporterName &&
            e.vehicleNumber &&
            e.contactNumber &&
            e.billNo &&
            e.billDate &&
            e.areaLifting &&
            e.freightAmount &&
            e.liftingQty &&
            (e.hasBilty === "No" || (e.hasBilty === "Yes" && e.biltyNumber && e.biltyCopy))
          );
        }
        return false;
      });
  })();

  const handleExportPendingCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const headers = [
          ...baseColumns.filter((c) => selectedColumns.includes(c.key)).map((c) => c.label),
          "Vendor",
          "PO Number",
          "Basic Value"
        ];

        const rowData = pending.map((record) => {
          const v = getVendorData(record);
          const baseData = baseColumns
            .filter((c) => selectedColumns.includes(c.key))
            .map((col) => {
              const val = record.data[col.key];
              if (col.key === "planned5" || col.key === "estimatedDate") {
                return formatDateDash(val);
              }
              return val || "-";
            });

          return [
            ...baseData,
            v.name || "-",
            v.poNumber || "-",
            record.row[56] || "-"
          ];
        });

        const csvContent =
          "data:text/csv;charset=utf-8," +
          [headers.join(","), ...rowData.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Follow_UP_Lifting_Pending_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error("Export CSV error:", error);
        toast.error("Failed to export CSV file");
      } finally {
        setIsExporting(false);
      }
    }, 1000);
  };

  const pending = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sheetRecords
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const v = getVendorData(r);
        return (
          r.data.indentNumber?.toLowerCase().includes(term) ||
          r.data.itemName?.toLowerCase().includes(term) ||
          r.data.quantity?.toString().includes(term) ||
          r.data.planned5?.toLowerCase().includes(term) ||
          v.name?.toLowerCase().includes(term) ||
          v.poNumber?.toLowerCase().includes(term)
        );
      });
  }, [sheetRecords, searchTerm]);

  const history = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return receivingAccountsData.filter((r) => {
      return (
        r.indentNumber?.toLowerCase().includes(term) ||
        r.liftNo?.toLowerCase().includes(term) ||
        r.vendorName?.toLowerCase().includes(term) ||
        r.poNumber?.toLowerCase().includes(term) ||
        r.itemName?.toLowerCase().includes(term) ||
        r.vehicleNo?.toLowerCase().includes(term)
      );
    });
  }, [receivingAccountsData, searchTerm]);

  const handleColumnToggle = useCallback((key: string, checked: boolean) => {
    setSelectedColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  }, []);

  const renderItemDetailsCard = () => {
    if (isUnifiedMode) {
      return (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-5 mb-6 shadow-sm shrink-0">
          <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2">
            <span className="p-1.5 bg-slate-900 text-white rounded text-[10px] font-bold">Selected Items</span>
            <span>Batch Details ({bulkFormData.length} Indents)</span>
          </h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {bulkFormData.map((item) => {
              const record = sheetRecords.find((r) => r.id === item.recordId);
              return (
                <Badge key={item.recordId} variant="secondary" className="bg-white border-slate-200 px-3 py-1 font-semibold text-slate-700 text-xs">
                  {record?.data.indentNumber} - {record?.data.itemName} (Qty: {record?.data.quantity})
                </Badge>
              );
            })}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-200/60">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor</span>
              <span className="font-semibold text-slate-800">
                {commonVendorPO?.vendor || getVendorData(sheetRecords.find(r => r.id === bulkFormData[0]?.recordId)).name}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">PO Number</span>
              <span className="font-semibold text-slate-800">
                {commonVendorPO?.poNumber || getVendorData(sheetRecords.find(r => r.id === bulkFormData[0]?.recordId)).poNumber}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (bulkFormData.length === 1) {
      const record = sheetRecords.find((r) => r.id === bulkFormData[0].recordId);
      const v = getVendorData(record);
      return (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl p-5 mb-6 shadow-sm shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Indent Number</span>
            <span className="font-bold text-slate-900 text-sm">{record?.data.indentNumber}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Item Details</span>
            <span className="font-semibold text-slate-800 text-sm">{record?.data.itemName} (Qty: {record?.data.quantity})</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor Name</span>
            <span className="font-semibold text-slate-800 text-sm">{v.name}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">PO Number</span>
            <span className="font-semibold text-slate-800 font-mono text-sm">{v.poNumber}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-4 md:p-6 md:h-[calc(100vh-2rem)] flex flex-col md:overflow-hidden min-h-screen md:min-h-0 bg-[#f8fafc]">
      {/* Header */}
      <div className="mb-4 md:mb-6 p-4 md:p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 7: Follow UP / Lifting</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by Indent, Item, Vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium hidden md:inline-block">Show Columns:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-white border-slate-200">
                    Columns <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 bg-white border p-2" align="end">
                  <div className="space-y-1.5">
                    {baseColumns.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={selectedColumns.includes(col.key)}
                          onCheckedChange={(checked) => handleColumnToggle(col.key, !!checked)}
                        />
                        <Label htmlFor={`col-${col.key}`} className="text-xs cursor-pointer select-none font-medium text-slate-700">
                          {col.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
          <TabsList className="bg-slate-100/80 p-1 rounded-lg">
            <TabsTrigger value="pending" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Pending</span>
              <Badge variant="secondary" className="bg-slate-900 text-white px-2">
                {pending.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            {selectedRecordIds.length > 0 && activeTab === "pending" && (
              <Button
                disabled={selectedRecordIds.length === 0}
                size="sm"
                onClick={handleBulkProcessDirect}
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                Process Selected ({selectedRecordIds.length})
              </Button>
            )}

            {activeTab === "pending" && (
              <Button
                onClick={handleExportPendingCSV}
                disabled={isExporting}
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-2"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Export CSV</span>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="pending" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-slate-950 mb-3" />
              <p className="font-semibold text-slate-700 text-sm">Syncing spreadsheet records...</p>
            </div>
          )}

          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No pending follow-up indents found.</p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0 z-20">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={selectedRecordIds.length === pending.length && pending.length > 0}
                          onCheckedChange={selectAll}
                        />
                      </TableHead>
                      <TableHead className="text-center w-24">Actions</TableHead>
                      {baseColumns
                        .filter((c) => selectedColumns.includes(c.key))
                        .map((c) => (
                          <TableHead key={c.key} className={cn((c.key === "totalLifted" || c.key === "pendingLifted") && "text-center")}>
                            {c.label}
                          </TableHead>
                        ))}
                      <TableHead>Vendor</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead className="text-right">Basic Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record) => {
                      const v = getVendorData(record);
                      return (
                        <TableRow key={record.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedRecordIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleProcessDirect(record.id)}
                            >
                              Process
                            </Button>
                          </TableCell>
                          {baseColumns
                            .filter((c) => selectedColumns.includes(c.key))
                            .map((col) => (
                              <TableCell key={col.key} className={cn((col.key === "totalLifted" || col.key === "pendingLifted") && "text-center")}>
                                {col.key === "planned5" || col.key === "estimatedDate"
                                  ? formatDateDash(record.data[col.key])
                                  : record.data[col.key] || "-"}
                              </TableCell>
                            ))}
                          <TableCell className="font-semibold text-slate-800">{v.name}</TableCell>
                          <TableCell className="font-mono text-slate-600">{v.poNumber}</TableCell>
                          <TableCell className="text-right font-medium text-slate-800">
                            {record.row[56] ? `₹ ${parseFloat(String(record.row[56]).replace(/,/g, '')).toLocaleString()}` : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="overflow-auto flex-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <History className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No material lifting history logs found.</p>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0 z-20">
                    <TableRow>
                      <TableHead>Lift Number</TableHead>
                      <TableHead>Indent No</TableHead>
                      <TableHead>Item Details</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead className="text-center">Lifting Qty</TableHead>
                      <TableHead>Transporter</TableHead>
                      <TableHead>Vehicle No</TableHead>
                      <TableHead>LR / Bilty</TableHead>
                      <TableHead>Dispatch Date</TableHead>
                      <TableHead className="text-right">Freight Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800">{h.liftNo}</TableCell>
                        <TableCell className="font-mono">{h.indentNumber}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{h.itemName}</TableCell>
                        <TableCell>{h.vendorName}</TableCell>
                        <TableCell className="font-mono">{h.poNumber}</TableCell>
                        <TableCell className="text-center font-semibold">{h.liftingQty}</TableCell>
                        <TableCell>{h.transporterName}</TableCell>
                        <TableCell className="font-mono uppercase">{h.vehicleNo}</TableCell>
                        <TableCell>
                          {h.lrNo ? (
                            <span className="flex items-center gap-1">
                              {h.lrNo}
                              {h.biltyCopy && h.biltyCopy.startsWith("http") && (
                                <a href={h.biltyCopy} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                  <FileText className="w-3.5 h-3.5 ml-1" />
                                </a>
                              )}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{formatDateDash(h.dispatchDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {h.freightAmount ? `₹ ${parseFloat(String(h.freightAmount).replace(/,/g, '')).toLocaleString()}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* PROCESS MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0 bg-white border rounded-2xl shadow-xl overflow-hidden">
          <DialogHeader className="flex-shrink-0 border-b p-6 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  {processMode === "follow-up" ? "Follow-Up Details" : "Material Lifting & Dispatch"}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {vendorPOMismatchError
                    ? "Cannot proceed with submission."
                    : isUnifiedMode
                      ? `Updating ${bulkFormData.length} indents with common details.`
                      : "Update multiple indents at once."}
                </p>
              </div>
            </div>

            {/* Mode Switch Header inside Modal */}
            {!vendorPOMismatchError && (
              <div className="flex bg-slate-200/60 p-1 rounded-lg w-fit mx-auto mt-4 shrink-0 border border-slate-300/30">
                <button
                  type="button"
                  onClick={() => toggleDialogMode("follow-up")}
                  className={cn(
                    "px-6 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                    processMode === "follow-up"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Follow-UP
                </button>
                <button
                  type="button"
                  onClick={() => toggleDialogMode("lift-material")}
                  className={cn(
                    "px-6 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
                    processMode === "lift-material"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Material Lifting
                </button>
              </div>
            )}
          </DialogHeader>

          {/* Modal Form Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Mismatch Error Message */}
            {vendorPOMismatchError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                  <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-red-700 mb-2">Cannot Proceed</h4>
                  <p className="text-red-600 text-sm">{vendorPOMismatchError}</p>
                  <p className="text-xs text-gray-500 mt-4">
                    Please select items with the same Vendor and PO Number to use bulk material lifting.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Same Indent Information Card at the top of BOTH forms */}
                {renderItemDetailsCard()}

                {processMode === "follow-up" ? (
                  /* Follow-Up Form */
                  <form onSubmit={handleBulkSubmit} className="space-y-6">
                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-4">
                      <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Follow-Up Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">
                            Estimated Requirement Date *
                          </Label>
                          <Input
                            type="date"
                            required
                            value={
                              isUnifiedMode
                                ? unifiedFormData?.followUpDate || ""
                                : bulkFormData[0]?.followUpDate || ""
                            }
                            onChange={(e) => {
                              if (isUnifiedMode) {
                                setUnifiedFormData((prev) =>
                                  prev ? { ...prev, followUpDate: e.target.value } : null
                                );
                              } else {
                                setBulkFormData((prev) => {
                                  const updated = [...prev];
                                  if (updated[0]) updated[0].followUpDate = e.target.value;
                                  return updated;
                                });
                              }
                            }}
                            className="bg-white border-slate-200 h-10 shadow-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">
                            Remarks
                          </Label>
                          <Input
                            placeholder="Enter remarks..."
                            value={
                              isUnifiedMode
                                ? unifiedFormData?.remarks || ""
                                : bulkFormData[0]?.remarks || ""
                            }
                            onChange={(e) => {
                              if (isUnifiedMode) {
                                setUnifiedFormData((prev) =>
                                  prev ? { ...prev, remarks: e.target.value } : null
                                );
                              } else {
                                setBulkFormData((prev) => {
                                  const updated = [...prev];
                                  if (updated[0]) updated[0].remarks = e.target.value;
                                  return updated;
                                });
                              }
                            }}
                            className="bg-white border-slate-200 h-10 shadow-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="pt-6 border-t mt-6 bg-white gap-2">
                      <Button type="button" variant="outline" onClick={resetBulk} disabled={isSubmitting} className="h-10 px-5 rounded-lg border-slate-200">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !isBulkValid} className="h-10 bg-slate-950 text-white hover:bg-slate-800 font-semibold px-6 shadow-sm rounded-lg">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Follow-Up"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : isUnifiedMode && unifiedFormData ? (
                  /* Unified Material Lifting Form (Multiple Items with Matching Vendor/PO) */
                  <form onSubmit={handleBulkSubmit} className="space-y-6">
                    <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-6">
                      <h4 className="font-semibold text-xs text-green-800 uppercase tracking-wider">Lifting Dispatch details</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Transporter *</Label>
                          <TransporterCombobox
                            value={unifiedFormData.liftingData.transporterName}
                            onChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, transporterName: val }
                              } : null)
                            }
                            options={transporterList}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Vehicle No *</Label>
                          <Input
                            className="bg-white border-green-200 uppercase h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.vehicleNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, vehicleNumber: e.target.value.toUpperCase() }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Contact No *</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.contactNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, contactNumber: e.target.value }
                              } : null)
                            }
                            required
                            placeholder="Driver contact info"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">AREA LIFTING *</Label>
                          <Select
                            value={unifiedFormData.liftingData.areaLifting || ""}
                            onValueChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, areaLifting: val }
                              } : null)
                            }
                          >
                            <SelectTrigger className="bg-white border-green-200 h-10 shadow-sm w-full">
                              <SelectValue placeholder="Select area..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white border">
                              {areaList.map(area => (
                                <SelectItem key={area} value={area}>{area}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL NO. *</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.billNo || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, billNo: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL DATE *</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.billDate || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, billDate: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">TYPE OF TRANSPORTING RATE *</Label>
                          <Input
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.transportRateType || ""}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, transportRateType: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">TOTAL TRANSPORTING AMOUNT *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="bg-white border-green-200 h-10 shadow-sm w-full"
                            value={unifiedFormData.liftingData.freightAmount}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, freightAmount: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY *</Label>
                          <Select
                            value={unifiedFormData.liftingData.hasBilty || "No"}
                            onValueChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, hasBilty: val }
                              } : null)
                            }
                          >
                            <SelectTrigger className="bg-white border-green-200 h-10 shadow-sm w-full">
                              <SelectValue placeholder="Bilty Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border">
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {unifiedFormData.liftingData.hasBilty === "Yes" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY NUMBER *</Label>
                            <Input
                              className="bg-white border-green-200 h-10 shadow-sm w-full"
                              value={unifiedFormData.liftingData.biltyNumber || ""}
                              onChange={(e) =>
                                setUnifiedFormData((prev) => prev ? {
                                  ...prev,
                                  liftingData: { ...prev.liftingData, biltyNumber: e.target.value }
                                } : null)
                              }
                              required
                            />
                          </div>
                        )}

                        {unifiedFormData.liftingData.hasBilty === "Yes" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY IMAGE *</Label>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.png"
                              onChange={(e) =>
                                setUnifiedFormData((prev) => prev ? {
                                  ...prev,
                                  liftingData: { ...prev.liftingData, biltyCopy: e.target.files?.[0] || null }
                                } : null)
                              }
                              className="hidden"
                              id="unified-file"
                            />
                            <label
                              htmlFor="unified-file"
                              className="flex h-10 items-center justify-between w-full border border-green-200 rounded-lg cursor-pointer bg-white px-3 hover:bg-slate-50 transition-colors shadow-sm text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-255"
                            >
                              <span className="truncate">
                                {unifiedFormData.liftingData.biltyCopy
                                  ? unifiedFormData.liftingData.biltyCopy.name
                                  : "Choose Bilty Image..."}
                              </span>
                              <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t border-slate-200">
                        <h5 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Per-Indent Quantities</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {bulkFormData.map((item) => {
                            const record = sheetRecords.find(r => r.id === item.recordId);
                            return (
                              <div key={item.recordId} className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-800">{record?.data.indentNumber}</span>
                                  <span className="text-slate-400 truncate max-w-[120px] font-medium" title={record?.data.itemName}>
                                    {record?.data.itemName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-slate-500 whitespace-nowrap">Lifting Qty *</Label>
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    className="h-8 text-xs bg-white border-slate-200 shadow-sm"
                                    value={unifiedLiftingQtys[item.recordId] || ""}
                                    onChange={(e) => handleUnifiedQtyChange(item.recordId, e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <Label className="text-xs font-semibold text-slate-650">Remarks (Optional)</Label>
                        <Textarea
                          className="bg-white border-slate-200 mt-1 shadow-sm"
                          placeholder="General remarks..."
                          value={unifiedFormData.remarks}
                          onChange={(e) =>
                            setUnifiedFormData((prev) => prev ? {
                              ...prev,
                              remarks: e.target.value
                            } : null)
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter className="pt-6 border-t mt-6 bg-white gap-2">
                      <Button type="button" variant="outline" onClick={resetBulk} disabled={isSubmitting} className="h-10 px-5 rounded-lg border-slate-200">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !isBulkValid} className="h-10 bg-slate-950 text-white hover:bg-slate-800 font-semibold px-6 shadow-sm rounded-lg">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Dispatch Material"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  /* Original Individual Forms for Single Item (Mode = Material Lifting) */
                  <form onSubmit={handleBulkSubmit} className="space-y-6">
                    {bulkFormData.map((item, recordIdx) => {
                      return (
                        <div key={item.recordId} className="border border-slate-200 rounded-2xl p-6 bg-slate-50/30 shadow-sm space-y-6">
                          <h4 className="font-semibold text-xs text-green-800 uppercase tracking-wider">Lifting Dispatch details</h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Lifting Qty *</Label>
                              <Input
                                type="number"
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.liftingQty}
                                onChange={(e) => updateLiftingEntry(recordIdx, "liftingQty", e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Transporter *</Label>
                              <TransporterCombobox
                                value={item.liftingData.transporterName}
                                onChange={(val) => updateLiftingEntry(recordIdx, "transporterName", val)}
                                options={transporterList}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Vehicle No *</Label>
                              <Input
                                className="bg-white border-green-200 h-10 shadow-sm uppercase w-full"
                                value={item.liftingData.vehicleNumber}
                                onChange={(e) => updateLiftingEntry(recordIdx, "vehicleNumber", e.target.value.toUpperCase())}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">Contact No *</Label>
                              <Input
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.contactNumber}
                                onChange={(e) => updateLiftingEntry(recordIdx, "contactNumber", e.target.value)}
                                required
                                placeholder="Driver contact info"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">AREA LIFTING *</Label>
                              <Select
                                value={item.liftingData.areaLifting || ""}
                                onValueChange={(val) => updateLiftingEntry(recordIdx, "areaLifting", val)}
                              >
                                <SelectTrigger className="bg-white border-green-200 h-10 shadow-sm w-full">
                                  <SelectValue placeholder="Select area..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white border">
                                  {areaList.map(area => (
                                    <SelectItem key={area} value={area}>{area}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">TYPE OF TRANSPORTING RATE *</Label>
                              <Input
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.transportRateType || ""}
                                onChange={(e) => updateLiftingEntry(recordIdx, "transportRateType", e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL NO. *</Label>
                              <Input
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.billNo || ""}
                                onChange={(e) => updateLiftingEntry(recordIdx, "billNo", e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILL DATE *</Label>
                              <Input
                                type="date"
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.billDate || ""}
                                onChange={(e) => updateLiftingEntry(recordIdx, "billDate", e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">TOTAL TRANSPORTING AMOUNT *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                className="bg-white border-green-200 h-10 shadow-sm w-full"
                                value={item.liftingData.freightAmount}
                                onChange={(e) => updateLiftingEntry(recordIdx, "freightAmount", e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY *</Label>
                              <Select
                                value={item.liftingData.hasBilty || "No"}
                                onValueChange={(val) => updateLiftingEntry(recordIdx, "hasBilty", val)}
                              >
                                <SelectTrigger className="bg-white border-green-200 h-10 shadow-sm w-full">
                                  <SelectValue placeholder="Bilty Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border">
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {item.liftingData.hasBilty === "Yes" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY NUMBER *</Label>
                                <Input
                                  className="bg-white border-green-200 h-10 shadow-sm w-full"
                                  value={item.liftingData.biltyNumber || ""}
                                  onChange={(e) => updateLiftingEntry(recordIdx, "biltyNumber", e.target.value)}
                                  required
                                />
                              </div>
                            )}

                            {item.liftingData.hasBilty === "Yes" && (
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-650">BILTY IMAGE *</Label>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.png"
                                  onChange={(e) => updateLiftingEntry(recordIdx, "biltyCopy", e.target.files?.[0] || null)}
                                  className="hidden"
                                  id={`file-${recordIdx}`}
                                />
                                <label
                                  htmlFor={`file-${recordIdx}`}
                                  className="flex h-10 items-center justify-between w-full border border-green-200 rounded-lg cursor-pointer bg-white px-3 hover:bg-slate-50 transition-colors shadow-sm text-xs font-medium text-slate-700 animate-in fade-in zoom-in-95 duration-255"
                                >
                                  <span className="truncate">
                                    {item.liftingData.biltyCopy
                                      ? item.liftingData.biltyCopy.name
                                      : "Choose Bilty Image..."}
                                  </span>
                                  <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <DialogFooter className="pt-6 border-t mt-6 bg-white gap-2">
                      <Button type="button" variant="outline" onClick={resetBulk} disabled={isSubmitting} className="h-10 px-5 rounded-lg border-slate-200">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting || !isBulkValid} className="h-10 bg-slate-950 text-white hover:bg-slate-800 font-semibold px-6 shadow-sm rounded-lg">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Dispatch Material"}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
