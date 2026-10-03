/**
 * Products Management View
 * Allows creating, editing, searching, and inspecting products.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  History,
  AlertCircle,
  Package,
  Receipt,
  CheckSquare,
  Square,
  ShoppingCart,
  SlidersHorizontal,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { Product } from '../../types/index.ts';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  generateProductSku,
} from '../../lib/services/productService.ts';
import { formatCurrency, fromMinorUnits, toMinorUnits, formatDate } from '../../lib/utils/format.ts';
import { Modal } from '../common/Modal.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';
import { ActionMenu } from '../common/ActionMenu.tsx';
import { Select } from '../common/Select.tsx';
import { Input } from '../common/Input.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface ProductsViewProps {
  currencySymbol: string;
  lowStockThreshold: number;
  onRestockClick: (product: Product) => void;
  onAdjustClick: (product: Product) => void;
  onViewMovements: (product: Product) => void;
  onStartSaleWithProducts?: (items: Array<{ product: Product; quantity?: number }>) => void;
  initialOpenCreate?: boolean;
  onClearInitialOpenCreate?: () => void;
}

const COMMON_UNITS = [
  { value: 'pcs', label: 'pcs (piece)' },
  { value: 'kg', label: 'kg (kilogram)' },
  { value: 'g', label: 'g (gram)' },
  { value: 'ltr', label: 'ltr (litre)' },
  { value: 'ml', label: 'ml (millilitre)' },
  { value: 'pkt', label: 'pkt (packet)' },
  { value: 'box', label: 'box (box)' },
  { value: 'bottle', label: 'bottle' },
  { value: 'can', label: 'can' },
  { value: 'dozen', label: 'dozen' },
  { value: 'm', label: 'm (meter)' },
];

export const ProductsView: React.FC<ProductsViewProps> = ({
  currencySymbol,
  lowStockThreshold,
  onRestockClick,
  onAdjustClick,
  onViewMovements,
  onStartSaleWithProducts,
  initialOpenCreate,
  onClearInitialOpenCreate,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'cost' | 'selling'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form states for Add/Edit
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    unit: 'pcs',
    costPrice: '',
    sellingPrice: '',
    initialStock: '',
    minStockAlert: '',
  });

  const loadProducts = () => {
    try {
      setProducts(getAllProducts());
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  useEffect(() => {
    loadProducts();
    const unsubscribe = subscribeToDbChanges(loadProducts);
    return unsubscribe;
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      sku: '',
      unit: 'pcs',
      costPrice: '',
      sellingPrice: '',
      initialStock: '0',
      minStockAlert: '',
    });
    setIsCreateOpen(true);
  };

  useEffect(() => {
    if (initialOpenCreate) {
      handleOpenCreate();
      onClearInitialOpenCreate?.();
    }
  }, [initialOpenCreate]);

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku || '',
      unit: p.unit || 'pcs',
      costPrice: fromMinorUnits(p.cost_price).toString(),
      sellingPrice: fromMinorUnits(p.selling_price).toString(),
      initialStock: p.current_stock.toString(),
      minStockAlert:
        p.min_stock_alert !== null && p.min_stock_alert !== undefined
          ? p.min_stock_alert.toString()
          : '',
    });
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Product name is required', 'warning');
      return;
    }

    const cost = toMinorUnits(formData.costPrice);
    const selling = toMinorUnits(formData.sellingPrice);
    const stock = parseInt(formData.initialStock, 10) || 0;
    const parsedMinAlert =
      formData.minStockAlert.trim() !== '' ? parseInt(formData.minStockAlert, 10) : null;
    const minStockAlert =
      parsedMinAlert !== null && !isNaN(parsedMinAlert) ? Math.max(0, parsedMinAlert) : null;

    try {
      const created = createProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || 'pcs',
        cost_price: cost,
        selling_price: selling,
        current_stock: stock,
        min_stock_alert: minStockAlert,
      });

      showToast(
        isNepali
          ? `सामान "${created.name}" (एकाइ: ${created.unit || 'pcs'}) सफलतापूर्वक थपियो`
          : `Product "${created.name}" (${created.unit || 'pcs'}) created successfully`,
        'success'
      );
      setIsCreateOpen(false);
      loadProducts();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!formData.name.trim()) {
      showToast('Product name is required', 'warning');
      return;
    }

    const cost = toMinorUnits(formData.costPrice);
    const selling = toMinorUnits(formData.sellingPrice);
    const parsedMinAlert =
      formData.minStockAlert.trim() !== '' ? parseInt(formData.minStockAlert, 10) : null;
    const minStockAlert =
      parsedMinAlert !== null && !isNaN(parsedMinAlert) ? Math.max(0, parsedMinAlert) : null;

    try {
      updateProduct(editingProduct.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || 'pcs',
        cost_price: cost,
        selling_price: selling,
        min_stock_alert: minStockAlert,
      });

      showToast(
        isNepali ? 'सामानको विवरण अद्यावधिक गरियो' : 'Product updated successfully',
        'success'
      );
      setEditingProduct(null);
      loadProducts();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    try {
      deleteProduct(deletingProduct.id);
      showToast(`Product "${deletingProduct.name}" deleted`, 'success');
      loadProducts();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error', 'Deletion Prevented');
    } finally {
      setDeletingProduct(null);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.id.toString() === q
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'stock') {
        comparison = a.current_stock - b.current_stock;
      } else if (sortBy === 'cost') {
        comparison = a.cost_price - b.cost_price;
      } else if (sortBy === 'selling') {
        comparison = a.selling_price - b.selling_price;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [products, search, sortBy, sortOrder]);

  const toggleSort = (column: 'name' | 'stock' | 'cost' | 'selling') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (filteredProducts.length === 0) return;
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleSellSelected = () => {
    const selected = products.filter((p) => selectedProductIds.includes(p.id));
    if (selected.length === 0) return;
    if (onStartSaleWithProducts) {
      onStartSaleWithProducts(selected.map((p) => ({ product: p, quantity: 1 })));
      setSelectedProductIds([]);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">{t('prod_title')}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isNepali
              ? `स्थानीय डाटाबेसमा जम्मा ${formatNumberByLang(products.length)} सामान दर्ता छन्`
              : `Total ${products.length} registered items in local database`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('prod_add_button')}</span>
          </button>
        </div>
      </div>

      {/* Multi-Select Floating Action Bar */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-neutral-200">
            <span className="font-bold text-emerald-400 font-mono text-sm">{selectedProductIds.length}</span>
            <span>products selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={handleSellSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Sell Selected Products ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar & Filter Controls */}
      <div className="flex items-center gap-3 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
        <div className="flex-1">
          <Input
            type="text"
            icon={Search}
            sizeVariant="sm"
            placeholder="Search products by title, SKU, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <Input
                    type="checkbox"
                    checked={
                      filteredProducts.length > 0 &&
                      selectedProductIds.length === filteredProducts.length
                    }
                    onChange={toggleSelectAll}
                    title="Select/Deselect all filtered"
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-6 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{t('prod_name')}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                </th>
                <th className="py-3 px-4 font-mono">{t('prod_sku')}</th>
                <th className="py-3 px-3 text-center font-mono">{t('prod_unit_short', 'Unit')}</th>
                <th
                  onClick={() => toggleSort('cost')}
                  className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t('prod_cost_price')}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('selling')}
                  className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t('prod_selling_price')}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('stock')}
                  className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t('prod_current_stock')}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">{isNepali ? 'इतिहास' : 'History'}</th>
                <th className="py-3 px-6 text-right">{t('prod_actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 text-xs">
                    <Package className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    {t('prod_no_products')}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const specificThreshold =
                    p.min_stock_alert !== null && p.min_stock_alert !== undefined
                      ? p.min_stock_alert
                      : lowStockThreshold;
                  const isLow = p.current_stock <= specificThreshold;
                  const isSelected = selectedProductIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-800/40 transition-colors group ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <Input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-6">
                        <div className="font-semibold text-neutral-100">{p.name}</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                          ID: #{p.id} · Added: {formatDate(p.created_at)}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-400">
                        {p.sku || <span className="text-neutral-600 italic">None</span>}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                          {p.unit || 'pcs'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                        {formatCurrency(p.cost_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-200 font-medium tabular-nums">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div>
                          <span
                            className={`font-semibold ${
                              isLow ? 'text-amber-400' : 'text-neutral-200'
                            }`}
                          >
                            {p.current_stock}
                          </span>
                          <span className="text-[11px] text-neutral-400 font-sans ml-1">
                            {p.unit || 'pcs'}
                          </span>
                          {isLow && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              low
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-sans mt-0.5">
                          Alert ≤ {specificThreshold}
                          {p.min_stock_alert !== null && p.min_stock_alert !== undefined && (
                            <span className="text-emerald-400 ml-1 font-mono text-[9px]">(custom)</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onViewMovements(p)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                          title="View inventory movement history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </td>

                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ActionMenu
                            align="right"
                            items={[
                              {
                                label: 'Sell Item',
                                icon: ShoppingCart,
                                color: 'emerald',
                                action: () => onStartSaleWithProducts?.([{ product: p, quantity: 1 }]),
                              },
                              {
                                label: 'Restock Units',
                                icon: PlusCircle,
                                color: 'emerald',
                                action: () => onRestockClick(p),
                              },
                              {
                                label: 'Adjust Count',
                                icon: SlidersHorizontal,
                                color: 'amber',
                                action: () => onAdjustClick(p),
                              },
                              {
                                label: 'Movement Ledger',
                                icon: History,
                                color: 'indigo',
                                action: () => onViewMovements(p),
                              },
                              {
                                label: 'Edit Product',
                                icon: Edit2,
                                color: 'default',
                                action: () => handleOpenEdit(p),
                              },
                              {
                                label: 'Delete Product',
                                icon: Trash2,
                                color: 'rose',
                                isDestructive: true,
                                divider: true,
                                action: () => setDeletingProduct(p),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Product */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('prod_create_title')}
        subtitle={isNepali ? 'नयाँ सामानको विवरण, मूल्य र प्रारम्भिक मौज्दात प्रविष्टि गर्नुहोस्।' : 'Specify product attributes, pricing, and initial stock.'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          <Input
            label={`${t('prod_name')} *`}
            type="text"
            required
            placeholder={isNepali ? 'उदा. कोकाकोला ५०० मि.लि.' : 'e.g. Coca Cola 500ml'}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_sku')}
                <span className="text-neutral-500 font-normal ml-1">
                  ({t('prod_sku_auto_hint', 'Auto-generated if left blank')})
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const gen = generateProductSku(formData.name);
                  setFormData((prev) => ({ ...prev, sku: gen }));
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title={isNepali ? 'स्वतः SKU कोड बनाउनुहोस्' : 'Auto-generate unique SKU code'}
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('prod_sku_auto_btn', 'Auto-Generate')}</span>
              </button>
            </div>
            <Input
              type="text"
              mono
              placeholder={t('prod_sku_placeholder', 'e.g. BEV-CC-500 (or leave blank to auto-generate)')}
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              rightIcon={
                formData.sku ? (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, sku: '' }))}
                    className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                    title="Clear SKU (will auto-generate upon saving)"
                  >
                    ✕
                  </button>
                ) : null
              }
              helperText={
                isNepali
                  ? 'यदि खाली छाड्नुभयो भने, सामानको नाम अनुसार प्रणालीले स्वतः नयाँ SKU बनाउनेछ।'
                  : 'Leave blank to let the system automatically assign a clean, unique SKU.'
              }
            />
          </div>

          {/* Unit of Measure */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_unit', 'Unit of Measure')} *
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {isNepali ? 'उदा. pcs, kg, ltr, box' : 'e.g. pcs, kg, litre, box'}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                required
                mono
                placeholder={t('prod_unit_placeholder', 'e.g. pcs, kg, ltr, box')}
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                containerClassName="flex-1"
              />
              <Select
                value={COMMON_UNITS.some((u) => u.value === formData.unit.toLowerCase()) ? formData.unit.toLowerCase() : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData({ ...formData, unit: e.target.value });
                  }
                }}
                placeholder={isNepali ? '-- एकाइ --' : '-- Common Units --'}
                containerClassName="w-48"
                options={COMMON_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              />
            </div>
            {/* Quick unit chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['pcs', 'kg', 'ltr', 'g', 'ml', 'pkt', 'box', 'bottle'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFormData({ ...formData, unit: u })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    formData.unit.toLowerCase() === u
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('prod_cost_price')} (${currencySymbol}) *`}
              type="number"
              step="0.01"
              min="0"
              required
              mono
              placeholder="45.00"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            />

            <Input
              label={`${t('prod_selling_price')} (${currencySymbol}) *`}
              type="number"
              step="0.01"
              min="0"
              required
              mono
              placeholder="60.00"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('prod_initial_stock')}
              type="number"
              min="0"
              mono
              placeholder="100"
              value={formData.initialStock}
              onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
              helperText={isNepali ? 'प्रारम्भिक मौज्दात प्रविष्टि गर्दछ।' : "Creates initial 'RESTOCK' movement."}
            />

            <Input
              label={t('prod_min_alert')}
              type="number"
              min="0"
              mono
              placeholder={isNepali ? `डिफल्ट: ${lowStockThreshold} एकाइ` : `Default: ${lowStockThreshold} units`}
              value={formData.minStockAlert}
              onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
              helperText={t('prod_min_alert_hint')}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t('action_create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Product */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={t('prod_edit_title')}
        subtitle={t('prod_edit_subtitle')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label={`${t('prod_name')} *`}
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_sku')}
                <span className="text-neutral-500 font-normal ml-1">
                  ({t('prod_sku_auto_hint', 'Auto-generated if left blank')})
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const gen = generateProductSku(formData.name);
                  setFormData((prev) => ({ ...prev, sku: gen }));
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
                title={isNepali ? 'स्वतः नयाँ SKU बनाउनुहोस्' : 'Auto-generate new SKU code'}
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('prod_sku_auto_btn', 'Auto-Generate')}</span>
              </button>
            </div>
            <Input
              type="text"
              mono
              placeholder={t('prod_sku_placeholder', 'e.g. BEV-CC-500 (or leave blank to auto-generate)')}
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              rightIcon={
                formData.sku ? (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, sku: '' }))}
                    className="text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                    title="Clear SKU (will auto-generate upon saving)"
                  >
                    ✕
                  </button>
                ) : null
              }
              helperText={
                isNepali
                  ? 'यदि खाली छाड्नुभयो भने, सामानको नाम अनुसार नयाँ SKU स्वतः सुरक्षित हुनेछ।'
                  : 'Leave blank to automatically assign a new unique SKU.'
              }
            />
          </div>

          {/* Unit of Measure */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_unit', 'Unit of Measure')} *
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                {isNepali ? 'उदा. pcs, kg, ltr, box' : 'e.g. pcs, kg, litre, box'}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                required
                mono
                placeholder={t('prod_unit_placeholder', 'e.g. pcs, kg, ltr, box')}
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                containerClassName="flex-1"
              />
              <Select
                value={COMMON_UNITS.some((u) => u.value === formData.unit.toLowerCase()) ? formData.unit.toLowerCase() : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData({ ...formData, unit: e.target.value });
                  }
                }}
                placeholder={isNepali ? '-- एकाइ --' : '-- Common Units --'}
                containerClassName="w-48"
                options={COMMON_UNITS.map((u) => ({ value: u.value, label: u.label }))}
              />
            </div>
            {/* Quick unit chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['pcs', 'kg', 'ltr', 'g', 'ml', 'pkt', 'box', 'bottle'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFormData({ ...formData, unit: u })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                    formData.unit.toLowerCase() === u
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/60'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('prod_cost_price')} (${currencySymbol}) *`}
              type="number"
              step="0.01"
              min="0"
              required
              mono
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            />

            <Input
              label={`${t('prod_selling_price')} (${currencySymbol}) *`}
              type="number"
              step="0.01"
              min="0"
              required
              mono
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            />
          </div>

          <Input
            label={`${t('prod_min_alert')} (${isNepali ? 'वैकल्पिक' : 'Optional'})`}
            type="number"
            min="0"
            mono
            placeholder={isNepali ? `डिफल्ट: ${lowStockThreshold} एकाइ` : `Default: ${lowStockThreshold} units`}
            value={formData.minStockAlert}
            onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
            helperText={t('prod_min_alert_hint')}
          />

          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-200">
                {isNepali ? 'ऐतिहासिक स्न्यापसट नियम: ' : 'Historical Snapshot Rule: '}
              </span>
              {isNepali
                ? 'मूल्य परिवर्तन भविष्यका कारोबारहरूमा मात्र लागू हुन्छ। पुराना बिलहरूमा ऐतिहासिक लागत र बिक्री मूल्य सुरक्षित रहन्छ।'
                : 'Updating prices applies to future transactions only. Past sales retain their original snapshot cost and selling values.'}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t('action_save_changes')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dialog: Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deletingProduct?.name}"? If this product has been involved in previous sales, deletion will be blocked to maintain historical financial audit integrity.`}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};
