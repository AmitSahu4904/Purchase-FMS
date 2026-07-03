"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const paymentTermsOptions = [
  { value: "Advance", label: "Advance" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" }
];

export default function PublicQuotationForm() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id"); // e.g. "IND-001_8"
  const vParam = searchParams.get("v");   // e.g. "1", "2", "3"

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [indentData, setIndentData] = useState<{
    indentNumber: string;
    itemName: string;
    quantity: string;
    category: string;
    vendorName: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    rate: "",
    terms: "30",
    expectedDeliveryDate: "",
  });

  const vendorSlot = parseInt(vParam || "1", 10);

  useEffect(() => {
    if (!idParam) {
      setErrorMsg("Missing indent ID or vendor parameter in link.");
      setIsLoading(false);
      return;
    }

    const fetchIndent = async () => {
      try {
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) {
          setErrorMsg("API Configuration error.");
          setIsLoading(false);
          return;
        }

        const parts = idParam.split("_");
        const rowIndex = parseInt(parts[1] || "", 10);
        if (isNaN(rowIndex)) {
          setErrorMsg("Invalid link parameters.");
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const row = json.data[rowIndex - 1];
          if (row) {
            const vOffset = 21 + (vendorSlot - 1) * 8; // slot 1: 21, slot 2: 29, slot 3: 37
            setIndentData({
              indentNumber: row[1] || "",
              itemName: row[4] || "",
              quantity: row[14] || "",
              category: row[3] || "",
              vendorName: row[vOffset] || `Vendor #${vendorSlot}`,
            });
          } else {
            setErrorMsg("Indent details not found.");
          }
        } else {
          setErrorMsg("Failed to read from server database.");
        }
      } catch (err: any) {
        console.error("Fetch error on public quotation form:", err);
        setErrorMsg("Network error trying to load indent details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchIndent();
  }, [idParam, vendorSlot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rate.trim() || !formData.expectedDeliveryDate) {
      toast.error("Please fill in all mandatory fields.");
      return;
    }

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL || !idParam) return;

    setIsSubmitting(true);
    try {
      const parts = idParam.split("_");
      const rowIndex = parseInt(parts[1] || "", 10);

      const rowArray = new Array(60).fill("");
      const vOffset = 21 + (vendorSlot - 1) * 8; // slot 1: 21, slot 2: 29, slot 3: 37

      // Update the vendor quote details in the spreadsheet
      rowArray[vOffset + 1] = formData.rate;                     // Rate Per Qty
      rowArray[vOffset + 2] = formData.terms;                    // Payment Terms
      rowArray[vOffset + 3] = formData.expectedDeliveryDate;     // Expected Delivery Date
      rowArray[vOffset + 4] = "No";                              // Approved/Selected status (default No)

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "INDENT-LIFT");
      params.append("rowIndex", rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        body: params,
      });

      const result = await res.json();
      if (result.success) {
        setSubmitted(true);
        toast.success("Quotation submitted successfully!");
      } else {
        throw new Error(result.error || "Unknown server error");
      }
    } catch (err: any) {
      console.error("Quotation submit error:", err);
      toast.error(err.message || "Failed to submit quotation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-slate-800" />
          <p className="text-slate-600 text-sm font-medium">Loading proposal parameters...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200 bg-white">
          <CardHeader className="flex flex-col items-center gap-2">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <CardTitle className="text-red-800 text-lg">Error loading form</CardTitle>
            <CardDescription className="text-center">{errorMsg}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-green-150 bg-white shadow-xl rounded-2xl">
          <CardHeader className="flex flex-col items-center gap-3 pt-8">
            <div className="w-16 h-16 bg-emerald-100 flex items-center justify-center rounded-full text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-slate-900 text-xl font-bold tracking-tight">Quotation Received!</CardTitle>
            <CardDescription className="text-center text-slate-500 px-4">
              Thank you for submitting your quotation. The purchasing department has been notified.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8 px-8">
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 text-xs text-slate-600 space-y-2">
              <div className="flex justify-between"><span className="font-semibold">Vendor:</span><span>{indentData?.vendorName}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Indent:</span><span>{indentData?.indentNumber}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Item:</span><span>{indentData?.itemName}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Rate Submitted:</span><span>₹{formData.rate} / unit</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <Card className="max-w-lg w-full bg-white shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 md:p-8 space-y-2">
          <CardTitle className="text-xl md:text-2xl font-bold tracking-tight">Vendor Quotation Submission</CardTitle>
          <CardDescription className="text-slate-300 text-sm">
            Please submit your commercial proposal details for the indent lift request below.
          </CardDescription>
        </div>

        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Indent Context */}
          <div className="border border-slate-100 bg-slate-50/70 rounded-xl p-4 text-sm space-y-3">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Requesting Vendor:</span>
              <span className="font-bold text-slate-800">{indentData?.vendorName}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-xs block">Indent ID</span>
                <span className="font-semibold text-slate-800">{indentData?.indentNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Item Category</span>
                <span className="font-semibold text-slate-800">{indentData?.category}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-slate-500 text-xs block">Item Name / Description</span>
                <span className="font-semibold text-slate-800">{indentData?.itemName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">Required Quantity</span>
                <span className="font-bold text-slate-800">{indentData?.quantity} units</span>
              </div>
            </div>
          </div>

          {/* Quotation Inputs Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rate Per Qty */}
            <div className="space-y-1.5">
              <Label htmlFor="rate">Rate Per Qty (₹) <span className="text-red-500">*</span></Label>
              <Input
                id="rate"
                type="number"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="Enter rate per unit in INR"
                required
              />
            </div>

            {/* Payment Terms */}
            <div className="space-y-1.5">
              <Label htmlFor="terms">Payment Terms <span className="text-red-500">*</span></Label>
              <Select
                value={formData.terms}
                onValueChange={(v) => setFormData({ ...formData, terms: v })}
              >
                <SelectTrigger id="terms">
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTermsOptions.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-1.5">
              <Label htmlFor="deliveryDate">Expected Delivery Date <span className="text-red-500">*</span></Label>
              <Input
                id="deliveryDate"
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11 text-sm font-semibold tracking-wide rounded-lg transition-colors mt-6 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting quotation...
                </>
              ) : (
                "Submit Quotation"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
