/**
 * Unified Inventory & Products Management View
 * Features:
 * - Product catalog master data management (Create, Edit, Delete, SKU generator, Units)
 * - Inventory stock tracking & real-time valuation KPIs
 * - Multi-criteria Filtering:
 *     - By Date: Presets (Today, Yesterday, Last 7 Days, This Month, All Time) + Custom Date Range
 *     - By Vendor: Filter products & movements by supplier/vendor
 *     - By Stock Status: All, In Stock, Low Stock, Out of Stock
 *     - By Search: Product title, SKU, ID, or Movement note
 * - Movement Audit Log: In-page transaction ledger with type filtering (RESTOCK, PURCHASE, SALE, ADJUSTMENT)
 * - Bulk actions: Multi-select products to Sell in POS
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  History,
  AlertCircle,
  AlertTriangle,
  Package,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Boxes,
  Filter,
  Calendar,
  Building2,
  CheckSquare,
  Square,
  X,
  PlusCircle,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { Product, StockMovement, Vendor } from '../../types/index.ts';
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  generateProductSku,
} from '../../lib/services/productService.ts';
import {
  restockProduct,
  adjustStock,
  getStockMovements,
} from '../../lib/services/inventoryService.ts';
import { getAllVendors } from '../../lib/services/vendorService.ts';
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  fromMinorUnits,
  toMinorUnits,
} from '../../lib/utils/format.ts';
import { Modal } from '../common/Modal.tsx';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';
import { ActionMenu } from '../common/ActionMenu.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';

export interface InventoryViewProps {
  currencySymbol: string;
  lowStockThreshold: number;
  allowNegativeStock?: boolean;
  activeRestockProduct?: Product | null;
  activeAdjustProduct?: Product | null;
  activeMovementsProduct?: Product | null;
  onClearActiveModals?: () => void;
  onStartSaleWithProducts?: (items: Array<{ product: Product; quantity?: number }>) => void;
  initialOpenCreate?: boolean;
  onClearInitialOpenCreate?: () => void;
  onEditProduct?: (product: Product) => void;
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

export const InventoryView: React.FC<InventoryViewProps> = ({
  currencySymbol,
  lowStockThreshold,
  allowNegativeStock = false,
  activeRestockProduct,
  activeAdjustProduct,
  activeMovementsProduct,
  onClearActiveModals,
  onStartSaleWithProducts,
  initialOpenCreate,
  onClearInitialOpenCreate,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();

  // Active view tab: 'catalog' (products & stock ledger) vs 'movements' (global movement audit log)
  const [viewTab, setViewTab] = useState<'catalog' | 'movements'>('catalog');

  // Master Data
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [movementsList, setMovementsList] = useState<StockMovement[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');

  // Multi-selection & Sorting
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'cost' | 'selling' | 'valuation' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedRestock, setSelectedRestock] = useState<Product | null>(activeRestockProduct || null);
  const [selectedAdjust, setSelectedAdjust] = useState<Product | null>(activeAdjustProduct || null);
  const [selectedMovements, setSelectedMovements] = useState<Product | null>(activeMovementsProduct || null);

  // Form states for Add/Edit Product
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    unit: 'pcs',
    costPrice: '',
    sellingPrice: '',
    initialStock: '',
    minStockAlert: '',
    vendorId: '',
    vendorName: '',
  });

  // Restock Form
  const [restockQty, setRestockQty] = useState('10');
  const [restockNote, setRestockNote] = useState('');
  const [restockVendorId, setRestockVendorId] = useState('');

  // Adjust Form
  const [adjustTargetStock, setAdjustTargetStock] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');

  // Load Data
  const loadData = () => {
    try {
      setProducts(getAllProducts());
      setVendors(getAllVendors());
    } catch (e) {
      console.error('Error fetching inventory data:', e);
    }
  };

  const loadMovements = (productId?: number) => {
    try {
      setMovementsList(
        getStockMovements({
          productId,
          vendorId: selectedVendorId !== 'all' ? Number(selectedVendorId) : undefined,
          type: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
          startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
          search: search.trim() || undefined,
        })
      );
    } catch (e) {
      console.error('Error loading movements:', e);
    }
  };

  useEffect(() => {
    loadData();
    loadMovements();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
      if (selectedMovements) {
        loadMovements(selectedMovements.id);
      } else {
        loadMovements();
      }
    });
    return unsubscribe;
  }, [selectedMovements, selectedVendorId, movementTypeFilter, startDate, endDate, search]);

  // Sync external props
  useEffect(() => {
    if (initialOpenCreate) {
      handleOpenCreate();
      onClearInitialOpenCreate?.();
    }
  }, [initialOpenCreate]);

  useEffect(() => {
    if (activeRestockProduct) {
      setSelectedRestock(activeRestockProduct);
      setRestockQty('10');
      setRestockNote('Inventory restock delivery');
      setRestockVendorId(activeRestockProduct.vendor_id ? String(activeRestockProduct.vendor_id) : '');
    }
  }, [activeRestockProduct]);

  useEffect(() => {
    if (activeAdjustProduct) {
      setSelectedAdjust(activeAdjustProduct);
      setAdjustTargetStock(activeAdjustProduct.current_stock.toString());
      setAdjustNote('Physical inventory recount');
    }
  }, [activeAdjustProduct]);

  useEffect(() => {
    if (activeMovementsProduct) {
      setSelectedMovements(activeMovementsProduct);
      loadMovements(activeMovementsProduct.id);
    }
  }, [activeMovementsProduct]);

  // Date Preset Handler
  const handleDatePresetChange = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      setStartDate(w.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const m = new Date(now);
      m.setDate(m.getDate() - 30);
      setStartDate(m.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedVendorId('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setStockStatusFilter('all');
    setMovementTypeFilter('ALL');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedVendorId !== 'all' ||
    datePreset !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    stockStatusFilter !== 'all' ||
    movementTypeFilter !== 'ALL';

  // Product Create/Edit Handlers
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      sku: '',
      unit: 'pcs',
      costPrice: '',
      sellingPrice: '',
      initialStock: '0',
      minStockAlert: '',
      vendorId: selectedVendorId !== 'all' ? selectedVendorId : '',
      vendorName: selectedVendorId !== 'all' ? (vendors.find((v) => String(v.id) === selectedVendorId)?.name || '') : '',
    });
    setIsCreateOpen(true);
  };

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
      vendorId: p.vendor_id ? String(p.vendor_id) : '',
      vendorName: p.vendor_name || '',
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

    const vendorIdNum = formData.vendorId ? Number(formData.vendorId) : null;
    const selectedV = vendors.find((v) => String(v.id) === formData.vendorId);
    const resolvedVendorName = selectedV?.name || formData.vendorName || null;

    try {
      const created = createProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || 'pcs',
        cost_price: cost,
        selling_price: selling,
        current_stock: stock,
        min_stock_alert: minStockAlert,
        vendor_id: vendorIdNum,
        vendor_name: resolvedVendorName,
      });

      showToast(
        isNepali
          ? `सामान "${created.name}" (एकाइ: ${created.unit || 'pcs'}) सफलतापूर्वक थपियो`
          : `Product "${created.name}" created successfully`,
        'success'
      );
      setIsCreateOpen(false);
      loadData();
      loadMovements();
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

    const vendorIdNum = formData.vendorId ? Number(formData.vendorId) : null;
    const selectedV = vendors.find((v) => String(v.id) === formData.vendorId);
    const resolvedVendorName = selectedV?.name || formData.vendorName || null;

    try {
      updateProduct(editingProduct.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        unit: formData.unit.trim() || 'pcs',
        cost_price: cost,
        selling_price: selling,
        min_stock_alert: minStockAlert,
        vendor_id: vendorIdNum,
        vendor_name: resolvedVendorName,
      });

      showToast(
        isNepali ? 'सामानको विवरण अद्यावधिक गरियो' : 'Product updated successfully',
        'success'
      );
      setEditingProduct(null);
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    try {
      deleteProduct(deletingProduct.id);
      showToast(`Product "${deletingProduct.name}" deleted`, 'success');
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error', 'Deletion Prevented');
    } finally {
      setDeletingProduct(null);
    }
  };

  // Restock & Adjust Handlers
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestock) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Restock quantity must be at least 1', 'warning');
      return;
    }

    const vId = restockVendorId ? Number(restockVendorId) : null;
    const vObj = vendors.find((v) => String(v.id) === restockVendorId);
    const vName = vObj?.name || null;

    try {
      restockProduct(selectedRestock.id, qty, restockNote, vId, vName);
      showToast(
        `Added +${qty} units to "${selectedRestock.name}". New stock: ${
          selectedRestock.current_stock + qty
        }`,
        'success'
      );
      setSelectedRestock(null);
      onClearActiveModals?.();
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjust) return;
    const target = parseInt(adjustTargetStock, 10);
    if (isNaN(target)) {
      showToast('Please specify a valid numeric stock count', 'warning');
      return;
    }

    if (target < 0 && !allowNegativeStock) {
      showToast('Negative stock is disabled by system settings', 'warning');
      return;
    }

    try {
      adjustStock(selectedAdjust.id, target, adjustNote);
      showToast(
        `Stock for "${selectedAdjust.name}" adjusted to ${target} units`,
        'success'
      );
      setSelectedAdjust(null);
      onClearActiveModals?.();
      loadData();
      loadMovements();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Selection & Selling Handlers
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

  // Sorting
  const toggleSort = (column: 'name' | 'stock' | 'cost' | 'selling' | 'valuation' | 'date') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Filtered Products (Stock Ledger)
  const filteredProducts = useMemo(() => {
    let result = products;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.id.toString() === q ||
          (p.vendor_name && p.vendor_name.toLowerCase().includes(q))
      );
    }

    // Vendor filter
    if (selectedVendorId !== 'all') {
      const vId = Number(selectedVendorId);
      result = result.filter((p) => p.vendor_id === vId);
    }

    // Date filter (based on created_at added date)
    if (startDate) {
      result = result.filter((p) => p.created_at.slice(0, 10) >= startDate);
    }
    if (endDate) {
      result = result.filter((p) => p.created_at.slice(0, 10) <= endDate);
    }

    // Stock status filter
    if (stockStatusFilter === 'in_stock') {
      result = result.filter((p) => p.current_stock > 0);
    } else if (stockStatusFilter === 'low_stock') {
      result = result.filter((p) => {
        const threshold =
          p.min_stock_alert !== null && p.min_stock_alert !== undefined
            ? p.min_stock_alert
            : lowStockThreshold;
        return p.current_stock <= threshold;
      });
    } else if (stockStatusFilter === 'out_of_stock') {
      result = result.filter((p) => p.current_stock <= 0);
    }

    // Sorting
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
      } else if (sortBy === 'valuation') {
        comparison = Math.max(0, a.current_stock * a.cost_price) - Math.max(0, b.current_stock * b.cost_price);
      } else if (sortBy === 'date') {
        comparison = a.created_at.localeCompare(b.created_at);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [products, search, selectedVendorId, startDate, endDate, stockStatusFilter, lowStockThreshold, sortBy, sortOrder]);

  // Aggregate KPI Stats based on current products list
  const totals = useMemo(() => {
    let units = 0;
    let costValuation = 0;
    let retailValuation = 0;
    let lowCount = 0;

    for (const p of products) {
      units += p.current_stock;
      if (p.current_stock > 0) {
        costValuation += p.current_stock * p.cost_price;
        retailValuation += p.current_stock * p.selling_price;
      }
      const specificThreshold =
        p.min_stock_alert !== null && p.min_stock_alert !== undefined
          ? p.min_stock_alert
          : lowStockThreshold;
      if (p.current_stock <= specificThreshold) {
        lowCount++;
      }
    }

    return {
      productCount: products.length,
      units,
      costValuation,
      retailValuation,
      lowCount,
    };
  }, [products, lowStockThreshold]);

  // Filtered movements for in-page audit log
  const filteredMovements = useMemo(() => {
    let result = movementsList;
    if (movementTypeFilter !== 'ALL') {
      result = result.filter((m) => m.type === movementTypeFilter);
    }
    if (selectedVendorId !== 'all') {
      const vId = Number(selectedVendorId);
      result = result.filter((m) => m.vendor_id === vId);
    }
    if (startDate) {
      result = result.filter((m) => m.created_at.slice(0, 10) >= startDate);
    }
    if (endDate) {
      result = result.filter((m) => m.created_at.slice(0, 10) <= endDate);
    }
    if (search.trim() && viewTab === 'movements') {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.product_name && m.product_name.toLowerCase().includes(q)) ||
          (m.note && m.note.toLowerCase().includes(q)) ||
          m.product_id.toString() === q ||
          (m.vendor_name && m.vendor_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [movementsList, movementTypeFilter, selectedVendorId, startDate, endDate, search, viewTab]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Main Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <span>{t('inv_title', 'Inventory & Products')}</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isNepali
              ? `सामानको सूची, आपूर्तिकर्ता (Vendor), मिति अनुसार फिल्टर र मौज्दात मूल्याङ्कन`
              : `Catalog master, supplier link, date & vendor filtering, stock movements & valuation`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Tab Switcher */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 flex items-center text-xs">
            <button
              onClick={() => setViewTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewTab === 'catalog'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{isNepali ? 'सामान सूची (Stock Ledger)' : 'Stock Ledger'}</span>
            </button>
            <button
              onClick={() => {
                setViewTab('movements');
                loadMovements();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewTab === 'movements'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isNepali ? 'चलान अडिट लग (Movements)' : 'Movement Log'}</span>
            </button>
          </div>

          {/* Quick Create Product Button */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
            title={`Add New Product (${MODIFIER_LABEL}+Shift+P)`}
          >
            <Plus className="w-4 h-4" />
            <span>{t('prod_add_button', 'Add Product')}</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Products */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">{isNepali ? 'कुल सामान संख्या' : 'Total Items'}</div>
          <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
            {formatNumberByLang(totals.productCount)}{' '}
            <span className="text-xs font-normal text-neutral-400">{isNepali ? 'सामान' : 'items'}</span>
          </div>
        </motion.div>

        {/* Total Stock Units */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">{t('inv_total_units', 'Total In-Stock Units')}</div>
          <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
            {formatNumberByLang(totals.units)}{' '}
            <span className="text-xs font-normal text-neutral-400">{isNepali ? 'एकाइ' : 'units'}</span>
          </div>
        </motion.div>

        {/* Total Cost Valuation */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">{t('inv_total_valuation', 'Cost Valuation')}</div>
          <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {formatCurrency(totals.costValuation, currencySymbol)}
          </div>
        </motion.div>

        {/* Low Stock Alerts */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between"
        >
          <div>
            <div className="text-xs text-neutral-400">
              {t('inv_low_stock_items', 'Low Stock Items')} (≤ {formatNumberByLang(lowStockThreshold)})
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                totals.lowCount > 0 ? 'text-amber-400' : 'text-neutral-100'
              }`}
            >
              {formatNumberByLang(totals.lowCount)} {isNepali ? 'सामान' : 'items'}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setStockStatusFilter(stockStatusFilter === 'low_stock' ? 'all' : 'low_stock')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              stockStatusFilter === 'low_stock'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            {stockStatusFilter === 'low_stock'
              ? (isNepali ? 'कम मौज्दात मात्र' : 'Filtering Low')
              : (isNepali ? 'फिल्टर' : 'Filter')}
          </motion.button>
        </motion.div>
      </div>

      {/* Multi-Select Floating Action Bar */}
      {selectedProductIds.length > 0 && viewTab === 'catalog' && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-neutral-200">
            <span className="font-bold text-emerald-400 font-mono text-sm">{formatNumberByLang(selectedProductIds.length)}</span>
            <span>{isNepali ? 'सामान छानिएको' : 'products selected'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {isNepali ? 'सबै हटाउनुहोस्' : 'Deselect All'}
            </button>
            <button
              type="button"
              onClick={handleSellSelected}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>
                {isNepali
                  ? `छानिएका सामान बिक्रीमा राख्नुहोस् (${formatNumberByLang(selectedProductIds.length)})`
                  : `Sell Selected in POS (${selectedProductIds.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== RICH FILTERING TOOLBAR ==================== */}
      <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-3">
        {/* Row 1: Search & Core Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-5">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                viewTab === 'catalog'
                  ? 'Search by title, SKU, ID, or supplier name...'
                  : 'Search movements by product, supplier, or audit note...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Vendor Filter Dropdown */}
          <div className="md:col-span-4 relative">
            <div className="relative">
              <Building2 className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-8 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none"
              >
                <option value="all">🏢 {isNepali ? 'सबै आपूर्तिकर्ताहरू (All Vendors)' : 'All Vendors / Suppliers'}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name} {v.pan_vat ? `(PAN: ${v.pan_vat})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Stock Status Filter (for Catalog tab) or Movement Type (for Movement tab) */}
          <div className="md:col-span-3">
            {viewTab === 'catalog' ? (
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">{isNepali ? 'सबै मौज्दात अवस्था' : 'All Stock Levels'}</option>
                <option value="in_stock">{isNepali ? 'मौज्दातमा उपलब्ध (> 0)' : 'In Stock (> 0)'}</option>
                <option value="low_stock">⚠️ {isNepali ? 'कम मौज्दात मात्र (Low Stock)' : 'Low Stock (≤ threshold)'}</option>
                <option value="out_of_stock">❌ {isNepali ? 'रित्तिएको मौज्दात (Out of Stock)' : 'Out of Stock (0)'}</option>
              </select>
            ) : (
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
              >
                <option value="ALL">All Movement Types</option>
                <option value="RESTOCK">RESTOCK (Manual / Delivery)</option>
                <option value="PURCHASE">PURCHASE (Supplier Order)</option>
                <option value="SALE">SALE (Customer Order)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Count Recount)</option>
              </select>
            )}
          </div>
        </div>

        {/* Row 2: Date Range Presets & Date Pickers */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-800/80 text-xs">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
            <span className="text-neutral-500 text-[11px] font-medium mr-1 flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? 'मिति:' : 'Date:'}</span>
            </span>
            {[
              { id: 'all', label: isNepali ? 'सबै समय' : 'All Time' },
              { id: 'today', label: isNepali ? 'आज' : 'Today' },
              { id: 'yesterday', label: isNepali ? 'हिजो' : 'Yesterday' },
              { id: 'week', label: isNepali ? '७ दिन' : 'Last 7 Days' },
              { id: 'month', label: isNepali ? '३० दिन' : 'This Month' },
              { id: 'custom', label: isNepali ? 'कस्टम' : 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePresetChange(p.id as any)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer text-xs font-medium ${
                  datePreset === p.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Inputs & Clear Button */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-neutral-300">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-neutral-200 focus:outline-none text-xs"
                title="Start Date"
              />
              <span className="text-neutral-500 text-xs">{isNepali ? 'देखि' : 'to'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-transparent text-neutral-200 focus:outline-none text-xs"
                title="End Date"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer text-xs"
                title="Reset all active search and filter constraints"
              >
                <RotateCcw className="w-3 h-3 text-neutral-400" />
                <span>{isNepali ? 'रिसेट' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {viewTab === 'catalog' ? (
        /* ==================== TAB 1: PRODUCT & STOCK INVENTORY LEDGER ==================== */
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
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
                      <span>{t('prod_name', 'Product Name')}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th className="py-3 px-4 font-mono">{t('prod_sku', 'SKU')}</th>
                  <th className="py-3 px-3 text-center font-mono">{t('prod_unit_short', 'Unit')}</th>
                  <th className="py-3 px-4">{isNepali ? 'आपूर्तिकर्ता' : 'Supplier / Vendor'}</th>
                  <th
                    onClick={() => toggleSort('cost')}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('prod_cost_price', 'Cost Price')}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('selling')}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('prod_selling_price', 'Selling Price')}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('stock')}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('prod_current_stock', 'Current Stock')}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('valuation')}
                    className="py-3 px-4 text-right font-mono cursor-pointer hover:text-neutral-200"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('inv_col_valuation', 'Stock Value')}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">{isNepali ? 'इतिहास' : 'Ledger'}</th>
                  <th className="py-3 px-6 text-right">{t('prod_actions', 'Actions')}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-neutral-400 text-xs">
                      <Boxes className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <p className="font-semibold text-neutral-300">
                        {isNepali ? 'कुनै सामान फेला परेन।' : 'No matching inventory items found.'}
                      </p>
                      <p className="text-neutral-500 text-[11px] mt-1">
                        {hasActiveFilters
                          ? 'Try clearing date, vendor, or search filters to see all products.'
                          : 'Click "+ Add Product" to register your first product.'}
                      </p>
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
                    const valuation = Math.max(0, p.current_stock * p.cost_price);
                    const marginPct =
                      p.selling_price > 0
                        ? Math.round(((p.selling_price - p.cost_price) / p.selling_price) * 100)
                        : 0;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-neutral-800/40 transition-colors group ${
                          isSelected ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
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

                        {/* Vendor Tag */}
                        <td className="py-3 px-4">
                          {p.vendor_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 max-w-[160px] truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{p.vendor_name}</span>
                            </span>
                          ) : (
                            <span className="text-neutral-600 text-[11px] italic">Self-Supplied</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                          {formatCurrency(p.cost_price, currencySymbol)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-neutral-200 font-medium tabular-nums">
                          <div>{formatCurrency(p.selling_price, currencySymbol)}</div>
                          <div className="text-[10px] text-neutral-500 font-sans">
                            {marginPct}% margin
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <div>
                            <span
                              className={`font-semibold ${
                                isLow ? 'text-amber-400 font-bold' : 'text-neutral-200'
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

                        <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                          {formatCurrency(valuation, currencySymbol)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedMovements(p);
                              loadMovements(p.id);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                            title="View stock movement ledger"
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
                                  label: isNepali ? 'बिक्रीमा थप्नुहोस्' : 'Sell in POS',
                                  icon: ShoppingCart,
                                  color: 'emerald',
                                  action: () => onStartSaleWithProducts?.([{ product: p, quantity: 1 }]),
                                },
                                {
                                  label: isNepali ? 'मौज्दात थप (Restock)' : 'Restock Units',
                                  icon: PlusCircle,
                                  color: 'emerald',
                                  action: () => {
                                    setSelectedRestock(p);
                                    setRestockQty('10');
                                    setRestockNote('Inventory restock delivery');
                                    setRestockVendorId(p.vendor_id ? String(p.vendor_id) : '');
                                  },
                                },
                                {
                                  label: isNepali ? 'मौज्दात मिलान (Adjust)' : 'Adjust Count',
                                  icon: SlidersHorizontal,
                                  color: 'amber',
                                  action: () => {
                                    setSelectedAdjust(p);
                                    setAdjustTargetStock(p.current_stock.toString());
                                    setAdjustNote('Physical inventory recount');
                                  },
                                },
                                {
                                  label: isNepali ? 'चलान इतिहास (Ledger)' : 'Movement History',
                                  icon: History,
                                  color: 'indigo',
                                  action: () => {
                                    setSelectedMovements(p);
                                    loadMovements(p.id);
                                  },
                                },
                                {
                                  label: isNepali ? 'विवरण सम्पादन (Edit)' : 'Edit Product',
                                  icon: Edit2,
                                  color: 'default',
                                  action: () => handleOpenEdit(p),
                                },
                                {
                                  label: isNepali ? 'सामान मेटाउनुहोस् (Delete)' : 'Delete Product',
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
      ) : (
        /* ==================== TAB 2: GLOBAL STOCK MOVEMENT AUDIT LOG ==================== */
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <span>{isNepali ? 'सम्पूर्ण स्टक चलान विवरण (Audit Ledger)' : 'Comprehensive Stock Movement Ledger'}</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isNepali
                  ? 'खरिद, बिक्री, स्टक थप तथा मिलानका सबै कारोबारहरूको विस्तृत अडिट अभिलेख।'
                  : 'Immutable transaction-level audit trail of all RESTOCK, PURCHASE, SALE, and ADJUSTMENT operations.'}
              </p>
            </div>
            <div className="text-xs text-neutral-400 font-mono">
              {filteredMovements.length} movements recorded
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium sticky top-0 border-b border-neutral-800 z-10 select-none">
                <tr>
                  <th className="py-3 px-4 font-mono">Date / Time</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3 text-center">Movement Type</th>
                  <th className="py-3 px-4">Vendor / Source</th>
                  <th className="py-3 px-4 text-right font-mono">Quantity Delta</th>
                  <th className="py-3 px-6">Audit Reference / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500 text-xs">
                      <History className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                      <p className="font-semibold text-neutral-300">No stock movements found matching filter criteria.</p>
                      <p className="text-neutral-500 text-[11px] mt-1">Try resetting date or vendor filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-200">{m.product_name || `Product #${m.product_id}`}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">ID: #{m.product_id}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
                              m.type === 'RESTOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : m.type === 'PURCHASE'
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                : m.type === 'SALE'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {m.vendor_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                              <Building2 className="w-3 h-3 text-emerald-400" />
                              <span className="truncate max-w-[140px]">{m.vendor_name}</span>
                            </span>
                          ) : (
                            <span className="text-neutral-600 text-[11px]">—</span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity} {m.product_unit || 'units'}
                        </td>
                        <td className="py-3 px-6 text-neutral-300 break-words">
                          {m.note || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CREATE PRODUCT ==================== */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('prod_create_title', 'Create New Product')}
        subtitle={isNepali ? 'नयाँ सामानको विवरण, मूल्य, आपूर्तिकर्ता र प्रारम्भिक मौज्दात प्रविष्टि गर्नुहोस्।' : 'Specify product attributes, pricing, vendor supplier, and initial stock.'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              {t('prod_name', 'Product Name')} *
            </label>
            <input
              type="text"
              required
              placeholder={isNepali ? 'उदा. कोकाकोला ५०० मि.लि.' : 'e.g. Coca Cola 500ml'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_sku', 'SKU / Barcode')}
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
            <div className="relative">
              <input
                type="text"
                placeholder={t('prod_sku_placeholder', 'e.g. BEV-CC-500 (or leave blank to auto-generate)')}
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              {formData.sku && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, sku: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                  title="Clear SKU (will auto-generate upon saving)"
                >
                  ✕
                </button>
              )}
            </div>
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
              <input
                type="text"
                required
                placeholder={t('prod_unit_placeholder', 'e.g. pcs, kg, ltr, box')}
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={COMMON_UNITS.some((u) => u.value === formData.unit.toLowerCase()) ? formData.unit.toLowerCase() : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData({ ...formData, unit: e.target.value });
                  }
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" disabled>
                  {isNepali ? '-- एकाइ छान्नुहोस् --' : '-- Common Units --'}
                </option>
                {COMMON_UNITS.map((u) => (
                  <option key={u.value} value={u.value} className="bg-neutral-900">
                    {u.label}
                  </option>
                ))}
              </select>
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

          {/* Preferred Vendor / Supplier Selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? 'आपूर्तिकर्ता / सप्लायर (वैकल्पिक)' : 'Supplier / Vendor (Optional)'}</span>
            </label>
            <select
              value={formData.vendorId}
              onChange={(e) => {
                const v = vendors.find((vend) => String(vend.id) === e.target.value);
                setFormData({
                  ...formData,
                  vendorId: e.target.value,
                  vendorName: v ? v.name : '',
                });
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">{isNepali ? '-- आपूर्तिकर्ता तोकिएको छैन (None) --' : '-- No Specific Supplier --'}</option>
              {vendors.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name} {v.pan_vat ? `(PAN: ${v.pan_vat})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_cost_price', 'Cost Price')} ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="45.00"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_selling_price', 'Default Selling')} ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="60.00"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_initial_stock', 'Opening Stock')}
              </label>
              <input
                type="number"
                min="0"
                placeholder="100"
                value={formData.initialStock}
                onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                {isNepali ? 'प्रारम्भिक मौज्दात प्रविष्टि गर्दछ।' : "Creates initial 'RESTOCK' movement."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_min_alert', 'Minimum Alert Threshold')}
              </label>
              <input
                type="number"
                min="0"
                placeholder={isNepali ? `डिफल्ट: ${lowStockThreshold} एकाइ` : `Default: ${lowStockThreshold} units`}
                value={formData.minStockAlert}
                onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                {t('prod_min_alert_hint', 'Triggers low-stock warning when below threshold.')}
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              {t('action_cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t('action_create', 'Create Product')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: EDIT PRODUCT ==================== */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={t('prod_edit_title', 'Edit Product Master')}
        subtitle={t('prod_edit_subtitle', 'Update attributes, pricing, or unit of measure')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              {t('prod_name', 'Product Name')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t('prod_sku', 'SKU / Barcode')}
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
            <div className="relative">
              <input
                type="text"
                placeholder={t('prod_sku_placeholder', 'e.g. BEV-CC-500 (or leave blank to auto-generate)')}
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              {formData.sku && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, sku: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
                  title="Clear SKU"
                >
                  ✕
                </button>
              )}
            </div>
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
              <input
                type="text"
                required
                placeholder={t('prod_unit_placeholder', 'e.g. pcs, kg, ltr, box')}
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={COMMON_UNITS.some((u) => u.value === formData.unit.toLowerCase()) ? formData.unit.toLowerCase() : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFormData({ ...formData, unit: e.target.value });
                  }
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" disabled>
                  {isNepali ? '-- एकाइ छान्नुहोस् --' : '-- Common Units --'}
                </option>
                {COMMON_UNITS.map((u) => (
                  <option key={u.value} value={u.value} className="bg-neutral-900">
                    {u.label}
                  </option>
                ))}
              </select>
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

          {/* Supplier / Vendor Selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNepali ? 'आपूर्तिकर्ता / सप्लायर (वैकल्पिक)' : 'Supplier / Vendor (Optional)'}</span>
            </label>
            <select
              value={formData.vendorId}
              onChange={(e) => {
                const v = vendors.find((vend) => String(vend.id) === e.target.value);
                setFormData({
                  ...formData,
                  vendorId: e.target.value,
                  vendorName: v ? v.name : '',
                });
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">{isNepali ? '-- आपूर्तिकर्ता तोकिएको छैन (None) --' : '-- No Specific Supplier --'}</option>
              {vendors.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name} {v.pan_vat ? `(PAN: ${v.pan_vat})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_cost_price', 'Cost Price')} ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                {t('prod_selling_price', 'Default Selling')} ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              {t('prod_min_alert', 'Minimum Alert Threshold')} ({isNepali ? 'वैकल्पिक' : 'Optional'})
            </label>
            <input
              type="number"
              min="0"
              placeholder={isNepali ? `डिफल्ट: ${lowStockThreshold} एकाइ` : `Default: ${lowStockThreshold} units`}
              value={formData.minStockAlert}
              onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              {t('prod_min_alert_hint', 'Triggers low-stock warning when below threshold.')}
            </p>
          </div>

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
              {t('action_cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              {t('action_save_changes', 'Save Changes')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== DIALOG: CONFIRM DELETE ==================== */}
      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${deletingProduct?.name}"? If this product has been involved in previous sales or purchases, deletion will be blocked to maintain historical financial audit integrity.`}
        confirmText="Delete"
        isDestructive={true}
      />

      {/* ==================== MODAL: RESTOCK PRODUCT ==================== */}
      <Modal
        isOpen={!!selectedRestock}
        onClose={() => {
          setSelectedRestock(null);
          onClearActiveModals?.();
        }}
        title={`Restock: ${selectedRestock?.name}`}
        subtitle="Increases product stock and registers a RESTOCK movement record with supplier attribution."
        maxWidth="md"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current In-Stock Quantity:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedRestock?.current_stock} {selectedRestock?.unit || 'units'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Quantity to Add *
            </label>
            <input
              type="number"
              min="1"
              required
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supplier / Vendor (Optional)</span>
            </label>
            <select
              value={restockVendorId}
              onChange={(e) => setRestockVendorId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">-- No Specific Vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name} {v.pan_vat ? `(PAN: ${v.pan_vat})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Movement Note / Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Delivery Batch #842 from distributor"
              value={restockNote}
              onChange={(e) => setRestockNote(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSelectedRestock(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Confirm Restock
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: ADJUST STOCK ==================== */}
      <Modal
        isOpen={!!selectedAdjust}
        onClose={() => {
          setSelectedAdjust(null);
          onClearActiveModals?.();
        }}
        title={`Adjust Stock: ${selectedAdjust?.name}`}
        subtitle="Manually override inventory level and log an ADJUSTMENT movement."
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current Recorded Stock:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedAdjust?.current_stock} {selectedAdjust?.unit || 'units'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              New Accurate Stock Count *
            </label>
            <input
              type="number"
              required
              value={adjustTargetStock}
              onChange={(e) => setAdjustTargetStock(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            {selectedAdjust && (
              <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                Calculated adjustment delta:{' '}
                <span
                  className={
                    parseInt(adjustTargetStock, 10) - selectedAdjust.current_stock >= 0
                      ? 'text-emerald-400 font-semibold'
                      : 'text-rose-400 font-semibold'
                  }
                >
                  {parseInt(adjustTargetStock, 10) - selectedAdjust.current_stock >= 0 ? '+' : ''}
                  {isNaN(parseInt(adjustTargetStock, 10))
                    ? 0
                    : parseInt(adjustTargetStock, 10) - selectedAdjust.current_stock}{' '}
                  {selectedAdjust.unit || 'units'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Adjustment Reason *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Physical inventory recount / damaged items"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => {
                setSelectedAdjust(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================== MODAL: INDIVIDUAL MOVEMENT HISTORY ==================== */}
      <Modal
        isOpen={selectedMovements !== undefined && selectedMovements !== null}
        onClose={() => {
          setSelectedMovements(null);
          onClearActiveModals?.();
        }}
        title={
          selectedMovements
            ? `Stock Movement Ledger: ${selectedMovements.name}`
            : 'All Stock Movements Audit Log'
        }
        subtitle="Every stock increase, decrease, sale, purchase, and adjustment recorded with timestamp."
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="max-h-[480px] overflow-y-auto border border-neutral-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4 font-mono">Date / Time</th>
                  {!selectedMovements && <th className="py-2.5 px-3">Product</th>}
                  <th className="py-2.5 px-3 text-center">Type</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right font-mono">Qty Delta</th>
                  <th className="py-2.5 px-4">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {movementsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      No stock movement records found for this item.
                    </td>
                  </tr>
                ) : (
                  movementsList.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-neutral-800/30">
                        <td className="py-2.5 px-4 font-mono text-neutral-400 whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </td>
                        {!selectedMovements && (
                          <td className="py-2.5 px-3 font-medium text-neutral-200">
                            {m.product_name}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              m.type === 'RESTOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : m.type === 'PURCHASE'
                                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                : m.type === 'SALE'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">
                          {m.vendor_name || '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-300 break-words">
                          {m.note || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => {
                setSelectedMovements(null);
                onClearActiveModals?.();
              }}
              className="px-4 py-1.5 text-xs text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
