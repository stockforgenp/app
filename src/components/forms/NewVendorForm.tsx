/**
 * New Vendor Form Component
 * Isolated form for creating and editing suppliers and vendors.
 * Tracks contact details, PAN/VAT registration, address, and credit/payment terms.
 */
import React, { useState, useEffect } from "react";
import { Building2, Phone, Mail, FileText, MapPin } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { useToast } from "../../context/ToastContext.tsx";
import {
  createVendor,
  updateVendor,
} from "../../lib/services/vendorService.ts";
import { capitalizeWords } from "../../helpers/formatHelpers.ts";
import { Vendor, CreateVendorInput } from "../../types/index.ts";
import { Input, Textarea } from "../common/Input.tsx";

export interface NewVendorFormProps {
  editingVendor: Vendor | null;
  initialValues?: Partial<CreateVendorInput>;
  onClose: () => void;
  loadVendors?: () => void;
  onSuccess?: () => void;
  onVendorCreated?: (vendor: Vendor) => void;
}

export const NewVendorForm: React.FC<NewVendorFormProps> = ({
  editingVendor,
  initialValues,
  onClose,
  loadVendors,
  onSuccess,
  onVendorCreated,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Form Fields
  const [formData, setFormData] = useState<CreateVendorInput>({
    name: editingVendor?.name ?? initialValues?.name ?? "",
    pan_vat: editingVendor?.pan_vat ?? initialValues?.pan_vat ?? "",
    phone: editingVendor?.phone ?? initialValues?.phone ?? "",
    email: editingVendor?.email ?? initialValues?.email ?? "",
    address: editingVendor?.address ?? initialValues?.address ?? "",
    notes: editingVendor?.notes ?? initialValues?.notes ?? "",
  });

  // Re-sync form fields whenever editingVendor or initialValues prop changes
  useEffect(() => {
    if (editingVendor) {
      setFormData({
        name: editingVendor.name,
        pan_vat: editingVendor.pan_vat || "",
        phone: editingVendor.phone || "",
        email: editingVendor.email || "",
        address: editingVendor.address || "",
        notes: editingVendor.notes || "",
      });
    } else if (initialValues) {
      setFormData({
        name: initialValues.name || "",
        pan_vat: initialValues.pan_vat || "",
        phone: initialValues.phone || "",
        email: initialValues.email || "",
        address: initialValues.address || "",
        notes: initialValues.notes || "",
      });
    } else {
      setFormData({
        name: "",
        pan_vat: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
    }
  }, [editingVendor, initialValues]);

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      showToast(
        isNepali ? "आपूर्तिकर्ताको नाम आवश्यक छ" : "Vendor name is required",
        "warning",
      );
      return;
    }

    const payload: CreateVendorInput = {
      ...formData,
      name: capitalizeWords(trimmedName),
    };

    try {
      if (editingVendor) {
        updateVendor(editingVendor.id, payload);
        showToast(
          isNepali
            ? `आपूर्तिकर्ता "${payload.name}" अद्यावधिक गरियो`
            : `Vendor "${payload.name}" updated successfully`,
          "success",
        );
        onVendorCreated?.({
          ...editingVendor,
          name: payload.name,
          pan_vat: formData.pan_vat?.trim() || null,
          phone: formData.phone?.trim() || null,
          email: formData.email?.trim() || null,
          address: formData.address?.trim() || null,
          notes: formData.notes?.trim() || null,
        });
      } else {
        const created = createVendor(payload);
        showToast(
          isNepali
            ? `नयाँ आपूर्तिकर्ता "${payload.name}" सफलतापूर्वक थपियो`
            : `Vendor "${payload.name}" created successfully`,
          "success",
        );
        onVendorCreated?.(created);
      }
      onClose();
      loadVendors?.();
      onSuccess?.();
    } catch (err: unknown) {
      showToast(
        (err as Error).message ||
          (isNepali ? "त्रुटि देखा पर्यो" : "Failed to save vendor"),
        "error",
      );
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-4">
      <div>
        <Input
          label={
            <>
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>
                {isNepali ? "आपूर्तिकर्ताको नाम" : "Vendor / Business Name"}
              </span>{" "}
              <span className="text-rose-400">*</span>
            </>
          }
          type="text"
          required
          className="capitalize"
          placeholder={
            isNepali
              ? "जस्तै: सूर्य डिस्ट्रिब्युटर्स"
              : "e.g. Acme Supplies Pvt. Ltd."
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={
            <>
              <FileText className="w-3.5 h-3.5 text-neutral-400" />
              <span>{`PAN / VAT ${isNepali ? "नम्बर" : "Number"}`}</span>
            </>
          }
          type="text"
          mono
          placeholder="e.g. 601234567"
          value={formData.pan_vat}
          onChange={(e) =>
            setFormData({ ...formData, pan_vat: e.target.value })
          }
        />

        <Input
          label={
            <>
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "फोन नम्बर" : "Phone / Mobile"}</span>
            </>
          }
          type="text"
          placeholder="e.g. 9841234567"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={
            <>
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "इमेल ठेगाना" : "Email Address"}</span>
            </>
          }
          type="email"
          placeholder="vendor@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />

        <Input
          label={
            <>
              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "ठेगाना / स्थान" : "Address / Location"}</span>
            </>
          }
          type="text"
          placeholder={
            isNepali ? "जस्तै: नयाँ सडक, काठमाडौँ" : "e.g. New Road, Kathmandu"
          }
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
        />
      </div>

      <Textarea
        label={
          <>
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>
              {isNepali ? "थप कैफियत / टिप्पणी" : "Notes / Payment Terms"}
            </span>
          </>
        }
        rows={2}
        placeholder={
          isNepali
            ? "जस्तै: क्रेडिट अवधि १५ दिन, डेलिभरी आइतबार"
            : "e.g. Credit terms 15 days, weekly delivery on Sundays"
        }
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
        >
          {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
        >
          {editingVendor
            ? isNepali
              ? "अद्यावधिक गर्नुहोस्"
              : "Save Changes"
            : isNepali
              ? "आपूर्तिकर्ता थप्नुहोस्"
              : "Create Vendor"}
        </button>
      </div>
    </form>
  );
};
