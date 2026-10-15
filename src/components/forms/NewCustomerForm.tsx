/**
 * Customers Management View
 * Dedicated section for customer management.
 * Tracks contact details, PAN/VAT registration, repeat orders, and total expenditure.
 */
import React, { useState } from "react";
import { Users, Phone, FileText, MapPin } from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext.tsx";
import { useToast } from "@/src/context/ToastContext.tsx";
import {
  updateCustomer,
  createCustomer,
} from "@/src/lib/services/customerService.ts";
import { capitalizeWords } from "@/src/helpers/formatHelpers.ts";
import { Customer, CreateCustomerInput } from "@/src/types/index.ts";
import Input from "../common/Input";

interface CustomerFormProps {
  editingCustomer: Customer | null;
  initialValues?: Partial<CreateCustomerInput>;
  onClose: () => void;
  loadCustomers?: () => void;
  onCustomerCreated?: (customer: Customer) => void;
}

export const NewCustomerForm: React.FC<CustomerFormProps> = ({
  editingCustomer,
  initialValues,
  onClose,
  loadCustomers,
  onCustomerCreated,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Form Fields
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: editingCustomer?.name ?? initialValues?.name ?? "",
    phone: editingCustomer?.phone ?? initialValues?.phone ?? "",
    pan_vat: editingCustomer?.pan_vat ?? initialValues?.pan_vat ?? "",
    address: editingCustomer?.address ?? initialValues?.address ?? "",
    notes: editingCustomer?.notes ?? initialValues?.notes ?? "",
  });

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      showToast(
        isNepali ? "ग्राहकको नाम आवश्यक छ" : "Customer name is required",
        "warning",
      );
      return;
    }

    const payload: CreateCustomerInput = {
      ...formData,
      name: capitalizeWords(trimmedName),
    };

    try {
      if (editingCustomer) {
        updateCustomer(editingCustomer.id, payload);
        showToast(
          isNepali
            ? `ग्राहक "${payload.name}" अद्यावधिक गरियो`
            : `Customer "${payload.name}" updated successfully`,
          "success",
        );
        if (onCustomerCreated) {
          onCustomerCreated({
            ...editingCustomer,
            name: payload.name,
            phone: formData.phone?.trim() || null,
            pan_vat: formData.pan_vat?.trim() || null,
            address: formData.address?.trim() || null,
            notes: formData.notes?.trim() || null,
          });
        }
      } else {
        const created = createCustomer(payload);
        showToast(
          isNepali
            ? `नयाँ ग्राहक "${payload.name}" सफलतापूर्वक थपियो`
            : `Customer "${payload.name}" created successfully`,
          "success",
        );
        if (onCustomerCreated) {
          onCustomerCreated(created);
        }
      }
      onClose();
      if (loadCustomers) loadCustomers();
    } catch (err: unknown) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-4">
      <Input
        label={
          <>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isNepali ? "ग्राहकको नाम" : "Customer Name"}</span>
            <span className="text-rose-400">*</span>
          </>
        }
        type="text"
        required
        className="capitalize"
        placeholder={
          isNepali ? "उदा. राम बहादुर श्रेष्ठ" : "e.g. Ram Bahadur Shrestha"
        }
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        onBlur={() =>
          setFormData((prev) => ({
            ...prev,
            name: capitalizeWords(prev.name),
          }))
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label={
            <>
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "फोन / मोबाइल" : "Phone / Mobile"}</span>
            </>
          }
          type="tel"
          mono
          placeholder={isNepali ? "उदा. 9841234567" : "e.g. 9841234567"}
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />

        <Input
          label={
            <>
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "PAN / VAT नम्बर" : "PAN / VAT Number"}</span>
            </>
          }
          type="text"
          mono
          className="uppercase"
          placeholder={isNepali ? "उदा. 601234567" : "e.g. 601234567"}
          value={formData.pan_vat}
          onChange={(e) =>
            setFormData({ ...formData, pan_vat: e.target.value })
          }
        />
      </div>

      <Input
        label={
          <>
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            <span>{isNepali ? "ठेगाना" : "Address"}</span>
          </>
        }
        type="text"
        placeholder={
          isNepali
            ? "उदा. नयाँ बानेश्वर, काठमाडौँ"
            : "e.g. New Baneshwor, Kathmandu"
        }
        value={formData.address}
        onChange={(e) =>
          setFormData({ ...formData, address: e.target.value })
        }
      />

      <div>
        <label className="block text-xs font-semibold text-neutral-300 mb-1">
          {isNepali ? "कैफियत / टिप्पणी" : "Notes / Remarks"}
        </label>
        <textarea
          rows={2}
          placeholder={
            isNepali
              ? "ग्राहक सम्बन्धी कुनै अतिरिक्त जानकारी..."
              : "Any preferences or special notes..."
          }
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          {editingCustomer
            ? isNepali
              ? "अद्यावधिक गर्नुहोस्"
              : "Update Customer"
            : isNepali
              ? "ग्राहक सुरक्षित गर्नुहोस्"
              : "Save Customer"}
        </button>
      </div>
    </form>
  );
};
