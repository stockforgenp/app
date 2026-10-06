/**
 * Table Column Definitions: Staff Directory
 */
import {
  Users,
  CreditCard,
  Edit2,
  Calendar,
  UserCheck,
  UserX,
  Trash2,
  Phone,
  Mail,
} from "lucide-react";
import { Staff } from "../types/index.ts";
import { Column } from "../components/common/DataTable.tsx";
import { ActionMenu } from "../components/common/ActionMenu.tsx";
import { formatCurrency, formatDate } from "../helpers/formatHelpers.ts";

export interface StaffColumnOptions {
  isNepali?: boolean;
  currencySymbol: string;
  onDisburseSalary: (staff: Staff) => void;
  onEdit: (staff: Staff) => void;
  onViewDisbursements: (staff: Staff) => void;
  onToggleStatus: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
}

export function getStaffColumns(options: StaffColumnOptions): Column<Staff>[] {
  const {
    isNepali = false,
    currencySymbol,
    onDisburseSalary,
    onEdit,
    onViewDisbursements,
    onToggleStatus,
    onDelete,
  } = options;

  return [
    {
      id: "name",
      header: isNepali ? "कर्मचारी" : "Employee",
      sortable: true,
      sortKey: (staff) => staff.name,
      accessor: (staff) => (
        <div>
          <div className="font-semibold text-neutral-100 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>{staff.name}</span>
            {staff.status === "active" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
            ID: #{staff.id}
            {staff.join_date && ` · Joined: ${formatDate(staff.join_date)}`}
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: isNepali ? "पद / जिम्मेवारी" : "Designation",
      sortable: true,
      sortKey: (staff) => staff.role,
      accessor: (staff) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-200 border border-neutral-700/60">
          {staff.role}
        </span>
      ),
    },
    {
      id: "salary",
      header: isNepali ? "तलब संरचना" : "Salary Structure",
      align: "right",
      sortable: true,
      sortKey: (staff) => staff.base_salary,
      accessor: (staff) => (
        <div className="text-right font-mono font-medium text-neutral-200 tabular-nums whitespace-nowrap">
          {formatCurrency(staff.base_salary, currencySymbol)}
          <span className="text-[10px] text-neutral-500 font-sans block">
            per {staff.salary_type}
          </span>
        </div>
      ),
    },
    {
      id: "contact",
      header: isNepali ? "सम्पर्क विवरण" : "Contact",
      accessor: (staff) => (
        <div className="text-neutral-300">
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
            <span className="text-neutral-600 italic">No contact info</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: isNepali ? "स्थिति" : "Status",
      align: "center",
      sortable: true,
      sortKey: (staff) => staff.status,
      accessor: (staff) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            staff.status === "active"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-neutral-800 text-neutral-400 border border-neutral-700"
          }`}
        >
          {staff.status === "active"
            ? isNepali
              ? "सक्रिय"
              : "Active"
            : isNepali
              ? "निष्क्रिय"
              : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: isNepali ? "कार्य" : "Actions",
      align: "right",
      accessor: (staff) => (
        <ActionMenu
          align="right"
          items={[
            {
              label: isNepali ? "तलब भुक्तानी" : "Disburse Salary",
              icon: CreditCard,
              color: "emerald",
              action: () => onDisburseSalary(staff),
            },
            {
              label: isNepali ? "सम्पादन" : "Edit Employee",
              icon: Edit2,
              color: "sky",
              action: () => onEdit(staff),
            },
            {
              label: isNepali ? "भुक्तानी इतिहास" : "View Disbursements",
              icon: Calendar,
              color: "indigo",
              action: () => onViewDisbursements(staff),
            },
            {
              label:
                staff.status === "active"
                  ? isNepali
                    ? "निष्क्रिय बनाउनुहोस्"
                    : "Mark as Inactive"
                  : isNepali
                    ? "सक्रिय बनाउनुहोस्"
                    : "Mark as Active",
              icon: staff.status === "active" ? UserX : UserCheck,
              color: "amber",
              action: () => onToggleStatus(staff),
            },
            {
              label: isNepali ? "हटाउनुहोस्" : "Delete Employee",
              icon: Trash2,
              color: "rose",
              isDestructive: true,
              divider: true,
              action: () => onDelete(staff),
            },
          ]}
        />
      ),
    },
  ];
}

