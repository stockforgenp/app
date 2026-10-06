/**
 * Customer Management Service
 * Supports customer directory, search autocomplete, auto-fill, and auto-creation during sales.
 */
import { Customer, CreateCustomerInput, Sale } from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';

export function getAllCustomers(search?: string): Customer[] {
  const baseSql = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as sales_count,
      (SELECT COALESCE(SUM(COALESCE(grand_total, total)), 0) FROM sales WHERE customer_id = c.id) as total_spent
    FROM customers c
  `;

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    return query<Customer>(
      `${baseSql} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.pan_vat LIKE ? OR c.email LIKE ? ORDER BY c.name ASC`,
      [s, s, s, s]
    );
  }

  return query<Customer>(`${baseSql} ORDER BY c.name ASC`);
}

export function getCustomerById(id: number): Customer | null {
  return queryOne<Customer>(
    `SELECT 
       c.*,
       (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as sales_count,
       (SELECT COALESCE(SUM(COALESCE(grand_total, total)), 0) FROM sales WHERE customer_id = c.id) as total_spent
     FROM customers c 
     WHERE c.id = ?`,
    [id]
  );
}

/**
 * Fast search for autocomplete in POS Sales view.
 */
export function searchCustomers(searchTerm: string, limit: number = 20): Customer[] {
  const term = searchTerm.trim();
  if (!term) {
    return query<Customer>(
      `SELECT c.*, (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as sales_count 
       FROM customers c 
       ORDER BY c.name ASC 
       LIMIT ?`,
      [limit]
    );
  }

  const s = `%${term}%`;
  return query<Customer>(
    `SELECT c.*, (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as sales_count 
     FROM customers c 
     WHERE c.name LIKE ? OR c.phone LIKE ? OR c.pan_vat LIKE ? OR c.email LIKE ?
     ORDER BY 
       CASE 
         WHEN LOWER(c.phone) = LOWER(?) THEN 1
         WHEN LOWER(c.name) = LOWER(?) THEN 2
         WHEN LOWER(c.pan_vat) = LOWER(?) THEN 3
         WHEN LOWER(c.phone) LIKE LOWER(? || '%') THEN 4
         WHEN LOWER(c.name) LIKE LOWER(? || '%') THEN 5
         ELSE 6
       END,
       c.name ASC
     LIMIT ?`,
    [s, s, s, s, term, term, term, term, term, limit]
  );
}

export function createCustomer(data: CreateCustomerInput): Customer {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new Error('Customer name is required');
  }

  const now = new Date().toISOString();
  const email = data.email && data.email.trim() ? data.email.trim() : null;
  const phone = data.phone && data.phone.trim() ? data.phone.trim() : null;
  const panVat = data.pan_vat && data.pan_vat.trim() ? data.pan_vat.trim() : null;
  const address = data.address && data.address.trim() ? data.address.trim() : null;
  const notes = data.notes && data.notes.trim() ? data.notes.trim() : null;

  return transaction(() => {
    run(
      `INSERT INTO customers (name, email, phone, pan_vat, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [trimmedName, email, phone, panVat, address, notes, now, now]
    );

    const idRes = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const newId = idRes?.id ?? 0;

    const created = getCustomerById(newId);
    if (!created) {
      throw new Error('Failed to retrieve created customer');
    }
    return created;
  });
}

export function updateCustomer(id: number, data: Partial<CreateCustomerInput>): void {
  const existing = getCustomerById(id);
  if (!existing) {
    throw new Error('Customer not found');
  }

  const now = new Date().toISOString();
  const name = data.name !== undefined ? data.name.trim() : existing.name;
  if (!name) {
    throw new Error('Customer name cannot be empty');
  }

  const email = (data.email !== undefined ? data.email?.trim() : existing.email) ?? null;
  const phone = (data.phone !== undefined ? data.phone?.trim() : existing.phone) ?? null;
  const panVat = (data.pan_vat !== undefined ? data.pan_vat?.trim() : existing.pan_vat) ?? null;
  const address = (data.address !== undefined ? data.address?.trim() : existing.address) ?? null;
  const notes = (data.notes !== undefined ? data.notes?.trim() : existing.notes) ?? null;

  transaction(() => {
    run(
      `UPDATE customers 
       SET name = ?, email = ?, phone = ?, pan_vat = ?, address = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [name, email, phone, panVat, address, notes, now, id]
    );

    // Keep denormalized customer_name in sales up-to-date
    if (name !== existing.name || phone !== existing.phone) {
      run(`UPDATE sales SET customer_name = ?, customer_phone = ? WHERE customer_id = ?`, [name, phone, id]);
    }
  });
}

export function deleteCustomer(id: number): void {
  const existing = getCustomerById(id);
  if (!existing) {
    throw new Error('Customer not found');
  }

  transaction(() => {
    // Unlink sales before deleting customer
    run(`UPDATE sales SET customer_id = NULL WHERE customer_id = ?`, [id]);
    run(`DELETE FROM customers WHERE id = ?`, [id]);
  });
}

/**
 * Searches for an existing customer by Phone, PAN/VAT, or Name.
 * If found, updates any missing details and returns the customer.
 * If not found, automatically creates and returns a new Customer.
 */
export function findOrCreateCustomer(data: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
}): Customer | null {
  const trimmedName = data.name ? data.name.trim() : '';
  const trimmedPhone = data.phone ? data.phone.trim() : '';
  const trimmedPan = data.pan_vat ? data.pan_vat.trim() : '';
  const trimmedEmail = data.email ? data.email.trim() : '';
  const trimmedAddress = data.address ? data.address.trim() : '';

  if (!trimmedName && !trimmedPhone && !trimmedPan) {
    return null;
  }

  // 1. Try matching by Phone if provided (primary retail lookup)
  if (trimmedPhone) {
    const matchByPhone = queryOne<Customer>(
      `SELECT * FROM customers WHERE phone = ? LIMIT 1`,
      [trimmedPhone]
    );
    if (matchByPhone) {
      const updates: Partial<CreateCustomerInput> = {};
      if (
        trimmedName &&
        trimmedName !== matchByPhone.name &&
        (matchByPhone.name.startsWith('Customer (') || matchByPhone.name === 'Walk-in Customer' || trimmedName.length > 0)
      ) {
        updates.name = trimmedName;
      }
      if (trimmedPan && trimmedPan !== (matchByPhone.pan_vat || '')) {
        updates.pan_vat = trimmedPan;
      }
      if (trimmedEmail && trimmedEmail !== (matchByPhone.email || '')) {
        updates.email = trimmedEmail;
      }
      if (trimmedAddress && trimmedAddress !== (matchByPhone.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByPhone.id, updates);
        return getCustomerById(matchByPhone.id) || matchByPhone;
      }
      return matchByPhone;
    }
  }

  // 2. Try matching by PAN/VAT if provided
  if (trimmedPan) {
    const matchByPan = queryOne<Customer>(
      `SELECT * FROM customers WHERE LOWER(pan_vat) = LOWER(?) LIMIT 1`,
      [trimmedPan]
    );
    if (matchByPan) {
      const updates: Partial<CreateCustomerInput> = {};
      if (trimmedPhone && trimmedPhone !== (matchByPan.phone || '')) {
        updates.phone = trimmedPhone;
      }
      if (
        trimmedName &&
        trimmedName !== matchByPan.name &&
        (matchByPan.name.startsWith('Customer (') || matchByPan.name === 'Walk-in Customer' || trimmedName.length > 0)
      ) {
        updates.name = trimmedName;
      }
      if (trimmedEmail && trimmedEmail !== (matchByPan.email || '')) {
        updates.email = trimmedEmail;
      }
      if (trimmedAddress && trimmedAddress !== (matchByPan.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByPan.id, updates);
        return getCustomerById(matchByPan.id) || matchByPan;
      }
      return matchByPan;
    }
  }

  // 3. Try matching by Name (case-insensitive) if provided
  if (trimmedName && trimmedName !== 'Walk-in Customer') {
    const matchByName = queryOne<Customer>(
      `SELECT * FROM customers WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [trimmedName]
    );
    if (matchByName) {
      const updates: Partial<CreateCustomerInput> = {};
      if (trimmedPhone && trimmedPhone !== (matchByName.phone || '')) {
        updates.phone = trimmedPhone;
      }
      if (trimmedPan && trimmedPan !== (matchByName.pan_vat || '')) {
        updates.pan_vat = trimmedPan;
      }
      if (trimmedEmail && trimmedEmail !== (matchByName.email || '')) {
        updates.email = trimmedEmail;
      }
      if (trimmedAddress && trimmedAddress !== (matchByName.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByName.id, updates);
        return getCustomerById(matchByName.id) || matchByName;
      }
      return matchByName;
    }
  }

  // 4. Not found: create new customer
  const effectiveName = trimmedName || (trimmedPhone ? `Customer (${trimmedPhone})` : 'Walk-in Customer');
  return createCustomer({
    name: effectiveName,
    phone: trimmedPhone || null,
    email: trimmedEmail || null,
    pan_vat: trimmedPan || null,
    address: trimmedAddress || null,
    notes: data.notes?.trim() || null,
  });
}

export function getCustomerSales(customerId: number): Sale[] {
  return query<Sale>(
    `SELECT s.*, 
            (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
     FROM sales s
     WHERE s.customer_id = ?
     ORDER BY s.created_at DESC, s.id DESC`,
    [customerId]
  );
}

/**
 * Total count of registered customers in the database.
 */
export function getCustomerCount(): number {
  const row = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM customers`);
  return row?.count ?? 0;
}
