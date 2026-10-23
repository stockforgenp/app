/**
 * End-to-End Real Data Simulation & Full Business Cycle Test Suite
 *
 * Implements a real-world FMCG retail operation in Nepal with authentic business data:
 * 1. 5 Real Products:
 *    - Wai Wai Instant Noodles 75g (WW-NOODLE-75G)
 *    - Tokla CTC Gold Tea 500g (TOK-TEA-500G)
 *    - Aarti Premium Basmati Rice 25kg (AAR-RICE-25KG)
 *    - DDC Pure Dairy Ghee 1L (DDC-GHEE-1L)
 *    - Shakti Refined Sugar 1kg (SHK-SUGAR-1KG)
 * 2. 2 Real Vendors / Suppliers:
 *    - CG Foods Nepal Pvt. Ltd. (PAN: 300123456)
 *    - Birgunj Food Grain Importers (PAN: 600987654)
 * 3. 2 Real Customers:
 *    - Rajesh Kirana & Departmental Store (Wholesale Khata, PAN: 601122334)
 *    - Sita Devi Shrestha (Retail Walk-in)
 * 4. Business Transactions:
 *    - Credit and cash purchases from suppliers
 *    - Wholesale and retail sales with tiered pricing
 *    - Sales return with Credit Note (CN-XXXXX)
 *    - Purchase return with Debit Note (DN-XXXXX)
 *    - Debt settlement & supplier payable alignment
 *    - Stock movements ledger integrity
 *    - Day Book journal double-entry balancing
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";
import type { ProcessPurchaseItemInput } from "../src/types/index.ts";

// Dynamically import services after setup has registered the wasm loader
const {
  createProduct,
  getProductById,
  getAllProducts,
} = await import("../src/lib/services/productService.ts");

const {
  createVendor,
  getVendorById,
  getVendorTotalDue,
  recordVendorPayment,
  getVendorStatement,
} = await import("../src/lib/services/vendorService.ts");

const {
  createCustomer,
  getCustomerById,
  getCustomerTotalDue,
  recordCustomerPayment,
  getCustomerStatement,
} = await import("../src/lib/services/customerService.ts");

const {
  processPurchase,
  getPurchaseWithItems,
} = await import("../src/lib/services/purchaseService.ts");

const {
  processSale,
  getSaleWithItems,
} = await import("../src/lib/services/salesService.ts");

const {
  processSaleReturn,
  processPurchaseReturn,
} = await import("../src/lib/services/returnsService.ts");

const { getStockMovements } = await import(
  "../src/lib/services/inventoryService.ts"
);

const { getDayBook } = await import("../src/lib/services/dayBookService.ts");
const { query, queryOne } = await import("../src/lib/db/sqliteEngine.ts");

function makePurchaseItem(input: {
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
}): ProcessPurchaseItemInput {
  return {
    discount: 0,
    ...input,
  };
}

describe("Feature: End-to-End Real Data Simulation", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. Master Data Provisioning: Insert 5 real products, 2 suppliers, and 2 customers into database", () => {
    // 5 Products
    const p1 = createProduct({
      name: "wai wai instant noodles 75g",
      sku: "WW-NOODLE-75G",
      unit: "packet",
      cost_price: 2000,
      selling_price: 2500,
      wholesale_price: 2200,
      wholesale_min_qty: 30,
      current_stock: 100,
      min_stock_alert: 20,
    });

    const p2 = createProduct({
      name: "tokla ctc gold tea 500g",
      sku: "TOK-TEA-500G",
      unit: "packet",
      cost_price: 38000,
      selling_price: 45000,
      wholesale_price: 41000,
      wholesale_min_qty: 10,
      current_stock: 40,
      min_stock_alert: 10,
    });

    const p3 = createProduct({
      name: "aarti premium basmati rice 25kg",
      sku: "AAR-RICE-25KG",
      unit: "bag",
      cost_price: 280000,
      selling_price: 330000,
      wholesale_price: 305000,
      wholesale_min_qty: 5,
      current_stock: 25,
      min_stock_alert: 5,
    });

    const p4 = createProduct({
      name: "ddc pure dairy ghee 1l",
      sku: "DDC-GHEE-1L",
      unit: "tin",
      cost_price: 115000,
      selling_price: 135000,
      wholesale_price: 125000,
      wholesale_min_qty: 6,
      current_stock: 30,
      min_stock_alert: 5,
    });

    const p5 = createProduct({
      name: "shakti refined sugar 1kg",
      sku: "SHK-SUGAR-1KG",
      unit: "kg",
      cost_price: 8500,
      selling_price: 10500,
      wholesale_price: 9500,
      wholesale_min_qty: 20,
      current_stock: 80,
      min_stock_alert: 15,
    });

    assert.equal(getAllProducts().length, 5);

    // Verify raw database products table
    const productsInDb = query<{ id: number; name: string; sku: string; current_stock: number }>(
      "SELECT id, name, sku, current_stock FROM products ORDER BY id ASC"
    );
    assert.equal(productsInDb.length, 5);
    assert.equal(productsInDb[0].name, "Wai Wai Instant Noodles 75g");
    assert.equal(productsInDb[0].current_stock, 100);
    assert.equal(productsInDb[1].name, "Tokla Ctc Gold Tea 500g");
    assert.equal(productsInDb[2].name, "Aarti Premium Basmati Rice 25kg");
    assert.equal(productsInDb[3].name, "Ddc Pure Dairy Ghee 1l");
    assert.equal(productsInDb[4].name, "Shakti Refined Sugar 1kg");

    // 2 Vendors
    const v1 = createVendor({
      name: "cg foods nepal pvt. ltd.",
      phone: "9801234567",
      email: "orders@cgfoods.com.np",
      pan_vat: "300123456",
      address: "Chaudhary House, Lalitpur",
      notes: "Primary distributor for noodles and tea",
    });

    const v2 = createVendor({
      name: "birgunj food grain importers",
      phone: "9855012345",
      email: "supply@birgunjgrains.np",
      pan_vat: "600987654",
      address: "Adarshnagar, Birgunj",
      notes: "Direct wholesale supplier for rice & sugar",
    });

    assert.ok(v1.id > 0);
    assert.ok(v2.id > 0);
    assert.equal(query("SELECT id FROM vendors").length, 2);

    // 2 Customers
    const c1 = createCustomer({
      name: "rajesh kirana & departmental store",
      phone: "9845011223",
      pan_vat: "601122334",
      address: "Murli Chowk, Birgunj",
      customer_type: "WHOLESALE",
      notes: "Weekly wholesale bulk buyer with 15-day credit agreement",
    });

    const c2 = createCustomer({
      name: "sita devi shrestha",
      phone: "9812345678",
      address: "Maisthan, Birgunj",
      customer_type: "RETAIL",
      notes: "Regular retail walk-in customer",
    });

    assert.ok(c1.id > 0);
    assert.ok(c2.id > 0);
    assert.equal(query("SELECT id FROM customers").length, 2);
  });

  test("2. Purchasing & Restocking: Credit and cash purchases from suppliers with ledger inflows", () => {
    const prodRice = createProduct({
      name: "Aarti Basmati Rice 25kg",
      cost_price: 280000,
      selling_price: 330000,
      current_stock: 25,
    });

    const prodSugar = createProduct({
      name: "Shakti Sugar 1kg",
      cost_price: 8500,
      selling_price: 10500,
      current_stock: 80,
    });

    const vendorGrains = createVendor({
      name: "Birgunj Food Grain Importers",
      phone: "9855012345",
    });

    // Credit purchase from supplier
    // 50 bags Rice @ Rs. 2,800 = 14,000,000 paisa
    // 100 kg Sugar @ Rs. 85 = 850,000 paisa
    // Total = 14,850,000 paisa (Rs. 148,500)
    // Paid = 5,000,000 paisa (Rs. 50,000)
    // Due = 9,850,000 paisa (Rs. 98,500)
    const purchase = processPurchase(
      [
        makePurchaseItem({ productId: prodRice.id, quantity: 50, costPrice: 280000 }),
        makePurchaseItem({ productId: prodSugar.id, quantity: 100, costPrice: 8500 }),
      ],
      {
        vendorId: vendorGrains.id,
        paymentMethod: "Bank Transfer",
        paidAmount: 5000000,
        applyVat: false,
        invoiceNumber: "INV-BGI-901",
      }
    );

    assert.equal(purchase.total, 14850000);
    assert.equal(purchase.paid_amount, 5000000);
    assert.equal(purchase.due_amount, 9850000);

    // Verify supplier payable in database
    assert.equal(getVendorTotalDue(vendorGrains.id), 9850000);

    // Verify inventory restocked in SQLite
    assert.equal(getProductById(prodRice.id)?.current_stock, 75); // 25 + 50
    assert.equal(getProductById(prodSugar.id)?.current_stock, 180); // 80 + 100
  });

  test("3. Sales & Billing: Wholesale credit sale and retail cash sale with accurate stock deductions", () => {
    const prodWaiWai = createProduct({
      name: "Wai Wai Noodles",
      cost_price: 2000,
      selling_price: 2500,
      wholesale_price: 2200,
      current_stock: 100,
    });

    const prodTea = createProduct({
      name: "Tokla Tea",
      cost_price: 38000,
      selling_price: 45000,
      current_stock: 40,
    });

    const customer = createCustomer({
      name: "Rajesh Kirana Store",
      phone: "9845011223",
      customer_type: "WHOLESALE",
    });

    // Wholesale Credit Sale: 30 packs Wai Wai @ wholesale price Rs. 22 (2200) = 66,000 paisa
    // Customer pays Rs. 160 (16000 paisa); Rs. 500 (50000 paisa) remains due
    const sale = processSale(
      [
        { productId: prodWaiWai.id, quantity: 30, actualSellingPrice: 2200, discount: 0, pricingTier: "WHOLESALE" },
      ],
      {
        customerId: customer.id,
        paymentMethod: "Cash",
        paidAmount: 16000,
        applyVat: false,
      }
    );

    assert.equal(sale.total, 66000);
    assert.equal(sale.paid_amount, 16000);
    assert.equal(sale.due_amount, 50000);

    // Customer due in DB = 50000 paisa
    assert.equal(getCustomerTotalDue(customer.id), 50000);

    // Inventory decremented from 100 to 70
    assert.equal(getProductById(prodWaiWai.id)?.current_stock, 70);

    // Retail Cash Sale: 2 packs Tokla Tea @ retail Rs. 450 (45000) = 90,000 paisa
    // 100% Cash paid
    const retailSale = processSale(
      [
        { productId: prodTea.id, quantity: 2, actualSellingPrice: 45000, discount: 0, pricingTier: "RETAIL" },
      ],
      {
        paymentMethod: "Cash",
        paidAmount: 90000,
        applyVat: false,
      }
    );

    assert.equal(retailSale.total, 90000);
    assert.equal(retailSale.paid_amount, 90000);
    assert.equal(retailSale.due_amount, 0);

    // Inventory decremented from 40 to 38
    assert.equal(getProductById(prodTea.id)?.current_stock, 38);
  });

  test("4. Returns & Refunds: Customer Credit Note (restocking item) and Vendor Debit Note (deducting item)", () => {
    const prodGhee = createProduct({
      name: "DDC Ghee 1L",
      cost_price: 115000,
      selling_price: 135000,
      current_stock: 20,
    });

    const vendor = createVendor({ name: "CG Foods Nepal" });
    const customer = createCustomer({ name: "Sita Devi Shrestha" });

    // Customer buys 3 tins of Ghee
    const sale = processSale(
      [{ productId: prodGhee.id, quantity: 3, actualSellingPrice: 135000, discount: 0 }],
      { customerId: customer.id, paidAmount: 405000, paymentMethod: "Cash", applyVat: false }
    );
    assert.equal(getProductById(prodGhee.id)?.current_stock, 17); // 20 - 3

    // Customer returns 1 tin (defective seal) -> Restocked into inventory
    const { returnRecord: creditNote } = processSaleReturn({
      saleId: sale.id,
      billNumber: sale.bill_number,
      customerId: customer.id,
      customerName: customer.name,
      refundMethod: "CASH",
      reason: "DEFECTIVE",
      items: [{ productId: prodGhee.id, quantity: 1, unitPrice: 135000, action: "RESTOCK" }],
    });

    assert.match(creditNote.return_number, /^CN-\d{5}$/);
    assert.equal(creditNote.total_refund, 135000);

    // Inventory restored back from 17 to 18
    assert.equal(getProductById(prodGhee.id)?.current_stock, 18);

    // Supplier return: We return 2 damaged tins back to supplier -> Deducted from inventory
    const purchase = processPurchase(
      [makePurchaseItem({ productId: prodGhee.id, quantity: 10, costPrice: 115000 })],
      { vendorId: vendor.id, paymentMethod: "Cash", paidAmount: 1150000, applyVat: false }
    );
    assert.equal(getProductById(prodGhee.id)?.current_stock, 28); // 18 + 10

    const { returnRecord: debitNote } = processPurchaseReturn({
      purchaseId: purchase.id,
      billNumber: purchase.bill_number,
      vendorId: vendor.id,
      vendorName: vendor.name,
      refundMethod: "CASH",
      reason: "DEFECTIVE",
      items: [{ productId: prodGhee.id, quantity: 2, costPrice: 115000 }],
    });

    assert.match(debitNote.return_number, /^DN-\d{5}$/);
    assert.equal(debitNote.total_refund, 230000);

    // Inventory reduced from 28 to 26
    assert.equal(getProductById(prodGhee.id)?.current_stock, 26);
  });

  test("5. Due & Settlement Alignment: Customer debt payments and supplier payable settlements", () => {
    const today = new Date().toISOString().slice(0, 10);
    const prod = createProduct({ name: "Sugar 50kg", cost_price: 350000, selling_price: 420000, current_stock: 20 });
    const customer = createCustomer({ name: "Ramesh Store", phone: "9841000000" });
    const vendor = createVendor({ name: "Sugar Mill Nepal", phone: "9851000000" });

    // Customer Credit Sale: Bill Rs. 4,200 (420000), Paid Rs. 1,200 (120000), Due Rs. 3,000 (300000)
    processSale(
      [{ productId: prod.id, quantity: 1, actualSellingPrice: 420000, discount: 0 }],
      { customerId: customer.id, paidAmount: 120000, paymentMethod: "Cash", applyVat: false }
    );
    assert.equal(getCustomerTotalDue(customer.id), 300000);

    // Customer settles Rs. 2,000 (200000)
    recordCustomerPayment({
      customerId: customer.id,
      amount: 200000,
      paymentMethod: "Cash",
      paymentDate: today,
    });
    // Remaining due = 300000 - 200000 = 100000 paisa (Rs. 1,000)
    assert.equal(getCustomerTotalDue(customer.id), 100000);

    // Vendor Credit Purchase: Bill Rs. 3,500 (350000), Paid Rs. 500 (50000), Due Rs. 3,000 (300000)
    const purch = processPurchase(
      [makePurchaseItem({ productId: prod.id, quantity: 1, costPrice: 350000 })],
      { vendorId: vendor.id, paidAmount: 50000, paymentMethod: "Cash", applyVat: false }
    );
    assert.equal(getVendorTotalDue(vendor.id), 300000);

    // We pay Rs. 2,500 (250000) to vendor
    recordVendorPayment({
      vendorId: vendor.id,
      amount: 250000,
      paymentMethod: "Bank Transfer",
      paymentDate: today,
    });
    // Remaining vendor payable due = 300000 - 250000 = 50000 paisa (Rs. 500)
    assert.equal(getVendorTotalDue(vendor.id), 50000);
  });

  test("6. Stock Movement Ledger & Day Book Audit Trail: Full mathematical balance verification", () => {
    const today = new Date().toISOString().slice(0, 10);
    const prod = createProduct({ name: "Gold Tea 250g", cost_price: 20000, selling_price: 28000, current_stock: 50 });

    // Initial stock created: 1 RESTOCK entry of +50
    let movements = getStockMovements({ productId: prod.id });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].quantity, 50);

    // Restock via purchase: +20
    processPurchase(
      [makePurchaseItem({ productId: prod.id, quantity: 20, costPrice: 20000 })],
      { paymentMethod: "Cash", paidAmount: 400000, applyVat: false }
    );
    // Sale: -15
    const sale = processSale(
      [{ productId: prod.id, quantity: 15, actualSellingPrice: 28000, discount: 0 }],
      { paymentMethod: "Cash", paidAmount: 420000, applyVat: false }
    );
    // Customer return: +2
    processSaleReturn({
      saleId: sale.id,
      billNumber: sale.bill_number,
      refundMethod: "CASH",
      reason: "DEFECTIVE",
      items: [{ productId: prod.id, quantity: 2, unitPrice: 28000, action: "RESTOCK" }],
    });

    // Ledger reconciliation: 50 + 20 - 15 + 2 = 57
    movements = getStockMovements({ productId: prod.id });
    assert.equal(movements.length, 4);

    const netStock = movements.reduce((sum, m) => sum + m.quantity, 0);
    assert.equal(netStock, 57);
    assert.equal(getProductById(prod.id)?.current_stock, 57);

    // Day Book Balancing
    const dayBook = getDayBook({ date: today });
    assert.ok(dayBook);
    assert.equal(
      dayBook.closingBalance,
      dayBook.openingBalance + dayBook.netCash,
      "Day Book double-entry closing cash must balance with mathematical accuracy"
    );
  });
});

