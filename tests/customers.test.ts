/**
 * Feature 6 Test: Customers & Khata Ledger Suite
 * Tests:
 * 1. Customer creation, title-casing, validation, and wholesale/retail customer types
 * 2. Customer profile update with automated sales denormalization synchronization
 * 3. Safe customer deletion (unlinks historical sales to preserve transaction history)
 * 4. Fast search and prioritized ranking in searchCustomers (phone match > name match > prefix)
 * 5. Auto-resolution and auto-enrichment via findOrCreateCustomer (phone, PAN/VAT, name)
 * 6. Customer due calculations: getCustomerTotalDue and getCustomerPreviousDueForSale
 * 7. Debt settlement via recordCustomerPayment with FIFO allocation across unpaid sales
 * 8. Targeted sale payment allocation to a specific bill
 * 9. Customer Statement of Account (Khata Ledger): chronological running balance, invoices, payments, and credit notes
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";

// Dynamically import after setup has registered the wasm loader
const {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  searchCustomers,
  findOrCreateCustomer,
  getCustomerTotalDue,
  getCustomerPreviousDueForSale,
  recordCustomerPayment,
  getCustomerStatement,
  getCustomerCount,
} = await import("../src/lib/services/customerService.ts");

const { createProduct } = await import("../src/lib/services/productService.ts");

const { processSale, getSaleWithItems } =
  await import("../src/lib/services/salesService.ts");

const { processSaleReturn } =
  await import("../src/lib/services/returnsService.ts");

const { query, queryOne, run } = await import("../src/lib/db/sqliteEngine.ts");

describe("Feature 6: Customers & Khata Ledger", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. Customer creation, validation, title-casing, and customer types", () => {
    assert.throws(() => createCustomer({ name: "" }), /name is required/i);
    assert.throws(() => createCustomer({ name: "   " }), /name is required/i);

    const retailCustomer = createCustomer({
      name: "shyam sundar sharma",
      phone: "9845011111",
      pan_vat: "601234567",
      address: "Pokhariya, Parsa",
      notes: "Reliable grocery buyer",
      customer_type: "RETAIL",
    });

    assert.ok(retailCustomer.id > 0);
    assert.equal(
      retailCustomer.name,
      "Shyam Sundar Sharma",
      "Name should be automatically capitalized",
    );
    assert.equal(retailCustomer.phone, "9845011111");
    assert.equal(retailCustomer.pan_vat, "601234567");
    assert.equal(retailCustomer.address, "Pokhariya, Parsa");
    assert.equal(retailCustomer.customer_type, "RETAIL");

    const wholesaleCustomer = createCustomer({
      name: "Birgunj Mart Pvt Ltd",
      phone: "9802011222",
      customer_type: "WHOLESALE",
    });
    assert.equal(wholesaleCustomer.customer_type, "WHOLESALE");
    assert.equal(getCustomerCount(), 2);
  });

  test("2. Customer profile update syncs denormalized customer name and phone in sales", () => {
    const customer = createCustomer({
      name: "Old Name",
      phone: "9800000001",
    });

    const product = createProduct({
      name: "Biscuit Pack",
      cost_price: 2000,
      selling_price: 3000,
      current_stock: 50,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 2,
          actualSellingPrice: 3000,
          discount: 0,
        },
      ],
      { customerId: customer.id, applyVat: false },
    );
    assert.equal(sale.customer_name, "Old Name");
    assert.equal(sale.customer_phone, "9800000001");

    // Update customer profile
    updateCustomer(customer.id, {
      name: "New Corrected Name",
      phone: "9800000099",
      address: "Adarshnagar, Birgunj",
    });

    const updatedCust = getCustomerById(customer.id);
    assert.equal(updatedCust?.name, "New Corrected Name");
    assert.equal(updatedCust?.phone, "9800000099");

    // Check sales table was updated with new customer name and phone
    const updatedSale = getSaleWithItems(sale.id);
    assert.equal(updatedSale?.sale.customer_name, "New Corrected Name");
    assert.equal(updatedSale?.sale.customer_phone, "9800000099");
  });

  test("3. Safe customer deletion unlinks sales to preserve historical records", () => {
    const customer = createCustomer({
      name: "Temporary Customer",
      phone: "9811122233",
    });
    const product = createProduct({
      name: "Tea Box",
      cost_price: 10000,
      selling_price: 15000,
      current_stock: 20,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 15000,
          discount: 0,
        },
      ],
      { customerId: customer.id, applyVat: false },
    );

    // Delete customer
    deleteCustomer(customer.id);
    assert.equal(getCustomerById(customer.id), null);

    // Sales record must still exist with customer_id set to NULL
    const saleAfter = getSaleWithItems(sale.id);
    assert.ok(saleAfter);
    assert.equal(
      saleAfter.sale.customer_id,
      null,
      "Customer ID must be unlinked safely",
    );
    assert.equal(saleAfter.sale.total, 15000);
  });

  test("4. Fast search and prioritized ranking in searchCustomers", () => {
    createCustomer({
      name: "Anil Kumar",
      phone: "9845012345",
      pan_vat: "10001",
    });
    createCustomer({
      name: "Sunil Shrestha",
      phone: "9845099999",
      pan_vat: "10002",
    });
    createCustomer({
      name: "Anil Gupta",
      phone: "9800012345",
      pan_vat: "10003",
    });

    // Search by exact phone match
    const phoneResults = searchCustomers("9845012345");
    assert.ok(phoneResults.length >= 1);
    assert.equal(phoneResults[0].phone, "9845012345");

    // Search by partial name
    const nameResults = searchCustomers("Anil");
    assert.equal(nameResults.length, 2);

    // Search by PAN
    const panResults = searchCustomers("10002");
    assert.equal(panResults.length, 1);
    assert.equal(panResults[0].name, "Sunil Shrestha");
  });

  test("5. Auto-resolution and auto-enrichment via findOrCreateCustomer", () => {
    // 1. Initial creation via phone lookup
    const c1 = findOrCreateCustomer({
      phone: "9860123456",
      name: "Govinda KC",
    });
    assert.ok(c1);
    assert.equal(c1.name, "Govinda KC");
    assert.equal(c1.phone, "9860123456");

    // 2. Secondary lookup with same phone but newly provided PAN and address should update existing profile
    const c2 = findOrCreateCustomer({
      phone: "9860123456",
      pan_vat: "302918273",
      address: "Main Road, Birgunj",
    });
    assert.ok(c2);
    assert.equal(c2.id, c1.id, "Should resolve to same customer record");
    assert.equal(c2.pan_vat, "302918273", "PAN should be enriched");
    assert.equal(
      c2.address,
      "Main Road, Birgunj",
      "Address should be enriched",
    );

    // 3. Lookup by PAN/VAT
    const c3 = findOrCreateCustomer({
      pan_vat: "302918273",
    });
    assert.ok(c3);
    assert.equal(c3.id, c1.id);
  });

  test("6. Customer due calculations: getCustomerTotalDue and getCustomerPreviousDueForSale", () => {
    const customer = createCustomer({
      name: "Bikram Thapa",
      phone: "9845555555",
    });
    const product = createProduct({
      name: "Rice 25kg",
      cost_price: 200000,
      selling_price: 250000,
      current_stock: 50,
    });

    // Sale 1: Due = 100000 (Paid 150000 of 250000)
    const sale1 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 250000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 150000, applyVat: false },
    );

    // Sale 2: Due = 200000 (Paid 50000 of 250000)
    const sale2 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 250000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 50000, applyVat: false },
    );

    // Total due across all sales
    const totalDue = getCustomerTotalDue(customer.id);
    assert.equal(
      totalDue,
      300000,
      "Total due must be 100000 + 200000 = 300000",
    );

    // Previous due strictly prior to Sale 2 must be Sale 1's due (100000)
    const prevDueSale2 = getCustomerPreviousDueForSale(sale2.id, customer.id);
    assert.equal(
      prevDueSale2,
      100000,
      "Previous due before sale 2 must be 100000",
    );

    // Previous due strictly prior to Sale 1 must be 0
    const prevDueSale1 = getCustomerPreviousDueForSale(sale1.id, customer.id);
    assert.equal(prevDueSale1, 0, "Previous due before sale 1 must be 0");
  });

  test("7. Debt settlement via recordCustomerPayment with FIFO allocation across unpaid sales", () => {
    const customer = createCustomer({
      name: "Manoj Patel",
      phone: "9845112233",
    });
    const product = createProduct({
      name: "Edible Oil 1L",
      cost_price: 20000,
      selling_price: 25000,
      current_stock: 50,
    });

    // Sale 1: Due = 20000
    const sale1 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 25000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 5000, applyVat: false },
    );

    // Sale 2: Due = 15000
    const sale2 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 25000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 10000, applyVat: false },
    );

    assert.equal(getCustomerTotalDue(customer.id), 35000);

    // Customer makes a lump sum debt settlement of Rs. 250 (25000 paisa)
    // FIFO should settle Sale 1 completely (20000) and remaining 5000 towards Sale 2
    const payment = recordCustomerPayment({
      customerId: customer.id,
      amount: 25000,
      paymentMethod: "Cash",
      note: "Partial khata settlement",
    });

    assert.match(
      payment.receipt_number ?? "",
      /^RCP-C-\d{5}$/,
      "Receipt number format RCP-C-XXXXX",
    );
    assert.equal(payment.amount, 25000);

    // Verify remaining total due is 10000 (35000 - 25000)
    assert.equal(getCustomerTotalDue(customer.id), 10000);

    // Check specific sales
    const updatedSale1 = getSaleWithItems(sale1.id);
    assert.equal(
      updatedSale1?.sale.due_amount,
      0,
      "Sale 1 must be fully cleared",
    );
    assert.equal(updatedSale1?.sale.paid_amount, 25000);

    const updatedSale2 = getSaleWithItems(sale2.id);
    assert.equal(
      updatedSale2?.sale.due_amount,
      10000,
      "Sale 2 remaining due must be 10000",
    );
    assert.equal(updatedSale2?.sale.paid_amount, 15000); // 10000 initial + 5000 allocated
  });

  test("8. Targeted sale payment allocation to a specific bill", () => {
    const customer = createCustomer({
      name: "Sanjay Yadav",
      phone: "9845998877",
    });
    const product = createProduct({
      name: "Washing Soap",
      cost_price: 3000,
      selling_price: 5000,
      current_stock: 50,
    });

    const sale1 = processSale(
      [
        {
          productId: product.id,
          quantity: 2,
          actualSellingPrice: 5000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 0, applyVat: false }, // Due = 10000
    );

    const sale2 = processSale(
      [
        {
          productId: product.id,
          quantity: 2,
          actualSellingPrice: 5000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 0, applyVat: false }, // Due = 10000
    );

    // Specifically target Sale 2 with payment of 8000
    recordCustomerPayment({
      customerId: customer.id,
      saleId: sale2.id,
      amount: 8000,
      paymentMethod: "Online / QR",
      note: "Targeted payment for Sale 2 via Fonepay",
    });

    const s1 = getSaleWithItems(sale1.id);
    assert.equal(s1?.sale.due_amount, 10000, "Sale 1 remains untouched");

    const s2 = getSaleWithItems(sale2.id);
    assert.equal(s2?.sale.due_amount, 2000, "Sale 2 due reduced to 2000");
    assert.equal(s2?.sale.paid_amount, 8000);
  });

  test("9. Customer Statement of Account (Khata Ledger): running balance, invoices, payments, and credit notes", () => {
    const customer = createCustomer({
      name: "Kishore Manandhar",
      phone: "9841234567",
    });
    const product = createProduct({
      name: "Basmati Rice Special",
      cost_price: 150000,
      selling_price: 200000,
      current_stock: 50,
    });

    // Event 1: Invoice 1 with partial payment -> Due = 120000
    const sale1 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 200000,
          discount: 0,
        },
      ],
      {
        customerId: customer.id,
        paidAmount: 80000,
        applyVat: false,
        createdAt: "2026-10-01T10:00:00Z",
      },
    );

    // Event 2: Direct Payment Receipt of Rs. 500 (50000 paisa)
    recordCustomerPayment({
      customerId: customer.id,
      saleId: sale1.id,
      amount: 50000,
      paymentMethod: "Cash",
      paymentDate: "2026-10-05T12:00:00Z",
      note: "Cash payment towards balance",
    });

    // Event 3: Invoice 2 fully on credit -> Due = 200000
    const sale2 = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 200000,
          discount: 0,
        },
      ],
      {
        customerId: customer.id,
        paidAmount: 0,
        applyVat: false,
        createdAt: "2026-10-10T14:00:00Z",
      },
    );

    // Event 4: Credit Note (Sale return) of Rs. 300 (30000 paisa)
    processSaleReturn({
      saleId: sale2.id,
      billNumber: sale2.bill_number,
      customerId: customer.id,
      refundMethod: "CREDIT_NOTE",
      reason: "DEFECTIVE",
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 30000,
          action: "RESTOCK",
        },
      ],
      createdAt: "2026-10-15T16:00:00Z",
    });

    // Retrieve Khata Statement of Account
    const statement = getCustomerStatement(customer.id);
    assert.ok(statement);
    assert.equal(statement.customer.id, customer.id);
    assert.equal(statement.totalInvoiced, 400000); // 200000 + 200000

    // Verify chronological statement rows & step-by-step running balance:
    // Row 1 (Bill 1): initial due 120000 -> runningBalance = 120000
    // Row 2 (Payment 1): -50000 -> runningBalance = 70000
    // Row 3 (Bill 2): +200000 -> runningBalance = 270000
    // Row 4 (Credit Note): -30000 -> runningBalance = 240000
    assert.equal(statement.rows.length, 4);

    assert.equal(statement.rows[0].type, "BILL");
    assert.equal(statement.rows[0].runningBalance, 120000);

    assert.equal(statement.rows[1].type, "PAYMENT");
    assert.equal(statement.rows[1].runningBalance, 70000);

    assert.equal(statement.rows[2].type, "BILL");
    assert.equal(statement.rows[2].runningBalance, 270000);

    assert.equal(statement.rows[3].type, "RETURN");
    assert.equal(statement.rows[3].runningBalance, 240000);

    // Current total outstanding due must equal latest running balance (240000)
    assert.equal(getCustomerTotalDue(customer.id), 240000);
  });

  test("10. Real CRUD on Customers: INSERT into db, FETCH all columns, UPDATE customer, and DELETE from db", () => {
    // 1. CREATE / INSERT into db
    const customer = createCustomer({
      name: "rameshwor yadav",
      phone: "9845999888",
      pan_vat: "609876543",
      address: "Birgunj-12, Murli",
      customer_type: "WHOLESALE",
      notes: "Wholesale beverage dealer",
    });

    // 2. READ / FETCH directly from SQLite customers table
    const dbCustomer = queryOne<{
      id: number;
      name: string;
      phone: string;
      pan_vat: string;
      address: string;
      customer_type: string;
      notes: string;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM customers WHERE id = ?", [customer.id]);

    assert.ok(dbCustomer);
    assert.equal(dbCustomer.id, customer.id);
    assert.equal(dbCustomer.name, "Rameshwor Yadav");
    assert.equal(dbCustomer.phone, "9845999888");
    assert.equal(dbCustomer.pan_vat, "609876543");
    assert.equal(dbCustomer.address, "Birgunj-12, Murli");
    assert.equal(dbCustomer.customer_type, "WHOLESALE");
    assert.equal(dbCustomer.notes, "Wholesale beverage dealer");
    assert.ok(dbCustomer.created_at);
    assert.ok(dbCustomer.updated_at);

    // 3. UPDATE in SQLite database
    updateCustomer(customer.id, {
      name: "Rameshwor Kumar Yadav",
      phone: "9845999777",
      address: "Birgunj-10, Adarshnagar",
      notes: "Updated credit terms to 15 days",
    });

    const updated = getCustomerById(customer.id);
    assert.ok(updated);
    assert.equal(updated.name, "Rameshwor Kumar Yadav");

    const updatedDbCustomer = queryOne<{
      name: string;
      phone: string;
      address: string;
      notes: string;
    }>("SELECT name, phone, address, notes FROM customers WHERE id = ?", [customer.id]);
    assert.ok(updatedDbCustomer);
    assert.equal(updatedDbCustomer.name, "Rameshwor Kumar Yadav");
    assert.equal(updatedDbCustomer.phone, "9845999777");
    assert.equal(updatedDbCustomer.address, "Birgunj-10, Adarshnagar");
    assert.equal(updatedDbCustomer.notes, "Updated credit terms to 15 days");

    // 4. DELETE from SQLite database
    deleteCustomer(customer.id);

    const deletedRow = queryOne("SELECT * FROM customers WHERE id = ?", [customer.id]);
    assert.equal(deletedRow, null, "Customer row must be deleted from database");
    assert.equal(getCustomerById(customer.id), null);
  });
});
