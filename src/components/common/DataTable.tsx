/**
 * Shared DataTable / SharedTable Component
 * Universal data table with integrated search, multi-criteria filters,
 * extra action toolbar slots, column sorting, and pagination.
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
} from "lucide-react";
import { Input } from "./Input.tsx";
import { Select } from "./Select.tsx";
import { DateFilterBar, DateFilterBarProps } from "./DateFilterBar.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  accessor?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortKey?: (item: T) => string | number | Date | null | undefined;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId?: (item: T, index: number) => string | number;

  // Search
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchFilter?: (item: T, query: string) => boolean;

  // Date Filter
  dateFilterConfig?: Omit<DateFilterBarProps, "className">;

  // Custom Filters & Extra Actions
  filtersSlot?: React.ReactNode;
  extraActionsSlot?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;

  // Row Selection & Bulk Actions
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectChange?: (selectedIds: (string | number)[]) => void;
  bulkActionsSlot?: (selectedCount: number) => React.ReactNode;

  // Sorting
  defaultSortColumn?: string;
  defaultSortDirection?: "asc" | "desc";
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (columnId: string, direction: "asc" | "desc") => void;

  // Pagination
  enablePagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  currentPage?: number;
  onPageChange?: (page: number) => void;

  // Interactivity
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;

  // Loading & Empty States
  isLoading?: boolean;
  emptyIcon?: React.ElementType;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;

  // Styling
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  showSearch = true,
  searchPlaceholder,
  searchQuery: controlledSearchQuery,
  onSearchChange: controlledOnSearchChange,
  searchFilter,
  dateFilterConfig,
  filtersSlot,
  extraActionsSlot,
  hasActiveFilters,
  onClearFilters,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectChange,
  bulkActionsSlot,
  defaultSortColumn,
  defaultSortDirection = "asc",
  sortColumn: controlledSortColumn,
  sortDirection: controlledSortDirection,
  onSortChange,
  enablePagination = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  currentPage: controlledCurrentPage,
  onPageChange: controlledOnPageChange,
  onRowClick,
  rowClassName,
  isLoading = false,
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle,
  emptyMessage,
  emptyAction,
  className = "",
  tableClassName = "",
  headerClassName = "",
}: DataTableProps<T>): React.ReactElement {
  const { isNepali, formatNumberByLang } = useLanguage();

  // Internal search state if not controlled
  const [internalSearch, setInternalSearch] = useState("");
  const isSearchControlled = controlledSearchQuery !== undefined;
  const currentSearch = isSearchControlled
    ? controlledSearchQuery
    : internalSearch;

  const handleSearchChange = (val: string) => {
    if (!isSearchControlled) {
      setInternalSearch(val);
    }
    controlledOnSearchChange?.(val);
  };

  // Internal sorting state if not controlled
  const [internalSortColumn, setInternalSortColumn] = useState<
    string | undefined
  >(defaultSortColumn);
  const [internalSortDirection, setInternalSortDirection] = useState<
    "asc" | "desc"
  >(defaultSortDirection);

  const activeSortColumn =
    controlledSortColumn !== undefined
      ? controlledSortColumn
      : internalSortColumn;
  const activeSortDirection =
    controlledSortDirection !== undefined
      ? controlledSortDirection
      : internalSortDirection;

  const handleColumnSort = (col: Column<T>) => {
    if (!col.sortable) return;
    const newDirection =
      activeSortColumn === col.id && activeSortDirection === "asc"
        ? "desc"
        : "asc";

    if (controlledSortColumn === undefined) {
      setInternalSortColumn(col.id);
      setInternalSortDirection(newDirection);
    }
    onSortChange?.(col.id, newDirection);
  };

  // Internal selection state
  const [internalSelectedIds, setInternalSelectedIds] = useState<
    (string | number)[]
  >([]);
  const isSelectionControlled = controlledSelectedIds !== undefined;
  const activeSelectedIds = isSelectionControlled
    ? controlledSelectedIds
    : internalSelectedIds;

  const resolveRowId = (item: T, idx: number): string | number => {
    if (getRowId) return getRowId(item, idx);
    const anyItem = item as Record<string, unknown>;
    if (anyItem.id !== undefined && anyItem.id !== null) {
      return anyItem.id as string | number;
    }
    return idx;
  };

  // Filter items by search if not handled by parent
  const filteredData = useMemo(() => {
    if (isSearchControlled || !currentSearch.trim()) {
      return data;
    }
    const q = currentSearch.trim().toLowerCase();

    return data.filter((item) => {
      if (searchFilter) {
        return searchFilter(item, q);
      }
      // Default: inspect all values in object
      const values = Object.values(item as Record<string, unknown>);
      return values.some((v) => {
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [data, currentSearch, isSearchControlled, searchFilter]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!activeSortColumn) return filteredData;
    const col = columns.find((c) => c.id === activeSortColumn);
    if (!col || !col.sortable) return filteredData;

    return [...filteredData].sort((a, b) => {
      let valA: unknown = undefined;
      let valB: unknown = undefined;

      if (col.sortKey) {
        valA = col.sortKey(a);
        valB = col.sortKey(b);
      } else {
        const key = col.id as keyof T;
        valA = a[key];
        valB = b[key];
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      return activeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, activeSortColumn, activeSortDirection, columns]);

  // Pagination state
  const [internalPage, setInternalPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const isPageControlled = controlledCurrentPage !== undefined;
  const activePage = isPageControlled ? controlledCurrentPage : internalPage;

  // Reset page to 1 when search or filtered items change
  useEffect(() => {
    if (!isPageControlled) {
      setInternalPage(1);
    }
  }, [currentSearch, filteredData.length, isPageControlled]);

  const totalPages = enablePagination
    ? Math.max(1, Math.ceil(sortedData.length / pageSize))
    : 1;
  const validPage = Math.min(Math.max(1, activePage), totalPages);

  const paginatedData = useMemo(() => {
    if (!enablePagination) return sortedData;
    const startIndex = (validPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, enablePagination, validPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    const clamped = Math.min(Math.max(1, newPage), totalPages);
    if (!isPageControlled) {
      setInternalPage(clamped);
    }
    controlledOnPageChange?.(clamped);
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    const pageRowIds = paginatedData.map((item, idx) =>
      resolveRowId(item, idx),
    );
    const allSelected = pageRowIds.every((id) =>
      activeSelectedIds.includes(id),
    );

    let nextSelected: (string | number)[];
    if (allSelected) {
      nextSelected = activeSelectedIds.filter((id) => !pageRowIds.includes(id));
    } else {
      const toAdd = pageRowIds.filter((id) => !activeSelectedIds.includes(id));
      nextSelected = [...activeSelectedIds, ...toAdd];
    }

    if (!isSelectionControlled) {
      setInternalSelectedIds(nextSelected);
    }
    onSelectChange?.(nextSelected);
  };

  const handleToggleSelectRow = (id: string | number) => {
    const isSelected = activeSelectedIds.includes(id);
    const next = isSelected
      ? activeSelectedIds.filter((item) => item !== id)
      : [...activeSelectedIds, id];

    if (!isSelectionControlled) {
      setInternalSelectedIds(next);
    }
    onSelectChange?.(next);
  };

  const isAllCurrentPageSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item, idx) =>
      activeSelectedIds.includes(resolveRowId(item, idx)),
    );

  const startEntryIndex =
    sortedData.length === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endEntryIndex = Math.min(validPage * pageSize, sortedData.length);

  // Generate page numbers for pagination bar with ellipsis
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (validPage >= totalPages - 3) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          validPage - 1,
          validPage,
          validPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  }, [totalPages, validPage]);

  const showToolbar =
    showSearch ||
    Boolean(dateFilterConfig) ||
    Boolean(filtersSlot) ||
    Boolean(extraActionsSlot);

  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xs ${className}`}
    >
      {/* Table Toolbar: Search, Filters, Date Filter & Extra Actions */}
      {showToolbar && (
        <div className="p-4 space-y-3 border-b border-neutral-800 bg-neutral-900">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Left: Search & Filter Slots */}
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {showSearch && (
                <div className="flex-1 min-w-[200px] max-w-md">
                  <Input
                    type="text"
                    icon={Search}
                    sizeVariant="sm"
                    placeholder={
                      searchPlaceholder ||
                      (isNepali ? "खोजी गर्नुहोस्..." : "Search records...")
                    }
                    value={currentSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              )}

              {/* Custom filter dropdowns or chips */}
              {filtersSlot}

              {/* Reset/Clear button */}
              {(hasActiveFilters || Boolean(currentSearch)) &&
                onClearFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchChange("");
                      onClearFilters();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer shrink-0"
                    title={
                      isNepali ? "फिल्टरहरू रिसेट गर्नुहोस्" : "Reset filters"
                    }
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{isNepali ? "रिसेट" : "Reset"}</span>
                  </button>
                )}
            </div>

            {/* Right: Extra Action Buttons */}
            {extraActionsSlot && (
              <div className="flex items-center gap-2 shrink-0 justify-end">
                {extraActionsSlot}
              </div>
            )}
          </div>

          {/* Date Filter Bar Row if provided */}
          {dateFilterConfig && (
            <div className="pt-2 border-t border-neutral-800/80">
              <DateFilterBar {...dateFilterConfig} />
            </div>
          )}
        </div>
      )}

      {/* Bulk Action Banner when rows are selected */}
      {selectable && activeSelectedIds.length > 0 && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-semibold font-mono">
              {formatNumberByLang(activeSelectedIds.length)}
            </span>
            <span>
              {isNepali ? "वस्तुहरू चयन गरिएका छन्" : "item(s) selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActionsSlot?.(activeSelectedIds.length)}
            <button
              type="button"
              onClick={() => {
                if (!isSelectionControlled) setInternalSelectedIds([]);
                onSelectChange?.([]);
              }}
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
              title="Deselect all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className={`w-full text-left text-xs ${tableClassName}`}>
          <thead
            className={`bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 select-none ${headerClassName}`}
          >
              <tr>
                {selectable && (
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      title={
                        isNepali ? "सबै चयन गर्नुहोस्" : "Select all on page"
                      }
                    />
                  </th>
                )}

                {columns.map((col) => {
                  const isSorted = activeSortColumn === col.id;
                  const alignClass =
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                        ? "text-right"
                        : "text-left";

                  return (
                    <th
                      key={col.id}
                      style={{ width: col.width }}
                      className={`py-3 px-4 ${alignClass} ${col.headerClassName || ""} ${
                        col.sortable
                          ? "cursor-pointer hover:text-neutral-200 transition-colors"
                          : ""
                      }`}
                      onClick={() => col.sortable && handleColumnSort(col)}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 ${
                          col.align === "right" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-neutral-500">
                            {isSorted ? (
                              activeSortDirection === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-800/60">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-16 text-center text-neutral-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-neutral-400">
                        {isNepali ? "डाटा लोड हुँदैछ..." : "Loading data..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-14 px-4 text-center text-neutral-500"
                  >
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                      <EmptyIcon className="w-9 h-9 text-neutral-600 mb-1" />
                      <p className="text-sm font-semibold text-neutral-300">
                        {emptyTitle ||
                          (isNepali
                            ? "कुनै विवरण फेला परेन"
                            : "No records found")}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {emptyMessage ||
                          (currentSearch || hasActiveFilters
                            ? isNepali
                              ? "तपाईंको खोजी वा फिल्टर मापदण्डसँग कुनै डाटा मेल खाएन।"
                              : "No data matches your active filter or search criteria."
                            : isNepali
                              ? "यहाँ प्रदर्शन गर्न कुनै डाटा उपलब्ध छैन।"
                              : "There are no records to display in this list.")}
                      </p>
                      {emptyAction && <div className="pt-2">{emptyAction}</div>}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const rowId = resolveRowId(item, idx);
                  const isSelected = activeSelectedIds.includes(rowId);
                  const customRowClass = rowClassName?.(item, idx) || "";

                  return (
                    <tr
                      key={String(rowId)}
                      onClick={() => onRowClick?.(item, idx)}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? "bg-emerald-950/20" : ""
                      } ${onRowClick ? "cursor-pointer" : ""} ${customRowClass}`}
                    >
                      {selectable && (
                        <td
                          className="py-3 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(rowId)}
                            className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {columns.map((col) => {
                        const alignClass =
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                              ? "text-right"
                              : "text-left";

                        return (
                          <td
                            key={col.id}
                            className={`py-3 px-4 ${alignClass} ${col.className || ""}`}
                          >
                            {col.accessor
                              ? col.accessor(item, idx)
                              : ((item as Record<string, unknown>)[
                                  col.id
                                ] as React.ReactNode)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {enablePagination && sortedData.length > 0 && (
          <div className="px-4 py-3 bg-neutral-950 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 select-none">
            {/* Left: Range and Count */}
            <div className="flex items-center gap-3">
              <span>
                {isNepali ? (
                  <>
                    <strong className="text-neutral-200 font-mono">
                      {formatNumberByLang(sortedData.length)}
                    </strong>{" "}
                    मध्ये{" "}
                    <strong className="text-neutral-200 font-mono">
                      {formatNumberByLang(startEntryIndex)}
                    </strong>
                    -
                    <strong className="text-neutral-200 font-mono">
                      {formatNumberByLang(endEntryIndex)}
                    </strong>{" "}
                    देखाउँदै
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <strong className="text-neutral-200 font-mono">
                      {startEntryIndex}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-neutral-200 font-mono">
                      {endEntryIndex}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-neutral-200 font-mono">
                      {sortedData.length}
                    </strong>{" "}
                    entries
                  </>
                )}
              </span>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5 pl-3 border-l border-neutral-800">
                <span className="text-[11px] text-neutral-500">
                  {isNepali ? "प्रति पृष्ठ:" : "Show:"}
                </span>
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setPageSize(newSize);
                    handlePageChange(1);
                  }}
                  sizeVariant="sm"
                  portal={true}
                  dropdownPosition="up"
                  containerClassName="w-20"
                  options={pageSizeOptions.map((opt) => ({
                    value: opt,
                    label: `${opt}`,
                  }))}
                />
              </div>
            </div>

            {/* Right: Page Navigation Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(1)}
                  disabled={validPage <= 1}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(validPage - 1)}
                  disabled={validPage <= 1}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Number Buttons */}
                <div className="flex items-center gap-1">
                  {pageNumbers.map((p, idx) => {
                    if (p === "...") {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 text-neutral-600"
                        >
                          ...
                        </span>
                      );
                    }
                    const pageNum = p as number;
                    const isActive = pageNum === validPage;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-7 h-7 px-2 rounded-md font-mono text-xs font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        {formatNumberByLang(pageNum)}
                      </button>
                    );
                  })}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(validPage + 1)}
                  disabled={validPage >= totalPages}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={validPage >= totalPages}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
  );
}

// Alias for flexibility
export const SharedTable = DataTable;
