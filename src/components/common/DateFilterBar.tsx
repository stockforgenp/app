import React from "react";
import { RotateCcw } from "lucide-react";
import {
  DatePreset,
  DATE_PRESETS,
  calculateDateRange,
} from "../../lib/utils/dateFilters.ts";
import { Input } from "./Input.tsx";
import { NepaliDatePicker } from "./NepaliDatePicker.tsx";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { getCalendarSystem } from "../../lib/services/settingsService.ts";

export interface DateFilterBarProps {
  preset: DatePreset;
  onPresetChange: (
    preset: DatePreset,
    startDate: string,
    endDate: string,
  ) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
  showCustomInputs?: boolean;
  sizeVariant?: "sm" | "md";
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  hasActiveFilters = false,
  className = "",
  showCustomInputs = true,
  sizeVariant = "sm",
}) => {
  const { isNepali } = useLanguage();

  const handleSelectPreset = (p: DatePreset) => {
    if (p === "custom") {
      onPresetChange("custom", startDate, endDate);
    } else {
      const range = calculateDateRange(p);
      onPresetChange(p, range.startDate, range.endDate);
    }
  };

  const isCustom = preset === "custom";

  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs ${className}`}
    >
      {/* Preset Pill Buttons */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 shrink-0">
          {DATE_PRESETS.map((item) => {
            const isSelected = preset === item.id;
            const label =
              isNepali && item.nepaliLabel ? item.nepaliLabel : item.label;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Date Inputs and Clear Button */}
      <div className="flex items-center gap-2 justify-end shrink-0">
        {showCustomInputs && (
          <div
            className={`flex items-center gap-1.5 p-0.5 rounded-lg border text-neutral-300 transition-colors ${
              isCustom ? "border-emerald-500/50 bg-neutral-950" : "border-neutral-800 bg-neutral-950"
            }`}
          >
            <div className="w-36 sm:w-44">
              <NepaliDatePicker
                value={startDate}
                sizeVariant="sm"
                placeholder={isNepali ? "सुरु मिति" : "Start Date"}
                onChange={(adDate) => {
                  onStartDateChange(adDate);
                  onPresetChange("custom", adDate, endDate);
                }}
              />
            </div>
            <span className="text-neutral-500 text-xs px-0.5">—</span>
            <div className="w-36 sm:w-44">
              <NepaliDatePicker
                value={endDate}
                sizeVariant="sm"
                placeholder={isNepali ? "अन्तिम मिति" : "End Date"}
                onChange={(adDate) => {
                  onEndDateChange(adDate);
                  onPresetChange("custom", startDate, adDate);
                }}
              />
            </div>
          </div>
        )}

        {hasActiveFilters && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer text-xs shrink-0"
            title="Reset date and other active filters"
          >
            <RotateCcw className="w-3 h-3 text-neutral-400 dark:text-neutral-400 shrink-0" />
            <span>{isNepali ? "रिसेट" : "Clear"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
