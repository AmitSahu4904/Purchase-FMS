"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCw, Search, Plus, Loader2, AlertCircle, XCircle, Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ItemCombobox = ({
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

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter((option) =>
      option.toLowerCase().includes(query.toLowerCase())
    );
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-slate-200 text-left font-normal"
        >
          <span className="truncate">{value ? value : "Select item..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search item..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
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

export default function OrderCancelPage() {
  const [orderNumber, setOrderNumber] = useState("")
  const [cancelStage, setCancelStage] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [cancelQuantities, setCancelQuantities] = useState<Record<string, string>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([])
  const [stageOptions, setStageOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Refactored Search States
  const [searchType, setSearchType] = useState<"indent-no" | "po-number" | "item-name">("indent-no")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedSearchRowIds, setSelectedSearchRowIds] = useState<string[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [dropdownItemsList, setDropdownItemsList] = useState<string[]>([])

  const SHEET_NAME = "Order-Cancel"

  const [searchTerm, setSearchTerm] = useState("")

  // Helper function to parse Google Sheets date format and display as YYYY-MM-DD HH:MM:SS
  const parseGoogleSheetsDate = (dateString: any) => {
    if (!dateString) return "—"

    let d: Date
    if (dateString instanceof Date) {
      d = dateString
    } else if (typeof dateString === "string") {
      if (dateString.startsWith("Date(")) {
        try {
          const parts = dateString.slice(5, -1).split(",")
          if (parts.length < 3) return dateString
          const year = Number(parts[0])
          const month = Number(parts[1]) // zero based
          const day = Number(parts[2])
          const hour = parts.length > 3 ? Number(parts[3]) : 0
          const minute = parts.length > 4 ? Number(parts[4]) : 0
          const second = parts.length > 5 ? Number(parts[5]) : 0
          d = new Date(year, month, day, hour, minute, second)
        } catch {
          return dateString
        }
      } else {
        const parsed = new Date(dateString)
        if (!isNaN(parsed.getTime())) {
          d = parsed
        } else {
          return dateString
        }
      }
    } else {
      return String(dateString)
    }

    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const fetchCancelledOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI || ""

      // Fetch Order-Cancel, INDENT-LIFT, and RECEIVING-ACCOUNTS in parallel
      const [cancelRes, fmsRes, receivingRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME}`),
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`)
      ])

      if (!cancelRes.ok) throw new Error(`HTTP error fetching cancellations! status: ${cancelRes.status}`)
      if (!fmsRes.ok) throw new Error(`HTTP error fetching FMS! status: ${fmsRes.status}`)
      if (!receivingRes.ok) throw new Error(`HTTP error fetching receiving accounts! status: ${receivingRes.status}`)

      const cancelJson = await cancelRes.json()
      const fmsJson = await fmsRes.json()
      const receivingJson = await receivingRes.json()

      // Process FMS (INDENT-LIFT) data to map Indent-No -> PO Qty
      const fmsMap = new Map<string, { poQty: number }>()
      if (fmsJson.success && Array.isArray(fmsJson.data)) {
        // Data starts from index 6 (Row 7) or index 7 (Row 8) based on sheet structure
        fmsJson.data.slice(6).forEach((row: any) => {
          if (row && row[1]) {
            const indentNo = String(row[1]).trim()
            // approvedQty is index 14. Fallback to indent qty index 5 if empty or not a number.
            const approvedQtyVal = parseFloat(String(row[14]).trim().replace(/,/g, ""))
            const indentQtyVal = parseFloat(String(row[5]).trim().replace(/,/g, ""))
            const poQty = !isNaN(approvedQtyVal) ? approvedQtyVal : (!isNaN(indentQtyVal) ? indentQtyVal : 0)
            fmsMap.set(indentNo, { poQty })
          }
        })
      }

      // Process RECEIVING-ACCOUNTS data to map Indent-No -> { totalLiftedQty, totalReceivedQty }
      const receivingMap = new Map<string, { totalLiftedQty: number, totalReceivedQty: number }>()
      if (receivingJson.success && Array.isArray(receivingJson.data)) {
        receivingJson.data.slice(6).forEach((row: any) => {
          if (row && row[1]) {
            const indentNo = String(row[1]).trim()
            const liftingQty = parseFloat(String(row[8]).trim().replace(/,/g, "")) || 0
            const receivedQty = parseFloat(String(row[25]).trim().replace(/,/g, "")) || 0

            const existing = receivingMap.get(indentNo) || { totalLiftedQty: 0, totalReceivedQty: 0 }
            receivingMap.set(indentNo, {
              totalLiftedQty: existing.totalLiftedQty + liftingQty,
              totalReceivedQty: existing.totalReceivedQty + receivedQty
            })
          }
        })
      }

      if (cancelJson.success && Array.isArray(cancelJson.data)) {
        const orders: any[] = []

        cancelJson.data.slice(1).forEach((row: any, index: number) => { // Skip header row
          if (row && row.length > 0) {
            const actualRowIndex = index + 2
            const indentNo = row[1] || ""
            const cancelQty = parseFloat(String(row[6]).trim().replace(/,/g, "")) || 0

            // Get FMS and Receiving values
            const fmsData = fmsMap.get(String(indentNo).trim()) || { poQty: 0 }
            const recData = receivingMap.get(String(indentNo).trim()) || { totalLiftedQty: 0, totalReceivedQty: 0 }

            const poQty = fmsData.poQty
            const totalLiftedQty = recData.totalLiftedQty
            const receivedQty = recData.totalReceivedQty
            const pendingQty = poQty - cancelQty - receivedQty

            const order = {
              id: `CANCEL-${actualRowIndex}`,
              rowIndex: actualRowIndex,
              timestamp: row[0] || "", // Column A - Cancelled At
              indentNo: indentNo, // Column B - Indent-No.
              poNumber: row[2] || "", // Column C - PO Number
              itemName: row[3] || "", // Column D - Item-Name
              cancelStage: row[4] || "", // Column E - Cancel Stage
              cancelReason: row[5] || "", // Column F - Cancel Reason
              qty: cancelQty, // Column G - Qty (Canceled Qty)
              poQty,
              totalLiftedQty,
              receivedQty,
              pendingQty,
              fullRowData: row,
            }
            orders.push(order)
          }
        })

        setCancelledOrders(orders)
      } else {
        throw new Error(cancelJson.error || "Failed to fetch cancellation logs")
      }
    } catch (err: any) {
      console.error("Error fetching cancelled orders data:", err)
      setError(err.message)
      setCancelledOrders([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCancelStages = async () => {
    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI || ""

      const response = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`)
      if (!response.ok) return

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        const options: string[] = []
        json.data.slice(1).forEach((row: any) => { // Row 2 onwards
          if (row && row[17]) {
            options.push(String(row[17]).trim())
          }
        })
        let uniqueOptions = [...new Set(options)].filter(Boolean)
        if (uniqueOptions.length === 0) {
          uniqueOptions = [
            "Create Indent",
            "Indent Approval",
            "Quotation",
            "Approved Vendor",
            "Make PO",
            "Payment",
            "Follow UP / Lifting",
            "Transporter Follow-Up",
            "Material Received",
            "Billing",
            "Purchase Return",
            "Order Cancel"
          ]
        }
        setStageOptions(uniqueOptions)
      }
    } catch (err) {
      console.error("Error fetching cancel stages from Dropdown:", err)
    }
  }

  const fetchDropdownItems = async () => {
    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI || ""

      const response = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`)
      if (!response.ok) return

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        const items = json.data.slice(1)
          .map((row: any) => String(row[4] || "").trim())
          .filter(Boolean)
        const uniqueItems = Array.from(new Set(items)) as string[]
        setDropdownItemsList(uniqueItems)
      }
    } catch (err) {
      console.error("Error fetching items from Dropdown sheet:", err)
    }
  }

  useEffect(() => {
    fetchCancelledOrders()
    fetchCancelStages()
    fetchDropdownItems()
  }, [])

  // Filter orders based on search term
  const filteredCancelledOrders = useMemo(() => {
    if (!searchTerm) return cancelledOrders

    return cancelledOrders.filter((order) => {
      return (
        (order.indentNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.poNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.itemName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelStage || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelReason || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.qty || "").toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [cancelledOrders, searchTerm])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please select or enter a search query")
      return
    }

    setSearchLoading(true)
    setSearchResults([])
    setSelectedSearchRowIds([])

    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI || ""

      // Fetch INDENT-LIFT and RECEIVING-ACCOUNTS in parallel
      const [fmsRes, receivingRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`)
      ])

      if (!fmsRes.ok) throw new Error(`HTTP error! status: ${fmsRes.status}`)
      if (!receivingRes.ok) throw new Error(`HTTP error! status: ${receivingRes.status}`)

      const fmsJson = await fmsRes.json()
      const receivingJson = await receivingRes.json()

      // Process RECEIVING-ACCOUNTS to group by Indent Number
      // We want to map Indent-No -> { receivedQty: sum(Column Z/index 25), invoiceNos: string[] }
      const recMap = new Map<string, { receivedQty: number; invoiceNos: string[] }>()
      if (receivingJson.success && Array.isArray(receivingJson.data)) {
        receivingJson.data.slice(6).forEach((row: any) => {
          if (row && row[1]) {
            const indentNo = String(row[1]).trim()
            const recQty = parseFloat(String(row[25]).trim().replace(/,/g, "")) || 0
            const invNo = String(row[24] || "").trim()

            const existing = recMap.get(indentNo) || { receivedQty: 0, invoiceNos: [] }
            const newInvNos = [...existing.invoiceNos]
            if (invNo && invNo !== "—" && invNo !== "-" && !newInvNos.includes(invNo)) {
              newInvNos.push(invNo)
            }
            recMap.set(indentNo, {
              receivedQty: existing.receivedQty + recQty,
              invoiceNos: newInvNos
            })
          }
        })
      }

      if (fmsJson.success && Array.isArray(fmsJson.data)) {
        const query = searchQuery.toLowerCase().trim()
        const results: any[] = []

        // Skip headers and first 6 indices
        fmsJson.data.slice(6).forEach((row: any, index: number) => {
          if (row && row.length > 0) {
            const indentNumber = String(row[1] || "").trim()
            const poNumber = String(row[54] || "").trim()
            const itemName = String(row[4] || "").trim()

            if (!indentNumber) return

            let isMatch = false
            if (searchType === "indent-no") {
              isMatch = indentNumber.toLowerCase().includes(query)
            } else if (searchType === "po-number") {
              isMatch = poNumber.toLowerCase().includes(query)
            } else if (searchType === "item-name") {
              isMatch = itemName.toLowerCase().includes(query)
            }

            if (isMatch) {
              // approvedQty is index 14. Fallback to indent qty index 5 if empty or not a number.
              const approvedQtyVal = parseFloat(String(row[14]).trim().replace(/,/g, ""))
              const indentQtyVal = parseFloat(String(row[5]).trim().replace(/,/g, ""))
              const poQty = !isNaN(approvedQtyVal) ? approvedQtyVal : (!isNaN(indentQtyVal) ? indentQtyVal : 0)

              // Get Received Qty & Invoice Numbers from RECEIVING-ACCOUNTS
              const recData = recMap.get(indentNumber) || { receivedQty: 0, invoiceNos: [] }
              const receivedQty = recData.receivedQty
              const invoiceNo = recData.invoiceNos.length > 0 ? recData.invoiceNos.join(", ") : "—"

              // Calculate Remaining Qty = PO Qty - Received Qty
              const remainingQty = poQty - receivedQty

              results.push({
                id: `lift-${index}`,
                indentNumber,
                poNumber: poNumber || "—",
                itemName,
                invoiceNo,
                poQty,
                receivedQty,
                remainingQty: remainingQty >= 0 ? remainingQty : 0
              })
            }
          }
        })

        setSearchResults(results)
        if (results.length === 0) {
          toast.info("No matching records found")
        }
      } else {
        throw new Error(fmsJson.error || "Failed to fetch search results")
      }
    } catch (err: any) {
      console.error("Error during FMS search:", err)
      toast.error(`Search error: ${err.message}`)
    } finally {
      setSearchLoading(false)
    }
  }

  const submitCancellation = async () => {
    if (selectedSearchRowIds.length === 0) {
      toast.error("Please select at least one record to cancel")
      return
    }
    if (!cancelStage || !cancelReason) {
      toast.error("Please fill all required fields")
      return
    }

    const selectedRows = searchResults.filter(row => selectedSearchRowIds.includes(row.id))

    // Validate that each selected row has a valid cancel quantity
    for (const row of selectedRows) {
      const q = cancelQuantities[row.id] ?? row.remainingQty
      const cancelNum = Number(q)
      if (isNaN(cancelNum) || cancelNum <= 0) {
        toast.error(`Please enter a valid cancellation quantity for Indent: ${row.indentNumber}`)
        return
      }
      if (cancelNum > row.remainingQty) {
        toast.error(`Cancel quantity (${cancelNum}) cannot exceed remaining quantity (${row.remainingQty}) for Indent: ${row.indentNumber}`)
        return
      }
    }

    setSubmitting(true)

    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI || ""

      const today = new Date()
      const timestamp = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')} ${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:${today.getSeconds().toString().padStart(2, '0')}`

      const promises = selectedRows.map(async (row) => {
        const formData = new FormData()
        formData.append("sheetName", SHEET_NAME)
        formData.append("action", "insert")

        const rowQty = cancelQuantities[row.id] ?? row.remainingQty

        const rowData = [
          timestamp,                // A - Cancelled At
          row.indentNumber,         // B - Indent-No.
          row.poNumber || "—",      // C - PO Number
          row.itemName,             // D - Item-Name
          cancelStage,              // E - Cancel Stage
          cancelReason,             // F - Cancel Reason
          rowQty,                   // G - Qty
        ]

        formData.append("rowData", JSON.stringify(rowData))

        const response = await fetch(SHEET_API_URL, {
          method: "POST",
          mode: "cors",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        let result
        try {
          const responseText = await response.text()
          result = JSON.parse(responseText)
        } catch (parseError) {
          result = { success: true }
        }

        if (result.success === false) {
          throw new Error(result.error || "Cancellation failed")
        }
        return result
      })

      await Promise.all(promises)

      // Reset form
      setSearchQuery("")
      setSearchResults([])
      setSelectedSearchRowIds([])
      setCancelStage("")
      setCancelReason("")
      setCancelQuantities({})
      setIsDialogOpen(false)

      // Refresh the list
      await fetchCancelledOrders()

      toast.success(`Successfully cancelled ${selectedRows.length} record(s)`)
    } catch (err: any) {
      console.error("Error submitting cancellation:", err)
      toast.error(`Error cancelling order: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewCancellation = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedSearchRowIds([])
    setCancelStage("")
    setCancelReason("")
    setCancelQuantities({})
    setIsDialogOpen(true)
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchCancelledOrders()
      await fetchCancelStages()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }



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
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 rounded-lg text-white shadow-xl">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Order Cancel</h2>
            <p className="text-[13px] text-muted-foreground mt-0">Manage and track cancelled orders</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search cancelled orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 shadow-sm focus:ring-red-500 focus:border-red-500 rounded-lg h-10"
            />
          </div>
          <Button variant="outline" onClick={handleRefresh} size="icon" className="bg-white shadow-sm hover:bg-slate-50 border-slate-200 h-10 w-10 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNewCancellation} className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg h-10 px-4 shadow-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Cancel Order
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white overflow-hidden ring-1 ring-slate-200 rounded-xl">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
          <div className="flex flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                Cancellation Logs
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
              {filteredCancelledOrders.length} RECORDS FOUND
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto relative custom-scrollbar">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancelled At</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Indent-No.</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">PO Number</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Item-Name</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Stage</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Reason</TableHead>
                  <TableHead className="w-[80px] text-center font-bold text-slate-700 uppercase text-[10px]">PO Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Total Lifted Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Received Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Canceled Qty</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Pending Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                        <span className="text-slate-500 font-medium">Loading cancelled orders...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCancelledOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                      <TableCell className="text-[11px] text-slate-500 font-mono py-4">
                        {parseGoogleSheetsDate(order.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 py-4">
                        {order.indentNo}
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-slate-600 py-4">
                        {order.poNumber}
                      </TableCell>
                      <TableCell className="text-slate-700 py-4 max-w-[200px] truncate" title={order.itemName}>
                        {order.itemName}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200">{order.cancelStage}</Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant={
                            order.cancelReason === "Customer Request"
                              ? "default"
                              : order.cancelReason === "Quality Issues"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {order.cancelReason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.poQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.totalLiftedQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.receivedQty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.qty}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4">
                        {order.pendingQty}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {!loading && filteredCancelledOrders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="text-center text-muted-foreground h-32"
                    >
                      {searchTerm
                        ? "No orders match your search criteria"
                        : "No cancelled orders found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Order Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
            {/* Search Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="md:col-span-4 space-y-1.5">
                <Label htmlFor="searchType">Search By</Label>
                <Select
                  value={searchType}
                  onValueChange={(val: any) => {
                    setSearchType(val)
                    setSearchQuery("")
                    setSearchResults([])
                    setSelectedSearchRowIds([])
                  }}
                >
                  <SelectTrigger className="bg-white border-slate-200">
                    <SelectValue placeholder="Search parameter" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-md">
                    <SelectItem value="indent-no">Indent-No.</SelectItem>
                    <SelectItem value="po-number">PO Number</SelectItem>
                    <SelectItem value="item-name">Item-Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <Label>Search Value *</Label>
                {searchType === "item-name" ? (
                  <ItemCombobox
                    value={searchQuery}
                    onChange={(val) => setSearchQuery(val)}
                    options={dropdownItemsList}
                  />
                ) : (
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      searchType === "indent-no"
                        ? "Enter Indent Number (e.g. IN-...)"
                        : "Enter PO Number"
                    }
                    className="bg-white border-slate-200"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium flex items-center justify-center gap-2 h-10"
                >
                  {searchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {/* Results Table Section */}
            {searchLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                <span className="text-sm text-slate-500 font-medium">Searching FMS Sheet...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Search Results ({searchResults.length} found)
                  </h4>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                    {selectedSearchRowIds.length} Selected
                  </Badge>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-12 text-center">
                          <Checkbox
                            checked={
                              searchResults.length > 0 &&
                              selectedSearchRowIds.length === searchResults.length
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSearchRowIds(searchResults.map(r => r.id))
                              } else {
                                setSelectedSearchRowIds([])
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">Indent No.</TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">PO Number</TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">Item Name</TableHead>
                        <TableHead className="text-xs uppercase font-semibold text-slate-600">Invoice No.</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">PO Qty</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">Received Qty</TableHead>
                        <TableHead className="text-center text-xs uppercase font-semibold text-slate-600">Remaining Qty</TableHead>
                        <TableHead className="w-[120px] text-center text-xs uppercase font-semibold text-slate-600">Qty to Cancel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((row) => (
                        <TableRow
                          key={row.id}
                          className={cn(
                            "hover:bg-slate-50/50 transition-colors border-b border-slate-100",
                            selectedSearchRowIds.includes(row.id) && "bg-red-50/20"
                          )}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedSearchRowIds.includes(row.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSearchRowIds(prev => [...prev, row.id])
                                } else {
                                  setSelectedSearchRowIds(prev => prev.filter(id => id !== row.id))
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs text-slate-900">{row.indentNumber}</TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-500">{row.poNumber}</TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-[150px] truncate" title={row.itemName}>
                            {row.itemName}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 max-w-[120px] truncate" title={row.invoiceNo}>
                            {row.invoiceNo}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-700">{row.poQty}</TableCell>
                          <TableCell className="text-center text-xs text-slate-700">{row.receivedQty}</TableCell>
                          <TableCell className="text-center text-xs text-slate-700 font-semibold">{row.remainingQty}</TableCell>
                          <TableCell className="text-center py-1">
                            <Input
                              type="number"
                              min="1"
                              max={isNaN(Number(row.remainingQty)) ? undefined : Number(row.remainingQty)}
                              value={cancelQuantities[row.id] ?? row.remainingQty}
                              onChange={(e) => {
                                const val = e.target.value
                                setCancelQuantities(prev => ({
                                  ...prev,
                                  [row.id]: val
                                }))
                              }}
                              className={cn(
                                "w-20 text-center h-8 bg-white border-slate-200 focus-visible:ring-red-500 mx-auto",
                                Number(cancelQuantities[row.id] ?? row.remainingQty) > row.remainingQty && "border-destructive text-destructive focus-visible:ring-destructive focus:border-destructive"
                              )}
                              placeholder="Qty"
                              disabled={!selectedSearchRowIds.includes(row.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : searchQuery.trim() && !searchLoading ? (
              <div className="text-center py-6 text-sm text-slate-500 border border-dashed rounded-lg">
                No search results yet. Click Search to retrieve matching rows.
              </div>
            ) : null}

            {/* Cancellation Details Form (Visible only when rows are selected) */}
            {selectedSearchRowIds.length > 0 && (
              <div className="border border-red-100 bg-red-50/10 p-5 rounded-lg space-y-4 animate-in slide-in-from-top-4 duration-300">
                <h4 className="text-sm font-semibold text-red-900 border-b pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full" />
                  Cancellation Details for {selectedSearchRowIds.length} Selected Item(s)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cancelStage">Order Cancel Stage *</Label>
                    <Select value={cancelStage} onValueChange={setCancelStage}>
                      <SelectTrigger className="bg-white border-slate-200">
                        <SelectValue placeholder="Select cancel stage" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-md">
                        {stageOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cancelReason">Order Cancel Reason *</Label>
                    <Input
                      id="cancelReason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Enter cancel reason description"
                      className="bg-white border-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t pt-4 flex justify-end gap-2 bg-white">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCancellation}
              disabled={
                selectedSearchRowIds.length === 0 ||
                !cancelStage ||
                !cancelReason ||
                submitting ||
                selectedSearchRowIds.some(id => {
                  const q = cancelQuantities[id] ?? searchResults.find(r => r.id === id)?.remainingQty
                  const numQ = Number(q)
                  const remaining = searchResults.find(r => r.id === id)?.remainingQty || 0
                  return !q || isNaN(numQ) || numQ <= 0 || numQ > remaining
                })
              }
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                `Cancel ${selectedSearchRowIds.length} Order(s)`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
  )
}