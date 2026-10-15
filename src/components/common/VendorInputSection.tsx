/**
 * Vendor Search, Autocomplete & Creation Input Section
 * Used during purchase / product creation / restock.
 * Searches existing vendors; if found, auto-fills details; provides an "Add Vendor" dialog
 * and minimal details chip when selected/entered.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Search,
  Check,
  Plus,
  X,
  UserCheck,
  Phone,
  Mail,
  FileText,
  MapPin,
  Edit2,
  UserPlus,
} from "lucide-react";
import { Vendor } from "../../types/index.ts";
import { searchVendors } from "../../lib/services/vendorService.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { capitalizeWords } from "../../lib/utils/format.ts";
import { Input } from "./Input.tsx";
import { Modal } from "./Modal.tsx";
import { NewVendorForm } from "../forms/NewVendorForm.tsx";

export interface VendorInputData {
  vendorId: number | null;
  name: string;
  pan_vat: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  isNew: boolean;
}

interface VendorInputSectionProps {
  value: VendorInputData;
  onChange: (data: VendorInputData) => void;
  required?: boolean;
}

export const VendorInputSection: React.FC<VendorInputSectionProps> = ({
  value,
  onChange,
  required = false,
}) => {
  const { isNepali } = useLanguage();
  const [query, setQuery] = useState(value.name || "");
  const [results, setResults] = useState<Vendor[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external name changes
  useEffect(() => {
    setQuery(value.name || "");
  }, [value.name]);

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const found = searchVendors(query, 8);
      setResults(found);
    } catch (e) {
      console.error("Vendor search error:", e);
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

  const handleSelectVendor = (vendor: Vendor) => {
    setQuery(vendor.name);
    setIsOpen(false);
    onChange({
      vendorId: vendor.id,
      name: vendor.name,
      pan_vat: vendor.pan_vat || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
      notes: vendor.notes || "",
      isNew: false,
    });
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setIsOpen(true);

    const trimmed = text.trim();
    // Check if query exactly matches an existing vendor
    const isExactExisting = results.find(
      (r) =>
        r.name.toLowerCase() === trimmed.toLowerCase() ||
        (r.pan_vat && r.pan_vat.toLowerCase() === trimmed.toLowerCase()) ||
        (r.phone && r.phone === trimmed),
    );

    if (isExactExisting) {
      onChange({
        vendorId: isExactExisting.id,
        name: isExactExisting.name,
        pan_vat: isExactExisting.pan_vat || value.pan_vat,
        phone: isExactExisting.phone || value.phone,
        email: isExactExisting.email || value.email,
        address: isExactExisting.address || value.address,
        notes: isExactExisting.notes || value.notes,
        isNew: false,
      });
    } else {
      onChange({
        ...value,
        vendorId: null,
        name: text,
        isNew: trimmed.length > 0,
      });
    }
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    onChange({
      vendorId: null,
      name: "",
      pan_vat: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      isNew: false,
    });
  };

  const handleVendorCreated = (vendor: Vendor) => {
    setQuery(vendor.name);
    setIsDialogOpen(false);
    setIsOpen(false);
    onChange({
      vendorId: vendor.id,
      name: vendor.name,
      pan_vat: vendor.pan_vat || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      address: vendor.address || "",
      notes: vendor.notes || "",
      isNew: false,
    });
  };

  const hasVendorInfo = Boolean(
    value.name.trim() ||
    value.phone.trim() ||
    value.pan_vat.trim() ||
    value.email.trim(),
  );
  const isExistingVendor = value.vendorId !== null;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-200">
              {isNepali
                ? "आपूर्तिकर्ता / भेन्डर विवरण"
                : "Vendor / Supplier Details"}{" "}
              {required ? (
                <span className="text-rose-400">*</span>
              ) : (
                <span className="text-[10px] font-normal text-neutral-400 ml-1.5">
                  ({isNepali ? "ऐच्छिक" : "Optional"})
                </span>
              )}
            </label>
            <p className="text-[10px] text-neutral-400">
              {isNepali
                ? "नाम, फोन वा PAN बाट खोज्नुहोस् वा नयाँ आपूर्तिकर्ता थप्नुहोस्"
                : "Search supplier or add new vendor in dialog"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <div ref={dropdownRef} className="relative">
            <Input
              type="text"
              required={required}
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
                  ? "आपूर्तिकर्ताको नाम, फोन वा PAN खोज्नुहोस्..."
                  : "Search vendor by name, phone, or PAN/VAT..."
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
                  ? results.map((vendor) => (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => handleSelectVendor(vendor)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-neutral-800 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-neutral-100 group-hover:text-emerald-300 flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{vendor.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-neutral-400">
                            {vendor.phone && (
                              <span className="font-mono text-neutral-300">
                                {vendor.phone}
                              </span>
                            )}
                            {vendor.pan_vat && (
                              <span className="font-mono text-neutral-400">
                                PAN: {vendor.pan_vat}
                              </span>
                            )}
                            {vendor.address && (
                              <span className="truncate max-w-[140px]">
                                {vendor.address}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>{isNepali ? "अवस्थित" : "Found"}</span>
                        </span>
                      </button>
                    ))
                  : null}

                {/* Prompt to add as new vendor in Dialog */}
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
                            ? `नयाँ आपूर्तिकर्ता थप्नुहोस्: "${query.trim()}"`
                            : `Add new supplier dialog: "${query.trim()}"`}
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isNepali ? "नयाँ आपूर्तिकर्ता" : "Add Vendor"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Vendor Details Display */}
      {hasVendorInfo && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-950/80 border border-neutral-800/80 rounded-lg text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            {/* Vendor Name */}
            <div className="flex items-center gap-1.5 min-w-0 font-medium text-neutral-200">
              {isExistingVendor ? (
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              )}
              <span className="truncate max-w-[150px] font-semibold text-neutral-100 capitalize">
                {capitalizeWords(value.name) || (isNepali ? "अनाम आपूर्तिकर्ता" : "Vendor")}
              </span>
              {isExistingVendor ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded shrink-0">
                  {isNepali ? "दर्ता भएको" : "Registered"}
                </span>
              ) : (
                <span className="text-[10px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.2 rounded shrink-0">
                  {isNepali ? "नयाँ आपूर्तिकर्ता" : "New Supplier"}
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

            {/* Email Chip */}
            {value.email && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 truncate max-w-[150px]">
                <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{value.email}</span>
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

      {/* Add / Edit Vendor Modal Dialog */}
      <Modal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={
          value.vendorId
            ? isNepali
              ? "आपूर्तिकर्ता विवरण सम्पादन गर्नुहोस्"
              : "Edit Vendor Details"
            : isNepali
              ? "नयाँ आपूर्तिकर्ता दर्ता गर्नुहोस्"
              : "Add New Vendor"
        }
        subtitle={
          isNepali
            ? "नाम, PAN/VAT, फोन, इमेल र ठेगाना प्रविष्ट गर्नुहोस्"
            : "Enter vendor name, PAN/VAT, phone, email, and address"
        }
        maxWidth="md"
      >
        <NewVendorForm
          editingVendor={
            value.vendorId
              ? {
                  id: value.vendorId,
                  name: value.name,
                  pan_vat: value.pan_vat || null,
                  phone: value.phone || null,
                  email: value.email || null,
                  address: value.address || null,
                  notes: value.notes || null,
                  created_at: "",
                  updated_at: "",
                }
              : null
          }
          initialValues={
            !value.vendorId
              ? {
                  name: /^[0-9+\s\-()]{7,}$/.test(query.trim())
                    ? value.name
                    : query.trim() || value.name,
                  phone: /^[0-9+\s\-()]{7,}$/.test(query.trim())
                    ? query.trim()
                    : value.phone,
                  pan_vat: value.pan_vat,
                  email: value.email,
                  address: value.address,
                  notes: value.notes,
                }
              : undefined
          }
          onClose={() => setIsDialogOpen(false)}
          onVendorCreated={handleVendorCreated}
        />
      </Modal>
    </div>
  );
};
