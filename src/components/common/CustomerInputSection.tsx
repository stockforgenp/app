import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Search,
  Plus,
  X,
  UserCheck,
  Phone,
  FileText,
  MapPin,
  Edit2,
  UserPlus,
} from "lucide-react";
import { Customer } from "../../types/index.ts";
import { searchCustomers } from "../../lib/services/customerService.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { capitalizeWords } from "../../lib/utils/format.ts";
import { Input } from "./Input.tsx";
import { Modal } from "./Modal.tsx";
import { NewCustomerForm } from "../forms/NewCustomerForm.tsx";

export interface CustomerInputData {
  customerId: number | null;
  name: string;
  phone: string;
  pan_vat: string;
  address: string;
  notes?: string;
  customer_type?: 'RETAIL' | 'WHOLESALE';
  isNew: boolean;
}

interface CustomerInputSectionProps {
  value: CustomerInputData;
  onChange: (data: CustomerInputData) => void;
}

export const CustomerInputSection: React.FC<CustomerInputSectionProps> = ({
  value,
  onChange,
}) => {
  const { isNepali } = useLanguage();
  const [query, setQuery] = useState(value.name || value.phone || "");
  const [results, setResults] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external name changes
  useEffect(() => {
    if (value.name || value.phone) {
      setQuery(value.name || value.phone || "");
    } else {
      setQuery("");
    }
  }, [value.name, value.phone]);

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const found = searchCustomers(query, 8);
      setResults(found);
    } catch (e) {
      console.error("Customer search error:", e);
    }
  }, [query, isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setQuery(customer.name);
    setIsOpen(false);
    onChange({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      pan_vat: customer.pan_vat || "",
      address: customer.address || "",
      notes: customer.notes || "",
      customer_type: customer.customer_type || 'RETAIL',
      isNew: false,
    });
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setIsOpen(true);

    const trimmed = text.trim();
    // Check if query exactly matches an existing customer
    const isExactMatch = results.find(
      (r) =>
        r.name.toLowerCase() === trimmed.toLowerCase() ||
        (r.phone && r.phone === trimmed) ||
        (r.pan_vat && r.pan_vat.toLowerCase() === trimmed.toLowerCase()),
    );

    if (isExactMatch) {
      onChange({
        customerId: isExactMatch.id,
        name: isExactMatch.name,
        phone: isExactMatch.phone || value.phone,
        pan_vat: isExactMatch.pan_vat || value.pan_vat,
        address: isExactMatch.address || value.address,
        notes: isExactMatch.notes || value.notes,
        customer_type: isExactMatch.customer_type || 'RETAIL',
        isNew: false,
      });
    } else {
      // Determine if text looks like a phone number or name
      const isDigitsOnly = /^[0-9+\s\-()]{7,}$/.test(trimmed);
      onChange({
        ...value,
        customerId: null,
        name: isDigitsOnly ? value.name : text,
        phone: isDigitsOnly ? text : value.phone,
        isNew: trimmed.length > 0,
      });
    }
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    onChange({
      customerId: null,
      name: "",
      phone: "",
      pan_vat: "",
      address: "",
      notes: "",
      isNew: false,
    });
  };

  const handleCustomerCreated = (customer: Customer) => {
    setQuery(customer.name);
    setIsDialogOpen(false);
    setIsOpen(false);
    onChange({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone || "",
      pan_vat: customer.pan_vat || "",
      address: customer.address || "",
      notes: customer.notes || "",
      isNew: false,
    });
  };

  const hasCustomerInfo = Boolean(
    value.name.trim() || value.phone.trim() || value.pan_vat.trim(),
  );
  const isExistingCustomer = value.customerId !== null;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-200">
              {isNepali ? "ग्राहक विवरण" : "Customer Details"}
              <span className="text-[10px] font-normal text-neutral-400 ml-1.5">
                ({isNepali ? "ऐच्छिक" : "Optional"})
              </span>
            </label>
            <p className="text-[10px] text-neutral-400">
              {isNepali
                ? "नाम, फोन वा PAN बाट खोज्नुहोस् वा ग्राहक थप्नुहोस्"
                : "Search customer or add new customer in dialog"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div ref={dropdownRef} className="relative">
            <Input
              type="text"
              icon={Search}
              rightIcon={
                query ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-neutral-500 hover:text-neutral-300 cursor-pointer flex items-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null
              }
              placeholder={
                isNepali
                  ? "ग्राहकको नाम, मोबाइल नम्बर वा PAN खोज्नुहोस्..."
                  : "Search customer by name, phone, or PAN/VAT..."
              }
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => handleQueryChange(e.target.value)}
              sizeVariant="sm"
            />

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-neutral-800">
                {results.length > 0
                  ? results.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-neutral-800 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-100 group-hover:text-emerald-300 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{customer.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-neutral-400">
                            {customer.phone && (
                              <span className="font-mono text-neutral-300">
                                {customer.phone}
                              </span>
                            )}
                            {customer.pan_vat && (
                              <span className="font-mono text-neutral-400">
                                PAN: {customer.pan_vat}
                              </span>
                            )}
                            {customer.address && (
                              <span className="truncate max-w-[140px]">
                                {customer.address}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>{isNepali ? "अवस्थित" : "Found"}</span>
                        </span> */}
                      </button>
                    ))
                  : null}

                {/* Prompt to add as new customer in Dialog */}
                {query.trim().length > 0 &&
                  !results.some(
                    (r) => r.name.toLowerCase() === query.trim().toLowerCase(),
                  ) && (
                    <div
                      onClick={() => {
                        setIsOpen(false);
                        setIsDialogOpen(true);
                      }}
                      className="px-3.5 py-2.5 bg-emerald-950/20 hover:bg-emerald-950/40 text-left flex items-center justify-between text-xs cursor-pointer text-emerald-400"
                    >
                      <div className="flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {isNepali
                            ? `नयाँ ग्राहक थप्नुहोस्: "${query.trim()}"`
                            : `Add new customer dialog: "${query.trim()}"`}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                        {isNepali ? "डायलॉग" : "Dialog"}
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isNepali ? "नयाँ ग्राहक" : "Add Customer"}</span>
          </button>
        </div>
      </div>

      {/* Minimal Customer Details Display */}
      {hasCustomerInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-950/80 border border-neutral-800/80 rounded-lg text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            {/* Customer Name */}
            <div className="flex items-center gap-1.5 min-w-0 font-medium text-neutral-200">
              {isExistingCustomer ? (
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              )}
              <span className="truncate max-w-[150px] font-semibold text-neutral-100 capitalize">
                {capitalizeWords(value.name) ||
                  (isNepali ? "अनाम ग्राहक" : "Customer")}
              </span>
              {isExistingCustomer ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                  {isNepali ? "दर्ता भएको" : "Registered"}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.2 rounded shrink-0">
                  {isNepali ? "नयाँ ग्राहक" : "New"}
                </span>
              )}
            </div>

            {/* Phone Chip */}
            {value.phone && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-300 font-mono">
                <Phone className="w-3 h-3 text-neutral-500 shrink-0" />
                <span>{value.phone}</span>
              </div>
            )}

            {/* PAN / VAT Chip */}
            {value.pan_vat && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
                <FileText className="w-3 h-3 text-neutral-500 shrink-0" />
                <span>PAN: {value.pan_vat}</span>
              </div>
            )}

            {/* Address Chip */}
            {value.address && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[180px]">
                <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{value.address}</span>
              </div>
            )}
          </div>

          {/* Quick Edit in Dialog Button */}
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="text-[11px] text-neutral-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0 transition-colors ml-auto"
            title={
              isNepali ? "विवरण सम्पादन गर्नुहोस्" : "Edit details in dialog"
            }
          >
            <Edit2 className="w-3 h-3" />
            <span>{isNepali ? "सम्पादन" : "Edit"}</span>
          </button>
        </div>
      )}

      {/* Add / Edit Customer Modal Dialog */}
      <Modal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={
          value.customerId
            ? isNepali
              ? "ग्राहक विवरण सम्पादन गर्नुहोस्"
              : "Edit Customer Details"
            : isNepali
              ? "नयाँ ग्राहक दर्ता गर्नुहोस्"
              : "Add New Customer"
        }
        subtitle={
          isNepali
            ? "नाम, फोन, PAN/VAT र ठेगाना प्रविष्ट गर्नुहोस्"
            : "Enter customer name, phone, PAN/VAT, and address"
        }
        maxWidth="md"
      >
        <NewCustomerForm
          editingCustomer={
            value.customerId
              ? {
                  id: value.customerId,
                  name: value.name,
                  phone: value.phone || null,
                  pan_vat: value.pan_vat || null,
                  address: value.address || null,
                  notes: value.notes || null,
                  created_at: "",
                  updated_at: "",
                }
              : null
          }
          initialValues={
            !value.customerId
              ? {
                  name: /^[0-9+\s\-()]{7,}$/.test(query.trim())
                    ? value.name
                    : query.trim() || value.name,
                  phone: /^[0-9+\s\-()]{7,}$/.test(query.trim())
                    ? query.trim()
                    : value.phone,
                  pan_vat: value.pan_vat,
                  address: value.address,
                  notes: value.notes,
                }
              : undefined
          }
          onClose={() => setIsDialogOpen(false)}
          onCustomerCreated={handleCustomerCreated}
        />
      </Modal>
    </div>
  );
};
