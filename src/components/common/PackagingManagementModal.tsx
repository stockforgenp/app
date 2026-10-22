/**
 * Multi-UOM & Packaging Hierarchy Management Modal
 * Allows store managers to configure unit conversion hierarchies
 * (e.g., 1 Carton = 24 pcs, 1 Sack = 25 kg, 1 Box = 10 strips).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Search,
  Package,
  Barcode,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Product, ProductPackaging } from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import {
  getAllPackagings,
  createPackaging,
  deletePackaging,
} from '../../lib/services/packagingService.ts';
import { formatCurrency, toMinorUnits, fromMinorUnits } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export interface PackagingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
}

export const PackagingManagementModal: React.FC<PackagingManagementModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
}) => {
  const { isNepali } = useLanguage();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');

  // Form states
  const [newPackageName, setNewPackageName] = useState('');
  const [newPackageUnit, setNewPackageUnit] = useState('');
  const [newMultiplier, setNewMultiplier] = useState('10');
  const [newSellingPrice, setNewSellingPrice] = useState('');
  const [newBarcode, setNewBarcode] = useState('');

  const loadData = () => {
    try {
      const prods = getAllProducts();
      setProducts(prods);
      const pkgs = getAllPackagings();
      setPackagings(pkgs);
      if (prods.length > 0 && selectedProductId === '') {
        setSelectedProductId(prods[0].id);
      }
    } catch (e) {
      console.error('Failed to load packaging data:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const filteredPackagings = useMemo(() => {
    return packagings.filter((pkg) => {
      const prod = productMap.get(pkg.product_id);
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const matchProd = prod?.name.toLowerCase().includes(q) || prod?.sku?.toLowerCase().includes(q);
      const matchPkg = pkg.package_name.toLowerCase().includes(q) || (pkg.barcode && pkg.barcode.toLowerCase().includes(q));
      return matchProd || matchPkg;
    });
  }, [packagings, productMap, search]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast(isNepali ? 'कृपया वस्तु चयन गर्नुहोस्।' : 'Please select a product.', 'warning');
      return;
    }
    if (!newPackageName.trim()) {
      showToast(isNepali ? 'प्याकेजको नाम लेख्नुहोस्।' : 'Package name is required.', 'warning');
      return;
    }
    const mult = parseInt(newMultiplier, 10);
    if (isNaN(mult) || mult <= 1) {
      showToast(
        isNepali ? 'गुणक (Multiplier) कम्तीमा २ हुनुपर्छ।' : 'Multiplier must be at least 2.',
        'warning'
      );
      return;
    }

    try {
      const prod = productMap.get(Number(selectedProductId));
      const sellingMinor = newSellingPrice.trim() !== '' ? toMinorUnits(newSellingPrice) : null;
      createPackaging({
        productId: Number(selectedProductId),
        packageName: newPackageName.trim(),
        packageUnit: newPackageUnit.trim() || newPackageName.trim().slice(0, 4).toLowerCase(),
        multiplier: mult,
        sellingPrice: sellingMinor,
        barcode: newBarcode.trim() || null,
      });

      showToast(
        isNepali
          ? `नयाँ प्याकेजिङ '${newPackageName}' (${prod?.name}) थपियो!`
          : `Added packaging '${newPackageName}' for ${prod?.name}!`,
        'success'
      );

      // Reset form
      setNewPackageName('');
      setNewPackageUnit('');
      setNewMultiplier('10');
      setNewSellingPrice('');
      setNewBarcode('');

      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(isNepali ? `'${name}' प्याकेजिङ नियम हटाउन निश्चित हुनुहुन्छ?` : `Delete packaging rule '${name}'?`)) {
      return;
    }
    try {
      deletePackaging(id);
      showToast(isNepali ? 'प्याकेजिङ नियम हटाइयो।' : 'Packaging rule removed.', 'info');
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  if (!isOpen) return null;

  const currentSelectedProd = selectedProductId ? productMap.get(Number(selectedProductId)) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span>{isNepali ? 'एकाइ तथा प्याकेजिङ व्यवस्थापन' : 'Packaging & Multi-UOM Rules'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    {packagings.length} {isNepali ? 'नियमहरू' : 'rules'}
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'थोक पेटी, कार्टुन वा बोरालाई आधारभूत एकाइमा स्वचालित रूपान्तरण गर्नुहोस्।'
                    : 'Configure bulk packaging conversions (e.g. 1 Carton = 24 pcs, 1 Sack = 25 kg).'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Add New Packaging Rule */}
            <div className="lg:col-span-5 bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-4 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>{isNepali ? 'नयाँ प्याकेजिङ नियम थप्नुहोस्' : 'Create Packaging Conversion'}</span>
              </h3>

              <form onSubmit={handleCreate} className="space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Product Selector */}
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'वस्तु (Product)' : 'Select Product'} *
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- {isNepali ? 'वस्तु रोज्नुहोस्' : 'Choose a product'} --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Base: {p.unit || 'pcs'}, Stk: {p.current_stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Packaging Name & Unit */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                        {isNepali ? 'प्याकेजको नाम' : 'Package Name'} *
                      </label>
                      <input
                        type="text"
                        placeholder={isNepali ? 'उदा: Carton, बोरा' : 'e.g. Carton, Box'}
                        value={newPackageName}
                        onChange={(e) => setNewPackageName(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                        {isNepali ? 'संकेत (Unit)' : 'Unit Code'}
                      </label>
                      <input
                        type="text"
                        placeholder="ctn, box, sack"
                        value={newPackageUnit}
                        onChange={(e) => setNewPackageUnit(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Multiplier */}
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'गुणक परिमाण (Multiplier)' : 'Multiplier (Base Units per Package)'} *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 font-medium">1 {newPackageName || 'Pkg'} =</span>
                      <input
                        type="number"
                        min="2"
                        value={newMultiplier}
                        onChange={(e) => setNewMultiplier(e.target.value)}
                        className="w-24 bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-xs text-neutral-300 font-mono">
                        {currentSelectedProd?.unit || 'pcs'}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      {isNepali
                        ? `खरिद वा बिक्री गर्दा १ ${newPackageName || 'प्याकेज'} ले ${newMultiplier || 1} ${currentSelectedProd?.unit || 'pcs'} मौज्दात असर पार्छ।`
                        : `Selling/buying 1 ${newPackageName || 'package'} moves ${newMultiplier || 1} base ${currentSelectedProd?.unit || 'pcs'} in stock.`}
                    </p>
                  </div>

                  {/* Optional Selling Price */}
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'प्याकेज बिक्री मूल्य (ऐच्छिक)' : `Package Selling Price (${currencySymbol})`}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={
                        currentSelectedProd
                          ? `${fromMinorUnits(currentSelectedProd.selling_price * (parseInt(newMultiplier, 10) || 1))}`
                          : 'Auto-calculated'
                      }
                      value={newSellingPrice}
                      onChange={(e) => setNewSellingPrice(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Optional Barcode */}
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      {isNepali ? 'प्याकेज बारकोड (ऐच्छिक)' : 'Package Barcode (Optional)'}
                    </label>
                    <div className="relative">
                      <Barcode className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="e.g. 8901234567890"
                        value={newBarcode}
                        onChange={(e) => setNewBarcode(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-cyan-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isNepali ? 'नियम सुरक्षित गर्नुहोस्' : 'Save Packaging Rule'}</span>
                </button>
              </form>
            </div>

            {/* Right: Existing Packagings Table */}
            <div className="lg:col-span-7 flex flex-col">
              {/* Search bar */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={isNepali ? 'वस्तु वा प्याकेज नाम खोज्नुहोस्...' : 'Search product or packaging name...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto bg-neutral-950/60 border border-neutral-800 rounded-xl">
                {filteredPackagings.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400">
                    <Package className="w-8 h-8 mx-auto text-neutral-600 mb-2 opacity-50" />
                    <p className="text-xs">
                      {isNepali ? 'कुनै प्याकेजिङ नियम भेटिएन।' : 'No packaging rules found.'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {isNepali ? 'बायाँ फारमबाट नयाँ नियम सिर्जना गर्नुहोस्।' : 'Create one using the form on the left.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900/90 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Packaging</th>
                        <th className="py-2.5 px-3 text-center">Multiplier</th>
                        <th className="py-2.5 px-3 text-right">Selling Price</th>
                        <th className="py-2.5 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {filteredPackagings.map((pkg) => {
                        const prod = productMap.get(pkg.product_id);
                        const effectivePrice =
                          pkg.selling_price || (prod ? prod.selling_price * pkg.multiplier : 0);

                        return (
                          <tr key={pkg.id} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-neutral-200 capitalize">
                                {prod?.name || `Product #${pkg.product_id}`}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono">
                                Base: {prod?.unit || 'pcs'} · Stock: {prod?.current_stock ?? 0}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-cyan-300 flex items-center gap-1.5">
                                <span className="capitalize">{pkg.package_name}</span>
                                <span className="text-[10px] font-mono px-1 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-400">
                                  {pkg.package_unit}
                                </span>
                              </div>
                              {pkg.barcode && (
                                <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 mt-0.5">
                                  <Barcode className="w-3 h-3 text-neutral-500" />
                                  <span>{pkg.barcode}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-200 font-mono text-[11px] font-semibold">
                                <span>1 {pkg.package_unit}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-cyan-400" />
                                <span>{pkg.multiplier} {prod?.unit || 'pcs'}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-200">
                              {formatCurrency(effectivePrice, currencySymbol)}
                              {!pkg.selling_price && (
                                <div className="text-[9px] text-neutral-500 font-sans">
                                  {isNepali ? 'स्वचालित (Auto)' : 'Auto calculated'}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDelete(pkg.id, pkg.package_name)}
                                className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                                title="Delete packaging rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

