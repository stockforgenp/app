import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import stockforgeLogo from "@/src-tauri/icons/icon.png";
import {
  ShieldCheck,
  PanelLeftOpen,
  PanelLeftClose,
  Store,
  LogOut,
  Clock,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { getSubscriptionDaysRemaining } from "../../lib/services/authService.ts";
import {
  getNavGroups,
  NavTab,
  NavItem,
  NavGroup,
} from "../../constants/index.ts";

export type { NavTab, NavItem, NavGroup };

interface SidebarProps {
  onSelectTab: (tab: NavTab) => void;
  lowStockCount: number;
  toggleSidebar: boolean;
  setToggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectTab,
  lowStockCount,
  toggleSidebar,
  setToggleSidebar,
}) => {
  const location = useLocation();
  const activeTab =
    location.pathname.replace(/^\//, "").split("/")[0] || "dashboard";
  const { t, isNepali } = useLanguage();
  const { currentShop, logout } = useAuth();

  const daysRemaining = useMemo(
    () => getSubscriptionDaysRemaining(currentShop),
    [currentShop],
  );

  const navGroups = useMemo(
    () => getNavGroups(t, lowStockCount, isNepali),
    [t, lowStockCount, isNepali],
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: toggleSidebar ? 256 : 64 }}
      transition={{ type: "spring", damping: 26, stiffness: 350, mass: 0.6 }}
      className="bg-neutral-950 border-r border-neutral-800/80 flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Brand Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-neutral-800/80 shrink-0">
        <Link
          to="/dashboard"
          onClick={() => onSelectTab("dashboard")}
          className="flex items-center gap-3 min-w-0 group cursor-pointer"
          title="StockForge Dashboard"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-1 flex items-center justify-center shrink-0 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/15 transition-all">
            <img
              src={stockforgeLogo}
              alt="StockForge Logo"
              className="w-full h-full object-contain"
            />
          </div>
          {toggleSidebar && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              className="min-w-0 flex-1"
            >
              <div className="text-sm font-bold tracking-tight text-neutral-100 group-hover:text-emerald-400 transition-colors truncate">
                StockForge
              </div>
              <div className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                <span className="truncate">{t("app_subtitle")}</span>
              </div>
            </motion.div>
          )}
        </Link>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={setToggleSidebar}
          className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800/60 transition-colors cursor-pointer"
          title={toggleSidebar ? "Collapse sidebar" : "Expand sidebar"}
        >
          {toggleSidebar ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </motion.button>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, groupIdx) => (
          <div key={group.id} className="space-y-0.5">
            {toggleSidebar ? (
              <div className="pt-2 pb-1 px-3 first:pt-0 select-none">
                <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 font-mono">
                  {group.title}
                </span>
              </div>
            ) : (
              groupIdx > 0 && (
                <div className="my-2 border-t border-neutral-800/80" />
              )
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  to={`/${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  title={
                    !toggleSidebar
                      ? `${item.label} (${item.shortcut})`
                      : undefined
                  }
                  className={`group relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer select-none ${
                    isActive
                      ? "text-neutral-100 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavHighlight"
                      className="absolute inset-0 bg-neutral-800 rounded-lg shadow-xs"
                      transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 380,
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-emerald-400"
                          : "text-neutral-500 group-hover:text-neutral-300"
                      }`}
                    />
                    {toggleSidebar && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </div>
                  {toggleSidebar && (
                    <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                      {item.badge !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                          {item.badge}
                        </span>
                      )}
                      <kbd
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-opacity ${
                          isActive
                            ? "bg-neutral-00/80 text-neutral-300 border-neutral-700/80"
                            : "bg-neutral-900 text-neutral-500 border-neutral-800 opacity-60 group-hover:opacity-100"
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Shop Account & Subscription Expiry Countdown */}
      {currentShop && (
        <div className="px-3 py-2 border-t border-neutral-800/80 bg-neutral-950/90 shrink-0 space-y-2">
          {/* Shop identity pill */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-neutral-900 border border-neutral-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              {toggleSidebar && (
                <div className="min-w-0 flex-1 leading-tight text-left">
                  <span className="text-[11px] font-bold text-neutral-200 block truncate">
                    {currentShop.name}
                  </span>
                  <span className="text-[9px] text-neutral-400 block truncate font-mono">
                    {currentShop.email}
                  </span>
                </div>
              )}
            </div>
            {toggleSidebar && (
              <button
                type="button"
                onClick={logout}
                className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors cursor-pointer shrink-0"
                title={
                  isNepali
                    ? "पसल खाताबाट बाहिरिनुहोस् (Logout)"
                    : "Log out of shop"
                }
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subscription Expiry Countdown Badge & Progress */}
          <Link
            to="/support"
            onClick={() => onSelectTab("support" as NavTab)}
            className={`block rounded-lg p-2 border transition-all cursor-pointer group ${
              daysRemaining <= 7
                ? "bg-rose-500/25 border-rose-500/40 hover:bg-rose-500/40 hover:border-rose-500/60"
                : daysRemaining <= 30
                  ? "bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/30 hover:border-amber-500/50"
                  : "bg-neutral-900/80 border-neutral-800/70 hover:bg-neutral-900 hover:border-neutral-700"
            }`}
            title={
              isNepali
                ? `योजना: ${currentShop.subscription_plan || "Standard"} (${daysRemaining} दिन बाँकी, म्याद: ${currentShop.subscription_expiry_date || "N/A"})`
                : `Subscription: ${currentShop.subscription_plan || "Standard"} (${daysRemaining} days remaining, expires: ${currentShop.subscription_expiry_date || "N/A"})`
            }
          >
            {toggleSidebar ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-neutral-300 flex items-center gap-1.5 truncate">
                    <Clock
                      className={`w-3.5 h-3.5 shrink-0 ${
                        daysRemaining <= 7
                          ? "text-rose-400 animate-pulse"
                          : daysRemaining <= 30
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    />
                    <span className="truncate uppercase">
                      {currentShop.subscription_plan || "Standard"}
                    </span>
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] shrink-0 ${
                      daysRemaining <= 7
                        ? "bg-rose-300/20 text-rose-300 border border-rose-500/30"
                        : daysRemaining <= 30
                          ? "bg-amber-300/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-300/15 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {daysRemaining <= 0
                      ? isNepali
                        ? "समाप्त"
                        : "Expired"
                      : isNepali
                        ? `${daysRemaining} दिन बाँकी`
                        : `${daysRemaining}d left`}
                  </span>
                </div>

                {/* Progress bar towards expiry */}
                <div className="w-full bg-neutral-950 rounded-full h-1 overflow-hidden border border-neutral-800/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      daysRemaining <= 7
                        ? "bg-rose-500"
                        : daysRemaining <= 30
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          4,
                          (daysRemaining /
                            (currentShop.subscription_duration_days || 365)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-0.5">
                <Clock
                  className={`w-3.5 h-3.5 ${
                    daysRemaining <= 7
                      ? "text-rose-400 animate-pulse"
                      : daysRemaining <= 30
                        ? "text-amber-400"
                        : "text-emerald-400"
                  }`}
                />
                <span
                  className={`text-[8px] font-mono font-bold mt-0.5 leading-none ${
                    daysRemaining <= 7
                      ? "text-rose-400"
                      : daysRemaining <= 30
                        ? "text-amber-400"
                        : "text-emerald-400"
                  }`}
                >
                  {daysRemaining}d
                </span>
              </div>
            )}
          </Link>
        </div>
      )}

      {/* Bottom Integrity Indicator */}
      {toggleSidebar && (
        <div className="p-4 border-t border-neutral-800/80 text-[11px] text-neutral-500 bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-2 text-neutral-400 font-medium mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t("acid_safe")}</span>
          </div>
          <div className="text-[10px] text-neutral-500 leading-tight">
            {t("acid_desc")}
          </div>
        </div>
      )}
    </motion.aside>
  );
};
