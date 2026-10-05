/**
 * New Staff Form Component
 * Isolated form for creating and editing staff / employees.
 */
import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Users,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { DEFAULT_STAFF_ROLES } from "@/src/constants";
import { useToast } from "@/src/context/ToastContext.tsx";
import { useLanguage } from "@/src/context/LanguageContext.tsx";
import { fromMinorUnits, toMinorUnits } from "@/src/helpers";
import { createStaff, updateStaff } from "@/src/lib/services/staffService";
import { getTodayISODate } from "@/src/lib/utils/format";
import {
  Staff,
  StaffRole,
  SalaryType,
  StaffStatus,
  UpdateStaffInput,
  CreateStaffInput,
} from "@/src/types";
import { Input } from "../common/Input.tsx";
import { Select } from "../common/Select.tsx";

export interface NewStaffFormProps {
  editingStaff: Staff | null;
  onClose: () => void;
  currencySymbol: string;
  loadStaff?: () => void;
  onSuccess?: () => void;
}

export const NewStaffForm: React.FC<NewStaffFormProps> = ({
  editingStaff,
  onClose,
  currencySymbol,
  loadStaff,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>(DEFAULT_STAFF_ROLES[0]);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [formCustomRole, setFormCustomRole] = useState("");
  const [formSalaryType, setFormSalaryType] = useState<SalaryType>("monthly");
  const [formBaseSalary, setFormBaseSalary] = useState("25000");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formJoinDate, setFormJoinDate] = useState(getTodayISODate());
  const [formStatus, setFormStatus] = useState<StaffStatus>("active");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync form state when editingStaff changes
  useEffect(() => {
    if (editingStaff) {
      setFormName(editingStaff.name);
      if (DEFAULT_STAFF_ROLES.includes(editingStaff.role as StaffRole)) {
        setFormRole(editingStaff.role as StaffRole);
        setIsCustomRole(false);
        setFormCustomRole("");
      } else {
        setFormRole("Other");
        setIsCustomRole(true);
        setFormCustomRole(editingStaff.role);
      }
      setFormSalaryType(editingStaff.salary_type);
      setFormBaseSalary(fromMinorUnits(editingStaff.base_salary).toString());
      setFormPhone(editingStaff.phone || "");
      setFormEmail(editingStaff.email || "");
      setFormJoinDate(editingStaff.join_date || getTodayISODate());
      setFormStatus(editingStaff.status);
      setFormNotes(editingStaff.notes || "");
    } else {
      setFormName("");
      setFormRole(DEFAULT_STAFF_ROLES[0]);
      setIsCustomRole(false);
      setFormCustomRole("");
      setFormSalaryType("monthly");
      setFormBaseSalary("25000");
      setFormPhone("");
      setFormEmail("");
      setFormJoinDate(getTodayISODate());
      setFormStatus("active");
      setFormNotes("");
    }
    setFormError(null);
  }, [editingStaff]);

  // Save Staff (Create or Update)
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError(
        isNepali
          ? "कृपया कर्मचारीको पूरा नाम प्रविष्ट गर्नुहोस्।"
          : "Please enter the employee full name.",
      );
      return;
    }

    const effectiveRole = isCustomRole ? formCustomRole.trim() : formRole;
    if (!effectiveRole) {
      setFormError(
        isNepali
          ? "कृपया पद / जिम्मेवारी छान्नुहोस् वा लेख्नुहोस्।"
          : "Please select or specify a designation.",
      );
      return;
    }

    const numSalary = parseFloat(formBaseSalary);
    if (isNaN(numSalary) || numSalary < 0) {
      setFormError(
        isNepali
          ? "कृपया मान्य तलब रकम प्रविष्ट गर्नुहोस्।"
          : "Please enter a valid base wage (e.g. 25000).",
      );
      return;
    }

    const minorSalary = toMinorUnits(numSalary);

    try {
      if (editingStaff) {
        const updateInput: UpdateStaffInput = {
          name: trimmedName,
          role: effectiveRole,
          salary_type: formSalaryType,
          base_salary: minorSalary,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          join_date: formJoinDate || undefined,
          status: formStatus,
          notes: formNotes.trim() || null,
        };
        updateStaff(editingStaff.id, updateInput);
        showToast(
          isNepali
            ? `कर्मचारी "${trimmedName}" अद्यावधिक गरियो`
            : `Employee "${trimmedName}" updated successfully.`,
          "success",
        );
      } else {
        const createInput: CreateStaffInput = {
          name: trimmedName,
          role: effectiveRole,
          salary_type: formSalaryType,
          base_salary: minorSalary,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          join_date: formJoinDate || undefined,
          status: formStatus,
          notes: formNotes.trim() || null,
        };
        createStaff(createInput);
        showToast(
          isNepali
            ? `नयाँ कर्मचारी "${trimmedName}" थपियो`
            : `Employee "${trimmedName}" added to team.`,
          "success",
        );
      }

      onClose();
      loadStaff?.();
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || "Failed to save staff record");
    }
  };

  return (
    <form onSubmit={handleSaveStaff} className="space-y-4">
      {formError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Full Name */}
      <Input
        label={
          <>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isNepali ? "कर्मचारीको पूरा नाम" : "Full Name"}</span>
            <span className="text-rose-400">*</span>
          </>
        }
        type="text"
        required
        placeholder={isNepali ? "उदा. राहुल शर्मा" : "e.g. Rahul Sharma"}
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Designation / Role */}
        <Select
          label={
            <>
              <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "पद / जिम्मेवारी" : "Designation / Role"}</span>
              <span className="text-rose-400">*</span>
            </>
          }
          required
          value={isCustomRole ? "Other" : formRole}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "Other") {
              setIsCustomRole(true);
            } else {
              setIsCustomRole(false);
              setFormRole(val as StaffRole);
            }
          }}
          options={DEFAULT_STAFF_ROLES.map((role) => ({
            value: role,
            label: role,
          }))}
        />

        {/* Custom Designation if 'Other' */}
        {isCustomRole ? (
          <Input
            label={
              <>
                <span>{isNepali ? "अन्य पद शीर्षक" : "Custom Role Title"}</span>
                <span className="text-rose-400">*</span>
              </>
            }
            type="text"
            required
            placeholder={
              isNepali ? "उदा. शिफ्ट सुपरभाइजर" : "e.g. Shift Supervisor"
            }
            value={formCustomRole}
            onChange={(e) => setFormCustomRole(e.target.value)}
          />
        ) : (
          <Select
            label={isNepali ? "रोजगार स्थिति" : "Employment Status"}
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as StaffStatus)}
            options={[
              {
                value: "active",
                label: isNepali ? "सक्रिय (Active)" : "Active",
              },
              {
                value: "inactive",
                label: isNepali ? "निष्क्रिय (Inactive)" : "Inactive",
              },
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Salary Type */}
        <Select
          label={
            <>
              <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "तलब प्रकार" : "Salary Type"}</span>
            </>
          }
          value={formSalaryType}
          onChange={(e) => setFormSalaryType(e.target.value as SalaryType)}
          options={[
            {
              value: "monthly",
              label: isNepali
                ? "मासिक निश्चित (Monthly Fixed)"
                : "Monthly Fixed",
            },
            {
              value: "hourly",
              label: isNepali ? "प्रति घण्टा (Hourly Rate)" : "Hourly Rate",
            },
            {
              value: "commission",
              label: isNepali
                ? "कमिशनमा आधारित (Commission)"
                : "Commission Based",
            },
          ]}
        />

        {/* Base Salary Rate */}
        <Input
          label={
            <>
              <span>
                {isNepali ? "आधारभूत तलब रकम" : "Base Wage Amount"} (
                {currencySymbol})
              </span>
              <span className="text-rose-400">*</span>
            </>
          }
          type="number"
          step="0.01"
          min="0"
          required
          mono
          placeholder="25000"
          value={formBaseSalary}
          onChange={(e) => setFormBaseSalary(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Phone */}
        <Input
          label={
            <>
              <Phone className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "फोन नम्बर" : "Phone Number"}</span>
              <span className="text-neutral-500 text-[10px]">
                ({isNepali ? "ऐच्छिक" : "optional"})
              </span>
            </>
          }
          type="tel"
          mono
          placeholder="+977 98XXXXXXXX"
          value={formPhone}
          onChange={(e) => setFormPhone(e.target.value)}
        />

        {/* Email */}
        <Input
          label={
            <>
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "इमेल ठेगाना" : "Email Address"}</span>
              <span className="text-neutral-500 text-[10px]">
                ({isNepali ? "ऐच्छिक" : "optional"})
              </span>
            </>
          }
          type="email"
          placeholder="staff@store.com"
          value={formEmail}
          onChange={(e) => setFormEmail(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Joining Date */}
        <Input
          label={
            <>
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isNepali ? "कार्य सुरु मिति" : "Joining Date"}</span>
            </>
          }
          type="date"
          value={formJoinDate}
          onChange={(e) => setFormJoinDate(e.target.value)}
        />

        {isCustomRole && (
          <Select
            label={isNepali ? "रोजगार स्थिति" : "Status"}
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value as StaffStatus)}
            options={[
              {
                value: "active",
                label: isNepali ? "सक्रिय (Active)" : "Active",
              },
              {
                value: "inactive",
                label: isNepali ? "निष्क्रिय (Inactive)" : "Inactive",
              },
            ]}
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1">
          {isNepali ? "आन्तरिक टिप्पणी / बैंक विवरण" : "Internal Profile Notes"}{" "}
          <span className="text-neutral-500 text-[10px]">
            ({isNepali ? "ऐच्छिक" : "optional"})
          </span>
        </label>
        <textarea
          rows={2}
          placeholder={
            isNepali
              ? "उदा. बैंक खाता विवरण, नागरिकता नम्बर वा परिचय..."
              : "e.g. Bank details: Nabil Bank A/C 012003423..."
          }
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
        >
          {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
        >
          {editingStaff
            ? isNepali
              ? "कर्मचारी अद्यावधिक गर्नुहोस्"
              : "Update Employee"
            : isNepali
              ? "कर्मचारी सुरक्षित गर्नुहोस्"
              : "Add Employee"}
        </button>
      </div>
    </form>
  );
};

export default NewStaffForm;
