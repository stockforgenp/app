/**
 * Staff Directory & Management View
 * Handles employee profiles, designations, salary structures, contact information, and active status.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, UserPlus, Briefcase, UserCheck, UserX } from "lucide-react";
import { Staff, StaffSummary } from "../types/index.ts";
import {
  getAllStaff,
  updateStaff,
  deleteStaff,
  getStaffSummary,
} from "../lib/services/staffService.ts";
import { Modal } from "../components/common/Modal.tsx";
import { ConfirmDialog } from "../components/common/ConfirmDialog.tsx";
import { Select } from "../components/common/Select.tsx";
import { NewStaffForm } from "../components/forms/NewStaffForm.tsx";
import { DataTable, Column } from "../components/common/DataTable.tsx";
import { getStaffColumns } from "../columns/index.ts";
import { useToast } from "../context/ToastContext.tsx";
import { useLanguage } from "../context/LanguageContext.tsx";
import { subscribeToDbChanges } from "../lib/db/sqliteEngine.ts";
import { getStaffStatusFilterOptions } from "../constants/index.ts";

interface StaffViewProps {
  currencySymbol: string;
}

export const StaffView: React.FC<StaffViewProps> = ({ currencySymbol }) => {
  const { showToast } = useToast();
  const { isNepali } = useLanguage();
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
    setIsStaffModalOpen(true);
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setIsStaffModalOpen(true);
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

  const staffColumns = useMemo<Column<Staff>[]>(
    () =>
      getStaffColumns({
        currencySymbol,
        isNepali,
        onDisburseSalary: (staff) => navigate(`/payroll?staffId=${staff.id}`),
        onEdit: handleOpenEditStaff,
        onViewDisbursements: (staff) =>
          navigate(`/payroll?staffId=${staff.id}`),
        onToggleStatus: handleToggleStaffStatus,
        onDelete: (staff) => setStaffToDelete(staff),
      }),
    [currencySymbol, isNepali, navigate],
  );

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-150">
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

      {/* Staff Directory Table */}
      <DataTable<Staff>
        data={filteredStaffList}
        columns={staffColumns}
        searchQuery={staffSearch}
        onSearchChange={setStaffSearch}
        searchPlaceholder={
          isNepali
            ? "नाम, पद, फोन वा इमेल खोज्नुहोस्..."
            : "Search staff by name, role, phone, or email..."
        }
        filtersSlot={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <Select
              value={staffStatusFilter}
              onChange={(e) => setStaffStatusFilter(e.target.value as any)}
              containerClassName="w-32"
              sizeVariant="sm"
              options={getStaffStatusFilterOptions(isNepali)}
            />

            {/* Role Filter */}
            <Select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              containerClassName="w-40"
              sizeVariant="sm"
              options={[
                {
                  value: "all",
                  label: isNepali ? "सबै पदहरू" : "All Designations",
                },
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
        }
        extraActionsSlot={
          <button
            type="button"
            onClick={handleOpenAddStaff}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isNepali ? "कर्मचारी थप्नुहोस्" : "Add Employee"}</span>
          </button>
        }
        emptyIcon={Users}
        emptyTitle={isNepali ? "कुनै कर्मचारी फेला परेन" : "No employees found"}
        emptyMessage={
          isNepali
            ? "खोज मापदण्डसँग मेल खाने कुनै कर्मचारी छैन।"
            : "No employees found matching the search criteria."
        }
        emptyAction={
          <button
            type="button"
            onClick={handleOpenAddStaff}
            className="px-3 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
          >
            {isNepali ? "+ पहिलो कर्मचारी थप्नुहोस्" : "+ Add First Employee"}
          </button>
        }
        enablePagination={true}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Modal: Add / Edit Staff Member */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={
          editingStaff
            ? isNepali
              ? `कर्मचारी विवरण सम्पादन #${editingStaff.id}`
              : `Edit Employee #${editingStaff.id}`
            : isNepali
              ? "नयाँ कर्मचारी थप्नुहोस्"
              : "Add New Employee"
        }
        subtitle={
          isNepali
            ? "कर्मचारीको पद, तलब दर र सम्पर्क विवरणहरू प्रविष्ट गर्नुहोस्।"
            : "Configure employee job profile, salary rates, and contact details."
        }
        maxWidth="lg"
      >
        <NewStaffForm
          editingStaff={editingStaff}
          onClose={() => setIsStaffModalOpen(false)}
          currencySymbol={currencySymbol}
          loadStaff={loadData}
        />
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
