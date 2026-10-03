/**
 * Inventory Management & Valuation View
 * Implements Section 12:
 * - Product, SKU, Current Stock, Cost Price, Selling Price, Inventory Value (stock * cost)
 * - Restock & Adjust stock modals
 * - Stock movements log modal
 * - Search & Low-stock filter toggle
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Boxes,
  ArrowDownUp,
  PackageCheck,
  TrendingDown,
  Receipt,
  CheckSquare,
  Square,
  PlusCircle,
  Edit2,
  ShoppingCart,
} from 'lucide-react';
import { Product, StockMovement } from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import {
  restockProduct,
  adjustStock,
  getStockMovements,
} from '../../lib/services/inventoryService.ts';
import {
  formatCurrency,
  formatNumber,
  formatDateTime,
  fromMinorUnits,
} from '../../lib/utils/format.ts';
import { Modal } from '../common/Modal.tsx';
import { ActionMenu } from '../common/ActionMenu.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface InventoryViewProps {
  currencySymbol: string;
  lowStockThreshold: number;
  allowNegativeStock: boolean;
  activeRestockProduct: Product | null;
  activeAdjustProduct: Product | null;
  activeMovementsProduct: Product | null;
  onClearActiveModals: () => void;
  onEditProduct: (product: Product) => void;
  onStartSaleWithProducts?: (items: Array<{ product: Product; quantity?: number }>) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  currencySymbol,
  lowStockThreshold,
  allowNegativeStock,
  activeRestockProduct,
  activeAdjustProduct,
  activeMovementsProduct,
  onClearActiveModals,
  onEditProduct,
  onStartSaleWithProducts,
}) => {
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<number[]>([]);

  // Local modals
  const [selectedRestock, setSelectedRestock] = useState<Product | null>(activeRestockProduct);
  const [selectedAdjust, setSelectedAdjust] = useState<Product | null>(activeAdjustProduct);
  const [selectedMovements, setSelectedMovements] = useState<Product | null>(activeMovementsProduct);

  const [restockQty, setRestockQty] = useState('10');
  const [restockNote, setRestockNote] = useState('');

  const [adjustTargetStock, setAdjustTargetStock] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');

  // Movements log
  const [movementsList, setMovementsList] = useState<StockMovement[]>([]);

  const toggleSelectProduct = (id: number) => {
    setSelectedInventoryIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (filteredProducts.length === 0) return;
    if (selectedInventoryIds.length === filteredProducts.length) {
      setSelectedInventoryIds([]);
    } else {
      setSelectedInventoryIds(filteredProducts.map((p) => p.id));
    }
  };

  const handleSellSelected = () => {
    const selected = products.filter((p) => selectedInventoryIds.includes(p.id));
    if (selected.length === 0) return;
    if (onStartSaleWithProducts) {
      onStartSaleWithProducts(selected.map((p) => ({ product: p, quantity: 1 })));
      setSelectedInventoryIds([]);
    }
  };

  // Sync props to state if passed from parent
  useEffect(() => {
    if (activeRestockProduct) {
      setSelectedRestock(activeRestockProduct);
      setRestockQty('10');
      setRestockNote('Inventory restock delivery');
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

  const loadData = () => {
    try {
      setProducts(getAllProducts());
    } catch (e) {
      console.error('Error loading inventory:', e);
    }
  };

  const loadMovements = (productId?: number) => {
    try {
      setMovementsList(getStockMovements(productId, 100));
    } catch (e) {
      console.error('Error loading movements:', e);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
      if (selectedMovements) {
        loadMovements(selectedMovements.id);
      }
    });
    return unsubscribe;
  }, [selectedMovements]);

  // Handle restock submit
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestock) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Restock quantity must be at least 1', 'warning');
      return;
    }

    try {
      restockProduct(selectedRestock.id, qty, restockNote);
      showToast(
        `Added +${qty} units to "${selectedRestock.name}". New stock: ${
          selectedRestock.current_stock + qty
        }`,
        'success'
      );
      setSelectedRestock(null);
      onClearActiveModals();
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Handle adjust submit
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
      onClearActiveModals();
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const filteredProducts = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }
    if (onlyLowStock) {
      result = result.filter((p) => p.current_stock <= lowStockThreshold);
    }
    return result;
  }, [products, search, onlyLowStock, lowStockThreshold]);

  // Aggregate stats
  const totals = useMemo(() => {
    let units = 0;
    let valuation = 0;
    let lowCount = 0;

    for (const p of products) {
      units += p.current_stock;
      if (p.current_stock > 0) {
        valuation += p.current_stock * p.cost_price;
      }
      if (p.current_stock <= lowStockThreshold) {
        lowCount++;
      }
    }

    return { units, valuation, lowCount };
  }, [products, lowStockThreshold]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">
            {t('inv_title', 'Inventory & Stock Valuation')}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {t('inv_subtitle', 'Valuation calculated exactly as Current Stock × Snapshot Cost Price')}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setSelectedMovements(null);
            loadMovements();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('inv_audit_log_btn', 'Full Stock Movement Audit Log')}</span>
        </motion.button>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">{t('inv_total_units', 'Total In-Stock Units')}</div>
          <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
            {formatNumberByLang(totals.units)} <span className="text-xs font-normal text-neutral-400">{isNepali ? 'एकाइ' : 'units'}</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-xs text-neutral-400">{t('inv_total_valuation', 'Total Inventory Valuation')}</div>
          <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {formatCurrency(totals.valuation, currencySymbol)}
          </div>
        </motion.div>

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
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              onlyLowStock
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            {onlyLowStock
              ? t('inv_showing_low_stock', 'Showing Low Stock')
              : t('inv_filter_low_stock', 'Filter Low Stock')}
          </motion.button>
        </motion.div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('inv_search_placeholder', 'Search inventory by title or SKU...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${
              onlyLowStock
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {onlyLowStock
                ? t('inv_showing_low_stock', 'Showing Low Stock')
                : t('inv_filter_low_stock', 'Low Stock Only')}{' '}
              ({formatNumberByLang(totals.lowCount)})
            </span>
          </button>
        </div>
      </div>

      {/* Multi-Select Floating Action Bar */}
      {selectedInventoryIds.length > 0 && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-neutral-200">
            <span className="font-bold text-emerald-400 font-mono text-sm">{formatNumberByLang(selectedInventoryIds.length)}</span>
            <span>{isNepali ? 'सामान छानिएको' : 'inventory items selected'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedInventoryIds([])}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
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
                  ? `छानिएका सामान बेच्नुहोस् (${formatNumberByLang(selectedInventoryIds.length)})`
                  : `Sell Selected Items (${selectedInventoryIds.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Inventory Valuation Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredProducts.length > 0 &&
                      selectedInventoryIds.length === filteredProducts.length
                    }
                    onChange={toggleSelectAll}
                    title="Select/Deselect all filtered items"
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-6">{t('inv_col_product', 'Product')}</th>
                <th className="py-3 px-4 font-mono">{t('inv_col_sku', 'SKU')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('inv_col_cost', 'Cost Price')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('inv_col_selling', 'Default Selling')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('inv_col_stock', 'Stock Units')}</th>
                <th className="py-3 px-4 text-right font-mono">{t('inv_col_valuation', 'Inventory Value')}</th>
                <th className="py-3 px-6 text-right">{t('inv_col_actions', 'Stock Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400 text-xs">
                    <Boxes className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    No inventory records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.current_stock <= lowStockThreshold;
                  const isSelected = selectedInventoryIds.includes(p.id);
                  const itemValuation = Math.max(0, p.current_stock * p.cost_price);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
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
                        <div className="text-[11px] text-neutral-500 font-mono">ID: #{p.id}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-400">
                        <span>{p.sku || '—'}</span>
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                          {p.unit || 'pcs'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                        {formatCurrency(p.cost_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-300 tabular-nums">
                        {formatCurrency(p.selling_price, currencySymbol)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={`font-semibold ${
                            isLow ? 'text-amber-400' : 'text-neutral-100'
                          }`}
                        >
                          {p.current_stock}
                        </span>
                        <span className="text-[11px] text-neutral-400 ml-1 font-sans">
                          {p.unit || 'pcs'}
                        </span>
                        {isLow && (
                          <span className="ml-1 text-[10px] text-amber-500 font-sans">
                            low
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                        {formatCurrency(itemValuation, currencySymbol)}
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
                                label: 'Restock Batch',
                                icon: PlusCircle,
                                color: 'emerald',
                                action: () => {
                                  setSelectedRestock(p);
                                  setRestockQty('10');
                                  setRestockNote('Replenishment restock');
                                },
                              },
                              {
                                label: 'Adjust Count',
                                icon: SlidersHorizontal,
                                color: 'amber',
                                action: () => {
                                  setSelectedAdjust(p);
                                  setAdjustTargetStock(p.current_stock.toString());
                                  setAdjustNote('Stock count adjustment');
                                },
                              },
                              {
                                label: 'Movement Ledger',
                                icon: History,
                                color: 'indigo',
                                action: () => {
                                  setSelectedMovements(p);
                                  loadMovements(p.id);
                                },
                              },
                              {
                                label: 'Edit in Catalog',
                                icon: Edit2,
                                color: 'default',
                                divider: true,
                                action: () => onEditProduct(p),
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

      {/* Modal: Restock Product */}
      <Modal
        isOpen={!!selectedRestock}
        onClose={() => {
          setSelectedRestock(null);
          onClearActiveModals();
        }}
        title={`Restock: ${selectedRestock?.name}`}
        subtitle="Increases product stock and registers a RESTOCK movement record."
        maxWidth="md"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current In-Stock Quantity:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedRestock?.current_stock} units
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
                onClearActiveModals();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
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

      {/* Modal: Adjust Stock */}
      <Modal
        isOpen={!!selectedAdjust}
        onClose={() => {
          setSelectedAdjust(null);
          onClearActiveModals();
        }}
        title={`Adjust Stock: ${selectedAdjust?.name}`}
        subtitle="Manually override inventory level and log an ADJUSTMENT movement."
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <span className="text-neutral-400">Current Recorded Stock:</span>
            <span className="font-mono font-bold text-neutral-100">
              {selectedAdjust?.current_stock} units
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
                  units
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
                onClearActiveModals();
              }}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
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

      {/* Modal: Movement History Audit */}
      <Modal
        isOpen={selectedMovements !== undefined && selectedMovements !== null}
        onClose={() => {
          setSelectedMovements(undefined as unknown as null);
          onClearActiveModals();
        }}
        title={
          selectedMovements
            ? `Stock Movement History: ${selectedMovements.name}`
            : 'All Stock Movements Audit Log'
        }
        subtitle="Every stock increase, decrease, sale, and adjustment is recorded with timestamp."
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="max-h-[480px] overflow-y-auto border border-neutral-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium sticky top-0 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4">Date / Time</th>
                  {!selectedMovements && <th className="py-2.5 px-3">Product</th>}
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right font-mono">Qty Delta</th>
                  <th className="py-2.5 px-4">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {movementsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      No stock movement records found.
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
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              m.type === 'RESTOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : m.type === 'SALE'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {m.type}
                          </span>
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
                setSelectedMovements(undefined as unknown as null);
                onClearActiveModals();
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
