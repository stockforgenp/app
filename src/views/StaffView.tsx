/**
 * Staff Directory & Management View
 * Handles employee profiles, designations, salary structures, contact information, and active status.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  Search,
  Phone,
  Mail,
  AlertCircle,
  UserCheck,
  UserX,
  Briefcase,
} from "lucide-react";
import {
  Staff,
  StaffSummary,
  StaffRole,
  SalaryType,
  StaffStatus,
  CreateStaffInput,
  UpdateStaffInput,
} from "../types/index.ts";
import {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffSummary,
  DEFAULT_STAFF_ROLES,
} from "../lib/services/staffService.ts";
import {
  formatCurrency,
  formatDate,
  toMinorUnits,
  fromMinorUnits,
  getTodayISODate,
} from "../lib/utils/format.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import { Select } from "../components/common/Select.tsx";
import { Input } from "../components/common/Input.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";

interface StaffViewProps {
  currencySymbol: string;
}

export const StaffView: React.FC<StaffViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [summary, setSummary] = useState<StaffSummary>({
    total_staff: 0,
    active_staff: 0,
    monthly_payroll_commitment: 0,
    total_salaries_paid_this_month: 0,
    payments_count_this_month: 0,
  });

  // Filters
  const [staffSearch, setStaffSearch] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // Staff Form Modal States
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>(DEFAULT_STAFF_ROLES[0]);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [formCustomRole, setFormCustomRole] = useState("");
  const [formSalaryType, setFormSalaryType] = useState<SalaryType>("monthly");
  const [formBaseSalary, setFormBaseSalary] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formJoinDate, setFormJoinDate] = useState(getTodayISODate());
  const [formStatus, setFormStatus] = useState<StaffStatus>("active");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Load Data
  const loadData = useCallback(() => {
    try {
      const allStaff = getAllStaff({
        status: staffStatusFilter,
        search: staffSearch.trim() || undefined,
      });
      setStaffList(allStaff);

      const stats = getStaffSummary();
      setSummary(stats);
    } catch (err: any) {
      console.error("Error loading staff data:", err);
    }
  }, [staffStatusFilter, staffSearch]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbChanges(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // Open Create Staff Modal
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
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
    setFormError(null);
    setIsStaffModalOpen(true);
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setFormName(staff.name);

    if (DEFAULT_STAFF_ROLES.includes(staff.role as StaffRole)) {
      setFormRole(staff.role as StaffRole);
      setIsCustomRole(false);
      setFormCustomRole("");
    } else {
      setFormRole("Other");
      setIsCustomRole(true);
      setFormCustomRole(staff.role);
    }

    setFormSalaryType(staff.salary_type);
    setFormBaseSalary(fromMinorUnits(staff.base_salary).toString());
    setFormPhone(staff.phone || "");
    setFormEmail(staff.email || "");
    setFormJoinDate(staff.join_date || getTodayISODate());
    setFormStatus(staff.status);
    setFormNotes(staff.notes || "");
    setFormError(null);
    setIsStaffModalOpen(true);
  };

  // Save Staff (Create or Update)
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError("Please enter the employee full name.");
      return;
    }

    const effectiveRole = isCustomRole ? formCustomRole.trim() : formRole;
    if (!effectiveRole) {
      setFormError("Please select or specify a designation.");
      return;
    }

    const numSalary = parseFloat(formBaseSalary);
    if (isNaN(numSalary) || numSalary < 0) {
      setFormError("Please enter a valid base wage (e.g. 25000).");
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
        showToast(`Employee "${trimmedName}" updated successfully.`, "success");
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
        showToast(`Employee "${trimmedName}" added to team.`, "success");
      }

      setIsStaffModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save staff record");
    }
  };

  // Toggle active/inactive status
  const handleToggleStaffStatus = (staff: Staff) => {
    try {
      const nextStatus = staff.status === "active" ? "inactive" : "active";
      updateStaff(staff.id, { status: nextStatus });
      showToast(`${staff.name} is now marked ${nextStatus}`, "info");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update employee status", "error");
    }
  };

  // Delete staff member
  const handleDeleteStaff = () => {
    if (!staffToDelete) return;
    try {
      deleteStaff(staffToDelete.id);
      showToast(`Employee "${staffToDelete.name}" removed`, "info");
      setStaffToDelete(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete employee", "error");
    }
  };

  // Filtered staff by role
  const filteredStaffList = useMemo(() => {
    if (selectedRoleFilter === "all") return staffList;
    return staffList.filter((s) => s.role === selectedRoleFilter);
  }, [staffList, selectedRoleFilter]);

  // Unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    staffList.forEach((s) => {
      if (s.role) roles.add(s.role);
    });
    return Array.from(roles);
  }, [staffList]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-100">
              Staff Management
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Team Directory
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Employee profiles, job roles, salary structures, contact
            information, and employment status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleOpenAddStaff}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </motion.button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Total Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-100 font-mono tabular-nums">
              {summary.total_staff}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Registered employee records
            </div>
          </div>
        </motion.div>

        {/* Active Staff */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Active Workforce
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-100 font-mono tabular-nums">
              {summary.active_staff}{" "}
              <span className="text-xs font-normal text-emerald-400">
                (
                {summary.total_staff > 0
                  ? Math.round(
                      (summary.active_staff / summary.total_staff) * 100,
                    )
                  : 0}
                %)
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Active on current roster
            </div>
          </div>
        </motion.div>

        {/* Job Designations */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Job Designations
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-100 font-mono tabular-nums">
              {uniqueRoles.length}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Distinct roles configured
            </div>
          </div>
        </motion.div>

        {/* Inactive Staff Count */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              Inactive Staff
            </span>
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-300 font-mono tabular-nums">
              {Math.max(0, summary.total_staff - summary.active_staff)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Former or paused staff members
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full">
          <Input
            type="text"
            icon={Search}
            sizeVariant="sm"
            placeholder="Search staff by name, role, phone, or email..."
            value={staffSearch}
            onChange={(e) => setStaffSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {/* Status Filter */}
          <Select
            value={staffStatusFilter}
            onChange={(e) => setStaffStatusFilter(e.target.value as any)}
            containerClassName="w-32"
            sizeVariant="sm"
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active Only" },
              { value: "inactive", label: "Inactive Only" },
            ]}
          />

          {/* Role Filter */}
          <Select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            containerClassName="w-40"
            sizeVariant="sm"
            options={[
              { value: "all", label: "All Designations" },
              ...uniqueRoles.map((r) => ({ value: r, label: r })),
            ]}
          />

          {(staffStatusFilter !== "all" ||
            selectedRoleFilter !== "all" ||
            staffSearch) && (
            <button
              type="button"
              onClick={() => {
                setStaffStatusFilter("all");
                setSelectedRoleFilter("all");
                setStaffSearch("");
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none">
              <tr>
                <th className="py-3 px-5">Employee</th>
                <th className="py-3 px-5">Designation</th>
                <th className="py-3 px-5 text-right font-mono">
                  Salary Structure
                </th>
                <th className="py-3 px-5">Contact</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredStaffList.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-neutral-400 text-xs"
                  >
                    <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    No employees found matching the search criteria.
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleOpenAddStaff}
                        className="px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
                      >
                        + Add First Employee
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaffList.map((staff) => (
                  <tr
                    key={staff.id}
                    className="hover:bg-neutral-800/40 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-neutral-100 flex items-center gap-2">
                        <span>{staff.name}</span>
                        {staff.status === "active" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                        ID: #{staff.id}
                        {staff.join_date &&
                          ` · Joined: ${formatDate(staff.join_date)}`}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-200 border border-neutral-700/60">
                        {staff.role}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right font-mono font-medium text-neutral-200 tabular-nums whitespace-nowrap">
                      {formatCurrency(staff.base_salary, currencySymbol)}
                      <span className="text-[10px] text-neutral-500 font-sans block">
                        per {staff.salary_type}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-neutral-300">
                      {staff.phone ? (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span>{staff.phone}</span>
                        </div>
                      ) : null}
                      {staff.email ? (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5 truncate max-w-[170px]">
                          <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                          <span>{staff.email}</span>
                        </div>
                      ) : null}
                      {!staff.phone && !staff.email && (
                        <span className="text-neutral-600 italic">
                          No contact info
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          staff.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                        }`}
                      >
                        {staff.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <ActionMenu
                          align="right"
                          items={[
                            {
                              label: "Disburse Salary",
                              icon: CreditCard,
                              color: "emerald",
                              action: () =>
                                navigate(`/payroll?staffId=${staff.id}`),
                            },
                            {
                              label: "Edit Employee",
                              icon: Edit2,
                              color: "sky",
                              action: () => handleOpenEditStaff(staff),
                            },
                            {
                              label: "View Disbursements",
                              icon: Calendar,
                              color: "indigo",
                              action: () =>
                                navigate(`/payroll?staffId=${staff.id}`),
                            },
                            {
                              label:
                                staff.status === "active"
                                  ? "Mark as Inactive"
                                  : "Mark as Active",
                              icon:
                                staff.status === "active" ? UserX : UserCheck,
                              color: "amber",
                              action: () => handleToggleStaffStatus(staff),
                            },
                            {
                              label: "Delete Employee",
                              icon: Trash2,
                              color: "rose",
                              isDestructive: true,
                              divider: true,
                              action: () => setStaffToDelete(staff),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add / Edit Staff Member */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={
          editingStaff
            ? `Edit Employee #${editingStaff.id}`
            : "Add New Employee"
        }
        subtitle="Configure employee job profile, salary rates, and contact details."
        maxWidth="lg"
      >
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
                Full Name <span className="text-rose-400">*</span>
              </>
            }
            type="text"
            required
            placeholder="e.g. Rahul Sharma"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Designation / Role */}
            <Select
              label="Designation / Role"
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
                    Custom Role Title <span className="text-rose-400">*</span>
                  </>
                }
                type="text"
                required
                placeholder="e.g. Shift Supervisor"
                value={formCustomRole}
                onChange={(e) => setFormCustomRole(e.target.value)}
              />
            ) : (
              <Select
                label="Employment Status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as StaffStatus)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Salary Type */}
            <Select
              label="Salary Type"
              value={formSalaryType}
              onChange={(e) => setFormSalaryType(e.target.value as SalaryType)}
              options={[
                { value: "monthly", label: "Monthly Fixed" },
                { value: "hourly", label: "Hourly Rate" },
                { value: "commission", label: "Commission Based" },
              ]}
            />

            {/* Base Salary Rate */}
            <Input
              label={
                <>
                  Base Wage Amount ({currencySymbol}){" "}
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

          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            <Input
              label={
                <>
                  Phone Number{" "}
                  <span className="text-neutral-500 text-[10px]">
                    (optional)
                  </span>
                </>
              }
              type="tel"
              mono
              placeholder="+91 98765 43210"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />

            {/* Email */}
            <Input
              label={
                <>
                  Email Address{" "}
                  <span className="text-neutral-500 text-[10px]">
                    (optional)
                  </span>
                </>
              }
              type="email"
              placeholder="staff@store.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Joining Date */}
            <Input
              label="Joining Date"
              type="date"
              value={formJoinDate}
              onChange={(e) => setFormJoinDate(e.target.value)}
            />

            {isCustomRole && (
              <Select
                label="Status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as StaffStatus)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Internal Profile Notes{" "}
              <span className="text-neutral-500 text-[10px]">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Bank details: HDFC Bank A/C 5010023423..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              {editingStaff ? "Update Employee" : "Add Employee"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Staff Deletion Dialog */}
      <ConfirmDialog
        isOpen={!!staffToDelete}
        onClose={() => setStaffToDelete(null)}
        onConfirm={handleDeleteStaff}
        title="Delete Employee Record?"
        message={`Are you sure you want to delete employee "${staffToDelete?.name}"? Historical salary disbursements will remain preserved in the payroll ledger.`}
        confirmText="Delete Employee"
        isDestructive={true}
      />
    </div>
  );
};
