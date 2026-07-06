"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X, Loader2, PlusCircle, History as HistoryIcon, LayoutGrid, ClipboardList, FileText, Upload, Search, Check, ChevronsUpDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Stage1() {
  const {
    // records,
    // addRecord,
    // moveToNextStage,
    indentCounter,
    setIndentCounter,
  } = useWorkflow();

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");


  const fetchData = async () => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Skip header and first 6 data rows (indices 0-6) -> Data starts at Row 8
        let autoIdCounter = 1;
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // Skip empty rows
          .map(({ row, originalIndex }: any) => {
            const rawId = row[1] ? String(row[1]).trim() : "";
            let indentNum: string;

            if (rawId) {
              indentNum = rawId;
            } else {
              indentNum = `IN-${String(autoIdCounter).padStart(3, "0")}A`;
              autoIdCounter++;
            }

            const isApproved = !!row[13] &&
              String(row[13]).trim() !== "" &&
              String(row[13]).trim() !== "-" &&
              String(row[13]).trim().toLowerCase() !== "pending";

            return {
              id: `${indentNum}-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 1,
              status: isApproved ? "completed" : "pending",
              createdAt: parseSheetDate(row[0]),
              history: [{ stage: 1, date: parseSheetDate(row[0]), data: {} }],
              data: {
                indentNumber: indentNum,
                createdBy: row[2],
                category: row[3],
                warehouseLocation: row[6],
                leadTime: row[8],
                itemName: row[4],
                quantity: row[5],
                itemCode: row[7],
                uom: row[69] || "",
                status: row[13] || "pending",
                remarks: row[16],
                attachment: row[17] || "",
                itemPriority: row[18] || ""
              }
            };
          });


        // Calculate max ID from loaded rows to sync counter
        let maxId = 0;
        rows.forEach((r: any) => {
          if (r.id) {
            const match = r.id.match(/IN-(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxId) maxId = num;
            }
          }
        });
        setIndentCounter(maxId > 0 ? maxId + 1 : 1);

        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  // Helper for search filtering
  const matchesSearch = (r: any) => {
    const searchLower = searchTerm.toLowerCase();
    const indNum = r.data.indentNumber || "";
    const iName = r.data.itemName || "";
    const qty = r.data.quantity ? r.data.quantity.toString() : "";
    const vType = r.data.vendorType || ""; // vendorType might be undefined

    return (
      indNum.toLowerCase().includes(searchLower) ||
      iName.toLowerCase().includes(searchLower) ||
      qty.toLowerCase().includes(searchLower) ||
      // r.data.poNumber?.toLowerCase().includes(searchLower) || // Not available in Stage 1
      // r.data.invoiceNumber?.toLowerCase().includes(searchLower) || // Not available in Stage 1
      vType.toLowerCase().includes(searchLower)
    );
  };

  const pending = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "pending")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  const history = useMemo(() =>
    sheetRecords
      .filter((r) => r.status === "completed")
      .filter(matchesSearch)
    , [sheetRecords, searchTerm]);

  const Combobox = ({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    disabled,
  }: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
  }) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            {value
              ? options.find((option) => option === value) || value
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div
                  className="py-2 px-4 text-sm text-blue-600 cursor-pointer hover:bg-slate-100 flex items-center gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(searchValue); // Set custom value
                    setOpen(false);
                  }}
                >
                  <PlusCircle className="w-3 h-3" />
                  Create "{searchValue}"
                </div>
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option);
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

  // === Existing Indent Creation Modal ===
  const [open, setOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === Edit Modal State ===
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    itemPriority: "",
    attachment: null as File | null,
    existingAttachmentUrl: "",
  });

  const [formData, setFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    attachment: null as File | null,
    items: [] as Array<{
      category: string;
      itemName: string;
      quantity: string;
      uom: string;
      itemCode: string;
      itemPriority: string;
    }>,
  });

  const [itemInput, setItemInput] = useState({
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    itemPriority: "",
  });





  // Fetch "Created By" options from Dropdown sheet column A
  const [createdByOptions, setCreatedByOptions] = useState<string[]>([]);
  // Fetch "Warehouse Location" options from Dropdown sheet column B
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  // Fetch "UOM" options from Dropdown sheet column N (Index 13)
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  // Fetch dropdown data for Category (D), Item Name (E), Item Code (C)
  const [dropdownData, setDropdownData] = useState<Array<{ itemCode: string; category: string; itemName: string }>>([]);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!SHEET_API_URL) return;
      try {
        const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Get values from column A starting from row 2 (index 1)
          const createdByOpts = json.data
            .slice(1) // Skip header row
            .map((row: any) => row[0]) // Column A is index 0
            .filter((val: any) => val && String(val).trim() !== "");
          setCreatedByOptions(createdByOpts);

          // Get values from column B starting from row 2 (index 1)
          const warehouseOpts = json.data
            .slice(1) // Skip header row
            .map((row: any) => row[1]) // Column B is index 1
            .filter((val: any) => val && String(val).trim() !== "");
          setWarehouseOptions(warehouseOpts);

          // Get UOM options from column N (Index 13)
          const uoms = json.data
            .slice(1)
            .map((row: any) => row[13]) // Column N is index 13
            .filter((val: any) => val && String(val).trim() !== "");
          setUomOptions(uoms);

          // Get Category (D), Item Name (E), Item Code (C) from columns
          const itemData = json.data
            .slice(1) // Skip header row
            .filter((row: any) => row[3] && String(row[3]).trim() !== "") // Filter rows with category
            .map((row: any) => ({
              itemCode: row[2] ? String(row[2]).trim() : "", // Column C (index 2)
              category: row[3] ? String(row[3]).trim() : "", // Column D (index 3)
              itemName: row[4] ? String(row[4]).trim() : "", // Column E (index 4)
            }));
          setDropdownData(itemData);
        }
      } catch (e) {
        console.error("Error fetching dropdown options:", e);
      }
    };
    fetchDropdownOptions();
  }, []);

  // Get unique categories from dropdown data
  const categoryOptions = useMemo(() => [...new Set(dropdownData.map(item => item.category))].filter(Boolean), [dropdownData]);

  // Get items filtered by selected category
  const getItemsByCategory = (category: string) => {
    const items = dropdownData.filter(item => item.category === category);
    // Deduplicate by itemName to prevent duplicate key errors in the dropdown
    return Array.from(new Map(items.map(item => [item.itemName, item])).values());
  };


  // Check and save new options to Dropdown sheet
  const checkAndSaveNewOptions = async (items: any[]) => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;

    const newOptions: any[] = [];
    const newLocalDropdowns: any[] = [];

    items.forEach(item => {
      // Check if this combo exists
      const exists = dropdownData.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );

      // Also check if we already queued it to prevent duplicates in update
      const alreadyQueued = newOptions.some(
        d => d.category === item.category &&
          d.itemName === item.itemName &&
          d.itemCode === item.itemCode
      );

      if (!exists && !alreadyQueued) {
        newOptions.push({
          category: item.category,
          itemName: item.itemName,
          itemCode: item.itemCode
        });
        // Prepare for local update
        newLocalDropdowns.push({
          category: item.category,
          itemName: item.itemName,
          itemCode: item.itemCode
        });
      }
    });

    if (newOptions.length > 0) {
      // Optimistically update local state immediately so user sees them if they add more items
      setDropdownData(prev => [...prev, ...newLocalDropdowns]);

      try {
        // Prepare row data: [CreatedBy(A), Warehouse(B), ItemCode(C), Category(D), ItemName(E), ...]
        // Dropdown sheet structure: 
        // A: Created By, B: Warehouse, C: Item Code, D: Category, E: Item Name, ...

        const rowsToAdd = newOptions.map(opt => {
          const row = new Array(20).fill("");
          row[2] = opt.itemCode; // Column C
          row[3] = opt.category; // Column D
          row[4] = opt.itemName; // Column E
          return row;
        });

        const params = new URLSearchParams();
        params.append("action", "batchInsert"); // Using batchInsert or append
        params.append("sheetName", "Dropdown");
        params.append("rowsData", JSON.stringify(rowsToAdd));
        // We append to the end, so no startRow needed if the backend handles 'append' logic with batchInsert
        // If backend needs startRow, we might need to fetch it first, but let's try assuming batchInsert appends if no startRow or use a dedicated 'append' action if available.
        // Based on previous code, the backend supports "update" and "batchInsert". 
        // Let's rely on the fact that we can just calculate where to put it or use a simpler "append" loop if robust batch isn't there.
        // Actually, safe bet is to use a loop of "appendRow" if available, or just "batchInsert" at a high row index?
        // "batchInsert" in `submitToSheet` used `startRow`. 

        // LET'S USE A "append" action if we can infer it exists or fallback to `batchInsert`.
        // The safest implementation based on standard Google Apps Script patterns is usually an 'append' action.
        // I'll assume 'append' action is supported or I'll implement a loop using 'update' at the end.
        // Wait, I can just use 'batchInsert' with a high start row? No, that leaves gaps.
        // Let's try to assume the backend has an 'append' or 'appendRow' feature.
        // If not, I'll fetch the last row index first.

        // Fetch last row to be safe
        const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
        const json = await res.json();
        const existingRows = Array.isArray(json.data) ? json.data : [];
        const nextRow = existingRows.length + 1; // 1-based index

        params.append("startRow", nextRow.toString());

        await fetch(SHEET_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
          redirect: "follow",
        });
      } catch (e) {
        console.error("Failed to save new options:", e);
      }
    }
  };


  // submitToSheet: Uses insertIndent GAS action which atomically generates
  // unique IN-NNN[A/B/C] IDs under a LockService lock, preventing duplicates
  // when multiple users submit simultaneously.
  // Returns the generated indent IDs so the counter can be synced.
  const submitToSheet = async (data: any, attachmentUrl: string): Promise<string[]> => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) throw new Error("Sheet API URL is not defined");

    // Build rows WITHOUT Col B (index 1) — GAS will fill it with unique IDs
    const rows = data.items.map((item: any) => {
      const timestamp = getFmsTimestamp();

      const row = new Array(70).fill("");
      row[0] = timestamp;                    // A: Timestamp
      row[1] = "";                           // B: Indent No — filled by GAS
      row[2] = data.createdBy;              // C: Created By
      row[3] = item.category;              // D: Category
      row[4] = item.itemName;              // E: Item Name
      row[5] = item.quantity;              // F: Qty
      row[6] = data.warehouseLocation;     // G: Warehouse
      row[7] = item.itemCode || "";        // H: Item Code
      row[8] = data.leadTime;              // I: Lead Time (Expected Requirement Date)
      row[18] = item.itemPriority || "";   // S: Item Priority
      row[17] = attachmentUrl || "";       // R: Attachment
      row[69] = item.uom || "";            // BR: UOM
      return row;
    });

    const params = new URLSearchParams();
    params.append("action", "insertIndent");
    params.append("rowsData", JSON.stringify(rows));

    const res = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      redirect: "follow",
    });
    const text = await res.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error("Failed to parse insertIndent response: " + text);
    }

    if (result && result.success) {
      return result.generatedIds as string[];
    } else {
      throw new Error(result?.error || "insertIndent failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.createdBy &&
      formData.warehouseLocation &&
      formData.leadTime &&
      formData.items.length > 0
    ) {
      setIsSubmitting(true);

      const submitPromise = (async () => {
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) throw new Error("API URL is missing");

        // 1. Handle file upload first (before we know the indent number)
        let attachmentUrl = "";
        if (formData.attachment) {
          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(formData.attachment);
          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", `Stage1_attachment_${formData.attachment.name}`);
          uploadParams.append("mimeType", formData.attachment.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: uploadParams.toString(),
            redirect: "follow",
          });
          if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            attachmentUrl = uploadJson.url || uploadJson.fileUrl;
          } else {
            throw new Error(uploadJson.error || "Upload failed");
          }
          // Delay to prevent concurrent request rate limits on Google Apps Script redirect
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // 2. Submit to sheet — GAS generates unique IDs atomically under a lock
        const generatedIds = await submitToSheet({ ...formData }, attachmentUrl);

        // 3. Save new dropdown options in background (using generated IDs for reference)
        const createdRecords = formData.items.map((item, i) => ({
          indentNumber: generatedIds[i] || "",
          ...item,
        }));
        checkAndSaveNewOptions(createdRecords);

        // 4. Sync counter from returned IDs
        const maxFromGenerated = generatedIds.reduce((max, id) => {
          const m = id.match(/IN-(\d+)/);
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        if (maxFromGenerated > 0) setIndentCounter(maxFromGenerated + 1);

        fetchData();
        setFormData({ createdBy: "", warehouseLocation: "", leadTime: "", attachment: null, items: [] });
        setOpen(false);
        return true;
      })();

      toast.promise(submitPromise, {
        loading: "Creating indent and uploading attachment...",
        success: "Indent created successfully!",
        error: (err) => `Failed to create indent: ${err.message}`,
      });

      try {
        await submitPromise;
      } catch (err) {
        console.error("Submission failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleItemFieldChange = (field: string, value: string) => {
    setItemInput((prev) => {
      if (field === "category") {
        return { ...prev, category: value, itemName: "", itemCode: "" };
      }
      if (field === "itemName") {
        const selectedItem = dropdownData.find(
          (d) => d.category === prev.category && d.itemName === value
        );
        return {
          ...prev,
          itemName: value,
          itemCode: selectedItem?.itemCode || "",
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleAddItemToList = (e: React.MouseEvent) => {
    e.preventDefault();
    if (
      !itemInput.category ||
      !itemInput.itemName ||
      !itemInput.quantity ||
      !itemInput.uom ||
      !itemInput.itemCode ||
      !itemInput.itemPriority
    ) {
      toast.error("Please fill in all item fields before adding.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...itemInput }],
    }));

    // Clear inputs but preserve category to make sequential adding faster
    setItemInput({
      category: itemInput.category,
      itemName: "",
      quantity: "",
      uom: "",
      itemCode: "",
      itemPriority: "",
    });

    toast.success("Item added to the indent list!");
  };

  // === Edit Record Handler ===
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({
      createdBy: record.data.createdBy || "",
      warehouseLocation: record.data.warehouseLocation || "",
      leadTime: record.data.leadTime || "",
      category: record.data.category || "",
      itemName: record.data.itemName || "",
      quantity: record.data.quantity || "",
      uom: record.data.uom || "",
      itemCode: record.data.itemCode || "",
      itemPriority: record.data.itemPriority || "",
      attachment: null,
      existingAttachmentUrl: record.data.attachment || "",
    });
    setEditOpen(true);
  };

  // === Update Record in Sheet ===
  const updateRecordInSheet = async () => {
    if (!editingRecord) return;

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) {
      console.error("Sheet API URL is not defined");
      return;
    }

    setIsEditSubmitting(true);

    try {
      // Handle file upload if new file selected
      let finalAttachmentUrl = editFormData.existingAttachmentUrl;
      if (editFormData.attachment) {
        try {
          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(editFormData.attachment);
          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", `Stage1_Edit_${editingRecord.id}_${editFormData.attachment.name}`);
          uploadParams.append("mimeType", editFormData.attachment.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            body: uploadParams,
            redirect: "follow",
          });
          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            finalAttachmentUrl = uploadJson.url || uploadJson.fileUrl;
          }
        } catch (uploadErr) {
          console.error("Upload error during edit:", uploadErr);
        }
      }

      // Build the row data array - only update specific columns
      const rowArray = new Array(70).fill(""); // Increase size to accommodate UOM at index 69

      // Update columns: C (index 2), D (index 3), E (index 4), F (index 5), G (index 6), H (index 7), I (index 8), S (index 18), R (index 17), BR (index 69)
      rowArray[2] = editFormData.createdBy;      // Col C: Created By
      rowArray[3] = editFormData.category;        // Col D: Category
      rowArray[4] = editFormData.itemName;        // Col E: Item Name
      rowArray[5] = editFormData.quantity;        // Col F: Quantity
      rowArray[6] = editFormData.warehouseLocation; // Col G: Warehouse Location
      rowArray[7] = editFormData.itemCode;        // Col H: Item Code
      rowArray[8] = editFormData.leadTime;        // Col I: Lead Time (Expected Requirement Date)
      rowArray[18] = editFormData.itemPriority;   // Col S: Item Priority
      rowArray[17] = finalAttachmentUrl;          // Col R: Attachment URL
      rowArray[69] = editFormData.uom;            // Col BR: UOM

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "INDENT-LIFT");
      params.append("rowIndex", editingRecord.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        redirect: "follow",
      });

      const text = await res.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error("Failed to parse update response: " + text);
      }

      if (result.success) {
        setEditOpen(false);
        setEditingRecord(null);
        fetchData(); // Refresh data
      } else {
        console.error("Update failed:", result.error);
        alert("Failed to update record: " + (result.error || "Please try again."));
      }
    } catch (error: any) {
      console.error("Error updating record:", error);
      alert("Error updating record: " + (error?.message || "Please check console."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm max-w-4xl mx-auto">
        <div className="p-3 bg-slate-900 rounded-lg text-white shadow-xl">
          <PlusCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Create Indent</h2>
          <p className="text-slate-500 text-sm">Initiate a new purchase indent by filling in the details below.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* Step 1: General Specifications */}
          {/* Step 1: General Specifications & Item Input */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-700">1</span>
              General Specifications & Item Details
            </h3>

            {/* General Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="createdBy">Created By <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.createdBy}
                  onValueChange={(val) =>
                    setFormData({ ...formData, createdBy: val })
                  }
                >
                  <SelectTrigger id="createdBy" className="w-full">
                    <SelectValue placeholder="Select creator" />
                  </SelectTrigger>
                  <SelectContent>
                    {createdByOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="warehouseLocation">Division <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.warehouseLocation}
                  onValueChange={(val) =>
                    setFormData({ ...formData, warehouseLocation: val })
                  }
                >
                  <SelectTrigger id="warehouseLocation" className="w-full">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="leadTime">Expected Requirement Date <span className="text-red-500">*</span></Label>
                <Input
                  id="leadTime"
                  type="date"
                  value={formData.leadTime}
                  onChange={(e) =>
                    setFormData({ ...formData, leadTime: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Attachment (Optional)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="indent-attachment"
                    className="flex-1 flex items-center justify-between px-3 h-10 border border-slate-200 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 text-xs transition-colors"
                  >
                    <span className="text-slate-500 truncate max-w-[200px]">
                      {formData.attachment ? formData.attachment.name : "Choose file..."}
                    </span>
                    <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                  </label>
                  {formData.attachment && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => setFormData({ ...formData, attachment: null })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Divider for Item Input */}
            <div className="border-t border-slate-100 pt-4 mt-6">
              <h4 className="text-sm font-bold text-slate-700 mb-3">Item Details</h4>
            </div>

            {/* Item Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Combobox
                  options={categoryOptions}
                  value={itemInput.category}
                  onChange={(val) => handleItemFieldChange("category", val)}
                  placeholder="Select category"
                  searchPlaceholder="Search category..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Item Name <span className="text-red-500">*</span></Label>
                <Combobox
                  options={itemInput.category ? getItemsByCategory(itemInput.category).map(i => i.itemName) : []}
                  value={itemInput.itemName}
                  onChange={(val) => handleItemFieldChange("itemName", val)}
                  placeholder={itemInput.category ? "Select or type item..." : "Select category first"}
                  searchPlaceholder="Search or create item..."
                  disabled={!itemInput.category}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Item Code <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="e.g. IC-001"
                  value={itemInput.itemCode}
                  onChange={(e) => handleItemFieldChange("itemCode", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={itemInput.quantity}
                  onChange={(e) => handleItemFieldChange("quantity", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>UOM <span className="text-red-500">*</span></Label>
                <Select
                  value={itemInput.uom}
                  onValueChange={(val) => handleItemFieldChange("uom", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {uomOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Item Priority <span className="text-red-500">*</span></Label>
                <Select
                  value={itemInput.itemPriority}
                  onValueChange={(val) => handleItemFieldChange("itemPriority", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={handleAddItemToList}
                variant="outline"
                className="w-full sm:w-auto px-6 border-slate-200 text-slate-800 hover:bg-slate-100 hover:text-black font-semibold h-10 transition-colors"
              >
                + Add Item to List
              </Button>
            </div>
          </div>

          {/* Step 2: Item List (Bottom) */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-700">2</span>
              Added Items List ({formData.items.length})
            </h3>

            {formData.items.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/30">
                <p className="text-sm text-slate-400">
                  No items added to the list yet. Fill in the section above and click "+ Add Item to List".
                </p>
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150">
                      <th className="p-3 font-semibold text-slate-700">Category</th>
                      <th className="p-3 font-semibold text-slate-700">Item Name</th>
                      <th className="p-3 font-semibold text-slate-700">Priority</th>
                      <th className="p-3 font-semibold text-slate-700">Quantity</th>
                      <th className="p-3 font-semibold text-slate-700">UOM</th>
                      <th className="p-3 font-semibold text-slate-700">Item Code</th>
                      <th className="p-3 font-semibold text-slate-700 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="p-3"><Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">{item.category}</Badge></td>
                        <td className="p-3 font-semibold text-slate-800">{item.itemName}</td>
                        <td className="p-3">
                          <Badge className={cn(
                            item.itemPriority === "high" && "bg-red-100 text-red-800 hover:bg-red-150 border-red-200",
                            item.itemPriority === "medium" && "bg-amber-100 text-amber-800 hover:bg-amber-150 border-amber-200",
                            item.itemPriority === "low" && "bg-green-100 text-green-800 hover:bg-green-150 border-green-200"
                          )} variant="outline">
                            {item.itemPriority ? item.itemPriority.toUpperCase() : "-"}
                          </Badge>
                        </td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">{item.uom}</td>
                        <td className="p-3 font-mono text-xs">{item.itemCode}</td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                items: formData.items.filter((_, i) => i !== index),
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step 4: Create Indent Submit Action */}
          <div className="pt-6 border-t flex justify-end">
            <Button
              type="button"
              disabled={
                !formData.createdBy ||
                !formData.warehouseLocation ||
                !formData.leadTime ||
                formData.items.length === 0 ||
                isSubmitting
              }
              onClick={handleSubmit}
              className="w-full sm:w-80 bg-slate-900 text-white hover:bg-slate-800 h-11 text-sm font-semibold tracking-wide shadow-lg shadow-slate-150 transition-all rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Indent...
                </>
              ) : (
                <>
                  Create Indent ({formData.items.length} item
                  {formData.items.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* === EDIT RECORD MODAL === */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Indent Record</DialogTitle>
            <p className="text-sm text-gray-600">
              {editingRecord ? `Editing: ${editingRecord.data.indentNumber}` : ""}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRecordInSheet();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <Select
                    value={editFormData.createdBy}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, createdBy: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select creator" />
                    </SelectTrigger>
                    <SelectContent>
                      {createdByOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={editFormData.warehouseLocation}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, warehouseLocation: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Combobox
                    options={categoryOptions}
                    value={editFormData.category}
                    onChange={(val) =>
                      setEditFormData({
                        ...editFormData,
                        category: val,
                        itemName: "",
                        itemCode: ""
                      })
                    }
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Combobox
                    options={editFormData.category ? getItemsByCategory(editFormData.category).map(i => i.itemName) : []}
                    value={editFormData.itemName}
                    onChange={(val) => {
                      const selectedItem = dropdownData.find(
                        d => d.category === editFormData.category && d.itemName === val
                      );
                      setEditFormData({
                        ...editFormData,
                        itemName: val,
                        itemCode: selectedItem?.itemCode || ""
                      });
                    }}
                    placeholder={editFormData.category ? "Select item" : "Select category first"}
                    searchPlaceholder="Search item..."
                    disabled={!editFormData.category}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={editFormData.quantity}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, quantity: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>UOM</Label>
                  <Select
                    value={editFormData.uom}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, uom: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {uomOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expected Requirement Date</Label>
                  <Input
                    type="date"
                    value={editFormData.leadTime}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, leadTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Item Priority</Label>
                  <Select
                    value={editFormData.itemPriority}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, itemPriority: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Item Code</Label>
                  <Input
                    type="text"
                    placeholder="Auto-filled"
                    value={editFormData.itemCode}
                    readOnly
                    className="bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Attachment</Label>
                <div className="flex flex-col gap-3">
                  {editFormData.existingAttachmentUrl && !editFormData.attachment && (() => {
                    const isImage = editFormData.existingAttachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)|(drive\.google\.com.*(id=|\/d\/))/i);
                    let previewUrl = editFormData.existingAttachmentUrl;

                    // Convert Google Drive link to direct image link for preview if possible
                    if (previewUrl.includes('drive.google.com')) {
                      const fileId = previewUrl.match(/\/d\/(.+?)\//)?.[1] || previewUrl.match(/id=(.+?)(&|$)/)?.[1];
                      if (fileId) {
                        previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                      }
                    }

                    return (
                      <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-100/50 aspect-video flex flex-col items-center justify-center transition-all hover:bg-slate-100">
                        {isImage ? (
                          <img
                            src={previewUrl}
                            alt="Previous attachment"
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <a
                            href={editFormData.existingAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-lg shadow-sm font-semibold text-slate-900 hover:bg-white hover:scale-105 transition-all text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            Open Previous Attachment
                          </a>
                          {!isImage && (
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-200/50 px-2 py-1 rounded">No image preview available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    id="edit-indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditFormData({ ...editFormData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="edit-indent-attachment"
                    className="flex items-center justify-center w-full py-4 px-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Upload className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="text-left leading-tight">
                        <p className="text-sm font-semibold text-slate-700">
                          {editFormData.attachment ? "Change Document" : "Update Document"}
                        </p>
                        <p className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {editFormData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-blue-100 rounded-md">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                            {editFormData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">New document selected</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => setEditFormData({ ...editFormData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingRecord(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
