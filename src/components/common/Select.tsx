import React, { useState, useRef, useEffect, useMemo, ReactNode } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: ReactNode;
  searchLabel?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }> | ReactNode;
}

export interface SelectChangeEvent<T = string | number> {
  target: {
    value: T;
    name?: string;
  };
  currentTarget: {
    value: T;
    name?: string;
  };
  value: T;
}

export interface SelectProps {
  value?: string | number | null | undefined;
  onChange?: (event: SelectChangeEvent<any>) => void;
  options?: (SelectOption | string | number)[];
  children?: ReactNode;
  placeholder?: string;
  label?: ReactNode;
  icon?: React.ComponentType<{ className?: string }> | ReactNode;
  error?: string | ReactNode;
  helperText?: string | ReactNode;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  containerClassName?: string;
  sizeVariant?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  onClear?: () => void;
}

const renderIcon = (
  icon: React.ComponentType<{ className?: string }> | ReactNode,
  extraClass: string
) => {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    const el = icon as React.ReactElement<{ className?: string }>;
    return React.cloneElement(el, {
      className: `${el.props?.className || ''} ${extraClass}`.trim(),
    });
  }
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className={extraClass} />;
  }
  return null;
};

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options: optionsProp,
  children,
  placeholder = 'Select option...',
  label,
  icon,
  error,
  helperText,
  disabled = false,
  required = false,
  name,
  id,
  className = '',
  containerClassName = '',
  sizeVariant = 'md',
  searchable = true,
  searchPlaceholder = 'Search options...',
  clearable = false,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Parse options from either `options` prop or `children` (<option>)
  const parsedOptions: SelectOption[] = useMemo(() => {
    if (optionsProp && optionsProp.length > 0) {
      return optionsProp.map((opt) => {
        if (typeof opt === 'string' || typeof opt === 'number') {
          return {
            value: opt,
            label: String(opt),
            searchLabel: String(opt),
          };
        }
        return {
          ...opt,
          searchLabel:
            opt.searchLabel || (typeof opt.label === 'string' ? opt.label : String(opt.value)),
        };
      });
    }

    if (children) {
      const extracted: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          const props = child.props as any;
          if (props && props.value !== undefined) {
            extracted.push({
              value: props.value,
              label: props.children ?? String(props.value),
              searchLabel: typeof props.children === 'string' ? props.children : String(props.value),
              disabled: props.disabled,
            });
          }
        }
      });
      return extracted;
    }

    return [];
  }, [optionsProp, children]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === null || value === undefined) return null;
    return (
      parsedOptions.find(
        (opt) => String(opt.value) === String(value)
      ) || null
    );
  }, [parsedOptions, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return parsedOptions;
    const query = searchQuery.toLowerCase().trim();
    return parsedOptions.filter((opt) => {
      const searchTarget = (
        (opt.searchLabel || '') +
        ' ' +
        (typeof opt.label === 'string' ? opt.label : '') +
        ' ' +
        opt.value
      ).toLowerCase();
      return searchTarget.includes(query);
    });
  }, [parsedOptions, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled || disabled) return;

    if (onChange) {
      const syntheticEvent: SelectChangeEvent<any> = {
        target: { value: opt.value, name },
        currentTarget: { value: opt.value, name },
        value: opt.value,
      };
      onChange(syntheticEvent);
    }

    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      const syntheticEvent: SelectChangeEvent<any> = {
        target: { value: '', name },
        currentTarget: { value: '', name },
        value: '',
      };
      onChange(syntheticEvent);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-xs',
    lg: 'px-3.5 py-2.5 text-sm',
  };

  const hasLeftIcon = Boolean(icon);

  return (
    <div ref={containerRef} className={`relative w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center gap-1.5"
        >
          {label}
          {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-neutral-950 border rounded-lg text-neutral-100 transition-colors flex items-center justify-between text-left focus:outline-none focus:ring-1 cursor-pointer ${
          error
            ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
            : isOpen
            ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
            : 'border-neutral-800 hover:border-neutral-700 focus:border-emerald-500 focus:ring-emerald-500/20'
        } ${sizeClasses[sizeVariant]} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-neutral-900' : ''
        } ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasLeftIcon && (
            <span className="shrink-0 flex items-center text-neutral-400">
              {renderIcon(icon, 'w-4 h-4 text-current shrink-0')}
            </span>
          )}

          {selectedOption ? (
            <div className="truncate flex items-center gap-1.5 text-neutral-100 font-medium">
              {selectedOption.icon && (
                <span className="shrink-0 flex items-center text-neutral-400">
                  {renderIcon(selectedOption.icon, 'w-3.5 h-3.5 text-current shrink-0')}
                </span>
              )}
              <span className="truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-neutral-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2 text-neutral-400">
          {clearable && selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-neutral-100 rounded transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5 text-current" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
              isOpen
                ? 'rotate-180 text-emerald-500'
                : 'text-neutral-400'
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
          {/* Search Input within Dropdown */}
          {searchable && parsedOptions.length > 3 && (
            <div className="p-2 border-b border-neutral-800 bg-neutral-950/60 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute inset-y-0 left-2.5 my-auto text-neutral-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-2 my-auto text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center"
                  >
                    <X className="w-3 h-3 text-current" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-neutral-800/40 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected =
                  selectedOption !== null &&
                  String(selectedOption.value) === String(opt.value);

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed bg-neutral-900/50 text-neutral-500'
                        : isSelected
                        ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-semibold'
                        : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {opt.icon && (
                        <span className="shrink-0 flex items-center text-neutral-500 dark:text-neutral-400">
                          {renderIcon(opt.icon, 'w-3.5 h-3.5 text-current shrink-0')}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">
                No matching options
              </div>
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-400">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-neutral-500">{helperText}</p>
      ) : null}
    </div>
  );
};

export default Select;
