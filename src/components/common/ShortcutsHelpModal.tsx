/**
 * ShortcutsHelpModal Component
 * Visual cheat sheet for all global keyboard shortcuts across StockForge
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Navigation, ShoppingCart, Sparkles, CornerDownLeft } from 'lucide-react';
import { SHORTCUT_REGISTRY, MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  const { isNepali, t } = useLanguage();
  const categories: Array<{
    name: 'Navigation' | 'Point of Sale' | 'General & Quick Actions';
    label: string;
    icon: React.ElementType;
    badgeColor: string;
  }> = [
    {
      name: 'Navigation',
      label: isNepali ? 'नेभिगेसन स्क्रिनहरू' : 'Navigation',
      icon: Navigation,
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
    {
      name: 'Point of Sale',
      label: isNepali ? 'बिक्री काउन्टर (POS)' : 'Point of Sale',
      icon: ShoppingCart,
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      name: 'General & Quick Actions',
      label: isNepali ? 'सामान्य र द्रुत कार्यहरू' : 'General & Quick Actions',
      icon: Sparkles,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="shortcuts-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="shortcuts-panel"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 380, mass: 0.6 }}
            className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                    <span>{t('shortcuts_modal_title', 'Global Keyboard Shortcuts')}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      Power User
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400">
                    {t('shortcuts_modal_subtitle', 'Navigate quickly across StockForge without taking your hands off the keyboard')}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-200 p-2 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                aria-label="Close shortcuts guide"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

        {/* Shortcuts list grouped by category */}
        <div className="p-6 overflow-y-auto space-y-6">
          {categories.map((cat) => {
            const items = SHORTCUT_REGISTRY.filter((s) => s.category === cat.name);
            if (items.length === 0) return null;
            const Icon = cat.icon;

            return (
              <div key={cat.name} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                  <div className={`p-1 rounded-md border ${cat.badgeColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span>{cat.label}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 hover:border-neutral-700/80 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-semibold text-neutral-200 truncate">
                          {shortcut.label}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">
                          {shortcut.description}
                        </div>
                      </div>

                      <kbd className="shrink-0 px-2 py-1 bg-neutral-800/90 text-neutral-200 font-mono text-xs font-semibold rounded-md border border-neutral-700/80 shadow-xs">
                        {shortcut.displayKeys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Quick tips callout */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-neutral-300 flex items-start gap-3">
            <CornerDownLeft className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-emerald-400">Pro Tip: </span>
              <span className="text-neutral-300">
                Press <kbd className="font-mono px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[11px] text-neutral-200">{MODIFIER_LABEL}+K</kbd> anywhere to open the Command Palette, or <kbd className="font-mono px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[11px] text-neutral-200">{MODIFIER_LABEL}+N</kbd> to immediately ring up a sale.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-xs text-neutral-500">
          <span>
            {isNepali ? (
              <>
                कुनै पनि बेला संवाद बन्द गर्न <kbd className="font-mono px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[10px]">Esc</kbd> थिच्नुहोस्
              </>
            ) : (
              <>
                Press <kbd className="font-mono px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[10px]">Esc</kbd> anytime to dismiss dialogs
              </>
            )}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            {isNepali ? 'बुझें' : 'Got it'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
