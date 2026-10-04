/**
 * Customer Search, Autocomplete & Auto-Creation Input Section
 * Used during POS Sales checkout.
 * Searches existing customers by Name, Phone, or PAN/VAT;
 * If found, auto-fills details; if not found, allows inputting customer details
 * which are automatically created in the database upon sale completion.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Search,
  Check,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Sparkles,
  Phone,
  Mail,
  FileText,
  MapPin,
} from 'lucide-react';
import { Customer } from '../../types/index.ts';
import { searchCustomers } from '../../lib/services/customerService.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Input } from './Input.tsx';

export interface CustomerInputData {
  customerId: number | null;
  name: string;
  phone: string;
  email: string;
  pan_vat: string;
  address: string;
  notes?: string;
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
  const [query, setQuery] = useState(value.name || value.phone || '');
  const [results, setResults] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external name changes
  useEffect(() => {
    if (value.name || value.phone) {
      setQuery(value.name || value.phone || '');
    } else {
      setQuery('');
    }
  }, [value.name, value.phone]);

  // Search when query changes
  useEffect(() => {
    if (!isOpen) return;
    try {
      const found = searchCustomers(query, 8);
      setResults(found);
    } catch (e) {
      console.error('Customer search error:', e);
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

  const handleSelectCustomer = (customer: Customer) => {
    setQuery(customer.name);
    setIsOpen(false);
    setShowExtraFields(true);
    onChange({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      pan_vat: customer.pan_vat || '',
      address: customer.address || '',
      notes: customer.notes || '',
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
        (r.pan_vat && r.pan_vat.toLowerCase() === trimmed.toLowerCase())
    );

    if (isExactMatch) {
      onChange({
        customerId: isExactMatch.id,
        name: isExactMatch.name,
        phone: isExactMatch.phone || value.phone,
        email: isExactMatch.email || value.email,
        pan_vat: isExactMatch.pan_vat || value.pan_vat,
        address: isExactMatch.address || value.address,
        notes: isExactMatch.notes || value.notes,
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
    setQuery('');
    setIsOpen(false);
    setShowExtraFields(false);
    onChange({
      customerId: null,
      name: '',
      phone: '',
      email: '',
      pan_vat: '',
      address: '',
      notes: '',
      isNew: false,
    });
  };

  const isExistingCustomer = value.customerId !== null;
  const isNewCustomerCandidate =
    !isExistingCustomer && (value.name.trim().length > 0 || value.phone.trim().length > 0);

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-200">
              {isNepali ? 'ग्राहक विवरण' : 'Customer Details'}
              <span className="text-[10px] font-normal text-neutral-400 ml-1.5">
                ({isNepali ? 'ऐच्छिक' : 'Optional'})
              </span>
            </label>
            <p className="text-[10px] text-neutral-400">
              {isNepali
                ? 'नाम, फोन वा PAN बाट खोज्नुहोस् वा नयाँ ग्राहक भर्नुहोस् (स्वतः दर्ता हुनेछ)'
                : 'Search existing customer or enter new details to auto-save'}
            </p>
          </div>
        </div>

        {(value.name || value.phone || value.pan_vat) && (
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
              ? 'ग्राहकको नाम, मोबाइल नम्बर वा PAN खोज्नुहोस्...'
              : 'Search customer by name, phone, or PAN/VAT...'
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
              results.map((customer) => (
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
                        <span className="font-mono text-neutral-300">{customer.phone}</span>
                      )}
                      {customer.pan_vat && (
                        <span className="font-mono text-neutral-400">
                          PAN: {customer.pan_vat}
                        </span>
                      )}
                      {customer.address && (
                        <span className="truncate max-w-[140px]">{customer.address}</span>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>{isNepali ? 'अवस्थित' : 'Found'}</span>
                  </span>
                </button>
              ))
            ) : null}

            {/* Prompt to add as new customer if query is entered */}
            {query.trim().length > 0 &&
              !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase()) && (
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
                        ? `नयाँ ग्राहकको रूपमा दर्ता: "${query.trim()}"`
                        : `Add as new customer: "${query.trim()}"`}
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

      {/* Customer Status Badge */}
      {isExistingCustomer && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate font-medium">
              {isNepali ? 'दर्ता भएको ग्राहक:' : 'Registered Customer:'}{' '}
              <strong className="text-emerald-200">{value.name}</strong>
              {value.phone && (
                <span className="ml-1.5 font-mono text-[11px] text-emerald-400">
                  ({value.phone})
                </span>
              )}
              {value.pan_vat && (
                <span className="ml-1.5 font-mono text-[11px] text-emerald-300">
                  [PAN: {value.pan_vat}]
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtraFields(!showExtraFields)}
            className="text-[11px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>
              {showExtraFields
                ? isNepali
                  ? 'लुकाउनुहोस्'
                  : 'Hide details'
                : isNepali
                ? 'विवरण थप्नुहोस् / हेर्नुहोस्'
                : 'Add / View details'}
            </span>
            {showExtraFields ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {isNewCustomerCandidate && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-sky-950/30 border border-sky-500/30 rounded-lg text-xs text-sky-300">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">
              {isNepali
                ? `नयाँ ग्राहक "${value.name || value.phone}" बिक्री सम्पन्न हुँदा स्वतः दर्ता हुनेछ`
                : `New customer "${value.name || value.phone}" will be automatically saved on sale`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtraFields(!showExtraFields)}
            className="text-[11px] text-sky-400 hover:text-sky-200 flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>
              {showExtraFields
                ? isNepali
                  ? 'लुकाउनुहोस्'
                  : 'Hide'
                : isNepali
                ? 'थप विवरण थप्नुहोस्'
                : 'Add details'}
            </span>
            {showExtraFields ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Extra Details Accordion (Name, Phone, PAN, Email, Address) */}
      {(showExtraFields || isNewCustomerCandidate) && (
        <div className="pt-2 space-y-2.5 border-t border-neutral-800/80 animate-in fade-in duration-200">
          {isExistingCustomer && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {isNepali
                  ? 'नयाँ वा थपिएका विवरणहरू (PAN, इमेल, ठेगाना) यो बिक्री सम्पन्न हुँदा ग्राहक प्रोफाइलमा स्वतः सुरक्षित हुनेछन्।'
                  : 'New or added details (PAN/VAT, email, address) will automatically update the customer profile on sale.'}
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label={isNepali ? 'ग्राहकको नाम' : 'Customer Name'}
              icon={User}
              type="text"
              sizeVariant="sm"
              placeholder={isNepali ? 'उदा. राम श्रेष्ठ' : 'e.g. Ram Shrestha'}
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value, isNew: !isExistingCustomer })}
            />

            <Input
              label={isNepali ? 'फोन / मोबाइल' : 'Phone / Mobile'}
              icon={Phone}
              type="tel"
              sizeVariant="sm"
              mono
              placeholder={isNepali ? 'उदा. 9841234567' : 'e.g. 9841234567'}
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value, isNew: !isExistingCustomer })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label={isNepali ? 'PAN / VAT नम्बर' : 'PAN / VAT Number'}
              icon={FileText}
              type="text"
              sizeVariant="sm"
              mono
              className="uppercase"
              placeholder={isNepali ? 'उदा. 601234567' : 'e.g. 601234567'}
              value={value.pan_vat}
              onChange={(e) => onChange({ ...value, pan_vat: e.target.value, isNew: !isExistingCustomer })}
            />

            <Input
              label={isNepali ? 'इमेल ठेगाना' : 'Email Address'}
              icon={Mail}
              type="email"
              sizeVariant="sm"
              placeholder="customer@example.com"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value, isNew: !isExistingCustomer })}
            />
          </div>

          <Input
            label={isNepali ? 'ठेगाना' : 'Address'}
            icon={MapPin}
            type="text"
            sizeVariant="sm"
            placeholder={isNepali ? 'उदा. नयाँ बानेश्वर, काठमाडौँ' : 'e.g. New Baneshwor, Kathmandu'}
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value, isNew: !isExistingCustomer })}
          />
        </div>
      )}
    </div>
  );
};
