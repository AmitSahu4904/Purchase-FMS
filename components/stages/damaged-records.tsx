"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, RefreshCw, Search, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function DamagedRecords() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    vendor: "All",
    item: "All"
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!API_URL) throw new Error("API URI not configured");

      const response = await fetch(`${API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Filter for records with damage (Column DM / Index 116 > 0)
        // Rows typically start from index 6 or 7.
        const rows = result.data.slice(6).filter((row: any) => {
          const damagedQty = parseFloat(row[116]);
          return !isNaN(damagedQty) && damagedQty > 0;
        }).map((row: any) => ({
          indentNo: row[1],
          unitTrackingNo: row[2],
          vendorName: row[3],
          poNumber: row[4],
          itemName: row[7],
          dispatchQty: row[8],
          receivedQty: row[25],
          qrCode: row[115],
          damagedQty: row[116],
          reason: row[117],
          image: row[118],
        }));
        setData(rows);
      } else {
        throw new Error(result.error || "Failed to fetch damaged records data");
      }
    } catch (err: any) {
      console.error("Damaged Records Fetch Error:", err);
      setError(err.message);
      toast.error("Failed to load damaged records: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueVendors = useMemo(() => 
    Array.from(new Set(data.map(r => r.vendorName).filter(Boolean))).sort()
  , [data]);

  const uniqueItems = useMemo(() => 
    Array.from(new Set(data.map(r => r.itemName).filter(Boolean))).sort()
  , [data]);

  const filteredData = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return data.filter(row => {
      const matchSearch = 
        row.indentNo?.toLowerCase().includes(lower) ||
        row.vendorName?.toLowerCase().includes(lower) ||
        row.itemName?.toLowerCase().includes(lower) ||
        row.poNumber?.toString().toLowerCase().includes(lower);
      
      const matchVendor = filters.vendor === "All" || row.vendorName === filters.vendor;
      const matchItem = filters.item === "All" || row.itemName === filters.item;

      return matchSearch && matchVendor && matchItem;
    });
  }, [data, searchTerm, filters]);



  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive">Error Loading Data</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchData} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-red-600 rounded-xl shadow-lg text-white">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Damaged Records</h2>
            <p className="text-[13px] text-muted-foreground mt-0">Viewing all reported material damage from warehouse receipts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by Indent, Vendor, Item..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 shadow-sm focus:ring-red-500 focus:border-red-500 rounded-lg h-10"
            />
          </div>
          <Button variant="outline" onClick={fetchData} size="icon" className="bg-white shadow-sm hover:bg-slate-50 border-slate-200 h-10 w-10 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white overflow-hidden ring-1 ring-slate-200 rounded-xl">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
          <div className="flex flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                Damage Analysis Dashboard
              </CardTitle>
            </div>

            <div className="flex-1 flex items-center justify-end gap-4">
              {/* Vendor Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all hover:border-red-300 group">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor</span>
                <select 
                  className="bg-transparent border-none text-[11px] font-medium text-slate-700 focus:ring-0 outline-none cursor-pointer min-w-[120px] max-w-[200px]"
                  value={filters.vendor}
                  onChange={(e) => setFilters(prev => ({ ...prev, vendor: e.target.value }))}
                >
                  <option value="All">All Vendors</option>
                  {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Item Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all hover:border-red-300 group">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Item</span>
                <select 
                  className="bg-transparent border-none text-[11px] font-medium text-slate-700 focus:ring-0 outline-none cursor-pointer min-w-[120px] max-w-[200px]"
                  value={filters.item}
                  onChange={(e) => setFilters(prev => ({ ...prev, item: e.target.value }))}
                >
                  <option value="All">All Items</option>
                  {uniqueItems.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
                {filteredData.length} RECORDS FOUND
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto relative custom-scrollbar">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="w-[120px] font-bold text-slate-700 uppercase text-[10px]">Indent No.</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Tracking No.</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Vendor</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Item Name</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Dispatch</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Received</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-red-600 uppercase text-[10px] bg-red-50/30">Damaged</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">QR Code</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Reason</TableHead>
                  <TableHead className="w-[80px] text-center font-bold text-slate-700 uppercase text-[10px]">Image</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                        <span className="text-slate-500 font-medium">Loading records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (filteredData.length === 0 && !loading) ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 opacity-20" />
                        <p className="font-medium">No damaged records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                      <TableCell className="font-medium text-slate-900 py-4">{row.indentNo}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-[11px]">{row.unitTrackingNo}</TableCell>
                      <TableCell className="text-slate-700 min-w-[200px] whitespace-normal py-4" title={row.vendorName}>
                        {row.vendorName}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800 min-w-[250px] whitespace-normal py-4" title={row.itemName}>
                        {row.itemName}
                      </TableCell>
                      <TableCell className="text-center text-slate-600">{row.dispatchQty}</TableCell>
                      <TableCell className="text-center text-slate-600">{row.receivedQty}</TableCell>
                      <TableCell className="text-center font-bold text-red-600 bg-red-50/10">
                        {row.damagedQty}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-500 font-mono">
                        {row.qrCode || "-"}
                      </TableCell>
                      <TableCell className="text-slate-600 text-[11px] max-w-[250px]">
                        <div className="whitespace-normal" title={row.reason}>
                          {row.reason || "No reason specified"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.image ? (
                          <a 
                            href={row.image} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <div className="bg-slate-50 p-3 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
             Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
           </p>
           <p className="text-[10px] text-muted-foreground font-bold italic text-red-600/70">
             CONFIDENTIAL DAMAGE REPORT
           </p>
        </div>
      </Card>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
