/**
 * Shared Table ActionMenu Component
 * Provides a standardized, accessible, and theme-aware action menu for table rows across the app.
 * Uses React Portal to avoid table overflow clipping.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal } from "lucide-react";

export type ActionMenuColor =
  | "default"
  | "primary"
  | "emerald"
  | "amber"
  | "warning"
  | "rose"
  | "danger"
  | "sky"
  | "indigo"
  | "violet";

export interface ActionMenuItem {
  id?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  color?: ActionMenuColor;
  action?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  isDestructive?: boolean;
  variant?: "danger" | "warning" | "primary" | string;
  description?: string;
  badge?: string | number;
  divider?: boolean;
}

export interface ActionMenuProps {
  items: (ActionMenuItem | false | null | undefined)[];
  align?: "left" | "right";
  triggerIcon?: React.ComponentType<{ className?: string }>;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerTitle?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

const colorStyles: Record<
  ActionMenuColor,
  { text: string; icon: string; hover: string }
> = {
  default: {
    text: "text-neutral-200",
    icon: "text-neutral-400 group-hover:text-neutral-200",
    hover: "hover:bg-neutral-800/80",
  },
  primary: {
    text: "text-emerald-400 font-medium",
    icon: "text-emerald-400",
    hover: "hover:bg-emerald-500/10 hover:text-emerald-300",
  },
  emerald: {
    text: "text-emerald-400 font-medium",
    icon: "text-emerald-400",
    hover: "hover:bg-emerald-500/10 hover:text-emerald-300",
  },
  amber: {
    text: "text-amber-400 font-medium",
    icon: "text-amber-400",
    hover: "hover:bg-amber-500/10 hover:text-amber-300",
  },
  warning: {
    text: "text-amber-400 font-medium",
    icon: "text-amber-400",
    hover: "hover:bg-amber-500/10 hover:text-amber-300",
  },
  rose: {
    text: "text-rose-400 font-medium",
    icon: "text-rose-400",
    hover: "hover:bg-rose-500/10 hover:text-rose-300",
  },
  danger: {
    text: "text-rose-400 font-medium",
    icon: "text-rose-400",
    hover: "hover:bg-rose-500/10 hover:text-rose-300",
  },
  sky: {
    text: "text-sky-400 font-medium",
    icon: "text-sky-400",
    hover: "hover:bg-sky-500/10 hover:text-sky-300",
  },
  indigo: {
    text: "text-indigo-400 font-medium",
    icon: "text-indigo-400",
    hover: "hover:bg-indigo-500/10 hover:text-indigo-300",
  },
  violet: {
    text: "text-violet-400 font-medium",
    icon: "text-violet-400",
    hover: "hover:bg-violet-500/10 hover:text-violet-300",
  },
};

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  align = "right",
  triggerIcon: TriggerIcon = MoreHorizontal,
  triggerLabel,
  triggerClassName,
  triggerTitle = "Actions",
  size = "sm",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const validItems = items.filter(Boolean) as ActionMenuItem[];

  // Calculate coordinates dynamically to prevent table overflow clipping
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 190;
    const menuEstimatedHeight = validItems.length * 36 + 16;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const openUp =
      rect.bottom + menuEstimatedHeight > windowHeight &&
      rect.top > menuEstimatedHeight;
    let left = align === "right" ? rect.right - menuWidth : rect.left;

    // Viewport clamping
    if (left + menuWidth > windowWidth - 12) {
      left = windowWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    const top = openUp ? rect.top - 4 : rect.bottom + 4;

    setCoords({ top, left, openUp });
  }, [align, validItems.length]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || validItems.length === 0) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside or scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
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
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen]);

  if (validItems.length === 0) return null;

  return (
    <>
      <motion.button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        title={triggerTitle}
        aria-label={triggerTitle}
        aria-expanded={isOpen}
        className={
          triggerClassName ||
          `p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            isOpen
              ? "bg-neutral-800 text-neutral-100 border-neutral-700 shadow-xs"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 border-transparent hover:border-neutral-700/60"
          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`
        }
      >
        <TriggerIcon className={size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5"} />
        {triggerLabel && (
          <span className="text-xs font-medium pr-0.5">{triggerLabel}</span>
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.94, y: coords.openUp ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: coords.openUp ? 6 : -6 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 450,
                mass: 0.5,
              }}
              style={{
                position: "fixed",
                top: coords.openUp ? undefined : `${coords.top}px`,
                bottom: coords.openUp
                  ? `${window.innerHeight - coords.top}px`
                  : undefined,
                left: `${coords.left}px`,
                width: "190px",
                zIndex: 9999,
              }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-1.5 select-none text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col space-y-0.5">
                {validItems.map((item, index) => {
                  const ItemIcon = item.icon;
                  const isDanger =
                    item.isDestructive ||
                    item.variant === "danger" ||
                    item.variant === "destructive" ||
                    item.color === "danger" ||
                    item.color === "rose";

                  const effectiveColor: ActionMenuColor = isDanger
                    ? "rose"
                    : item.color || "default";
                  const style =
                    colorStyles[effectiveColor] || colorStyles.default;

                  const handleClick = () => {
                    setIsOpen(false);
                    if (item.action) item.action();
                    else if (item.onClick) item.onClick();
                  };

                  return (
                    <React.Fragment key={item.id || `${item.label}-${index}`}>
                      {item.divider && (
                        <div className="my-1 border-t border-neutral-800" />
                      )}
                      <motion.button
                        type="button"
                        disabled={item.disabled}
                        whileHover={item.disabled ? undefined : { x: 2 }}
                        whileTap={item.disabled ? undefined : { scale: 0.98 }}
                        onClick={handleClick}
                        className={`group w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer ${
                          item.disabled
                            ? "opacity-40 cursor-not-allowed"
                            : `${style.text} ${style.hover}`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {ItemIcon &&
                            (React.isValidElement(ItemIcon) ? (
                              <span className="shrink-0">{ItemIcon}</span>
                            ) : typeof ItemIcon === "function" ||
                              (typeof ItemIcon === "object" &&
                                ItemIcon !== null) ? (
                              (() => {
                                const IconComponent =
                                  ItemIcon as React.ComponentType<{
                                    className?: string;
                                  }>;
                                return (
                                  <IconComponent
                                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                      item.disabled
                                        ? "text-neutral-500"
                                        : style.icon
                                    }`}
                                  />
                                );
                              })()
                            ) : null)}
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                            {item.badge}
                          </span>
                        )}
                      </motion.button>
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
