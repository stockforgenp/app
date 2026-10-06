/**
 * Vendors Management View
 * Dedicated section for supplier and vendor management.
 * Tracks contact details, PAN/VAT registration, supplied products, and purchase history.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  FileText,
  Package,
  DollarSign,
  Printer,
} from "lucide-react";
import { Vendor, Product, Purchase } from "../types/index.ts";
import {
  getAllVendors,
  deleteVendor,
  getVendorProducts,
  getVendorPurchases,
} from "../lib/services/vendorService.ts";
import { formatCurrency, formatDate } from "../lib/utils/format.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { PrintPurchaseBillModal } from "../components/common/PrintPurchaseBillModal.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getVendorColumns } from "../columns/index.ts";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { useLanguage } from "../context/LanguageContext.tsx";
import { NewVendorForm } from "../components/forms/NewVendorForm.tsx";

interface VendorsViewProps {
  currencySymbol: string;
  onNavigateToProducts?: () => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();
  const { isNepali, formatNumberByLang } = useLanguage();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [copiedPan, setCopiedPan] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  // Supplied products inspect modal
  const [inspectVendor, setInspectVendor] = useState<Vendor | null>(null);
  const [inspectProducts, setInspectProducts] = useState<Product[]>([]);

  // Vendor purchase bills inspect modal
  const [inspectPurchasesVendor, setInspectPurchasesVendor] =
    useState<Vendor | null>(null);
  const [inspectPurchases, setInspectPurchases] = useState<Purchase[]>([]);

  // Print purchase bill modal
  const [printPurchaseId, setPrintPurchaseId] = useState<number | null>(null);
  const [isPrintPurchaseModalOpen, setIsPrintPurchaseModalOpen] =
    useState(false);

  const loadVendors = useCallback(() => {
    try {
      setVendors(getAllVendors());
    } catch (e) {
      console.error("Error fetching vendors:", e);
    }
  }, []);

  useEffect(() => {
    loadVendors();
    const unsubscribe = subscribeToDbChanges(loadVendors);
    return unsubscribe;
  }, [loadVendors]);

  const handleOpenCreate = () => {
    setEditingVendor(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setIsFormModalOpen(true);
  };

  const handleViewProducts = (v: Vendor) => {
    try {
      const prods = getVendorProducts(v.id);
      setInspectProducts(prods);
      setInspectVendor(v);
    } catch (e) {
      console.error("Error fetching vendor products:", e);
    }
  };

  const handleViewPurchases = (v: Vendor) => {
    try {
      const purchases = getVendorPurchases(v.id);
      setInspectPurchases(purchases);
      setInspectPurchasesVendor(v);
    } catch (e) {
      console.error("Error fetching vendor purchases:", e);
    }
  };

  const handlePrintPurchaseBill = (purchaseId: number) => {
    setPrintPurchaseId(purchaseId);
    setIsPrintPurchaseModalOpen(true);
  };

  const handleCopyPan = (pan: string) => {
    navigator.clipboard.writeText(pan);
    setCopiedPan(pan);
    showToast(
      isNepali
        ? "PAN/VAT नम्बर प्रतिलिपि गरियो"
        : "PAN/VAT copied to clipboard",
      "info",
    );
    setTimeout(() => setCopiedPan(null), 2000);
  };

  const handleConfirmDelete = () => {
    if (!deletingVendor) return;
    try {
      deleteVendor(deletingVendor.id);
      showToast(
        isNepali
          ? `आपूर्तिकर्ता "${deletingVendor.name}" हटाइयो`
          : `Vendor "${deletingVendor.name}" deleted successfully`,
        "success",
      );
      loadVendors();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    } finally {
      setDeletingVendor(null);
    }
  };

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.pan_vat && v.pan_vat.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.address && v.address.toLowerCase().includes(q)),
    );
  }, [vendors, search]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalCount = vendors.length;
    const withPanCount = vendors.filter(
      (v) => !!v.pan_vat && v.pan_vat.trim() !== "",
    ).length;
    const totalProducts = vendors.reduce(
      (acc, v) => acc + (v.product_count || 0),
      0,
    );
    const totalPurchasedMinor = vendors.reduce(
      (acc, v) => acc + (v.total_purchased || 0),
      0,
    );

    return {
      totalCount,
      withPanCount,
      totalProducts,
      totalPurchasedMinor,
    };
  }, [vendors]);

  const vendorColumns = useMemo<Column<Vendor>[]>(
    () =>
      getVendorColumns({
        isNepali,
        currencySymbol,
        copiedPan,
        formatNumberByLang,
        onCopyPan: handleCopyPan,
        onViewProducts: handleViewProducts,
        onViewPurchases: handleViewPurchases,
        onEdit: handleOpenEdit,
        onDelete: (v) => setDeletingVendor(v),
        onCopyPhone: (phone) => {
          navigator.clipboard.writeText(phone);
          showToast(isNepali ? "फोन नं. कपी गरियो" : "Phone copied", "info");
        },
      }),
    [isNepali, currencySymbol, copiedPan, formatNumberByLang, showToast],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150 p-8">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-neutral-400">
              {isNepali ? "कुल आपूर्तिकर्ताहरू" : "Total Vendors"}
            </p>
            <h3 className="text-2xl font-bold text-neutral-100 mt-1">
              {formatNumberByLang(metrics.totalCount)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-neutral-400">
              {isNepali ? "PAN / VAT दर्ता भएका" : "PAN/VAT Registered"}
            </p>
            <h3 className="text-2xl font-bold text-sky-400 mt-1">
              {formatNumberByLang(metrics.withPanCount)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-neutral-400">
              {isNepali ? "सम्बन्धित सामानहरू" : "Supplied Items"}
            </p>
            <h3 className="text-2xl font-bold text-amber-400 mt-1">
              {formatNumberByLang(metrics.totalProducts)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-medium text-neutral-400">
              {isNepali ? "कुल खरिद रकम" : "Total Purchased"}
            </p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">
              {formatCurrency(metrics.totalPurchasedMinor, currencySymbol)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Unified Shared DataTable with Search, Sorting, and Pagination */}
      <DataTable<Vendor>
        data={filteredVendors}
        columns={vendorColumns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isNepali
            ? "आपूर्तिकर्ताको नाम, PAN/VAT, फोन वा ठेगाना खोज्नुहोस्..."
            : "Search vendors by name, PAN/VAT, phone, address..."
        }
        extraActionsSlot={
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {isNepali ? "नयाँ आपूर्तिकर्ता थप्नुहोस्" : "Add Vendor"}
            </span>
          </button>
        }
        emptyIcon={Building2}
        emptyTitle={
          search
            ? isNepali
              ? "कुनै आपूर्तिकर्ता भेटिएन"
              : "No matching vendors found"
            : isNepali
              ? "कुनै आपूर्तिकर्ता दर्ता गरिएको छैन"
              : "No vendors registered yet"
        }
        emptyMessage={
          search
            ? isNepali
              ? "कृपया अन्य खोज शब्द प्रयोग गर्नुहोस्"
              : "Try adjusting your search criteria"
            : isNepali
              ? "सामान थप्दा वा यहाँबाट नयाँ आपूर्तिकर्ता जोड्न सक्नुहुन्छ"
              : "Add vendors when purchasing products or create one directly here"
        }
        emptyAction={
          !search ? (
            <button
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isNepali ? "पहिलो आपूर्तिकर्ता थप्नुहोस्" : "Add First Vendor"}
              </span>
            </button>
          ) : undefined
        }
        enablePagination={true}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Add / Edit Vendor Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={
          editingVendor
            ? isNepali
              ? "आपूर्तिकर्ता सम्पादन गर्नुहोस्"
              : "Edit Vendor Details"
            : isNepali
              ? "नयाँ आपूर्तिकर्ता थप्नुहोस्"
              : "Add New Vendor"
        }
      >
        <NewVendorForm
          editingVendor={editingVendor}
          onClose={() => setIsFormModalOpen(false)}
          loadVendors={loadVendors}
        />
      </Modal>

      {/* Inspect Supplied Products Modal */}
      <Modal
        isOpen={!!inspectVendor}
        onClose={() => setInspectVendor(null)}
        title={
          inspectVendor
            ? `${isNepali ? "आपूर्तिकर्ताका सामानहरू" : "Supplied Products"} — ${inspectVendor.name}`
            : "Supplied Products"
        }
      >
        <div className="space-y-4">
          <div className="bg-neutral-850 p-3 rounded-lg border border-neutral-800 flex items-center justify-between text-xs">
            <div>
              <p className="text-neutral-400">
                {isNepali ? "PAN / VAT" : "Tax ID"}
              </p>
              <p className="font-mono text-neutral-200 mt-0.5">
                {inspectVendor?.pan_vat || "—"}
              </p>
            </div>
            {inspectVendor?.phone && (
              <div>
                <p className="text-neutral-400">
                  {isNepali ? "सम्पर्क" : "Phone"}
                </p>
                <p className="text-neutral-200 mt-0.5">{inspectVendor.phone}</p>
              </div>
            )}
            <div>
              <p className="text-neutral-400">
                {isNepali ? "जम्मा सामान" : "Items Count"}
              </p>
              <p className="text-neutral-200 font-semibold mt-0.5">
                {formatNumberByLang(inspectProducts.length)}
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-800">
            {inspectProducts.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs">
                {isNepali
                  ? "यस आपूर्तिकर्तासँग जोडिएका कुनै सामान फेला परेन।"
                  : "No products currently mapped to this vendor."}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">
                      {isNepali ? "सामानको नाम" : "Product"}
                    </th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "लागत मूल्य" : "Cost Price"}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "बिक्री मूल्य" : "Selling Price"}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "मौज्दात" : "Stock"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {inspectProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-850/50">
                      <td className="px-3 py-2 font-medium text-neutral-100">
                        {p.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-400">
                        {p.sku || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-300">
                        {formatCurrency(p.cost_price, currencySymbol)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-medium">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-200">
                        {formatNumberByLang(p.current_stock)} {p.unit || "pcs"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setInspectVendor(null)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Inspect Purchase Bills Modal */}
      <Modal
        isOpen={!!inspectPurchasesVendor}
        onClose={() => setInspectPurchasesVendor(null)}
        title={
          inspectPurchasesVendor
            ? `${isNepali ? "खरिद बिलहरू" : "Purchase Bills"} — ${inspectPurchasesVendor.name}`
            : "Purchase Bills"
        }
      >
        <div className="space-y-4">
          <div className="bg-neutral-850 p-3 rounded-lg border border-neutral-800 flex items-center justify-between text-xs">
            <div>
              <p className="text-neutral-400">
                {isNepali ? "PAN / VAT" : "Tax ID"}
              </p>
              <p className="font-mono text-neutral-200 mt-0.5">
                {inspectPurchasesVendor?.pan_vat || "—"}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">
                {isNepali ? "खरिद बीजक संख्या" : "Total Bills"}
              </p>
              <p className="text-neutral-200 font-semibold mt-0.5">
                {formatNumberByLang(inspectPurchases.length)}
              </p>
            </div>
            <div>
              <p className="text-neutral-400">
                {isNepali ? "कुल खरिद रकम" : "Total Purchased"}
              </p>
              <p className="text-emerald-400 font-semibold mt-0.5">
                {formatCurrency(
                  inspectPurchasesVendor?.total_purchased || 0,
                  currencySymbol,
                )}
              </p>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-800">
            {inspectPurchases.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-xs">
                {isNepali
                  ? "यस आपूर्तिकर्ताको कुनै खरिद बिल फेला परेन।"
                  : "No purchase bills recorded for this vendor yet."}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">
                      {isNepali ? "बिल नं" : "Bill #"}
                    </th>
                    <th className="px-3 py-2">
                      {isNepali ? "सप्लायर बीजक" : "Supplier Inv"}
                    </th>
                    <th className="px-3 py-2">{isNepali ? "मिति" : "Date"}</th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "सामान" : "Items"}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "कुल रकम" : "Grand Total"}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {isNepali ? "प्रिन्ट" : "Action"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {inspectPurchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-neutral-850/50">
                      <td className="px-3 py-2 font-mono text-emerald-400 font-medium">
                        {pur.bill_number ||
                          `PUR-${pur.id.toString().padStart(5, "0")}`}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-400">
                        {pur.invoice_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-neutral-300">
                        {formatDate(pur.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-300">
                        {formatNumberByLang(pur.item_count || 1)} (
                        {formatNumberByLang(pur.total_units || 0)}{" "}
                        {isNepali ? "थान" : "units"})
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-semibold font-mono">
                        {formatCurrency(
                          pur.grand_total ?? pur.total,
                          currencySymbol,
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handlePrintPurchaseBill(pur.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer text-[11px]"
                          title={
                            isNepali
                              ? "बिल पुन: प्रिन्ट गर्नुहोस्"
                              : "Reprint GRN Bill"
                          }
                        >
                          <Printer className="w-3 h-3 text-emerald-400" />
                          <span>{isNepali ? "प्रिन्ट" : "Print"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setInspectPurchasesVendor(null)}
              className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Print Purchase Bill Modal */}
      <PrintPurchaseBillModal
        isOpen={isPrintPurchaseModalOpen}
        onClose={() => setIsPrintPurchaseModalOpen(false)}
        purchaseId={printPurchaseId}
        currencySymbol={currencySymbol}
      />

      {/* Delete Vendor Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingVendor}
        title={isNepali ? "आपूर्तिकर्ता मेटाउने पुष्टि" : "Delete Vendor"}
        message={
          isNepali
            ? `के तपाईं निश्चित हुनुहुन्छ कि आपूर्तिकर्ता "${deletingVendor?.name}" मेटाउन चाहनुहुन्छ? सम्बन्धित सामानहरू मेटिने छैनन् तर आपूर्तिकर्ताको नाम अनलिंक हुनेछ।`
            : `Are you sure you want to delete vendor "${deletingVendor?.name}"? Linked products will not be deleted, but vendor association will be cleared.`
        }
        confirmText={isNepali ? "मेटाउनुहोस्" : "Delete"}
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingVendor(null)}
      />
    </div>
  );
};
