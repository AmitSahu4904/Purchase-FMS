"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Search, CreditCard, CheckCircle } from "lucide-react";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { toast } from "sonner";

const formatDateDash = (dateStr: string) => {
  if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  } catch {
    return dateStr;
  }
};

export default function Payment() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    paymentRef: "",
    paymentDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Data starts at index 6 (Row 8)
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const hasPlanPayment = !!row[72] && String(row[72]).trim() !== "" && String(row[72]).trim() !== "-";
            const hasActualPayment = !!row[73] && String(row[73]).trim() !== "" && String(row[73]).trim() !== "-";

            let status = "not_ready";
            if (hasPlanPayment) {
              status = hasActualPayment ? "completed" : "pending";
            }

            // Find selected vendor terms
            const selectedVendor = String(row[47] || "").trim();
            let terms = "";
            if (selectedVendor === "vendor1") terms = String(row[23] || "").trim();
            else if (selectedVendor === "vendor2") terms = String(row[31] || "").trim();
            else if (selectedVendor === "vendor3") terms = String(row[39] || "").trim();

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              status: status,
              createdAt: parseSheetDate(row[0]),
              data: {
                timestamp: row[0],
                indentNumber: row[1],
                itemName: row[4],
                quantity: row[14] || row[5] || "-",
                selectedVendorName: row[48] || "-",
                poNumber: row[54] || "-",
                totalValue: row[56] || "-",
                paymentTerms: terms || "Advance",
                plannedPayment: row[72],
                actualPayment: row[73],
                paymentRef: row[74] || "-",
              }
            };
          });
        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error Payment Stage:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pending = useMemo(() => sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.selectedVendorName?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const completed = useMemo(() => sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.selectedVendorName?.toLowerCase().includes(searchLower)
      );
    }), [sheetRecords, searchTerm]);

  const baseColumns = [
    { key: "indentNumber", label: "Indent" },
    { key: "itemName", label: "Item" },
    { key: "selectedVendorName", label: "Vendor" },
    { key: "poNumber", label: "PO Number" },
    { key: "totalValue", label: "PO Value" },
    { key: "plannedPayment", label: "Planned Date" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-40 justify-start h-10 rounded-xl bg-white border-slate-200">
          {selectedColumns.length === baseColumns.length
            ? "All columns"
            : `${selectedColumns.length} column${
                selectedColumns.length !== 1 ? "s" : ""
              } selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2 bg-white border shadow-md">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === baseColumns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(baseColumns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>

          {baseColumns.map((col) => (
            <div key={col.key} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.key]);
                  } else {
                    setSelectedColumns((prev) =>
                      prev.filter((c) => c !== col.key)
                    );
                  }
                }}
              />
              <Label className="text-sm">{col.label}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  const handleOpenForm = (record: any) => {
    setCurrentRecord(record);
    setFormData({
      paymentRef: "",
      paymentDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setCurrentRecord(null);
    setFormData({
      paymentRef: "",
      paymentDate: new Date().toISOString().split("T")[0],
      remarks: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord || !formData.paymentRef) {
      toast.error("Please enter the Payment Reference Number.");
      return;
    }

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const rowArray = new Array(75).fill("");

      // Update Payment Stage completion details
      rowArray[73] = formData.paymentDate || getFmsTimestamp(); // Actual Payment Date
      rowArray[74] = formData.paymentRef;                     // Payment Reference No

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "INDENT-LIFT");
      params.append("rowIndex", currentRecord.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        body: params,
      });

      if (!response.ok) throw new Error("Update failed");

      const result = await response.json();
      if (result.success) {
        toast.success("Payment recorded and transitioned successfully!");
        await fetchData();
        resetForm();
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err: any) {
      console.error("Payment Submit Error:", err);
      setSubmitError(err.message || "Failed to record payment");
      toast.error(err.message || "Failed submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col overflow-hidden">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 6: Payment</h1>
              <p className="text-slate-500 text-sm">Process advance payments for approved vendor items.</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4 w-full md:w-auto">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by indent, item, vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-slate-600 hidden md:inline-block">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="bg-slate-100/80 p-1 w-fit rounded-lg mb-4">
          <TabsTrigger value="pending" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
            Pending Payments ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="px-4 py-2 text-sm font-medium rounded-md transition-all">
            History ({completed.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab content */}
        <TabsContent value="pending" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading payments...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No pending payments</p>
              <p className="text-sm mt-1">All advance payments are caught up!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Actions
                    </TableHead>
                    {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                      <TableHead key={col.key} className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                      <TableCell className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenForm(record)}
                          className="h-8 text-xs font-semibold px-3 border-blue-200 text-blue-700 hover:bg-blue-50/80 transition-colors"
                        >
                          Record Payment
                        </Button>
                      </TableCell>
                      {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                        <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                          {col.key === "plannedPayment"
                            ? formatDateDash(record.data[col.key])
                            : col.key === "totalValue"
                              ? record.data[col.key] && record.data[col.key] !== "-" ? `₹${record.data[col.key]}` : "-"
                              : String(record.data[col.key] ?? "-")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Completed Tab content */}
        <TabsContent value="history" className="mt-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed payments</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border rounded-xl bg-white shadow-sm scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full caption-bottom text-sm border-collapse">
                <TableHeader className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                  <TableRow className="bg-slate-200 hover:bg-slate-200 border-none">
                    {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                      <TableHead key={col.key} className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Payment Ref No.
                    </TableHead>
                    <TableHead className="sticky top-0 z-30 bg-slate-200 border-none px-4 py-3 text-slate-700 font-bold uppercase text-[13px] tracking-wider">
                      Payment Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                      {baseColumns.filter((col) => selectedColumns.includes(col.key)).map((col) => (
                        <TableCell key={col.key} className="text-sm text-slate-700 px-4">
                          {col.key === "plannedPayment"
                            ? formatDateDash(record.data[col.key])
                            : col.key === "totalValue"
                              ? record.data[col.key] && record.data[col.key] !== "-" ? `₹${record.data[col.key]}` : "-"
                              : String(record.data[col.key] ?? "-")}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm text-slate-700 px-4 font-semibold text-blue-700">
                        {record.data.paymentRef}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 px-4">
                        {formatDateDash(record.data.actualPayment)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* RECORD PAYMENT DECISION MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Record Advance Payment</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 space-y-4 pr-1 py-1">
            {/* Indent summary */}
            <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Indent:</span>
                <span className="font-bold text-slate-900">{currentRecord?.data?.indentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Item Name:</span>
                <span className="font-medium text-slate-900">{currentRecord?.data?.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Selected Vendor:</span>
                <span className="font-bold text-slate-900">{currentRecord?.data?.selectedVendorName}</span>
              </div>
              <div className="flex justify-between border-t border-blue-100/50 pt-1 mt-1">
                <span className="font-semibold text-slate-500">PO Number:</span>
                <span className="font-medium text-slate-900">{currentRecord?.data?.poNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">PO Total Value:</span>
                <span className="font-extrabold text-blue-700">₹{currentRecord?.data?.totalValue}</span>
              </div>
            </div>

            {/* Payment Reference Number */}
            <div className="space-y-1.5">
              <Label htmlFor="paymentRef" className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Payment Ref No. / UTR <span className="text-red-500">*</span>
              </Label>
              <Input
                id="paymentRef"
                required
                value={formData.paymentRef}
                onChange={(e) => setFormData({ ...formData, paymentRef: e.target.value })}
                placeholder="Enter Transaction Ref / UTR / Cheque No."
                className="border-slate-200"
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label htmlFor="paymentDate" className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="paymentDate"
                type="date"
                required
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="border-slate-200"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="remarks" className="font-bold text-xs uppercase tracking-wider text-slate-500">Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any special transaction reference or payment notes..."
                className="min-h-16 border-slate-200"
              />
            </div>

            {submitError && (
              <p className="text-red-500 text-xs font-semibold">{submitError}</p>
            )}

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
