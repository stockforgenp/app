/**
 * Nepali Date & Time Picker Component
 * Interactive, 100% Offline Bikram Sambat (B.S.) & Gregorian (A.D.) Calendar Picker
 * Allows selecting Bikram Sambat date (Year, Month, Day) directly when BS is selected,
 * and Gregorian AD date when AD is selected.
 * Emits both AD (for SQLite database storage & query filters) and BS date strings.
 * Renders via React Portal with fixed viewport-boundary positioning to prevent being
 * clipped or hidden inside scrollable containers or modals.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Check,
  ArrowRightLeft,
} from "lucide-react";
import {
  adToBs,
  bsToAd,
  getDaysInBsMonth,
  getTodayBs,
  BS_MONTHS_EN,
  BS_MONTHS_NP,
  BS_DAYS_SHORT_NP,
  toNepaliDigits,
} from "../../lib/calendar/nepaliCalendar.ts";
import {
  getCalendarSystem,
  setCalendarSystem,
} from "../../lib/services/settingsService.ts";
import { useLanguage } from "../../context/LanguageContext.tsx";

const AD_MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const AD_MONTHS_NP = [
  "जनवरी",
  "फेब्रुअरी",
  "मार्च",
  "अप्रिल",
  "मे",
  "जुन",
  "जुलाई",
  "अगस्ट",
  "सेप्टेम्बर",
  "अक्टोबर",
  "नोभेम्बर",
  "डिसेम्बर",
];

const AD_DAYS_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AD_DAYS_SHORT_NP = ["आइत", "सोम", "मङ्गल", "बुध", "बिही", "शुक्र", "शनि"];

export interface NepaliDatePickerProps {
  value?: string; // Accepts ISO string, 'YYYY-MM-DDTHH:mm', 'YYYY-MM-DD', or BS date
  onChange: (adFormatted: string, bsFormatted: string) => void;
  showTime?: boolean; // When true, includes time picker (HH:mm) and emits YYYY-MM-DDTHH:mm
  label?: string | React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  sizeVariant?: "sm" | "md";
  required?: boolean;
  title?: string;
  calendarSystemOverride?: "BS" | "AD";
}

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value,
  onChange,
  showTime = false,
  label,
  placeholder,
  disabled = false,
  className = "",
  sizeVariant = "md",
  required = false,
  title,
  calendarSystemOverride,
}) => {
  const { isNepali } = useLanguage();

  // Listen to global calendar system changes
  const [activeCalSystem, setActiveCalSystem] = useState<"BS" | "AD">(() => {
    return calendarSystemOverride || getCalendarSystem();
  });

  useEffect(() => {
    if (calendarSystemOverride) {
      setActiveCalSystem(calendarSystemOverride);
      return;
    }
    const handler = (e: any) => {
      if (e?.detail === "BS" || e?.detail === "AD") {
        setActiveCalSystem(e.detail);
      } else {
        setActiveCalSystem(getCalendarSystem());
      }
    };
    window.addEventListener("stockforge:calendar-changed", handler);
    return () =>
      window.removeEventListener("stockforge:calendar-changed", handler);
  }, [calendarSystemOverride]);

  const isBs = activeCalSystem === "BS";

  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dynamic coordinates for portal rendering
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  // Helper pad function
  const pad = (n: number) => String(n).padStart(2, "0");

  // Parse incoming value into date & time parts
  const parsedState = useMemo(() => {
    let now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();

    let bsYear = 2083;
    let bsMonth = 6;
    let bsDay = 30;

    let adYear = now.getFullYear();
    let adMonth = now.getMonth() + 1;
    let adDay = now.getDate();

    if (value) {
      // Check for time component (T or space)
      if (value.includes("T")) {
        const parts = value.split("T");
        const tParts = (parts[1] || "").split(":");
        if (tParts.length >= 2) {
          const h = parseInt(tParts[0], 10);
          const m = parseInt(tParts[1], 10);
          if (!isNaN(h)) hours = h;
          if (!isNaN(m)) minutes = m;
        }
      } else if (value.includes(" ")) {
        const parts = value.split(" ");
        const timeStr = parts.slice(1).join(" ");
        const tMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
        if (tMatch) {
          let h = parseInt(tMatch[1], 10);
          const m = parseInt(tMatch[2], 10);
          const ampm = tMatch[3]?.toUpperCase();
          if (ampm === "PM" && h < 12) h += 12;
          if (ampm === "AM" && h === 12) h = 0;
          if (!isNaN(h)) hours = h;
          if (!isNaN(m)) minutes = m;
        }
      }

      // Check date part
      const datePart = value.split("T")[0].split(" ")[0].replace(/\//g, "-");
      const dParts = datePart.split("-").map((s) => parseInt(s, 10));

      if (dParts.length === 3 && !isNaN(dParts[0]) && !isNaN(dParts[1]) && !isNaN(dParts[2])) {
        if (dParts[0] >= 2060 && dParts[0] <= 2100) {
          // It's a BS date!
          bsYear = dParts[0];
          bsMonth = Math.max(1, Math.min(12, dParts[1]));
          const maxDays = getDaysInBsMonth(bsYear, bsMonth);
          bsDay = Math.max(1, Math.min(maxDays, dParts[2]));

          const adDate = bsToAd(bsYear, bsMonth, bsDay);
          adYear = adDate.getFullYear();
          adMonth = adDate.getMonth() + 1;
          adDay = adDate.getDate();
        } else {
          // Gregorian AD date
          const adDate = new Date(dParts[0], dParts[1] - 1, dParts[2]);
          if (!isNaN(adDate.getTime())) {
            adYear = adDate.getFullYear();
            adMonth = adDate.getMonth() + 1;
            adDay = adDate.getDate();

            const bs = adToBs(adDate);
            bsYear = bs.year;
            bsMonth = bs.month;
            bsDay = bs.day;
          }
        }
      }
    } else {
      const todayBs = getTodayBs();
      bsYear = todayBs.year;
      bsMonth = todayBs.month;
      bsDay = todayBs.day;
    }

    return {
      bsYear,
      bsMonth,
      bsDay,
      adYear,
      adMonth,
      adDay,
      hours,
      minutes,
    };
  }, [value]);

  // Calendar View State (Year & Month currently viewed)
  const [viewYear, setViewYear] = useState<number>(
    isBs ? parsedState.bsYear : parsedState.adYear,
  );
  const [viewMonth, setViewMonth] = useState<number>(
    isBs ? parsedState.bsMonth : parsedState.adMonth,
  );

  // Time state (12-hour format for intuitive editing)
  const [timeHour12, setTimeHour12] = useState<number>(() => {
    const h = parsedState.hours % 12;
    return h === 0 ? 12 : h;
  });
  const [timeMinute, setTimeMinute] = useState<number>(parsedState.minutes);
  const [timeAmPm, setTimeAmPm] = useState<"AM" | "PM">(() => {
    return parsedState.hours >= 12 ? "PM" : "AM";
  });

  // Manual typing input
  const [manualInput, setManualInput] = useState<string>("");
  const [manualError, setManualError] = useState<string>("");

  // Keep view in sync when value or calendar system changes
  useEffect(() => {
    if (isBs) {
      setViewYear(parsedState.bsYear);
      setViewMonth(parsedState.bsMonth);
    } else {
      setViewYear(parsedState.adYear);
      setViewMonth(parsedState.adMonth);
    }

    const h = parsedState.hours % 12;
    setTimeHour12(h === 0 ? 12 : h);
    setTimeMinute(parsedState.minutes);
    setTimeAmPm(parsedState.hours >= 12 ? "PM" : "AM");
  }, [parsedState, isBs]);

  // Calculate coordinates dynamically to prevent container overflow clipping
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverHeight = popoverRef.current
      ? popoverRef.current.offsetHeight
      : showTime
        ? 440
        : 380;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < popoverHeight + 8 && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - popoverHeight - 6 : rect.bottom + 6;
    if (top < 8) top = 8;
    if (top + popoverHeight > windowHeight - 8) {
      top = Math.max(8, windowHeight - popoverHeight - 8);
    }

    let left = rect.left;
    if (left + popoverWidth > windowWidth - 12) {
      left = Math.max(12, rect.right - popoverWidth);
    }
    if (left + popoverWidth > windowWidth - 12) {
      left = windowWidth - popoverWidth - 12;
    }
    if (left < 12) left = 12;

    setCoords({ top, left, openUp });
  }, [showTime]);

  // Handle open / toggle
  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close when clicking outside, pressing Escape, or window resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const rafId = requestAnimationFrame(() => {
      updatePosition();
    });

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Compute 24-hour representation from 12-hour state
  const get24Hours = (h12: number, ampm: "AM" | "PM") => {
    if (ampm === "PM") {
      return h12 === 12 ? 12 : h12 + 12;
    }
    return h12 === 12 ? 0 : h12;
  };

  // Emit change to parent
  const emitSelection = (
    y: number,
    m: number,
    d: number,
    h12: number,
    min: number,
    ampm: "AM" | "PM",
    cal: "BS" | "AD",
  ) => {
    const h24 = get24Hours(h12, ampm);
    const padMin = pad(min);
    const padH24 = pad(h24);
    const ampmStr = ampm;

    let finalAdIso = "";
    let finalBsStr = "";

    if (cal === "BS") {
      const adDate = bsToAd(y, m, d);
      const adYmd = `${adDate.getFullYear()}-${pad(adDate.getMonth() + 1)}-${pad(adDate.getDate())}`;
      const bsYmd = `${y}-${pad(m)}-${pad(d)}`;

      if (showTime) {
        finalAdIso = `${adYmd}T${padH24}:${padMin}`;
        finalBsStr = `${bsYmd} ${pad(h12)}:${padMin} ${ampmStr}`;
      } else {
        finalAdIso = adYmd;
        finalBsStr = bsYmd;
      }
    } else {
      const adYmd = `${y}-${pad(m)}-${pad(d)}`;
      const adDate = new Date(y, m - 1, d);
      const bsInfo = adToBs(adDate);
      const bsYmd = bsInfo.str;

      if (showTime) {
        finalAdIso = `${adYmd}T${padH24}:${padMin}`;
        finalBsStr = `${bsYmd} ${pad(h12)}:${padMin} ${ampmStr}`;
      } else {
        finalAdIso = adYmd;
        finalBsStr = bsYmd;
      }
    }

    onChange(finalAdIso, finalBsStr);
  };

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewYear((y) => Math.max(isBs ? 2070 : 2015, y - 1));
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewYear((y) => Math.min(isBs ? 2095 : 2035, y + 1));
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Day selection click
  const selectDay = (day: number) => {
    emitSelection(
      viewYear,
      viewMonth,
      day,
      timeHour12,
      timeMinute,
      timeAmPm,
      activeCalSystem,
    );
    if (!showTime) {
      setIsOpen(false);
    }
  };

  // Quick Action: Today
  const selectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBs) {
      const t = getTodayBs();
      setViewYear(t.year);
      setViewMonth(t.month);
      emitSelection(
        t.year,
        t.month,
        t.day,
        timeHour12,
        timeMinute,
        timeAmPm,
        "BS",
      );
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      setViewYear(y);
      setViewMonth(m);
      emitSelection(y, m, d, timeHour12, timeMinute, timeAmPm, "AD");
    }
    if (!showTime) setIsOpen(false);
  };

  // Quick Action: Yesterday
  const selectYesterday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (isBs) {
      const bs = adToBs(yest);
      setViewYear(bs.year);
      setViewMonth(bs.month);
      emitSelection(
        bs.year,
        bs.month,
        bs.day,
        timeHour12,
        timeMinute,
        timeAmPm,
        "BS",
      );
    } else {
      const y = yest.getFullYear();
      const m = yest.getMonth() + 1;
      const d = yest.getDate();
      setViewYear(y);
      setViewMonth(m);
      emitSelection(y, m, d, timeHour12, timeMinute, timeAmPm, "AD");
    }
    if (!showTime) setIsOpen(false);
  };

  // Quick Action: Now (current date AND current time)
  const selectNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    const h12 = curH % 12 === 0 ? 12 : curH % 12;
    const ampm: "AM" | "PM" = curH >= 12 ? "PM" : "AM";

    setTimeHour12(h12);
    setTimeMinute(curM);
    setTimeAmPm(ampm);

    if (isBs) {
      const t = getTodayBs();
      setViewYear(t.year);
      setViewMonth(t.month);
      emitSelection(t.year, t.month, t.day, h12, curM, ampm, "BS");
    } else {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      setViewYear(y);
      setViewMonth(m);
      emitSelection(y, m, d, h12, curM, ampm, "AD");
    }
    setIsOpen(false);
  };

  // Manual typed date submit
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setManualError("");
    const cleaned = manualInput.trim().replace(/\//g, "-");
    const parts = cleaned.split("-").map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      setManualError(
        isNepali
          ? "कृपया मान्य मिति प्रविष्ट गर्नुहोस् (उदा: २०८१-०७-०१)"
          : "Please enter a valid date (e.g. 2081-07-01)",
      );
      return;
    }

    const [y, m, d] = parts;
    if (isBs) {
      if (y < 2060 || y > 2100 || m < 1 || m > 12) {
        setManualError("अमान्य वि.सं. वर्ष वा महिना (२०६०-२१००)");
        return;
      }
      const maxDays = getDaysInBsMonth(y, m);
      if (d < 1 || d > maxDays) {
        setManualError(`यस महिनामा १ देखि ${maxDays} सम्म मात्र दिन छन्`);
        return;
      }
      setViewYear(y);
      setViewMonth(m);
      emitSelection(y, m, d, timeHour12, timeMinute, timeAmPm, "BS");
      setManualInput("");
      if (!showTime) setIsOpen(false);
    } else {
      if (y < 2000 || y > 2050 || m < 1 || m > 12) {
        setManualError("Invalid AD year or month");
        return;
      }
      const maxDays = new Date(y, m, 0).getDate();
      if (d < 1 || d > maxDays) {
        setManualError(`This month only has 1 to ${maxDays} days`);
        return;
      }
      setViewYear(y);
      setViewMonth(m);
      emitSelection(y, m, d, timeHour12, timeMinute, timeAmPm, "AD");
      setManualInput("");
      if (!showTime) setIsOpen(false);
    }
  };

  // Toggle calendar system directly from picker
  const toggleCalSystem = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCal = isBs ? "AD" : "BS";
    setActiveCalSystem(nextCal);
    if (!calendarSystemOverride) {
      setCalendarSystem(nextCal);
    }
  };

  // Calendar calculations
  let startDayOfWeek = 0;
  let totalDays = 30;

  if (isBs) {
    const firstDayAd = bsToAd(viewYear, viewMonth, 1);
    startDayOfWeek = firstDayAd.getDay(); // 0: Sun, 6: Sat
    totalDays = getDaysInBsMonth(viewYear, viewMonth);
  } else {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    startDayOfWeek = firstDay.getDay();
    totalDays = new Date(viewYear, viewMonth, 0).getDate();
  }

  // Display label on the input trigger button
  const displayValue = useMemo(() => {
    if (!value && !placeholder) {
      return isNepali ? "मिति छान्नुहोस्" : "Select Date";
    }
    if (!value) return placeholder || "";

    const padH = pad(timeHour12);
    const padM = pad(timeMinute);
    const timeDisplay = `${padH}:${padM} ${timeAmPm}`;

    if (isBs) {
      const monthLabel = isNepali
        ? BS_MONTHS_NP[parsedState.bsMonth - 1]
        : BS_MONTHS_EN[parsedState.bsMonth - 1];
      const dayLabel = isNepali
        ? toNepaliDigits(parsedState.bsDay)
        : parsedState.bsDay;

      const dateStr = `${parsedState.bsYear}-${pad(parsedState.bsMonth)}-${pad(parsedState.bsDay)}`;
      if (showTime) {
        return isNepali
          ? `${toNepaliDigits(parsedState.bsYear)}/${toNepaliDigits(pad(parsedState.bsMonth))}/${dayLabel} ${toNepaliDigits(padH)}:${toNepaliDigits(padM)} ${timeAmPm}`
          : `${dateStr} ${timeDisplay}`;
      }
      return `${dateStr} (${monthLabel} ${dayLabel})`;
    } else {
      const dateStr = `${parsedState.adYear}-${pad(parsedState.adMonth)}-${pad(parsedState.adDay)}`;
      const monthLabel = AD_MONTHS_EN[parsedState.adMonth - 1]?.slice(0, 3);
      if (showTime) {
        return `${dateStr} ${timeDisplay}`;
      }
      return `${dateStr} (${monthLabel} ${parsedState.adDay})`;
    }
  }, [value, placeholder, isBs, parsedState, showTime, timeHour12, timeMinute, timeAmPm, isNepali]);

  // Year options list
  const yearOptions: number[] = useMemo(() => {
    const list: number[] = [];
    if (isBs) {
      for (let y = 2070; y <= 2095; y++) list.push(y);
    } else {
      for (let y = 2018; y <= 2035; y++) list.push(y);
    }
    return list;
  }, [isBs]);

  // Portal Popover Content
  const popoverMenu = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999,
      }}
      className="w-80 max-w-[calc(100vw-24px)] bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-3 text-neutral-100 animate-in fade-in zoom-in-95 duration-100 select-none backdrop-blur-md"
    >
      {/* Header Bar: System Badge & Switcher */}
      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
              isBs
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-blue-500/15 text-blue-300 border-blue-500/30"
            }`}
          >
            {isBs
              ? isNepali
                ? "विक्रम संवत् (वि.सं.)"
                : "Bikram Sambat (B.S.)"
              : "Gregorian (A.D.)"}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleCalSystem}
          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
          title={
            isBs
              ? "Switch to English Gregorian (A.D.)"
              : "Switch to Bikram Sambat (B.S.)"
          }
        >
          <ArrowRightLeft className="w-3 h-3 text-neutral-400" />
          <span>{isBs ? "Switch to AD" : "वि.सं. मा बदल्नुहोस्"}</span>
        </button>
      </div>

      {/* Month & Year Selectors with Navigation */}
      <div className="flex items-center justify-between gap-1 mb-2.5">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Month Dropdown */}
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="bg-neutral-800 text-xs text-neutral-200 rounded px-2 py-1 border border-neutral-700 focus:outline-none font-semibold cursor-pointer"
          >
            {isBs
              ? BS_MONTHS_EN.map((mEn, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {isNepali
                      ? BS_MONTHS_NP[idx]
                      : `${mEn} (${BS_MONTHS_NP[idx]})`}
                  </option>
                ))
              : AD_MONTHS_EN.map((mEn, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {isNepali ? AD_MONTHS_NP[idx] : mEn}
                  </option>
                ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="bg-neutral-800 text-xs text-neutral-200 rounded px-2 py-1 border border-neutral-700 focus:outline-none font-semibold cursor-pointer"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {isNepali && isBs ? toNepaliDigits(y) : y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {(isBs ? BS_DAYS_SHORT_NP : isNepali ? AD_DAYS_SHORT_NP : AD_DAYS_SHORT_EN).map(
          (dayName, idx) => {
            const isHoliday = isBs ? idx === 6 : idx === 0;
            return (
              <div
                key={idx}
                className={`text-[11px] font-semibold py-0.5 ${
                  isHoliday ? "text-rose-400 font-bold" : "text-neutral-400"
                }`}
              >
                {dayName}
              </div>
            );
          },
        )}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Empty slots for month start offset */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7 w-7" />
        ))}

        {/* Month Days */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const isSelected = isBs
            ? parsedState.bsYear === viewYear &&
              parsedState.bsMonth === viewMonth &&
              parsedState.bsDay === day
            : parsedState.adYear === viewYear &&
              parsedState.adMonth === viewMonth &&
              parsedState.adDay === day;

          const todayInfo = isBs ? getTodayBs() : null;
          const nowAd = new Date();
          const isToday = isBs
            ? todayInfo?.year === viewYear &&
              todayInfo?.month === viewMonth &&
              todayInfo?.day === day
            : nowAd.getFullYear() === viewYear &&
              nowAd.getMonth() + 1 === viewMonth &&
              nowAd.getDate() === day;

          const dayOfWeek = (startDayOfWeek + day - 1) % 7;
          const isHoliday = isBs ? dayOfWeek === 6 : dayOfWeek === 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => selectDay(day)}
              className={`h-7 w-7 mx-auto flex items-center justify-center rounded-md text-xs font-mono transition-all cursor-pointer ${
                isSelected
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : isToday
                    ? "border border-emerald-500/70 text-emerald-400 font-bold hover:bg-emerald-500/10"
                    : isHoliday
                      ? "text-rose-400 hover:bg-neutral-800"
                      : "text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {isNepali && isBs ? toNepaliDigits(day) : day}
            </button>
          );
        })}
      </div>

      {/* Time Picker Row (when showTime is enabled) */}
      {showTime && (
        <div className="mt-2.5 pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-xs text-neutral-400">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{isNepali ? "समय:" : "Time:"}</span>
          </div>

          <div className="flex items-center gap-1 font-mono text-xs">
            {/* Hours 01-12 */}
            <select
              value={timeHour12}
              onChange={(e) => {
                const newH = Number(e.target.value);
                setTimeHour12(newH);
                emitSelection(
                  viewYear,
                  viewMonth,
                  isBs ? parsedState.bsDay : parsedState.adDay,
                  newH,
                  timeMinute,
                  timeAmPm,
                  activeCalSystem,
                );
              }}
              className="bg-neutral-800 text-xs text-neutral-200 rounded px-1.5 py-0.5 border border-neutral-700 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>

            <span className="text-neutral-500">:</span>

            {/* Minutes 00-59 */}
            <select
              value={timeMinute}
              onChange={(e) => {
                const newM = Number(e.target.value);
                setTimeMinute(newM);
                emitSelection(
                  viewYear,
                  viewMonth,
                  isBs ? parsedState.bsDay : parsedState.adDay,
                  timeHour12,
                  newM,
                  timeAmPm,
                  activeCalSystem,
                );
              }}
              className="bg-neutral-800 text-xs text-neutral-200 rounded px-1.5 py-0.5 border border-neutral-700 focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>

            {/* AM / PM Toggle */}
            <div className="flex items-center bg-neutral-800 rounded p-0.5 border border-neutral-700 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTimeAmPm("AM");
                  emitSelection(
                    viewYear,
                    viewMonth,
                    isBs ? parsedState.bsDay : parsedState.adDay,
                    timeHour12,
                    timeMinute,
                    "AM",
                    activeCalSystem,
                  );
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  timeAmPm === "AM"
                    ? "bg-emerald-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeAmPm("PM");
                  emitSelection(
                    viewYear,
                    viewMonth,
                    isBs ? parsedState.bsDay : parsedState.adDay,
                    timeHour12,
                    timeMinute,
                    "PM",
                    activeCalSystem,
                  );
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  timeAmPm === "PM"
                    ? "bg-emerald-600 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                PM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Manual Date Input (for fast keyboard typing) */}
      <div className="mt-2 pt-2 border-t border-neutral-800">
        <form
          onSubmit={handleManualSubmit}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            placeholder={
              isBs
                ? isNepali
                  ? "२०८१-०७-०१ टाइप गर्नुहोस्"
                  : "Type YYYY-MM-DD (BS)"
                : "Type YYYY-MM-DD (AD)"
            }
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              setManualError("");
            }}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded font-medium cursor-pointer transition-colors shrink-0"
          >
            {isNepali ? "सेट" : "Set"}
          </button>
        </form>
        {manualError && (
          <div className="text-[10px] text-rose-400 mt-1">{manualError}</div>
        )}
      </div>

      {/* Quick Preset Buttons & Close */}
      <div className="mt-2.5 pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={selectToday}
            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors text-[11px] cursor-pointer"
          >
            {isNepali ? "आज" : "Today"}
          </button>
          <button
            type="button"
            onClick={selectYesterday}
            className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors text-[11px] cursor-pointer"
          >
            {isNepali ? "हिजो" : "Yesterday"}
          </button>
          {showTime && (
            <button
              type="button"
              onClick={selectNow}
              className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 font-medium transition-colors text-[11px] cursor-pointer"
            >
              {isNepali ? "अहिले (Now)" : "Now"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-neutral-400 hover:text-neutral-100 text-xs px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          {isNepali ? "बन्द" : "Done"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`relative inline-block w-full text-left ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-neutral-300 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        title={title}
        disabled={disabled}
        onClick={handleToggleOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 transition-colors cursor-pointer hover:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          sizeVariant === "sm" ? "py-1.5 text-xs" : "py-2 text-sm"
        }`}
      >
        <span
          className={`truncate font-mono ${!value ? "text-neutral-500 italic" : "font-medium"}`}
        >
          {displayValue}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
              isBs
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}
          >
            {isBs ? (isNepali ? "वि.सं." : "BS") : "AD"}
          </span>
          {showTime ? (
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
          ) : (
            <CalendarIcon className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </div>
      </button>

      {/* Render Popover into document.body via Portal to escape all overflow containers */}
      {isOpen && typeof document !== "undefined" && createPortal(popoverMenu, document.body)}
    </div>
  );
};
