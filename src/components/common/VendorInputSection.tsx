/**
 * Vendor Search, Autocomplete & Creation Input Section
 * Used during purchase / product creation / restock.
 * Searches existing vendors; if found, auto-fills details; if not found, allows
 * inputting new vendor details which are automatically created upon saving.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Building2, Search, Check, Plus, X, ChevronDown, ChevronUp, UserCheck, Sparkles, Phone, Mail, FileText, MapPin } from 'lucide-react';
import { Vendor } from '../../types/index.ts';
import { searchVendors } from '../../lib/services/vendorService.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Input } from './Input.tsx';

export interface VendorInputData {
  vendorId: number | null;
  name: string;
  pan_vat: string;
  phone: string;
  email: string;
  address: string;
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
  const [query, setQuery] = useState(value.name || '');
  const [results, setResults] = useState<Vendor[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external name changes
  useEffect(() => {
    setQuery(value.name || '');
  }, [value.name]);

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const found = searchVendors(query, 8);
      setResults(found);
    } catch (e) {
      console.error('Vendor search error:', e);
    }
  }, [query, isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectVendor = (vendor: Vendor) => {
    setQuery(vendor.name);
    setIsOpen(false);
    setShowExtraFields(true);
    onChange({
      vendorId: vendor.id,
      name: vendor.name,
      pan_vat: vendor.pan_vat || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      isNew: false,
    });
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setIsOpen(true);

    // If query has changed from an existing vendor's name, reset vendorId
    const isExactExisting = results.find(
      (r) => r.name.toLowerCase() === text.trim().toLowerCase()
    );

    if (isExactExisting) {
      onChange({
        vendorId: isExactExisting.id,
        name: isExactExisting.name,
        pan_vat: isExactExisting.pan_vat || value.pan_vat,
        phone: isExactExisting.phone || value.phone,
        email: isExactExisting.email || value.email,
        address: isExactExisting.address || value.address,
        isNew: false,
      });
    } else {
      onChange({
        ...value,
        vendorId: null,
        name: text,
        isNew: text.trim().length > 0,
      });
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setShowExtraFields(false);
    onChange({
      vendorId: null,
      name: '',
      pan_vat: '',
      phone: '',
      email: '',
      address: '',
      isNew: false,
    });
  };

  const isExistingVendor = value.vendorId !== null;
  const isNewVendorCandidate = !isExistingVendor && value.name.trim().length > 0;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-200">
              {isNepali ? 'आपूर्तिकर्ता / भेन्डर विवरण' : 'Vendor / Supplier Details'}{' '}
              {required && <span className="text-rose-400">*</span>}
            </label>
            <p className="text-[10px] text-neutral-400">
              {isNepali
                ? 'खोजी गरेर छान्नुहोस् वा नयाँ आपूर्तिकर्ताको नाम लेख्नुहोस् (स्वतः दर्ता हुनेछ)'
                : 'Search existing suppliers or type a new name to auto-create'}
            </p>
          </div>
        </div>

        {value.name && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>{isNepali ? 'हटाउनुहोस्' : 'Clear'}</span>
          </button>
        )}
      </div>

      {/* Search / Autocomplete Field */}
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
              ? 'आपूर्तिकर्ताको नाम वा PAN नम्बर खोज्नुहोस्...'
              : 'Search vendor by name or PAN/VAT...'
          }
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => handleQueryChange(e.target.value)}
          sizeVariant="sm"
        />

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-neutral-800">
            {results.length > 0 ? (
              results.map((vendor) => (
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
                      {vendor.pan_vat && (
                        <span className="font-mono text-neutral-300">
                          PAN: {vendor.pan_vat}
                        </span>
                      )}
                      {vendor.phone && <span>{vendor.phone}</span>}
                      {vendor.address && <span className="truncate max-w-[140px]">{vendor.address}</span>}
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>{isNepali ? 'अवस्थित' : 'Found'}</span>
                  </span>
                </button>
              ))
            ) : null}

            {/* Prompt to add as new vendor if query is entered */}
            {query.trim().length > 0 && !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) && (
              <div
                onClick={() => {
                  setIsOpen(false);
                  setShowExtraFields(true);
                }}
                className="px-3.5 py-2.5 bg-emerald-950/20 hover:bg-emerald-950/40 text-left flex items-center justify-between text-xs cursor-pointer text-emerald-400"
              >
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isNepali
                      ? `नयाँ आपूर्तिकर्ताको रूपमा थप्नुहोस्: "${query.trim()}"`
                      : `Add as new supplier: "${query.trim()}"`}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {isNepali ? 'स्वतः सिर्जना' : 'Auto-Create'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vendor Status Badge */}
      {isExistingVendor && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate font-medium">
              {isNepali ? 'दर्ता भएको आपूर्तिकर्ता:' : 'Registered Vendor:'}{' '}
              <strong className="text-emerald-200">{value.name}</strong>
              {value.pan_vat && <span className="ml-1.5 font-mono text-[11px] text-emerald-400">({value.pan_vat})</span>}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtraFields(!showExtraFields)}
            className="text-[11px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>{showExtraFields ? (isNepali ? 'लुकाउनुहोस्' : 'Hide details') : (isNepali ? 'विवरण थप्नुहोस् / हेर्नुहोस्' : 'Add / View details')}</span>
            {showExtraFields ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {isNewVendorCandidate && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-sky-950/30 border border-sky-500/30 rounded-lg text-xs text-sky-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">
              {isNepali
                ? `नयाँ आपूर्तिकर्ता "${value.name}" सामान बचत गर्दा स्वतः दर्ता हुनेछ`
                : `New supplier "${value.name}" will be automatically created on save`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtraFields(!showExtraFields)}
            className="text-[11px] text-sky-400 hover:text-sky-200 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>{showExtraFields ? (isNepali ? 'लुकाउनुहोस्' : 'Hide') : (isNepali ? 'थप विवरण थप्नुहोस्' : 'Add details')}</span>
            {showExtraFields ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Extra Details Accordion (PAN, Phone, Email, Address) */}
      {(showExtraFields || isNewVendorCandidate) && (
        <div className="pt-2 space-y-2.5 border-t border-neutral-800/80 animate-in fade-in duration-200">
          {isExistingVendor && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {isNepali
                  ? 'नयाँ वा थपिएका विवरणहरू (PAN, फोन, इमेल, ठेगाना) खरिद सुरक्षित गर्दा आपूर्तिकर्ता प्रोफाइलमा स्वतः अद्यावधिक हुनेछन्।'
                  : 'Added or updated details (PAN/VAT, phone, email, address) will automatically update the vendor profile on purchase.'}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label={`PAN / VAT ${isNepali ? 'नम्बर' : 'Number'}`}
              icon={FileText}
              type="text"
              sizeVariant="sm"
              mono
              placeholder="e.g. 601234567"
              value={value.pan_vat}
              onChange={(e) => onChange({ ...value, pan_vat: e.target.value })}
            />

            <Input
              label={isNepali ? 'सम्पर्क फोन' : 'Phone / Mobile'}
              icon={Phone}
              type="text"
              sizeVariant="sm"
              placeholder="e.g. 9841234567"
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label={isNepali ? 'इमेल ठेगाना' : 'Email Address'}
              icon={Mail}
              type="email"
              sizeVariant="sm"
              placeholder="supplier@example.com"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
            />

            <Input
              label={isNepali ? 'ठेगाना' : 'Address / City'}
              icon={MapPin}
              type="text"
              sizeVariant="sm"
              placeholder={isNepali ? 'जस्तै: नयाँ सडक, काठमाडौँ' : 'e.g. New Road, Kathmandu'}
              value={value.address}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
