/**
 * Sales POS / New Sale Checkout View
 * Implements Sections 4, 5, 6:
 * - Multi-product transaction
 * - Default vs Actual sale price per item
 * - Absolute monetary discount per item
 * - Real-time stock validation (prevents negative stock if setting is OFF)
 * - Complete transactional checkout with snapshot cost prices
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Layers,
  ListChecks,
  CheckSquare,
  Square,
  Minus,
  ScanLine,
  Percent,
  Printer,
  X,
} from 'lucide-react';
import { Product, CartItem } from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import { processSale } from '../../lib/services/salesService.ts';
import { calculateProportionalDiscounts } from '../../lib/utils/discountUtils.ts';
import {
  formatCurrency,
  fromMinorUnits,
  toMinorUnits,
} from '../../lib/utils/format.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';
import { Modal } from '../common/Modal.tsx';
import { PrintBillModal } from '../common/PrintBillModal.tsx';
import { Input } from '../common/Input.tsx';
import { CustomerInputSection, CustomerInputData } from '../common/CustomerInputSection.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface SalesViewProps {
  currencySymbol: string;
  allowNegativeStock: boolean;
  onSaleCompleted: (saleId: number) => void;
  initialProducts?: Array<{ product: Product; quantity?: number }>;
  onClearInitialProducts?: () => void;
  onRestockProduct?: (product: Product) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  currencySymbol,
  allowNegativeStock,
  onSaleCompleted,
  initialProducts,
  onClearInitialProducts,
  onRestockProduct,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'lowStock'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerData, setCustomerData] = useState<CustomerInputData>({
    customerId: null,
    name: '',
    phone: '',
    email: '',
    pan_vat: '',
    address: '',
    isNew: false,
  });
  const [completedSaleInfo, setCompletedSaleInfo] = useState<{
    id: number;
    billNumber?: string | null;
    subtotal: number;
    discount: number;
    taxableAmount?: number;
    vatAmount?: number;
    grandTotal?: number;
    total: number;
    customerName?: string | null;
    customerPhone?: string | null;
    customerPanVat?: string | null;
  } | null>(null);

  // Bill Printing modal
  const [printSaleId, setPrintSaleId] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Quick Multi-SKU input right on POS
  const [quickSkuInput, setQuickSkuInput] = useState('');

  // Whole / Overall Sale Discount State (proportionally divided across line items)
  const [wholeDiscountValue, setWholeDiscountValue] = useState('');
  const [wholeDiscountType, setWholeDiscountType] = useState<'fixed' | 'percent'>('fixed');

  // Bulk / Whole Discount Modal
  const [isBulkDiscountModalOpen, setIsBulkDiscountModalOpen] = useState(false);
  const [bulkDiscountTab, setBulkDiscountTab] = useState<'proportional' | 'uniform'>('proportional');
  const [bulkDiscountType, setBulkDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [bulkDiscountValue, setBulkDiscountValue] = useState('');

  // Multi-Product Batch Mode States
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isMultiProductModalOpen, setIsMultiProductModalOpen] = useState(false);
  const [batchQuantities, setBatchQuantities] = useState<Record<number, number>>({});
  
  // Bulk SKU entry in modal
  const [modalTab, setModalTab] = useState<'checklist' | 'bulkSku'>('checklist');
  const [bulkSkuInput, setBulkSkuInput] = useState('');
  const [modalSearch, setModalSearch] = useState('');

  const quickSkuInputRef = useRef<HTMLInputElement>(null);

  const loadCatalog = () => {
    try {
      setProducts(getAllProducts());
    } catch (e) {
      console.error('Error fetching catalog:', e);
    }
  };

  useEffect(() => {
    loadCatalog();
    const unsubscribe = subscribeToDbChanges(loadCatalog);
    return unsubscribe;
  }, []);

  // Filter products for catalog
  const availableProducts = useMemo(() => {
    let list = products;
    if (stockFilter === 'inStock') {
      list = list.filter((p) => p.current_stock > 0);
    } else if (stockFilter === 'lowStock') {
      list = list.filter((p) => p.current_stock <= 10);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.id.toString() === q
    );
  }, [products, search, stockFilter]);

  // Filter products for modal
  const modalFilteredProducts = useMemo(() => {
    if (!modalSearch.trim()) return products;
    const q = modalSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, modalSearch]);

  const handleAddToCart = (product: Product) => {
    // Check if already in cart
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const newQty = existing.quantity + 1;

      // Validate stock
      if (!allowNegativeStock && newQty > product.current_stock) {
        showToast(
          `Cannot add more. Only ${product.current_stock} in stock for "${product.name}".`,
          'warning'
        );
        return;
      }

      const updated = [...cart];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
      };
      setCart(updated);
    } else {
      // Validate initial 1 quantity
      if (!allowNegativeStock && product.current_stock < 1) {
        showToast(`"${product.name}" is currently out of stock.`, 'warning');
        return;
      }

      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          actual_selling_price: product.selling_price, // default selling price
          discount: 0, // 0 discount
        },
      ]);
    }
  };

  // Add multiple products to the sale cart in one batch operation
  const handleBatchAddToCart = (itemsToAdd: Array<{ product: Product; quantity: number }>) => {
    if (itemsToAdd.length === 0) {
      showToast('No items selected to add', 'warning');
      return;
    }

    let updatedCart = [...cart];
    let addedCount = 0;
    let skippedCount = 0;

    for (const item of itemsToAdd) {
      const qty = Math.max(1, Math.floor(item.quantity));
      const existingIndex = updatedCart.findIndex((ci) => ci.product.id === item.product.id);

      if (existingIndex >= 0) {
        const currentQty = updatedCart[existingIndex].quantity;
        let newQty = currentQty + qty;

        if (!allowNegativeStock && newQty > item.product.current_stock) {
          if (currentQty >= item.product.current_stock) {
            skippedCount++;
            continue;
          }
          newQty = item.product.current_stock;
        }

        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: newQty,
        };
        addedCount++;
      } else {
        let finalQty = qty;
        if (!allowNegativeStock && finalQty > item.product.current_stock) {
          if (item.product.current_stock <= 0) {
            skippedCount++;
            continue;
          }
          finalQty = item.product.current_stock;
        }

        updatedCart.push({
          product: item.product,
          quantity: finalQty,
          actual_selling_price: item.product.selling_price,
          discount: 0,
        });
        addedCount++;
      }
    }

    setCart(updatedCart);

    if (addedCount > 0) {
      showToast(
        `Added ${addedCount} product${addedCount > 1 ? 's' : ''} to transaction`,
        'success'
      );
    }
    if (skippedCount > 0) {
      showToast(
        `${skippedCount} product${skippedCount > 1 ? 's were' : ' was'} skipped due to insufficient stock`,
        'warning'
      );
    }
  };

  // Pre-load products if passed from outside (e.g. ProductsView or InventoryView multi-select)
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      handleBatchAddToCart(
        initialProducts.map((p) => ({
          product: p.product,
          quantity: p.quantity || 1,
        }))
      );
      onClearInitialProducts?.();
    }
  }, [initialProducts]);

  // Toggle selection for batch map
  const toggleBatchItem = (productId: number, defaultQty: number = 1) => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      if (next[productId] !== undefined) {
        delete next[productId];
      } else {
        const prod = products.find((p) => p.id === productId);
        if (!allowNegativeStock && prod && prod.current_stock <= 0) {
          showToast(`"${prod.name}" is out of stock.`, 'warning');
          return prev;
        }
        const maxStock = prod ? prod.current_stock : Infinity;
        next[productId] = !allowNegativeStock ? Math.min(defaultQty, Math.max(1, maxStock)) : defaultQty;
      }
      return next;
    });
  };

  const updateBatchQty = (productId: number, qty: number) => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[productId];
      } else {
        const prod = products.find((p) => p.id === productId);
        const maxStock = prod ? prod.current_stock : Infinity;
        if (!allowNegativeStock && qty > maxStock) {
          next[productId] = Math.max(1, maxStock);
          showToast(
            `Quantity cannot exceed available stock (${maxStock} ${prod?.unit || 'pcs'} for "${prod?.name || 'Item'}").`,
            'warning'
          );
        } else {
          next[productId] = qty;
        }
      }
      return next;
    });
  };

  const selectAllFilteredInCatalog = () => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      availableProducts.forEach((p) => {
        if (!allowNegativeStock && p.current_stock <= 0) return;
        if (!next[p.id]) {
          next[p.id] = 1;
        }
      });
      return next;
    });
  };

  // Quick Barcode / Multi-SKU submit handler
  const handleQuickSkuSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickSkuInput.trim()) return;

    const tokens = quickSkuInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const itemsToAdd: Array<{ product: Product; quantity: number }> = [];
    const notFound: string[] = [];

    for (const token of tokens) {
      const match = token.match(/^(.+?)(?:[*x:]\s*(\d+))?$/i);
      if (!match) continue;

      const code = match[1].trim().toLowerCase();
      const qty = match[2] ? parseInt(match[2], 10) : 1;

      const product = products.find(
        (p) =>
          (p.sku && p.sku.toLowerCase() === code) ||
          p.id.toString() === code ||
          p.name.toLowerCase() === code ||
          p.name.toLowerCase().startsWith(code)
      );

      if (product) {
        itemsToAdd.push({ product, quantity: isNaN(qty) || qty <= 0 ? 1 : qty });
      } else {
        notFound.push(token);
      }
    }

    if (itemsToAdd.length > 0) {
      handleBatchAddToCart(itemsToAdd);
      setQuickSkuInput('');
    }

    if (notFound.length > 0) {
      showToast(
        `Could not match: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? '...' : ''}`,
        'warning'
      );
    }
  };

  // Bulk or Proportional Whole discount across all current cart items
  const handleApplyBulkDiscount = () => {
    const val = parseFloat(bulkDiscountValue);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid positive discount value', 'warning');
      return;
    }

    if (bulkDiscountTab === 'proportional') {
      setWholeDiscountValue(bulkDiscountValue);
      setWholeDiscountType(bulkDiscountType);
      setIsBulkDiscountModalOpen(false);
      setBulkDiscountValue('');
      showToast(
        `Applied whole discount of ${
          bulkDiscountType === 'fixed'
            ? formatCurrency(toMinorUnits(val), currencySymbol)
            : `${val}%`
        } divided proportionally across ${cart.length} items`,
        'success'
      );
    } else {
      const updated = cart.map((item) => {
        let discountMinor = 0;
        if (bulkDiscountType === 'fixed') {
          discountMinor = toMinorUnits(val);
        } else {
          const gross = item.quantity * item.actual_selling_price;
          discountMinor = Math.round((gross * Math.min(100, val)) / 100);
        }
        const lineGross = item.quantity * item.actual_selling_price;
        return {
          ...item,
          discount: Math.min(lineGross, discountMinor),
        };
      });

      setCart(updated);
      setIsBulkDiscountModalOpen(false);
      setBulkDiscountValue('');
      showToast(`Applied uniform discount across ${cart.length} items`, 'success');
    }
  };

  // Live preview for proportional whole discount in modal
  const modalProportionalPreview = useMemo(() => {
    if (bulkDiscountTab !== 'proportional' || !isBulkDiscountModalOpen || cart.length === 0) {
      return null;
    }
    const val = parseFloat(bulkDiscountValue) || 0;
    if (val <= 0) return null;

    let subtotal = 0;
    const itemsForDiscount = cart.map((item) => {
      const gross = item.quantity * item.actual_selling_price;
      subtotal += gross;
      return { gross, individualDiscount: item.discount };
    });

    let targetWholeMinor = 0;
    if (bulkDiscountType === 'percent') {
      targetWholeMinor = Math.round((subtotal * Math.min(100, val)) / 100);
    } else {
      targetWholeMinor = Math.min(subtotal, toMinorUnits(val));
    }

    const distributed = calculateProportionalDiscounts(itemsForDiscount, targetWholeMinor);
    return {
      subtotal,
      targetWholeMinor,
      items: cart.map((item, idx) => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit: item.product.unit || 'pcs',
        gross: itemsForDiscount[idx].gross,
        allocatedWhole: distributed[idx]?.allocatedWholeDiscount || 0,
        effectiveNet: distributed[idx]?.effectiveNet || itemsForDiscount[idx].gross,
      })),
    };
  }, [bulkDiscountTab, isBulkDiscountModalOpen, cart, bulkDiscountValue, bulkDiscountType]);

  const selectAllFilteredInModal = () => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      modalFilteredProducts.forEach((p) => {
        if (!allowNegativeStock && p.current_stock <= 0) return;
        if (!next[p.id]) {
          next[p.id] = 1;
        }
      });
      return next;
    });
  };

  const clearBatchSelections = () => {
    setBatchQuantities({});
  };

  const submitBatchFromQuantities = () => {
    const itemsToAdd: Array<{ product: Product; quantity: number }> = [];
    for (const [pIdStr, qty] of Object.entries(batchQuantities)) {
      const pId = parseInt(pIdStr, 10);
      const product = products.find((p) => p.id === pId);
      if (product && qty > 0) {
        itemsToAdd.push({ product, quantity: qty });
      }
    }

    if (itemsToAdd.length === 0) {
      showToast('Select at least one product with quantity > 0', 'warning');
      return;
    }

    handleBatchAddToCart(itemsToAdd);
    setBatchQuantities({});
    setIsMultiProductModalOpen(false);
  };

  // Handle parsing multiple SKUs / Barcodes typed or pasted in bulk format
  // Format examples: "BEV-CC-500, SNK-CHP-050", or with counts "BEV-CC-500*3, SNK-CHP-050*2"
  const handleBulkSkuSubmit = () => {
    if (!bulkSkuInput.trim()) {
      showToast('Please enter at least one SKU or product name', 'warning');
      return;
    }

    const tokens = bulkSkuInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const itemsToAdd: Array<{ product: Product; quantity: number }> = [];
    const notFound: string[] = [];

    for (const token of tokens) {
      // Check if quantity multiplier specified (e.g. SKU*5 or SKU:5 or SKU x 5)
      const match = token.match(/^(.+?)(?:[*x:]\s*(\d+))?$/i);
      if (!match) continue;

      const code = match[1].trim().toLowerCase();
      const qty = match[2] ? parseInt(match[2], 10) : 1;

      // Find matching product by SKU, exact ID, or Name
      const product = products.find(
        (p) =>
          (p.sku && p.sku.toLowerCase() === code) ||
          p.id.toString() === code ||
          p.name.toLowerCase() === code
      );

      if (product) {
        itemsToAdd.push({ product, quantity: isNaN(qty) || qty <= 0 ? 1 : qty });
      } else {
        notFound.push(token);
      }
    }

    if (itemsToAdd.length > 0) {
      handleBatchAddToCart(itemsToAdd);
      setBulkSkuInput('');
      setIsMultiProductModalOpen(false);
    }

    if (notFound.length > 0) {
      showToast(
        `Could not match: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? '...' : ''}`,
        'warning'
      );
    }
  };

  const handleUpdateQuantity = (index: number, qtyStr: string) => {
    const rawQty = parseInt(qtyStr, 10);
    const updated = [...cart];
    const item = updated[index];
    if (!item) return;

    const availableStock = item.product.current_stock;

    if (isNaN(rawQty) || rawQty <= 0) {
      item.quantity = 1;
    } else if (!allowNegativeStock && rawQty > availableStock) {
      item.quantity = Math.max(1, availableStock);
      showToast(
        `Quantity cannot exceed available stock (${availableStock} ${item.product.unit || 'pcs'} for "${item.product.name}").`,
        'warning'
      );
    } else {
      item.quantity = rawQty;
    }
    setCart(updated);
  };

  const handleUpdateActualPrice = (index: number, priceStr: string) => {
    const updated = [...cart];
    updated[index].actual_selling_price = toMinorUnits(priceStr);
    setCart(updated);
  };

  const handleUpdateDiscount = (index: number, discountStr: string) => {
    const updated = [...cart];
    updated[index].discount = toMinorUnits(discountStr);
    setCart(updated);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setWholeDiscountValue('');
    setWholeDiscountType('fixed');
    setCustomerData({
      customerId: null,
      name: '',
      phone: '',
      email: '',
      pan_vat: '',
      address: '',
      isNew: false,
    });
  };

  // Calculations with Proportional Whole Discount Division
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalUnits = 0;
    let hasStockViolation = false;
    let violationMessage = '';

    const itemsForDiscount = cart.map((item) => {
      const gross = item.quantity * item.actual_selling_price;
      subtotal += gross;
      totalUnits += item.quantity;

      if (!allowNegativeStock && item.quantity > item.product.current_stock) {
        hasStockViolation = true;
        violationMessage = `Item "${item.product.name}" exceeds current stock (${item.quantity} > ${item.product.current_stock})`;
      }

      return {
        gross,
        individualDiscount: item.discount,
      };
    });

    // Calculate target whole discount in minor units
    const rawWholeVal = parseFloat(wholeDiscountValue) || 0;
    let targetWholeDiscountMinor = 0;
    if (rawWholeVal > 0 && subtotal > 0) {
      if (wholeDiscountType === 'percent') {
        targetWholeDiscountMinor = Math.round((subtotal * Math.min(100, rawWholeVal)) / 100);
      } else {
        targetWholeDiscountMinor = Math.min(subtotal, toMinorUnits(rawWholeVal));
      }
    }

    // Distribute whole discount proportionally across all items based on item gross
    const distributedResults = calculateProportionalDiscounts(
      itemsForDiscount,
      targetWholeDiscountMinor
    );

    let totalIndividualDiscount = 0;
    let totalAllocatedWholeDiscount = 0;
    let totalDiscount = 0;

    const itemsWithDiscounts = cart.map((item, index) => {
      const gross = itemsForDiscount[index].gross;
      const indiv = Math.min(gross, item.discount);
      const result = distributedResults[index] || {
        allocatedWholeDiscount: 0,
        totalDiscount: indiv,
        effectiveNet: Math.max(0, gross - indiv),
      };

      totalIndividualDiscount += indiv;
      totalAllocatedWholeDiscount += result.allocatedWholeDiscount;
      totalDiscount += result.totalDiscount;

      return {
        ...item,
        gross,
        individualDiscount: indiv,
        allocatedWholeDiscount: result.allocatedWholeDiscount,
        effectiveTotalDiscount: result.totalDiscount,
        netTotal: result.effectiveNet,
      };
    });

    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const vatRate = 13.0;
    const vatAmount = Math.round(taxableAmount * 0.13);
    const grandTotal = taxableAmount + vatAmount;

    return {
      subtotal,
      totalIndividualDiscount,
      wholeDiscountAmount: totalAllocatedWholeDiscount,
      totalDiscount,
      taxableAmount,
      vatRate,
      vatAmount,
      grandTotal,
      total: grandTotal,
      totalUnits,
      itemsWithDiscounts,
      hasStockViolation,
      violationMessage,
    };
  }, [cart, allowNegativeStock, wholeDiscountValue, wholeDiscountType]);

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast('Please add at least one product to the sale', 'warning');
      return;
    }

    if (calculations.hasStockViolation) {
      showToast(calculations.violationMessage, 'error');
      return;
    }

    try {
      const itemsInput = calculations.itemsWithDiscounts.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        actualSellingPrice: item.actual_selling_price,
        discount: item.effectiveTotalDiscount,
      }));

      const sale = processSale(
        itemsInput,
        {
          customerId: customerData.customerId || undefined,
          customerName: customerData.name.trim() || undefined,
          customerPhone: customerData.phone.trim() || undefined,
          customerEmail: customerData.email.trim() || undefined,
          customerPanVat: customerData.pan_vat.trim() || undefined,
          customerAddress: customerData.address.trim() || undefined,
          customerInput: {
            name: customerData.name.trim(),
            phone: customerData.phone.trim() || undefined,
            email: customerData.email.trim() || undefined,
            pan_vat: customerData.pan_vat.trim() || undefined,
            address: customerData.address.trim() || undefined,
          },
        }
      );

      showToast(`Sale #${sale.id} completed successfully!`, 'success');

      // Alert the user if any product's stock levels fall to or below their specific minimum alert threshold
      if (sale.lowStockAlerts && sale.lowStockAlerts.length > 0) {
        sale.lowStockAlerts.forEach((alert) => {
          showToast(
            `"${alert.productName}" stock is now ${alert.remainingStock} unit${
              alert.remainingStock === 1 ? '' : 's'
            } (below minimum alert threshold of ${alert.threshold}). Restock recommended!`,
            'warning',
            {
              title: '⚠️ Low Stock Alert',
              duration: 8500,
              action: onRestockProduct
                ? {
                    label: 'Restock Product',
                    onClick: () => {
                      const prod = products.find((p) => p.id === alert.productId);
                      if (prod) {
                        onRestockProduct(prod);
                      } else {
                        navigate('/inventory');
                      }
                    },
                  }
                : {
                    label: 'View Inventory',
                    onClick: () => navigate('/inventory'),
                  },
            }
          );
        });
      }

      setCompletedSaleInfo({
        id: sale.id,
        billNumber: sale.bill_number,
        subtotal: sale.subtotal,
        discount: sale.discount,
        taxableAmount: sale.taxable_amount,
        vatAmount: sale.vat_amount,
        grandTotal: sale.grand_total,
        total: sale.grand_total ?? sale.total,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        customerPanVat: sale.customer_pan_vat,
      });

      // Auto-open bill print preview for quick thermal slip/invoice print
      setPrintSaleId(sale.id);
      setIsPrintModalOpen(true);

      setCart([]);
      setCustomerData({
        customerId: null,
        name: '',
        phone: '',
        email: '',
        pan_vat: '',
        address: '',
        isNew: false,
      });
      loadCatalog();
      onSaleCompleted(sale.id);
    } catch (err: unknown) {
      showToast((err as Error).message, 'error', 'Transaction Failed');
    }
  };

  // POS-Specific Keyboard Shortcuts (F2 / Ctrl+Enter for sale completion, Ctrl+B to focus scanner)
  useEffect(() => {
    const handlePosKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // F2 or Ctrl+Enter: Complete sale
      if (e.key === 'F2' || (isModifier && e.key === 'Enter')) {
        if (cart.length > 0 && !calculations.hasStockViolation) {
          e.preventDefault();
          handleCompleteSale();
        }
        return;
      }

      // Ctrl+B or Cmd+B: Focus barcode / quick SKU input
      if (isModifier && key === 'b') {
        e.preventDefault();
        quickSkuInputRef.current?.focus();
        quickSkuInputRef.current?.select();
        return;
      }
    };

    window.addEventListener('keydown', handlePosKeyDown);
    return () => window.removeEventListener('keydown', handlePosKeyDown);
  }, [cart, calculations]);

  // Selected batch items summary stats
  const batchSelectedCount = Object.keys(batchQuantities).length;
  const batchTotalUnits = Object.values(batchQuantities).reduce((acc, q) => acc + q, 0);
  const batchTotalEst = Object.entries(batchQuantities).reduce((acc, [pIdStr, q]) => {
    const p = products.find((prod) => prod.id === parseInt(pIdStr, 10));
    return acc + (p ? p.selling_price * q : 0);
  }, 0);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">{t('pos_title')}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            {t('pos_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick Multiple Products Button */}
          <button
            onClick={() => {
              setBatchQuantities({});
              setIsMultiProductModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('pos_add_multiple')}</span>
          </button>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('pos_clear_cart')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Catalog Picker / Right Active Sale Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selection & Catalog (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-200">Catalog & Multi-Product Picker</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Select items to batch add, or click + to add 1</div>
              </div>

              {/* Multi-Select Inline Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setBatchQuantities({});
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer border ${
                  isBatchMode
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                }`}
                title="Toggle batch selection checkboxes"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>{isBatchMode ? 'Multi-Select: ON' : 'Multi-Select'}</span>
              </button>
            </div>

            {/* Quick Filter Tabs & Search */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === 'all'
                      ? 'bg-neutral-800 text-neutral-100 font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {t('pos_all_products')} ({formatNumberByLang(products.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('inStock')}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === 'inStock'
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {t('pos_in_stock')}
                </button>
                <button
                  type="button"
                  onClick={() => setStockFilter('lowStock')}
                  className={`flex-1 py-1 rounded transition-colors text-center cursor-pointer ${
                    stockFilter === 'lowStock'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {t('pos_low_stock')}
                </button>
              </div>

              {/* Quick Search and Multi-Select Helpers */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder={isNepali ? 'सामानको नाम वा SKU बाट खोज्नुहोस्...' : 'Search catalog or SKU to add...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    icon={Search}
                    clearable
                    onClear={() => setSearch('')}
                    className="py-1.5 text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={selectAllFilteredInCatalog}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Select all products currently visible"
                >
                  Select All
                </button>

                {batchSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearBatchSelections}
                    className="px-2 py-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Multi-Add Sticky Bar if items are selected */}
            {batchSelectedCount > 0 && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-emerald-300">
                    {batchSelectedCount} selected
                  </span>{' '}
                  <span className="text-neutral-400">({batchTotalUnits} units)</span>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    Est: {formatCurrency(batchTotalEst, currencySymbol)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={submitBatchFromQuantities}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Sale</span>
                </button>
              </div>
            )}

            {/* Product List */}
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {availableProducts.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No products found.
                </div>
              ) : (
                availableProducts.map((p) => {
                  const isOutOfStock = p.current_stock <= 0;
                  const isSelected = batchQuantities[p.id] !== undefined;
                  const selectedQty = batchQuantities[p.id] || 1;
                  const inCartItem = cart.find((ci) => ci.product.id === p.id);
                  const isMaxInCart = !allowNegativeStock && !!inCartItem && inCartItem.quantity >= p.current_stock;

                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-lg border transition-all flex items-center justify-between select-none ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500/50'
                          : isOutOfStock && !allowNegativeStock
                          ? 'bg-neutral-950/40 border-neutral-800/40 opacity-50'
                          : 'bg-neutral-950 border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      {/* Checkbox & Product Info */}
                      <div
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          if (isOutOfStock && !allowNegativeStock) return;
                          toggleBatchItem(p.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-600 shrink-0 hover:text-neutral-400" />
                        )}

                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-xs font-semibold text-neutral-200 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-300">
                              {formatCurrency(p.selling_price, currencySymbol)}
                            </span>
                            <span>·</span>
                            <span>{p.sku || 'No SKU'}</span>
                            <span>·</span>
                            <span className="px-1 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                              {p.unit || 'pcs'}
                            </span>
                            <span>·</span>
                            <span className={p.current_stock <= 5 ? 'text-amber-400 font-semibold' : 'text-neutral-400'}>
                              Stock: {p.current_stock} {p.unit || 'pcs'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right action controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isSelected ? (
                          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-700 rounded p-0.5">
                            <button
                              type="button"
                              disabled={selectedQty <= 1}
                              onClick={() => updateBatchQty(p.id, selectedQty - 1)}
                              className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <Input
                              type="number"
                              min="1"
                              max={!allowNegativeStock ? Math.max(1, p.current_stock) : undefined}
                              value={selectedQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updateBatchQty(p.id, isNaN(val) ? 1 : val);
                              }}
                              containerClassName="w-8"
                              className="border-0 p-0 text-center text-xs font-mono font-bold text-neutral-100 bg-transparent focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!allowNegativeStock && selectedQty >= p.current_stock}
                              onClick={() => updateBatchQty(p.id, selectedQty + 1)}
                              title={!allowNegativeStock && selectedQty >= p.current_stock ? `Max stock reached (${p.current_stock})` : 'Increase batch quantity'}
                              className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={(isOutOfStock || isMaxInCart) && !allowNegativeStock}
                            onClick={() => handleAddToCart(p)}
                            title={
                              isMaxInCart
                                ? `All available stock (${p.current_stock}) already in cart`
                                : isOutOfStock
                                ? 'Out of stock'
                                : 'Add 1 unit to sale cart'
                            }
                            className="px-2 py-1 rounded bg-neutral-900 hover:bg-emerald-600 hover:text-white border border-neutral-800 flex items-center gap-1 text-[11px] text-neutral-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isMaxInCart ? 'Max in cart' : 'Add'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Catalog Multi-Select Action Bar (when Batch Items are selected) */}
            {batchSelectedCount > 0 && (
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <button
                  type="button"
                  onClick={submitBatchFromQuantities}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {batchSelectedCount} Selected Products ({batchTotalUnits} units)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Sale Line Items & Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
            {/* Cart Header */}
            <div className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-neutral-200">Current Transaction Items</span>
                <span className="text-[11px] text-neutral-400 font-mono ml-2">
                  ({cart.length} {cart.length === 1 ? 'item' : 'items'} · {calculations.totalUnits} units)
                </span>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkDiscountValue('');
                      setIsBulkDiscountModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors cursor-pointer"
                    title="Apply discount to all items in cart"
                  >
                    <Percent className="w-3 h-3" />
                    <span>Bulk Discount</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Multi-SKU / Barcode Scanner Input */}
            <div className="p-3 bg-neutral-950/80 border-b border-neutral-800/80">
              <form onSubmit={handleQuickSkuSubmit} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    ref={quickSkuInputRef}
                    type="text"
                    placeholder={`Fast add multiple items: Enter/scan SKUs or names (e.g. BEV-CC-500*2) [${MODIFIER_LABEL}+B]...`}
                    value={quickSkuInput}
                    onChange={(e) => setQuickSkuInput(e.target.value)}
                    icon={ScanLine}
                    iconPosition="left"
                    className="py-1.5 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!quickSkuInput.trim()}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Add to Sale
                </button>
              </form>
            </div>

            {/* Cart Table */}
            {cart.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400">
                <Receipt className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                Your sale cart is empty. Check multiple items on the catalog, or click{' '}
                <button
                  onClick={() => setIsMultiProductModalOpen(true)}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  Add Multiple Products
                </button>{' '}
                to select several products at once.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                    <tr>
                      <th className="py-2 px-4">Item</th>
                      <th className="py-2 px-2 text-center w-28">Qty</th>
                      <th className="py-2 px-3 text-right font-mono w-28">Sale Price</th>
                      <th className="py-2 px-3 text-right font-mono w-24">Discount</th>
                      <th className="py-2 px-4 text-right font-mono w-28">Net Total</th>
                      <th className="py-2 px-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {calculations.itemsWithDiscounts.map((item, index) => {
                      const isOverStock =
                        !allowNegativeStock && item.quantity > item.product.current_stock;

                      return (
                        <tr
                          key={item.product.id}
                          className={`hover:bg-neutral-800/30 transition-colors ${
                            isOverStock ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          {/* Product Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                              <span>{item.product.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                                {item.product.unit || 'pcs'}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1.5">
                              <span>Default: {formatCurrency(item.product.selling_price, currencySymbol)}</span>
                              <span>·</span>
                              <span
                                className={isOverStock ? 'text-rose-400 font-bold' : 'text-neutral-400'}
                              >
                                Stock: {item.product.current_stock} {item.product.unit || 'pcs'}
                              </span>
                            </div>
                            {isOverStock && (
                              <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Exceeds available stock ({item.product.current_stock} {item.product.unit || 'pcs'})</span>
                              </div>
                            )}
                          </td>

                          {/* Quantity with in-line stepper */}
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className="flex items-center justify-center gap-1 bg-neutral-950 border border-neutral-800 rounded p-0.5">
                                <button
                                  type="button"
                                  disabled={item.quantity <= 1}
                                  onClick={() => handleUpdateQuantity(index, (item.quantity - 1).toString())}
                                  className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <Input
                                  type="number"
                                  min="1"
                                  max={!allowNegativeStock ? Math.max(1, item.product.current_stock) : undefined}
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                  containerClassName="w-10"
                                  className="border-0 p-0 text-center text-xs font-mono text-neutral-100 bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={!allowNegativeStock && item.quantity >= item.product.current_stock}
                                  onClick={() => handleUpdateQuantity(index, (item.quantity + 1).toString())}
                                  title={
                                    !allowNegativeStock && item.quantity >= item.product.current_stock
                                      ? `Max available stock reached (${item.product.current_stock})`
                                      : 'Increase quantity'
                                  }
                                  className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-[10px] font-mono text-neutral-400">
                                {item.product.unit || 'pcs'}
                              </span>
                            </div>
                          </td>

                          {/* Actual Selling Price (Editable!) */}
                          <td className="py-3 px-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={fromMinorUnits(item.actual_selling_price)}
                              onChange={(e) => handleUpdateActualPrice(index, e.target.value)}
                              containerClassName="w-24 ml-auto"
                              className="px-2 py-1 text-xs text-right font-mono text-neutral-100"
                            />
                          </td>

                          {/* Line Discount (Item-level discount + Proportional whole discount badge) */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex flex-col items-end">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={fromMinorUnits(item.discount)}
                                onChange={(e) => handleUpdateDiscount(index, e.target.value)}
                                containerClassName="w-20 ml-auto"
                                className="px-2 py-1 text-xs text-right font-mono text-amber-400 focus:border-amber-500"
                              />
                              {item.allocatedWholeDiscount > 0 && (
                                <span
                                  className="text-[10px] text-amber-400/90 font-mono mt-0.5 whitespace-nowrap cursor-help"
                                  title={`Item discount: ${formatCurrency(item.individualDiscount, currencySymbol)} + Whole discount share: ${formatCurrency(item.allocatedWholeDiscount, currencySymbol)} = Total: ${formatCurrency(item.effectiveTotalDiscount, currencySymbol)}`}
                                >
                                  +{formatCurrency(item.allocatedWholeDiscount, currencySymbol)} whole
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Net Line Total */}
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <div className="font-bold text-neutral-100">
                              {formatCurrency(item.netTotal, currencySymbol)}
                            </div>
                            {item.effectiveTotalDiscount > 0 && (
                              <div className="text-[10px] font-normal text-amber-400 font-mono">
                                -{formatCurrency(item.effectiveTotalDiscount, currencySymbol)}
                              </div>
                            )}
                          </td>

                          {/* Remove */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(index)}
                              className="text-neutral-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-neutral-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Customer Information (Search, Autocomplete & Auto-Creation) */}
            <div className="p-4 bg-neutral-950/70 border-t border-neutral-800">
              <CustomerInputSection
                value={customerData}
                onChange={setCustomerData}
              />
            </div>

            {/* Calculations Breakdown */}
            <div className="p-5 bg-neutral-950 border-t border-neutral-800 space-y-3">
              {/* Whole Bill Discount (Proportional) Input Card */}
              {cart.length > 0 && (
                <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-neutral-200">
                        {isNepali ? 'सम्पूर्ण बिलमा छुट (Whole Bill Discount)' : 'Whole Bill Discount'}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {isNepali ? 'मूल्य अनुसार दामासाही बाँडिने' : 'Divided proportionally by item amount'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px] shrink-0">
                      <button
                        type="button"
                        onClick={() => setWholeDiscountType('fixed')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          wholeDiscountType === 'fixed'
                            ? 'bg-neutral-800 text-neutral-100 font-semibold'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {currencySymbol} Fixed
                      </button>
                      <button
                        type="button"
                        onClick={() => setWholeDiscountType('percent')}
                        className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          wholeDiscountType === 'percent'
                            ? 'bg-neutral-800 text-neutral-100 font-semibold'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        % Percent
                      </button>
                    </div>

                    <div className="relative flex-1">
                      <Input
                        type="number"
                        step={wholeDiscountType === 'fixed' ? '0.01' : '1'}
                        min="0"
                        max={wholeDiscountType === 'percent' ? 100 : undefined}
                        placeholder={
                          wholeDiscountType === 'fixed'
                            ? `Whole discount (${currencySymbol})...`
                            : 'Whole discount %...'
                        }
                        value={wholeDiscountValue}
                        onChange={(e) => setWholeDiscountValue(e.target.value)}
                        className="text-xs font-mono pr-7 focus:border-amber-500"
                      />
                      {wholeDiscountValue && (
                        <button
                          type="button"
                          onClick={() => setWholeDiscountValue('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 p-0.5 rounded cursor-pointer"
                          title="Clear whole discount"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {calculations.wholeDiscountAmount > 0 && (
                    <div className="text-[11px] text-amber-400 flex items-center justify-between font-mono pt-1 border-t border-neutral-800/60">
                      <span className="text-neutral-400">Proportionally distributed:</span>
                      <span>-{formatCurrency(calculations.wholeDiscountAmount, currencySymbol)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{isNepali ? 'उप-जम्मा' : 'Subtotal (Gross)'}</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(calculations.subtotal, currencySymbol)}
                </span>
              </div>

              {calculations.totalIndividualDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{isNepali ? 'वस्तुगत छुट' : 'Individual Item Discounts'}</span>
                  <span className="font-mono text-amber-400">
                    - {formatCurrency(calculations.totalIndividualDiscount, currencySymbol)}
                  </span>
                </div>
              )}

              {calculations.wholeDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{isNepali ? 'सम्पूर्ण बिल छुट' : 'Whole Bill Discount (Proportional)'}</span>
                  <span className="font-mono text-amber-400">
                    - {formatCurrency(calculations.wholeDiscountAmount, currencySymbol)}
                  </span>
                </div>
              )}

              {calculations.totalDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-neutral-300 font-semibold pt-1 border-t border-neutral-800/60">
                  <span>{isNepali ? 'जम्मा छुट' : 'Total Discounts'}</span>
                  <span className="font-mono text-amber-400">
                    - {formatCurrency(calculations.totalDiscount, currencySymbol)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>{isNepali ? 'करयोग्य रकम' : 'Taxable Amount'}</span>
                <span className="font-mono text-neutral-200">
                  {formatCurrency(calculations.taxableAmount, currencySymbol)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                    13% VAT
                  </span>
                  <span>{isNepali ? 'मूल्य अभिवृद्धि कर' : 'VAT (13%)'}</span>
                </span>
                <span className="font-mono text-sky-400">
                  + {formatCurrency(calculations.vatAmount, currencySymbol)}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-neutral-100">{isNepali ? 'कुल भुक्तानी रकम' : 'Grand Total Due'}</div>
                  <div className="text-[11px] text-neutral-400">
                    {isNepali ? '१३% भ्याट समावेश' : 'Includes 13% statutory VAT'}
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {formatCurrency(calculations.grandTotal, currencySymbol)}
                </div>
              </div>

              {calculations.hasStockViolation && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Cannot complete sale: one or more items exceed current inventory. (Adjust quantities or
                    enable "Allow Negative Stock" in Settings).
                  </span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={cart.length === 0 || calculations.hasStockViolation}
                  onClick={handleCompleteSale}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    cart.length === 0 || calculations.hasStockViolation
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.99]'
                  }`}
                  title="Complete sale and record transaction (F2 or Enter)"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Sale & Deduct Stock ({formatCurrency(calculations.grandTotal, currencySymbol)})</span>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-700/80 text-emerald-100 border border-emerald-500/40">
                    F2
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add Multiple Products At Once */}
      <Modal
        isOpen={isMultiProductModalOpen}
        onClose={() => setIsMultiProductModalOpen(false)}
        title="Add Multiple Products to Sale"
        subtitle="Select multiple products with quantities or enter bulk SKUs to add simultaneously."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {/* Sub-Tabs: Visual Checklist vs Bulk SKU / Barcode text */}
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
            <button
              onClick={() => setModalTab('checklist')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                modalTab === 'checklist'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
                <span>Multi-Product Checklist</span>
              </div>
            </button>
            <button
              onClick={() => setModalTab('bulkSku')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                modalTab === 'bulkSku'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5 text-sky-400" />
                <span>Bulk SKU / Barcode Paste</span>
              </div>
            </button>
          </div>

          {modalTab === 'checklist' && (
            <div className="space-y-3">
              {/* Modal Search & Quick Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search products by title or SKU..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    icon={Search}
                    clearable
                    onClear={() => setModalSearch('')}
                    className="py-1.5 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={selectAllFilteredInModal}
                    className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Select All ({modalFilteredProducts.length})
                  </button>
                  {batchSelectedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearBatchSelections}
                      className="px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      Deselect All
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Products List with Checkboxes & Quantities */}
              <div className="border border-neutral-800 rounded-lg max-h-[360px] overflow-y-auto divide-y divide-neutral-800/60 bg-neutral-950/40">
                {modalFilteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No products matching search criteria.
                  </div>
                ) : (
                  modalFilteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock <= 0;
                    const isSelected = batchQuantities[p.id] !== undefined;
                    const currentQty = batchQuantities[p.id] || 1;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-emerald-950/20' : 'hover:bg-neutral-900/60'
                        } ${isOutOfStock && !allowNegativeStock ? 'opacity-50' : ''}`}
                      >
                        {/* Checkbox & Product Details */}
                        <div
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                          onClick={() => {
                            if (isOutOfStock && !allowNegativeStock) return;
                            toggleBatchItem(p.id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600 shrink-0" />
                          )}

                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-xs font-semibold text-neutral-200 truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                              <span>SKU: {p.sku || 'None'}</span>
                              <span>·</span>
                              <span className="px-1 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                                {p.unit || 'pcs'}
                              </span>
                              <span>·</span>
                              <span>Price: {formatCurrency(p.selling_price, currencySymbol)}</span>
                              <span>·</span>
                              <span
                                className={
                                  p.current_stock <= 5 ? 'text-amber-400 font-semibold' : 'text-neutral-400'
                                }
                              >
                                Stock: {p.current_stock} {p.unit || 'pcs'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Quantity Stepper (Active when selected) */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected ? (
                            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-700 rounded p-1">
                              <button
                                type="button"
                                disabled={currentQty <= 1}
                                onClick={() => updateBatchQty(p.id, currentQty - 1)}
                                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <Input
                                type="number"
                                min="1"
                                max={!allowNegativeStock ? Math.max(1, p.current_stock) : undefined}
                                value={currentQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  updateBatchQty(p.id, isNaN(val) ? 1 : val);
                                }}
                                containerClassName="w-10"
                                className="border-0 p-0 text-center text-xs font-mono font-bold text-neutral-100 bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={!allowNegativeStock && currentQty >= p.current_stock}
                                onClick={() => updateBatchQty(p.id, currentQty + 1)}
                                title={!allowNegativeStock && currentQty >= p.current_stock ? `Max stock reached (${p.current_stock})` : 'Increase quantity'}
                                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-100 rounded hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isOutOfStock && !allowNegativeStock}
                              onClick={() => toggleBatchItem(p.id)}
                              className="px-2.5 py-1 text-xs text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded border border-neutral-800 hover:border-emerald-500/30 transition-colors"
                            >
                              Select
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Summary & Confirmation */}
              <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-neutral-400">Selected: </span>
                  <span className="font-semibold text-neutral-200">
                    {batchSelectedCount} products ({batchTotalUnits} units)
                  </span>
                  <span className="mx-2 text-neutral-600">·</span>
                  <span className="text-neutral-400">Est. Subtotal: </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(batchTotalEst, currencySymbol)}
                  </span>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsMultiProductModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={batchSelectedCount === 0}
                    onClick={submitBatchFromQuantities}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      batchSelectedCount === 0
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add {batchSelectedCount} Products to Sale</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {modalTab === 'bulkSku' && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-400 leading-relaxed">
                Paste or enter multiple product SKUs, Barcodes, or Product IDs separated by commas or
                newlines. You can optionally include quantity multipliers like{' '}
                <code className="text-emerald-400 font-mono">BEV-CC-500*3</code> or{' '}
                <code className="text-emerald-400 font-mono">SNK-CHP-050 x 2</code>.
              </div>

              <div>
                <textarea
                  rows={6}
                  value={bulkSkuInput}
                  onChange={(e) => setBulkSkuInput(e.target.value)}
                  placeholder={`BEV-CC-500*5\nBEV-PEP-500*2\nSNK-CHP-050`}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsMultiProductModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSkuSubmit}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Parse & Add All to Sale</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Bulk / Whole Discount across all items */}
      <Modal
        isOpen={isBulkDiscountModalOpen}
        onClose={() => setIsBulkDiscountModalOpen(false)}
        title={
          bulkDiscountTab === 'proportional'
            ? 'Whole Bill Discount (Proportional)'
            : 'Apply Uniform Discount to All Items'
        }
        subtitle={
          bulkDiscountTab === 'proportional'
            ? `Divide a single whole discount proportionally across all ${cart.length} items based on their individual amounts.`
            : `Set a uniform discount across all ${cart.length} line items currently in this sale.`
        }
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Discount Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setBulkDiscountTab('proportional')}
              className={`py-2 rounded font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                bulkDiscountTab === 'proportional'
                  ? 'bg-neutral-800 text-amber-400 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Whole Bill (Proportional)</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkDiscountTab('uniform')}
              className={`py-2 rounded font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                bulkDiscountTab === 'uniform'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>Uniform per Item</span>
            </button>
          </div>

          {/* Amount Type Selector: Fixed vs Percent */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setBulkDiscountType('fixed')}
              className={`py-1.5 rounded font-medium transition-colors cursor-pointer ${
                bulkDiscountType === 'fixed'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Fixed Amount ({currencySymbol})
            </button>
            <button
              type="button"
              onClick={() => setBulkDiscountType('percent')}
              className={`py-1.5 rounded font-medium transition-colors cursor-pointer ${
                bulkDiscountType === 'percent'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Percentage (%)
            </button>
          </div>

          <div>
            <Input
              label={
                bulkDiscountTab === 'proportional'
                  ? bulkDiscountType === 'fixed'
                    ? `Total Whole Discount Amount (${currencySymbol})`
                    : 'Total Whole Discount Percentage (%)'
                  : bulkDiscountType === 'fixed'
                  ? `Discount Amount per Item (${currencySymbol})`
                  : 'Discount Percentage per Item (%)'
              }
              type="number"
              step={bulkDiscountType === 'fixed' ? '0.01' : '1'}
              min="0"
              max={bulkDiscountType === 'percent' ? 100 : undefined}
              placeholder={bulkDiscountType === 'fixed' ? 'e.g. 100.00' : 'e.g. 10'}
              value={bulkDiscountValue}
              onChange={(e) => setBulkDiscountValue(e.target.value)}
              className="font-mono focus:border-amber-500"
            />
          </div>

          {/* Proportional Preview Table (Only in proportional tab with positive value) */}
          {bulkDiscountTab === 'proportional' && modalProportionalPreview && (
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Proportional Distribution Preview:</span>
                <span className="font-mono text-amber-400 font-bold">
                  Total Whole Discount: -{formatCurrency(modalProportionalPreview.targetWholeMinor, currencySymbol)}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-2 text-right font-mono">Gross Amount</th>
                      <th className="py-2 px-2 text-right font-mono text-amber-400">Discount Share</th>
                      <th className="py-2 px-3 text-right font-mono">Effective Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-mono">
                    {modalProportionalPreview.items.map((row) => (
                      <tr key={row.id} className="hover:bg-neutral-800/20">
                        <td className="py-2 px-3 font-sans text-neutral-200">
                          {row.name}{' '}
                          <span className="text-[10px] text-neutral-400">
                            ({row.quantity} {row.unit})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-neutral-300">
                          {formatCurrency(row.gross, currencySymbol)}
                        </td>
                        <td className="py-2 px-2 text-right text-amber-400 font-semibold">
                          -{formatCurrency(row.allocatedWhole, currencySymbol)}
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-100 font-bold">
                          {formatCurrency(row.effectiveNet, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsBulkDiscountModalOpen(false)}
              className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyBulkDiscount}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer font-medium"
            >
              {bulkDiscountTab === 'proportional'
                ? 'Apply Proportional Whole Discount'
                : 'Apply to All Items'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Completed Sale Notification Card */}
      {completedSaleInfo && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-neutral-100 flex items-center flex-wrap gap-x-2">
                <span>
                  {completedSaleInfo.billNumber
                    ? `Invoice ${completedSaleInfo.billNumber} (Sale #${completedSaleInfo.id})`
                    : `Transaction #${completedSaleInfo.id}`} Successfully Recorded
                </span>
                {completedSaleInfo.customerName && (
                  <span className="font-normal text-emerald-300 text-xs">
                    · Customer: <span className="font-semibold text-neutral-100">{completedSaleInfo.customerName}</span>
                    {completedSaleInfo.customerPhone && (
                      <span className="font-mono text-neutral-400 text-[11px] ml-1">
                        ({completedSaleInfo.customerPhone})
                      </span>
                    )}
                    {completedSaleInfo.customerPanVat && (
                      <span className="font-mono text-emerald-300 text-[11px] ml-1">
                        [PAN: {completedSaleInfo.customerPanVat}]
                      </span>
                    )}
                  </span>
                )}
                {!completedSaleInfo.customerName && completedSaleInfo.customerPhone && (
                  <span className="font-normal text-emerald-300 text-xs font-mono">
                    · Phone: {completedSaleInfo.customerPhone}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Grand Total: <span className="font-mono text-emerald-300 font-semibold">{formatCurrency(completedSaleInfo.grandTotal ?? completedSaleInfo.total, currencySymbol)}</span>
                {completedSaleInfo.vatAmount !== undefined && completedSaleInfo.vatAmount > 0 && (
                  <span> · 13% VAT: <span className="font-mono text-sky-400">+{formatCurrency(completedSaleInfo.vatAmount, currencySymbol)}</span></span>
                )}
                <span> · Subtotal: {formatCurrency(completedSaleInfo.subtotal, currencySymbol)}</span>
                {completedSaleInfo.discount > 0 && (
                  <span> · Discounts: {formatCurrency(completedSaleInfo.discount, currencySymbol)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPrintSaleId(completedSaleInfo.id);
                setIsPrintModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bill</span>
            </button>
            <button
              onClick={() => setCompletedSaleInfo(null)}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors px-2 py-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Bill Printing Modal */}
      <PrintBillModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        saleId={printSaleId}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
