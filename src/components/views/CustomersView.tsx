/**
 * Customers Management View
 * Dedicated section for customer management.
 * Tracks contact details, PAN/VAT registration, repeat orders, and total expenditure.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  MapPin,
  ShoppingBag,
  DollarSign,
  Copy,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Receipt,
  Eye,
  UserCheck,
  Calendar,
} from "lucide-react";
import { Customer, Sale, CreateCustomerInput } from "../../types/index.ts";
import { Input } from "../common/Input.tsx";
import {
  getAllCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerSales,
} from "../../lib/services/customerService.ts";
import { formatCurrency, formatDateTime } from "../../lib/utils/format.ts";
import { Modal } from "../common/Modal.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { ActionMenu } from "../common/ActionMenu.tsx";
import { PrintBillModal } from "../common/PrintBillModal.tsx";
import { DataTable, Column } from "../common/DataTable.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";

interface CustomersViewProps {
  currencySymbol: string;
  onNavigateToSales?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  currencySymbol,
  onNavigateToSales,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [copiedPan, setCopiedPan] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null,
  );

  // Customer purchase history inspect modal
  const [inspectCustomer, setInspectCustomer] = useState<Customer | null>(null);
  const [inspectSales, setInspectSales] = useState<Sale[]>([]);

  // Print Bill Modal from history inspect
  const [printSaleId, setPrintSaleId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: "",
    phone: "",
    email: "",
    pan_vat: "",
    address: "",
    notes: "",
  });

  const loadCustomers = useCallback(() => {
    try {
      setCustomers(getAllCustomers());
    } catch (e) {
      console.error("Error fetching customers:", e);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
    const unsubscribe = subscribeToDbChanges(loadCustomers);
    return unsubscribe;
  }, [loadCustomers]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      pan_vat: "",
      address: "",
      notes: "",
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      pan_vat: c.pan_vat || "",
      address: c.address || "",
      notes: c.notes || "",
    });
    setIsFormModalOpen(true);
  };

  const handleViewSales = (c: Customer) => {
    try {
      const sales = getCustomerSales(c.id);
      setInspectSales(sales);
      setInspectCustomer(c);
    } catch (e) {
      console.error("Error fetching customer sales:", e);
    }
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

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast(
        isNepali ? "ग्राहकको नाम आवश्यक छ" : "Customer name is required",
        "warning",
      );
      return;
    }

    try {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, formData);
        showToast(
          isNepali
            ? `ग्राहक "${formData.name.trim()}" अद्यावधिक गरियो`
            : `Customer "${formData.name.trim()}" updated successfully`,
          "success",
        );
      } else {
        createCustomer(formData);
        showToast(
          isNepali
            ? `नयाँ ग्राहक "${formData.name.trim()}" सफलतापूर्वक थपियो`
            : `Customer "${formData.name.trim()}" created successfully`,
          "success",
        );
      }
      setIsFormModalOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingCustomer) return;
    try {
      deleteCustomer(deletingCustomer.id);
      showToast(
        isNepali
          ? `ग्राहक "${deletingCustomer.name}" हटाइयो`
          : `Customer "${deletingCustomer.name}" deleted successfully`,
        "success",
      );
      setDeletingCustomer(null);
      loadCustomers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.pan_vat && c.pan_vat.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalCount = customers.length;
    const repeatCount = customers.filter(
      (c) => (c.sales_count || 0) > 1,
    ).length;
    const panRegisteredCount = customers.filter((c) =>
      Boolean(c.pan_vat && c.pan_vat.trim()),
    ).length;
    const totalRevenue = customers.reduce(
      (acc, c) => acc + (c.total_spent || 0),
      0,
    );

    return {
      totalCount,
      repeatCount,
      panRegisteredCount,
      totalRevenue,
    };
  }, [customers]);

  const customerColumns = useMemo<Column<Customer>[]>(
    () => [
      {
        id: "name",
        header: isNepali ? "ग्राहक" : "Customer",
        accessor: (c) => (
          <div>
            <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{c.name}</span>
              {(c.sales_count || 0) > 1 && (
                <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.2 rounded font-medium">
                  {isNepali ? "नियमित" : "Repeat"}
                </span>
              )}
            </div>
            {c.notes && (
              <p className="text-[10px] text-neutral-500 truncate max-w-xs mt-0.5">
                {c.notes}
              </p>
            )}
          </div>
        ),
        sortable: true,
        sortKey: (c) => c.name,
      },
      {
        id: "phone",
        header: isNepali ? "सम्पर्क नम्बर" : "Phone / Mobile",
        accessor: (c) =>
          c.phone ? (
            <div className="flex items-center gap-1 text-neutral-300 font-mono">
              <Phone className="w-3 h-3 text-neutral-500" />
              <span>{c.phone}</span>
            </div>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
        sortable: true,
        sortKey: (c) => c.phone || "",
      },
      {
        id: "pan_vat",
        header: isNepali ? "PAN / VAT नम्बर" : "PAN / VAT",
        accessor: (c) =>
          c.pan_vat ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-neutral-200 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 text-[11px]">
                {c.pan_vat}
              </span>
              <button
                type="button"
                onClick={() => handleCopyPan(c.pan_vat!)}
                className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                title="Copy PAN/VAT"
              >
                {copiedPan === c.pan_vat ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
        sortable: true,
        sortKey: (c) => c.pan_vat || "",
      },
      {
        id: "address_email",
        header: isNepali ? "ठेगाना र इमेल" : "Email & Address",
        accessor: (c) => (
          <div className="space-y-0.5">
            {c.email && (
              <div className="flex items-center gap-1 text-neutral-300 truncate max-w-[200px]">
                <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{c.email}</span>
              </div>
            )}
            {c.address && (
              <div className="flex items-center gap-1 text-neutral-400 text-[11px] truncate max-w-[200px]">
                <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{c.address}</span>
              </div>
            )}
            {!c.email && !c.address && (
              <span className="text-neutral-600">—</span>
            )}
          </div>
        ),
      },
      {
        id: "sales_count",
        header: isNepali ? "कुल अर्डर" : "Orders",
        align: "center",
        accessor: (c) => (
          <button
            type="button"
            onClick={() => handleViewSales(c)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
            title={
              isNepali
                ? "बिक्री रसिदहरू हेर्नुहोस्"
                : "View purchase history receipts"
            }
          >
            <ShoppingBag className="w-3 h-3" />
            <span>{formatNumberByLang(c.sales_count || 0)}</span>
          </button>
        ),
        sortable: true,
        sortKey: (c) => c.sales_count || 0,
      },
      {
        id: "total_spent",
        header: isNepali ? "कुल कारोबार" : "Total Spent",
        align: "right",
        accessor: (c) => (
          <span className="font-mono font-medium text-emerald-400">
            {formatCurrency(c.total_spent || 0, currencySymbol)}
          </span>
        ),
        sortable: true,
        sortKey: (c) => c.total_spent || 0,
      },
      {
        id: "actions",
        header: isNepali ? "कार्य" : "Actions",
        align: "center",
        accessor: (c) => (
          <ActionMenu
            items={[
              {
                label: isNepali
                  ? "कारोबार इतिहास हेर्नुहोस्"
                  : "View Purchases",
                icon: Eye,
                onClick: () => handleViewSales(c),
              },
              {
                label: isNepali ? "सम्पादन गर्नुहोस्" : "Edit Customer",
                icon: Edit2,
                onClick: () => handleOpenEdit(c),
              },
              {
                label: isNepali ? "हटाउनुहोस्" : "Delete Customer",
                icon: Trash2,
                variant: "danger",
                onClick: () => setDeletingCustomer(c),
              },
            ]}
          />
        ),
      },
    ],
    [isNepali, currencySymbol, copiedPan, formatNumberByLang],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150 p-8">
      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Customers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "कुल ग्राहकहरू" : "Total Customers"}
            </p>
            <p className="text-2xl font-bold text-neutral-100 mt-1">
              {formatNumberByLang(stats.totalCount)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isNepali
                ? "दर्ता भएका ग्राहक संख्या"
                : "Registered customer directory"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Repeat Customers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "नियमित ग्राहकहरू" : "Repeat Customers"}
            </p>
            <p className="text-2xl font-bold text-sky-400 mt-1">
              {formatNumberByLang(stats.repeatCount)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isNepali
                ? "> १ पटक खरिद गरेका"
                : "More than 1 purchase recorded"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Tax Registered PAN Customers */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "PAN/VAT दर्ता भएका" : "PAN/VAT Registered"}
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {formatNumberByLang(stats.panRegisteredCount)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isNepali ? "कर बीजक लिन योग्य" : "Tax invoice eligible"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Total Customer Revenue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-neutral-400 font-medium">
              {isNepali ? "ग्राहक बिक्री कारोबार" : "Registered Sales Value"}
            </p>
            <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(stats.totalRevenue, currencySymbol)}
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isNepali
                ? "दर्ता भएका ग्राहकबाट कुल रकम"
                : "Total lifetime expenditure"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* Unified Shared DataTable with Search, Sorting, and Pagination */}
      <DataTable<Customer>
        data={filteredCustomers}
        columns={customerColumns}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isNepali
            ? "ग्राहकको नाम, फोन, इमेल वा PAN खोज्नुहोस्..."
            : "Search by customer name, phone, email, or PAN/VAT..."
        }
        extraActionsSlot={
          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isNepali ? "नयाँ ग्राहक थप्नुहोस्" : "Add Customer"}</span>
          </button>
        }
        emptyIcon={Users}
        emptyTitle={
          search
            ? isNepali
              ? "खोजिएको विवरण अनुसार कुनै ग्राहक भेटिएन।"
              : "No customers match your search."
            : isNepali
              ? "कुनै ग्राहक दर्ता गरिएको छैन।"
              : "No customers recorded yet."
        }
        emptyMessage={
          search
            ? undefined
            : isNepali
              ? "नयाँ बिक्री गर्दा ग्राहक विवरण लेख्नुहोस् वा माथि रहेको बटन थिच्नुहोस्।"
              : "Customers are automatically registered when ringing up sales or via Add Customer."
        }
        emptyAction={
          !search ? (
            <button
              onClick={handleOpenCreate}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isNepali ? "नयाँ ग्राहक थप्नुहोस्" : "Add Customer"}</span>
            </button>
          ) : undefined
        }
        enablePagination={true}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={
          editingCustomer
            ? isNepali
              ? "ग्राहक विवरण सम्पादन"
              : "Edit Customer"
            : isNepali
              ? "नयाँ ग्राहक थप्नुहोस्"
              : "Add New Customer"
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <Input
            label={
              <>
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isNepali ? "ग्राहकको नाम" : "Customer Name"}</span>
                <span className="text-rose-400">*</span>
              </>
            }
            type="text"
            required
            placeholder={
              isNepali ? "उदा. राम बहादुर श्रेष्ठ" : "e.g. Ram Bahadur Shrestha"
            }
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={
                <>
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{isNepali ? "फोन / मोबाइल" : "Phone / Mobile"}</span>
                </>
              }
              type="tel"
              mono
              placeholder={isNepali ? "उदा. 9841234567" : "e.g. 9841234567"}
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />

            <Input
              label={
                <>
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    {isNepali ? "PAN / VAT नम्बर" : "PAN / VAT Number"}
                  </span>
                </>
              }
              type="text"
              mono
              className="uppercase"
              placeholder={isNepali ? "उदा. 601234567" : "e.g. 601234567"}
              value={formData.pan_vat}
              onChange={(e) =>
                setFormData({ ...formData, pan_vat: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={
                <>
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{isNepali ? "इमेल" : "Email Address"}</span>
                </>
              }
              type="email"
              placeholder="customer@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />

            <Input
              label={
                <>
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{isNepali ? "ठेगाना" : "Address"}</span>
                </>
              }
              type="text"
              placeholder={
                isNepali
                  ? "उदा. नयाँ बानेश्वर, काठमाडौँ"
                  : "e.g. New Baneshwor, Kathmandu"
              }
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              {isNepali ? "कैफियत / टिप्पणी" : "Notes / Remarks"}
            </label>
            <textarea
              rows={2}
              placeholder={
                isNepali
                  ? "ग्राहक सम्बन्धी कुनै अतिरिक्त जानकारी..."
                  : "Any preferences or special notes..."
              }
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              {editingCustomer
                ? isNepali
                  ? "अद्यावधिक गर्नुहोस्"
                  : "Update Customer"
                : isNepali
                  ? "ग्राहक सुरक्षित गर्नुहोस्"
                  : "Save Customer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Purchase History Modal */}
      <Modal
        isOpen={inspectCustomer !== null}
        onClose={() => setInspectCustomer(null)}
        title={
          inspectCustomer
            ? `${isNepali ? "ग्राहक खरिद इतिहास" : "Purchase History"} - ${inspectCustomer.name}`
            : "Purchase History"
        }
      >
        <div className="space-y-4">
          {inspectCustomer && (
            <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {inspectCustomer.phone && (
                  <span className="flex items-center gap-1 text-neutral-300 font-mono">
                    <Phone className="w-3 h-3 text-neutral-500" />
                    {inspectCustomer.phone}
                  </span>
                )}
                {inspectCustomer.pan_vat && (
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <FileText className="w-3 h-3 text-neutral-500" />
                    PAN: {inspectCustomer.pan_vat}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-neutral-400 mr-2">
                  {isNepali ? "कुल खर्च:" : "Total Spent:"}
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(
                    inspectCustomer.total_spent || 0,
                    currencySymbol,
                  )}
                </span>
              </div>
            </div>
          )}

          {inspectSales.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-xs">
              <ShoppingBag className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p>
                {isNepali
                  ? "यस ग्राहकको कुनै कारोबार भेटिएन।"
                  : "No sales records found for this customer."}
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800 border border-neutral-800 rounded-lg">
              {inspectSales.map((s) => (
                <div
                  key={s.id}
                  className="p-3 hover:bg-neutral-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-neutral-200 flex items-center gap-2">
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {s.bill_number ||
                          `INV-${s.id.toString().padStart(6, "0")}`}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-normal">
                        ({formatDateTime(s.created_at)})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-400">
                      <span>
                        Subtotal: {formatCurrency(s.subtotal, currencySymbol)}
                      </span>
                      {s.discount > 0 && (
                        <span className="text-amber-400">
                          Disc: -{formatCurrency(s.discount, currencySymbol)}
                        </span>
                      )}
                      {s.vat_amount !== undefined && s.vat_amount > 0 && (
                        <span className="text-sky-400">
                          VAT 13%:{" "}
                          {formatCurrency(s.vat_amount, currencySymbol)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono">
                      <div className="font-bold text-emerald-400">
                        {formatCurrency(
                          s.grand_total || s.total,
                          currencySymbol,
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintSaleId(s.id);
                        setIsPrintModalOpen(true);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-md transition-colors cursor-pointer"
                      title={isNepali ? "रसिद छाप्नुहोस्" : "Print receipt"}
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setInspectCustomer(null)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer"
            >
              {isNepali ? "बन्द गर्नुहोस्" : "Close"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Print Bill Modal */}
      <PrintBillModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintSaleId(null);
        }}
        saleId={printSaleId}
        currencySymbol={currencySymbol}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingCustomer !== null}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={handleConfirmDelete}
        title={isNepali ? "ग्राहक हटाउनुहोस्?" : "Delete Customer?"}
        message={
          isNepali
            ? `के तपाईं साँच्चै ग्राहक "${deletingCustomer?.name}" लाई हटाउन चाहनुहुन्छ? विगतका बिक्री अभिलेखहरूमा यसको असर पर्ने छैन।`
            : `Are you sure you want to delete customer "${deletingCustomer?.name}"? Historical sales invoices will retain customer snapshots.`
        }
        confirmText={isNepali ? "हटाउनुहोस्" : "Delete"}
        variant="danger"
      />
    </div>
  );
};
