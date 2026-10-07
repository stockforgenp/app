/**
 * Top Application Header
 * Follows the 3-zone contract: Breadcrumb trail on left, status & actions on right.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusCircle, ShoppingCart, Search, Keyboard, Sun, Moon, Languages } from 'lucide-react';
import { MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface HeaderProps {
  onNewSaleClick: () => void;
  onNewProductClick: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  currencySymbol?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNewSaleClick,
  onNewProductClick,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
}) => {
  const location = useLocation();
  const currentTab = location.pathname.replace(/^\//, '').split('/')[0];
  const { toggleTheme, isDark } = useTheme();
  const { t, toggleLanguage, isNepali } = useLanguage();

  return (
    <header className="h-14 px-6 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
      {/* Zone 1: Quick Search / Command Palette */}
      <div className="flex items-center gap-4 min-w-0">
        {onOpenCommandPalette && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg transition-colors cursor-pointer"
            title={`Open Command Palette (${MODIFIER_LABEL}+K)`}
          >
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] text-neutral-400">
              {isNepali ? 'खोज्नुहोस् वा जानुहोस्...' : 'Search or jump to...'}
            </span>
            <kbd className="inline-flex items-center text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.2 rounded border border-neutral-700/60">
              {MODIFIER_LABEL}+K
            </kbd>
          </motion.button>
        )}
      </div>

      {/* Zone 3: Quick Actions, Command Palette & Currency Badge */}
      <div className="flex items-center justify-between gap-2">
        {/* Language Toggle Button (EN <-> NP) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-950/80 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/70 hover:border-emerald-500/50 cursor-pointer shadow-xs"
          title={isNepali ? 'Switch to English (Alt+L)' : 'नेपाली भाषामा बदल्नुहोस् (Alt+L)'}
          aria-label="Toggle Language"
        >
          <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-400 font-mono">
            {isNepali ? 'नेपाली' : 'EN'}
          </span>
          <kbd className="hidden md:inline-flex text-[9px] font-mono text-neutral-500 bg-neutral-900 px-1 py-0.2 rounded border border-neutral-800">
            Alt+L
          </kbd>
        </motion.button>

        {/* Theme Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/60 hover:border-neutral-700 cursor-pointer"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-[11px] font-medium text-neutral-300">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-neutral-500" />
              <span className="hidden sm:inline text-[11px] font-medium text-neutral-400">Dark</span>
            </>
          )}
        </motion.button>

        {/* Shortcuts Guide Button */}
        {onOpenShortcutsHelp && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenShortcutsHelp}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/60 hover:border-neutral-700 cursor-pointer"
            title="Keyboard Shortcuts Cheatsheet (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </motion.button>
        )}

        {/* New Sale Button with Ctrl+N hint */}
        {currentTab !== 'sales' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewSaleClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            title={`Ring up New Sale (${MODIFIER_LABEL}+N)`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{t('nav_sales')}</span>
            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-emerald-700/80 text-emerald-100 px-1 py-0.2 rounded">
              {MODIFIER_LABEL}+N
            </kbd>
          </motion.button>
        )}

        {/* Add Product Button with Ctrl+Shift+P hint */}
        {currentTab === 'inventory' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewProductClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title={`Add New Product (${MODIFIER_LABEL}+Shift+P)`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('prod_add_button')}</span>
            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-neutral-900 text-neutral-400 px-1 py-0.2 rounded border border-neutral-700/60">
              {MODIFIER_LABEL}+⇧+P
            </kbd>
          </motion.button>
        )}
      </div>
    </header>
  );
};
