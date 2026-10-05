/**
 * New Product Form Component
 * Isolated form for creating and editing products in the inventory master catalog.
 * Supports SKU auto-generation, unit selection with searchable custom inputs,
 * opening stock tracking, and low-stock alert thresholds.
 */
import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Table2,
  Package,
  DollarSign,
  Scale,
  Hash,
  AlertCircle,
} from "lucide-react";
import { Product } from "../../types/index.ts";
import {
  createProduct,
  updateProduct,
  getProductById,
  generateProductSku,
} from "../../lib/services/productService.ts";
import {
  fromMinorUnits,
  toMinorUnits,
} from "../../lib/utils/format.ts";
import { COMMON_UNITS } from "../../constants/index.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import { Input } from "../common/Input.tsx";
import { Select } from "../common/Select.tsx";

export interface NewProductFormProps {
  editingProduct: Product | null;
  onClose: () => void;
  currencySymbol: string;
  lowStockThreshold?: number;
  loadProducts?: () => void;
  onSuccess?: (product: Product) => void;
  onOpenBulkCreate?: () => void;
}

export const NewProductForm: React.FC<NewProductFormProps> = ({
  editingProduct,
  onClose,
  currencySymbol,
  lowStockThreshold = 5,
  loadProducts,
  onSuccess,
  onOpenBulkCreate,
}) => {
  const { showToast } = useToast();
  const { t, isNepali } = useLanguage();

  // Form Fields State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "pcs",
    costPrice: "",
    sellingPrice: "",
    initialStock: "0",
    minStockAlert: "",
  });

  // Re-sync form state when editingProduct prop changes
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        sku: editingProduct.sku || "",
        unit: editingProduct.unit || "pcs",
        costPrice: fromMinorUnits(editingProduct.cost_price).toString(),
        sellingPrice: fromMinorUnits(editingProduct.selling_price).toString(),
        initialStock: editingProduct.current_stock.toString(),
        minStockAlert:
          editingProduct.min_stock_alert !== null &&
          editingProduct.min_stock_alert !== undefined
            ? editingProduct.min_stock_alert.toString()
            : "",
      });
    } else {
      setFormData({
        name: "",
        sku: "",
        unit: "pcs",
        costPrice: "",
        sellingPrice: "",
        initialStock: "0",
        minStockAlert: "",
      });
    }
  }, [editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast(
        isNepali ? "सामानको नाम आवश्यक छ" : "Product name is required",
        "warning"
      );
      return;
    }

    const cost = toMinorUnits(formData.costPrice);
    const selling = toMinorUnits(formData.sellingPrice);
    const parsedMinAlert =
      formData.minStockAlert.trim() !== ""
        ? parseInt(formData.minStockAlert, 10)
        : null;
    const minStockAlert =
      parsedMinAlert !== null && !isNaN(parsedMinAlert)
        ? Math.max(0, parsedMinAlert)
        : null;

    try {
      if (editingProduct) {
        updateProduct(editingProduct.id, {
          name: formData.name.trim(),
          sku: formData.sku.trim() || null,
          unit: formData.unit.trim() || "pcs",
          cost_price: cost,
          selling_price: selling,
          min_stock_alert: minStockAlert,
        });

        const updated = getProductById(editingProduct.id);

        showToast(
          isNepali
            ? "सामानको विवरण अद्यावधिक गरियो"
            : "Product updated successfully",
          "success"
        );
        onClose();
        loadProducts?.();
        if (updated) {
          onSuccess?.(updated);
        }
      } else {
        const stock = parseInt(formData.initialStock, 10) || 0;
        const created = createProduct({
          name: formData.name.trim(),
          sku: formData.sku.trim() || null,
          unit: formData.unit.trim() || "pcs",
          cost_price: cost,
          selling_price: selling,
          current_stock: stock,
          min_stock_alert: minStockAlert,
        });

        showToast(
          isNepali
            ? `सामान "${created.name}" (एकाइ: ${created.unit || "pcs"}) सफलतापूर्वक थपियो`
            : `Product "${created.name}" created successfully`,
          "success"
        );
        onClose();
        loadProducts?.();
        onSuccess?.(created);
      }
    } catch (err: unknown) {
      showToast(
        (err as Error).message ||
          (isNepali ? "त्रुटि देखा पर्यो" : "Failed to save product"),
        "error"
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action header for switching to Bulk Mode when creating */}
      {!editingProduct && onOpenBulkCreate && (
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-neutral-800">
          <span className="text-xs text-neutral-400">
            {isNepali ? "एक पटकमा एउटा सामान दर्ता" : "Single Product Entry"}
          </span>
          <button
            type="button"
            onClick={onOpenBulkCreate}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>
              {isNepali
                ? "तालिकामा धेरै सामान थप्नुहोस् (Bulk Mode)"
                : "Add Multiple in Table Mode"}
            </span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Name */}
        <div>
          <Input
            label={
              <>
                <Package className="w-3.5 h-3.5 text-neutral-400" />
                <span>{`${t("prod_name", "Product Name")}`}</span>{" "}
                <span className="text-rose-400">*</span>
              </>
            }
            type="text"
            required
            placeholder={
              isNepali ? "उदा. कोकाकोला ५०० मि.लि." : "e.g. Coca Cola 500ml"
            }
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>

        {/* SKU / Barcode */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t("prod_sku", "SKU / Barcode")}</span>
              <span className="text-neutral-500 font-normal ml-1">
                ({t("prod_sku_auto_hint", "Auto-generated if left blank")})
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                const gen = generateProductSku(formData.name);
                setFormData((prev) => ({ ...prev, sku: gen }));
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
              title={
                isNepali
                  ? "स्वतः SKU कोड बनाउनुहोस्"
                  : "Auto-generate unique SKU code"
              }
            >
              <Sparkles className="w-3 h-3" />
              <span>{t("prod_sku_auto_btn", "Auto-Generate")}</span>
            </button>
          </div>
          <Input
            type="text"
            placeholder={t(
              "prod_sku_placeholder",
              "e.g. BEV-CC-500 (or leave blank to auto-generate)"
            )}
            value={formData.sku}
            onChange={(e) =>
              setFormData({ ...formData, sku: e.target.value })
            }
            className="font-mono"
            clearable
            onClear={() => setFormData((prev) => ({ ...prev, sku: "" }))}
          />
        </div>

        {/* Unit of Measure */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-neutral-300 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t("prod_unit", "Unit of Measure")}</span>{" "}
              <span className="text-rose-400">*</span>
            </label>
            <span className="text-[10px] text-neutral-400 font-mono">
              {isNepali ? "उदा. pcs, kg, ltr, box" : "e.g. pcs, kg, litre, box"}
            </span>
          </div>
          <Select
            searchable
            allowCustom
            searchPlaceholder={
              isNepali
                ? "एकाइ खोज्नुहोस् वा नयाँ एकाइ लेख्नुहोस्..."
                : "Search unit or type custom unit..."
            }
            value={formData.unit || "pcs"}
            onChange={(e) => {
              if (e.target.value) {
                setFormData({ ...formData, unit: String(e.target.value) });
              }
            }}
            placeholder={
              isNepali ? "-- एकाइ छान्नुहोस् --" : "-- Select Unit --"
            }
            options={[
              ...(formData.unit &&
              !COMMON_UNITS.some(
                (u) => u.value.toLowerCase() === formData.unit.toLowerCase()
              )
                ? [
                    {
                      value: formData.unit,
                      label: `${formData.unit} (custom)`,
                      searchLabel: formData.unit,
                    },
                  ]
                : []),
              ...COMMON_UNITS.map((u) => ({
                value: u.value,
                label: u.label,
                searchLabel: `${u.value} ${u.label}`,
              })),
            ]}
            className="font-mono"
          />
          {/* Quick unit chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {["pcs", "kg", "ltr", "g", "ml", "pkt", "box", "bottle"].map(
              (u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFormData({ ...formData, unit: u })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    formData.unit.toLowerCase() === u
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60"
                  }`}
                >
                  {u}
                </button>
              )
            )}
          </div>
        </div>

        {/* Pricing (Cost Price & Default Selling Price) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label={
                <>
                  <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{`${t("prod_cost_price", "Cost Price")} (${currencySymbol})`}</span>{" "}
                  <span className="text-rose-400">*</span>
                </>
              }
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="45.00"
              value={formData.costPrice}
              onChange={(e) =>
                setFormData({ ...formData, costPrice: e.target.value })
              }
              className="font-mono"
            />
          </div>

          <div>
            <Input
              label={
                <>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{`${t("prod_selling_price", "Default Selling")} (${currencySymbol})`}</span>{" "}
                  <span className="text-rose-400">*</span>
                </>
              }
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="60.00"
              value={formData.sellingPrice}
              onChange={(e) =>
                setFormData({ ...formData, sellingPrice: e.target.value })
              }
              className="font-mono"
            />
          </div>
        </div>

        {/* Inventory Stock & Low Stock Alert */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!editingProduct ? (
            <div>
              <Input
                label={t("prod_initial_stock", "Opening Stock")}
                helperText={
                  isNepali
                    ? "प्रारम्भिक मौज्दात प्रविष्टि गर्दछ।"
                    : "Creates initial 'RESTOCK' movement."
                }
                type="number"
                min="0"
                placeholder="100"
                value={formData.initialStock}
                onChange={(e) =>
                  setFormData({ ...formData, initialStock: e.target.value })
                }
                className="font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                {isNepali ? "वर्तमान मौज्दात" : "Current Stock"}
              </label>
              <div className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200">
                {editingProduct.current_stock} {editingProduct.unit || "pcs"}
                <span className="text-[10px] text-neutral-500 ml-2">
                  ({isNepali ? "मौज्दात समायोजनबाट परिवर्तन गर्नुहोस्" : "Adjust via Restock/Adjust"})
                </span>
              </div>
            </div>
          )}

          <div>
            <Input
              label={
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{`${t("prod_min_alert", "Minimum Alert Threshold")} (${isNepali ? "वैकल्पिक" : "Optional"})`}</span>
                </>
              }
              helperText={t(
                "prod_min_alert_hint",
                "Triggers low-stock warning when below threshold."
              )}
              type="number"
              min="0"
              placeholder={
                isNepali
                  ? `डिफल्ट: ${lowStockThreshold} एकाइ`
                  : `Default: ${lowStockThreshold} units`
              }
              value={formData.minStockAlert}
              onChange={(e) =>
                setFormData({ ...formData, minStockAlert: e.target.value })
              }
              className="font-mono"
            />
          </div>
        </div>

        {/* Historical Snapshot Rule Notice in Edit Mode */}
        {editingProduct && (
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200">
                {isNepali
                  ? "ऐतिहासिक स्न्यापसट नियम: "
                  : "Historical Snapshot Rule: "}
              </span>
              {isNepali
                ? "मूल्य परिवर्तन भविष्यका कारोबारहरूमा मात्र लागू हुन्छ। पुराना बिलहरूमा ऐतिहासिक लागत र बिक्री मूल्य सुरक्षित रहन्छ।"
                : "Updating prices applies to future transactions only. Past sales retain their original snapshot cost and selling values."}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            {t("action_cancel", "Cancel")}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
          >
            {editingProduct
              ? isNepali
                ? "सामानको विवरण सुरक्षित गर्नुहोस्"
                : "Save Changes"
              : t("action_create", "Create Product")}
          </button>
        </div>
      </form>
    </div>
  );
};
