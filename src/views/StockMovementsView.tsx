/**
 * Stock Movements Audit Log View
 * Dedicated page for tracking all inventory inflows and outflows:
 * Restocks, Sales, Manual count adjustments, and Purchase deliveries.
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  History,
  Boxes,
  Building2,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { StockMovement, Vendor } from "../types/index.ts";
import { getStockMovements } from "../lib/services/inventoryService.ts";
import { getAllVendors } from "../lib/services/vendorService.ts";
import { Input } from "../components/common/Input.tsx";
import { Select } from "../components/common/Select.tsx";
import { DateFilterBar } from "../components/common/DateFilterBar.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getStockMovementColumns } from "../columns/index.ts";
import { DatePreset } from "../lib/utils/dateFilters.ts";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { useLanguage } from "../context/LanguageContext.tsx";

interface StockMovementsViewProps {
  currencySymbol: string;
}

export const StockMovementsView: React.FC<StockMovementsViewProps> = () => {
  const { isNepali, formatNumberByLang } = useLanguage();

  // Movements Data & Master Data
  const [movementsList, setMovementsList] = useState<StockMovement[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("ALL");

  const loadVendors = () => {
    try {
      setVendors(getAllVendors());
    } catch (e) {
      console.error("Error loading vendors:", e);
    }
  };

  const loadMovements = () => {
    try {
      setMovementsList(
        getStockMovements({
          vendorId:
            selectedVendorId !== "all" ? Number(selectedVendorId) : undefined,
          type: movementTypeFilter !== "ALL" ? movementTypeFilter : undefined,
          startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
          search: search.trim() || undefined,
        }),
      );
    } catch (e) {
      console.error("Error loading movements:", e);
    }
  };

  useEffect(() => {
    loadVendors();
    loadMovements();
    const unsubscribe = subscribeToDbChanges(() => {
      loadVendors();
      loadMovements();
    });
    return unsubscribe;
  }, [selectedVendorId, movementTypeFilter, startDate, endDate, search]);

  // Aggregate KPI metrics
  const movementStats = useMemo(() => {
    let restockUnits = 0;
    let saleUnits = 0;
    let adjustmentEvents = 0;

    for (const m of movementsList) {
      if (m.type === "RESTOCK" || m.type === "PURCHASE") {
        restockUnits += Math.max(0, m.quantity);
      } else if (m.type === "SALE") {
        saleUnits += Math.abs(m.quantity);
      } else if (m.type === "ADJUSTMENT") {
        adjustmentEvents++;
      }
    }

    return {
      totalMovements: movementsList.length,
      restockUnits,
      saleUnits,
      adjustmentEvents,
    };
  }, [movementsList]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    selectedVendorId !== "all" ||
    movementTypeFilter !== "ALL" ||
    datePreset !== "all" ||
    startDate ||
    endDate,
  );

  const handleClearFilters = () => {
    setSearch("");
    setSelectedVendorId("all");
    setMovementTypeFilter("ALL");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  const movementColumns = useMemo<Column<StockMovement>[]>(
    () => getStockMovementColumns({ isNepali, formatNumberByLang }),
    [isNepali, formatNumberByLang],
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>
              {isNepali
                ? "चलान तथा मौज्दात इतिहास"
                : "Stock Movement Audit Log"}
            </span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isNepali
              ? "सामानको खरिद, बिक्री, पुनः मौज्दात र समायोजनको सम्पूर्ण चलान अभिलेख"
              : "Complete immutable audit trail of all restocks, sales, count recounts, and deliveries"}
          </p>
        </div>

        {/* Link back to Products Catalog */}
        <Link
          to="/inventory"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
        >
          <Boxes className="w-4 h-4 text-emerald-400" />
          <span>
            {isNepali ? "सामान सूची (Product Catalog)" : "Product Catalog"}
          </span>
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "कुल चलान कारोबारहरू" : "Total Logged Movements"}
            </p>
            <p className="text-2xl font-bold text-neutral-100 mt-1">
              {formatNumberByLang(movementStats.totalMovements)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "दाखिला / पुनः मौज्दात" : "Total Stock Inflow"}
            </p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              +{formatNumberByLang(movementStats.restockUnits)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "बिक्री निकासी (एकाइ)" : "Total Sales Outflow"}
            </p>
            <p className="text-2xl font-bold text-sky-400 mt-1">
              -{formatNumberByLang(movementStats.saleUnits)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "भौतिक मौज्दात मिलान" : "Count Adjustments"}
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {formatNumberByLang(movementStats.adjustmentEvents)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Rich Filtering Toolbar */}
      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5">
            <Input
              type="text"
              placeholder={
                isNepali
                  ? "चलान इतिहास खोज्नुहोस् (सामान, आपूर्तिकर्ता, कैफियत)..."
                  : "Search movements by product, supplier, or audit note..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
              clearable
              onClear={() => setSearch("")}
              className="py-2 text-xs"
            />
          </div>

          {/* Vendor Filter Dropdown */}
          <div className="md:col-span-4">
            <Select
              icon={Building2}
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              options={[
                {
                  value: "all",
                  label: `🏢 ${isNepali ? "सबै आपूर्तिकर्ताहरू (All Vendors)" : "All Vendors / Suppliers"}`,
                },
                ...vendors.map((v) => ({
                  value: String(v.id),
                  label: `${v.name} ${v.pan_vat ? `(PAN: ${v.pan_vat})` : ""}`,
                })),
              ]}
            />
          </div>

          {/* Movement Type Filter */}
          <div className="md:col-span-3">
            <Select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              options={[
                {
                  value: "ALL",
                  label: isNepali
                    ? "सबै चलान प्रकार (All)"
                    : "All Movement Types",
                },
                { value: "RESTOCK", label: "RESTOCK (Manual / Delivery)" },
                { value: "PURCHASE", label: "PURCHASE (Supplier Order)" },
                { value: "SALE", label: "SALE (Customer Order)" },
                { value: "ADJUSTMENT", label: "ADJUSTMENT (Count Recount)" },
              ]}
            />
          </div>
        </div>

        {/* Row 2: Standard DateFilterBar */}
        <div className="pt-2 border-t border-neutral-800/80">
          <DateFilterBar
            preset={datePreset}
            onPresetChange={(p, start, end) => {
              setDatePreset(p);
              setStartDate(start);
              setEndDate(end);
            }}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClearFilters}
          />
        </div>
      </div>

      {/* Movement Log Table */}
      <DataTable<StockMovement>
        data={movementsList}
        columns={movementColumns}
        showSearch={false}
        getRowId={(m) => m.id}
        emptyIcon={History}
        emptyTitle={
          isNepali
            ? "कुनै चलान रेकर्ड फेला परेन।"
            : "No stock movements found matching filter criteria."
        }
        emptyMessage={
          isNepali
            ? "फिल्टर रिसेट गरेर पुनः प्रयास गर्नुहोस्।"
            : "Try resetting date, vendor, or type filters."
        }
      />
    </div>
  );
};
