"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings,
  Plus,
  Trash2,
  Loader2,
  Users,
  MapPin,
  ShieldCheck,
  Truck,
  FileText,
  Boxes,
  HelpCircle,
  AlertCircle,
  FileSpreadsheet,
  Search,
  Wrench,
  CheckSquare
} from "lucide-react";

interface ItemOption {
  itemCode: string;
  category: string;
  itemName: string;
}

export default function MasterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("createdBy");
  
  // RAW sheet data to preserve headers/size
  const [rawSheetData, setRawSheetData] = useState<any[][]>([]);

  // Managed Dropdown Lists
  const [createdBy, setCreatedBy] = useState<string[]>([]);
  const [warehouse, setWarehouse] = useState<string[]>([]);
  const [approver, setApprover] = useState<string[]>([]);
  const [transporter, setTransporter] = useState<string[]>([]);
  const [accountant, setAccountant] = useState<string[]>([]);
  const [uom, setUom] = useState<string[]>([]);
  const [qcEngineer, setQcEngineer] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState<string[]>([]);
  
  // Complex items catalog
  const [items, setItems] = useState<ItemOption[]>([]);

  // Form Inputs
  const [newSimpleVal, setNewSimpleVal] = useState<string>("");
  const [newItem, setNewItem] = useState<ItemOption>({ itemCode: "", category: "", itemName: "" });
  const [itemSearch, setItemSearch] = useState<string>("");

  const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

  const fetchDropdowns = async () => {
    if (!SHEET_API_URL) {
      toast.error("API URI is missing in environment");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRawSheetData(json.data);

        const dataRows = json.data.slice(1); // skip header row

        // Helper to extract non-empty trimmed values
        const extractCol = (colIdx: number) => {
          return dataRows
            .map((row: any) => String(row[colIdx] || "").trim())
            .filter((val: string) => val !== "");
        };

        setCreatedBy(extractCol(0));
        setWarehouse(extractCol(1));
        setApprover(extractCol(8));
        setTransporter(extractCol(10));
        setQcEngineer(extractCol(11));
        setAccountant(extractCol(12));
        setUom(extractCol(13));
        setChecklist(extractCol(15));
        setRejectReason(extractCol(16));

        // Items triplet: Code (C: 2), Category (D: 3), Name (E: 4)
        const parsedItems: ItemOption[] = dataRows
          .filter((row: any) => row[3] || row[4])
          .map((row: any) => ({
            itemCode: String(row[2] || "").trim(),
            category: String(row[3] || "").trim(),
            itemName: String(row[4] || "").trim(),
          }));
        setItems(parsedItems);
      } else {
        toast.error("Failed to load options: " + (json.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error fetching options.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  // Save the current states back to the google sheet
  const handleSave = async (
    updatedCreatedBy = createdBy,
    updatedWarehouse = warehouse,
    updatedApprover = approver,
    updatedTransporter = transporter,
    updatedQcEngineer = qcEngineer,
    updatedAccountant = accountant,
    updatedUom = uom,
    updatedChecklist = checklist,
    updatedRejectReason = rejectReason,
    updatedItems = items
  ) => {
    if (!SHEET_API_URL) return;
    setIsSubmitting(true);

    const headers = rawSheetData[0] || [
      "Created By", "Warehouse Location", "Item Code", "Category", "Item Name", 
      "", "", "", "Approver", "", "Transporter", "QC Engineer", "Accountant", 
      "UOM", "", "Checklist Item", "Reject Reason"
    ];

    const maxRows = Math.max(
      updatedCreatedBy.length,
      updatedWarehouse.length,
      updatedApprover.length,
      updatedTransporter.length,
      updatedQcEngineer.length,
      updatedAccountant.length,
      updatedUom.length,
      updatedChecklist.length,
      updatedRejectReason.length,
      updatedItems.length
    );

    const rowsData: any[][] = [];
    rowsData.push(headers);

    for (let i = 0; i < maxRows; i++) {
      const row = new Array(20).fill("");
      row[0] = updatedCreatedBy[i] || "";
      row[1] = updatedWarehouse[i] || "";
      row[2] = updatedItems[i]?.itemCode || "";
      row[3] = updatedItems[i]?.category || "";
      row[4] = updatedItems[i]?.itemName || "";
      row[8] = updatedApprover[i] || "";
      row[10] = updatedTransporter[i] || "";
      row[11] = updatedQcEngineer[i] || "";
      row[12] = updatedAccountant[i] || "";
      row[13] = updatedUom[i] || "";
      row[15] = updatedChecklist[i] || "";
      row[16] = updatedRejectReason[i] || "";
      rowsData.push(row);
    }

    // Pad remaining rows to overwrite stale rows at the bottom of the sheet
    const prevRowCount = rawSheetData.length;
    while (rowsData.length < prevRowCount) {
      rowsData.push(new Array(20).fill(""));
    }

    try {
      const params = new URLSearchParams();
      params.append("action", "batchInsert");
      params.append("sheetName", "Dropdown");
      params.append("startRow", "1");
      params.append("rowsData", JSON.stringify(rowsData));

      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Options synchronized successfully!");
        // Refresh local data to sync row length
        setRawSheetData(rowsData);
      } else {
        toast.error("Failed to sync: " + (json.error || "Server issue"));
      }
    } catch (e) {
      console.error(e);
      toast.error("Error connecting to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add simple value
  const handleAddSimple = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSimpleVal.trim();
    if (!val) return;

    let updatedList: string[] = [];

    switch (activeTab) {
      case "createdBy":
        if (createdBy.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...createdBy, val];
        setCreatedBy(updatedList);
        handleSave(updatedList);
        break;
      case "warehouse":
        if (warehouse.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...warehouse, val];
        setWarehouse(updatedList);
        handleSave(undefined, updatedList);
        break;
      case "approver":
        if (approver.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...approver, val];
        setApprover(updatedList);
        handleSave(undefined, undefined, updatedList);
        break;
      case "transporter":
        if (transporter.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...transporter, val];
        setTransporter(updatedList);
        handleSave(undefined, undefined, undefined, updatedList);
        break;
      case "qcEngineer":
        if (qcEngineer.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...qcEngineer, val];
        setQcEngineer(updatedList);
        handleSave(undefined, undefined, undefined, undefined, updatedList);
        break;
      case "accountant":
        if (accountant.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...accountant, val];
        setAccountant(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "uom":
        if (uom.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...uom, val];
        setUom(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "checklist":
        if (checklist.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...checklist, val];
        setChecklist(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "rejectReason":
        if (rejectReason.includes(val)) { toast.warning("Option already exists!"); return; }
        updatedList = [...rejectReason, val];
        setRejectReason(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
    }

    setNewSimpleVal("");
  };

  // Remove simple value
  const handleRemoveSimple = (valToRemove: string) => {
    let updatedList: string[] = [];

    switch (activeTab) {
      case "createdBy":
        updatedList = createdBy.filter(item => item !== valToRemove);
        setCreatedBy(updatedList);
        handleSave(updatedList);
        break;
      case "warehouse":
        updatedList = warehouse.filter(item => item !== valToRemove);
        setWarehouse(updatedList);
        handleSave(undefined, updatedList);
        break;
      case "approver":
        updatedList = approver.filter(item => item !== valToRemove);
        setApprover(updatedList);
        handleSave(undefined, undefined, updatedList);
        break;
      case "transporter":
        updatedList = transporter.filter(item => item !== valToRemove);
        setTransporter(updatedList);
        handleSave(undefined, undefined, undefined, updatedList);
        break;
      case "qcEngineer":
        updatedList = qcEngineer.filter(item => item !== valToRemove);
        setQcEngineer(updatedList);
        handleSave(undefined, undefined, undefined, undefined, updatedList);
        break;
      case "accountant":
        updatedList = accountant.filter(item => item !== valToRemove);
        setAccountant(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "uom":
        updatedList = uom.filter(item => item !== valToRemove);
        setUom(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "checklist":
        updatedList = checklist.filter(item => item !== valToRemove);
        setChecklist(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
      case "rejectReason":
        updatedList = rejectReason.filter(item => item !== valToRemove);
        setRejectReason(updatedList);
        handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedList);
        break;
    }
  };

  // Add Item to Catalog
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newItem.itemCode.trim();
    const cat = newItem.category.trim();
    const name = newItem.itemName.trim();

    if (!code || !cat || !name) {
      toast.error("Please fill out Code, Category, and Item Name!");
      return;
    }

    if (items.some(i => i.itemName.toLowerCase() === name.toLowerCase())) {
      toast.warning("An item with this name already exists in catalog!");
      return;
    }

    const updatedCatalog = [...items, { itemCode: code, category: cat, itemName: name }];
    setItems(updatedCatalog);
    handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedCatalog);

    setNewItem({ itemCode: "", category: "", itemName: "" });
  };

  // Remove Item from Catalog
  const handleRemoveItem = (nameToRemove: string) => {
    const updatedCatalog = items.filter(item => item.itemName !== nameToRemove);
    setItems(updatedCatalog);
    handleSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, updatedCatalog);
  };

  // Search filtered catalog items
  const filteredCatalog = useMemo(() => {
    return items.filter(item => {
      const search = itemSearch.toLowerCase();
      return (
        item.itemName.toLowerCase().includes(search) ||
        item.itemCode.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search)
      );
    });
  }, [items, itemSearch]);

  const tabsConfig = [
    { id: "createdBy", label: "Created By", icon: Users, desc: "System operators and indent authors." },
    { id: "warehouse", label: "Warehouse / Area", icon: MapPin, desc: "Warehouse depots and lifting destination zones." },
    { id: "items", label: "Product Catalog", icon: Boxes, desc: "Registered inventory items, categories, and item codes." },
    { id: "approver", label: "Approvers", icon: ShieldCheck, desc: "Authorized personnel who approve indents and vendors." },
    { id: "transporter", label: "Transporters", icon: Truck, desc: "Lifting logistics and transporting suppliers." },
    { id: "qcEngineer", label: "QC Engineers", icon: Wrench, desc: "Engineers inspecting items on arrival." },
    { id: "accountant", label: "Accountants", icon: FileText, desc: "Financial accountants posting to Tally." },
    { id: "uom", label: "UOMs", icon: Settings, desc: "Units of Measure (e.g. Nos, Sets, Kgs, Bags)." },
    { id: "checklist", label: "QC Checklists", icon: CheckSquare, desc: "Quality inspection standard checklist options." },
    { id: "rejectReason", label: "Reject Reasons", icon: AlertCircle, desc: "Reasons cited for material returns." },
  ];

  const activeTabConfig = tabsConfig.find(t => t.id === activeTab);

  return (
    <div className="flex flex-col h-[calc(100vh-50px)] lg:h-screen bg-slate-50 overflow-hidden">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white p-6 shadow-md flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">System Master Settings</h1>
            <p className="text-xs text-slate-400 mt-1">Configure and manage dropdown select values used across the workflow stages.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitting && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold bg-indigo-950/45 px-3 py-1.5 rounded-full border border-indigo-500/35">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Saving options...
            </div>
          )}
          <Button
            onClick={fetchDropdowns}
            variant="outline"
            className="h-9 px-4 rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-xs"
            disabled={isLoading || isSubmitting}
          >
            {isLoading ? "Fetching..." : "Sync Sheet"}
          </Button>
        </div>
      </div>

      {/* Main settings body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Settings Navigator */}
        <div className="w-64 border-r border-slate-200 bg-white p-4 overflow-y-auto space-y-1.5 flex-shrink-0 flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2">Configurations</h3>
            {tabsConfig.map(t => {
              const TabIcon = t.icon;
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setNewSimpleVal("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-md"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <TabIcon className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-slate-400"}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="bg-slate-50 border p-3 rounded-xl text-[10px] text-slate-500 flex items-start gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-700">Real-time Sync</p>
              <p className="mt-0.5 leading-relaxed">Changes made are automatically batch-inserted into the Dropdown Google Sheet.</p>
            </div>
          </div>
        </div>

        {/* Right Side Options List Manager */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-sm font-semibold">Loading options database...</p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Category Info header */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  {activeTabConfig && <activeTabConfig.icon className="w-5 h-5 text-indigo-600" />}
                  <span>Manage {activeTabConfig?.label}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">{activeTabConfig?.desc}</p>
              </div>

              {activeTab === "items" ? (
                /* PRODUCT CATALOG MANAGEMENT */
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                  {/* Left panel: Catalog Addition Form */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Plus className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Catalog Item</h4>
                    </div>
                    <form onSubmit={handleAddItem} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Item Code</Label>
                        <Input
                          placeholder="e.g. IT-LAP-101"
                          value={newItem.itemCode}
                          onChange={(e) => setNewItem({ ...newItem, itemCode: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Category</Label>
                        <Input
                          placeholder="e.g. IT Supplies"
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Item Name</Label>
                        <Input
                          placeholder="e.g. Dell Latitude Laptop"
                          value={newItem.itemName}
                          onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                          className="h-10"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add to Catalog
                      </Button>
                    </form>
                  </div>

                  {/* Right panel: Catalog Table list */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-[500px]">
                    <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Catalog Items ({items.length})</h4>
                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                        <Input
                          placeholder="Search items..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="pl-9 h-9 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="w-[120px] text-xs font-bold text-slate-600">Code</TableHead>
                            <TableHead className="w-[150px] text-xs font-bold text-slate-600">Category</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600">Item Name</TableHead>
                            <TableHead className="w-[80px] text-xs font-bold text-slate-600 text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCatalog.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-slate-400 py-12 text-xs">
                                No items found in catalog.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredCatalog.map((item, idx) => (
                              <TableRow key={idx} className="hover:bg-slate-50/50">
                                <TableCell className="font-mono text-xs text-slate-700">{item.itemCode}</TableCell>
                                <TableCell className="text-xs text-slate-600 font-semibold">{item.category}</TableCell>
                                <TableCell className="text-xs text-slate-800 font-bold">{item.itemName}</TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.itemName)}
                                    disabled={isSubmitting}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:text-red-650 rounded-lg hover:bg-red-50 text-slate-400 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                /* SIMPLE VALUES MANAGEMENT (Created By, Warehouse, Approver, etc.) */
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start flex-1">
                  {/* Option Add panel */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 xl:col-span-1">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Plus className="w-4 h-4 text-indigo-650" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Add Option Value</h4>
                    </div>
                    <form onSubmit={handleAddSimple} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-650 font-semibold">Value Name</Label>
                        <Input
                          placeholder={`Enter new ${activeTabConfig?.label.toLowerCase() || "option"}...`}
                          value={newSimpleVal}
                          onChange={(e) => setNewSimpleVal(e.target.value)}
                          className="h-10"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition-all mt-2"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        Add Value
                      </Button>
                    </form>
                  </div>

                  {/* Option List Display panel */}
                  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden xl:col-span-2 flex flex-col h-[500px]">
                    <div className="p-4 border-b bg-slate-50">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Current Values ({
                          activeTab === "createdBy" ? createdBy.length :
                          activeTab === "warehouse" ? warehouse.length :
                          activeTab === "approver" ? approver.length :
                          activeTab === "transporter" ? transporter.length :
                          activeTab === "qcEngineer" ? qcEngineer.length :
                          activeTab === "accountant" ? accountant.length :
                          activeTab === "uom" ? uom.length :
                          activeTab === "checklist" ? checklist.length :
                          activeTab === "rejectReason" ? rejectReason.length : 0
                        })
                      </h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                      {/* Grid representation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(() => {
                          const getList = () => {
                            switch (activeTab) {
                              case "createdBy": return createdBy;
                              case "warehouse": return warehouse;
                              case "approver": return approver;
                              case "transporter": return transporter;
                              case "qcEngineer": return qcEngineer;
                              case "accountant": return accountant;
                              case "uom": return uom;
                              case "checklist": return checklist;
                              case "rejectReason": return rejectReason;
                              default: return [];
                            }
                          };
                          const list = getList();
                          if (list.length === 0) {
                            return (
                              <div className="col-span-2 text-center text-slate-400 py-12 text-xs">
                                No values entered yet. Add options using the form on the left.
                              </div>
                            );
                          }
                          return list.map((val, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200/70 rounded-xl shadow-sm hover:border-slate-350 transition-colors">
                              <span className="text-xs font-semibold text-slate-700 truncate mr-2" title={val}>{val}</span>
                              <Button
                                type="button"
                                onClick={() => handleRemoveSimple(val)}
                                disabled={isSubmitting}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:text-red-650 hover:bg-red-50 text-slate-400 rounded-lg transition-colors flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
