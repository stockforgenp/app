/**
 * Barcode Sticker & Shelf Tag Print Modal
 * Supports:
 * - 50x25mm / 38x25mm Thermal Roll Stickers (TSC, Xprinter, Zebra)
 * - Supermarket Shelf Edge Price Tags (MRP, Name, Barcode, Batch & Expiry)
 * - A4 Grid Sheets (3x8 = 24 labels/sheet)
 */

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Printer,
  Barcode,
  Layers,
  Tag,
  Settings2,
  Check,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Product, ProductBatch } from '../../types/index.ts';
import { BarcodeSvg } from '../../lib/utils/barcode.tsx';
import { formatCurrency } from '../../lib/utils/format.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { getAllBatches } from '../../lib/services/batchService.ts';

export type LabelFormat = 'THERMAL_50X25' | 'THERMAL_38X25' | 'SHELF_TAG' | 'A4_SHEET';

export interface PrintBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol: string;
  product: Product | null;
  storeName?: string;
}

export const PrintBarcodeModal: React.FC<PrintBarcodeModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  product,
  storeName = 'StockForge Retail',
}) => {
  const { isNepali } = useLanguage();

  const [labelFormat, setLabelFormat] = useState<LabelFormat>('THERMAL_50X25');
  const [printCount, setPrintCount] = useState<number>(() => {
    return product ? Math.max(1, Math.min(product.current_stock || 1, 24)) : 1;
  });

  // Display toggles
  const [showStoreName, setShowStoreName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Available batches for this product
  const batches = useMemo(() => {
    if (!product) return [];
    try {
      const all = getAllBatches({ includeEmpty: false });
      return all.filter((b) => b.product_id === product.id);
    } catch {
      return [];
    }
  }, [product]);

  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return batches[0] || null;
    return batches.find((b) => b.id === selectedBatchId) || null;
  }, [batches, selectedBatchId]);

  if (!isOpen || !product) return null;

  const barcodeValue = product.sku?.trim() || `SKU-${product.id.toString().padStart(6, '0')}`;

  const handlePrint = () => {
    window.print();
  };

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
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
                  <span>{isNepali ? 'बारकोड तथा सेल्फ ट्याग प्रिन्ट' : 'Print Barcode Labels & Shelf Tags'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                    {product.name}
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isNepali
                    ? 'थर्मल स्टिकर (TSC/Xprinter) वा सेल्फ मूल्य ट्याग तत्काल प्रिन्ट गर्नुहोस्।'
                    : 'Print direct thermal barcode stickers or supermarket shelf tags.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>{isNepali ? 'प्रिन्ट गर्नुहोस्' : 'Print Labels'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Config Bar */}
          <div className="p-4 bg-neutral-950/50 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
            {/* Format Picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">
                {isNepali ? 'ढाँचा (Format):' : 'Label Type:'}
              </span>
              <select
                value={labelFormat}
                onChange={(e) => setLabelFormat(e.target.value as LabelFormat)}
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200 font-medium focus:outline-none focus:border-cyan-500"
              >
                <option value="THERMAL_50X25">Thermal Roll (50mm × 25mm)</option>
                <option value="THERMAL_38X25">Compact Roll (38mm × 25mm)</option>
                <option value="SHELF_TAG">Shelf Edge Tag (70mm × 35mm)</option>
                <option value="A4_SHEET">A4 Sheet (24 Labels Grid)</option>
              </select>
            </div>

            {/* Copies */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 font-medium">
                {isNepali ? 'प्रतिको संख्या:' : 'Copies:'}
              </span>
              <input
                type="number"
                min="1"
                max="200"
                value={printCount}
                onChange={(e) => setPrintCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-100 font-mono text-center focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setPrintCount(Math.max(1, product.current_stock))}
                className="text-[11px] underline text-cyan-400 hover:text-cyan-300 ml-1"
                title="Fill with current stock count"
              >
                {isNepali ? `स्टक बराबर (${product.current_stock})` : `Match Stock (${product.current_stock})`}
              </button>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0"
                />
                <span>{isNepali ? 'पसलको नाम' : 'Store'}</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0"
                />
                <span>{isNepali ? 'मूल्य (MRP)' : 'Price'}</span>
              </label>

              {batches.length > 0 && (
                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={showExpiry}
                    onChange={(e) => setShowExpiry(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0"
                  />
                  <span>{isNepali ? 'ब्याच र म्याद' : 'Batch/Exp'}</span>
                </label>
              )}
            </div>
          </div>

          {/* Preview Canvas */}
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 flex justify-center items-start">
            <div
              id="printable-barcodes"
              ref={printAreaRef}
              className={`bg-white text-black p-4 rounded-xl shadow-lg flex flex-wrap gap-2.5 justify-center ${
                labelFormat === 'A4_SHEET' ? 'max-w-3xl w-full min-h-[800px] border border-neutral-300' : 'max-w-2xl'
              }`}
            >
              {Array.from({ length: printCount }).map((_, idx) => (
                <div
                  key={idx}
                  className={`border border-neutral-300 rounded p-1.5 flex flex-col justify-between items-center text-center bg-white ${
                    labelFormat === 'SHELF_TAG'
                      ? 'w-[220px] h-[120px] p-2.5 border-dashed border-2 border-neutral-400'
                      : labelFormat === 'THERMAL_38X25'
                      ? 'w-[140px] h-[95px] p-1'
                      : 'w-[185px] h-[105px]'
                  }`}
                  style={{ pageBreakInside: 'avoid' }}
                >
                  {/* Store Name Header */}
                  {showStoreName && (
                    <div className="text-[9px] font-bold tracking-wider uppercase text-neutral-600 line-clamp-1 w-full border-b border-neutral-200 pb-0.5">
                      {storeName}
                    </div>
                  )}

                  {/* Product Title */}
                  <div className="text-[11px] font-bold text-neutral-900 capitalize line-clamp-1 w-full leading-tight mt-0.5">
                    {product.name}
                  </div>

                  {/* Barcode Vector Graphic */}
                  <div className="w-full flex-1 flex flex-col justify-center items-center my-0.5">
                    <BarcodeSvg
                      text={barcodeValue}
                      height={labelFormat === 'SHELF_TAG' ? 36 : 28}
                      showText={false}
                    />
                    <span className="text-[9px] font-mono tracking-wider font-semibold text-neutral-700 mt-0.5">
                      {barcodeValue}
                    </span>
                  </div>

                  {/* Price & Batch Footnote */}
                  <div className="w-full flex items-center justify-between text-[10px] border-t border-neutral-200 pt-0.5">
                    {showPrice ? (
                      <span className="font-bold text-neutral-900 font-mono text-xs">
                        MRP: {formatCurrency(product.selling_price, currencySymbol)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {product.unit || 'pcs'}
                      </span>
                    )}

                    {showExpiry && selectedBatch ? (
                      <span className="text-[8px] font-mono text-neutral-600 text-right">
                        B: {selectedBatch.batch_number} | Exp: {selectedBatch.expiry_date.slice(2)}
                      </span>
                    ) : (
                      <span className="text-[8px] font-mono text-neutral-500">
                        {product.unit || 'pcs'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
