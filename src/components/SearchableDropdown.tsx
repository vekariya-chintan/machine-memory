import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'red' | 'cyan' | 'purple' | 'slate';
  icon?: React.ReactNode;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  labelPrefix?: string;
  icon?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  align?: 'left' | 'right';
  showAllOption?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
  disabled?: boolean;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to search...',
  labelPrefix,
  icon,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  align = 'left',
  showAllOption = false,
  allOptionLabel = 'All Assets',
  allOptionValue = 'ALL',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);
  const isAllSelected = showAllOption && value === allOptionValue;

  // Filter options based on search term
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchLabel = opt.label.toLowerCase().includes(term);
    const matchValue = opt.value.toLowerCase().includes(term);
    const matchSubLabel = opt.subLabel ? opt.subLabel.toLowerCase().includes(term) : false;
    const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(term) : false;
    return matchLabel || matchValue || matchSubLabel || matchBadge;
  });

  const getBadgeClass = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-950/80 border-emerald-800 text-emerald-400';
      case 'amber':
        return 'bg-amber-950/80 border-amber-800 text-amber-400';
      case 'red':
        return 'bg-red-950/80 border-red-800 text-red-400';
      case 'purple':
        return 'bg-purple-950/80 border-purple-800 text-purple-400';
      case 'slate':
        return 'bg-slate-800 border-slate-700 text-slate-300';
      case 'cyan':
      default:
        return 'bg-cyan-950/80 border-cyan-800 text-cyan-400';
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
          isOpen
            ? 'bg-slate-900 border-cyan-500/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-cyan-400">{icon}</span>}
          {labelPrefix && <span className="text-slate-400 shrink-0">{labelPrefix}</span>}
          <span className="font-bold text-cyan-300 truncate min-w-0 flex-1">
            {isAllSelected
              ? allOptionLabel
              : selectedOption
              ? selectedOption.label
              : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`text-[9px] px-1 py-0.2 rounded border font-semibold uppercase shrink-0 ${getBadgeClass(
                selectedOption.badgeColor
              )}`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu with Integrated Search Box */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 w-72 sm:w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${dropdownClassName}`}
        >
          {/* Search Box Input */}
          <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1 font-mono text-xs divide-y divide-slate-800/40">
            {/* Show All option if requested and not filtered out */}
            {showAllOption && !searchTerm.trim() && (
              <button
                type="button"
                onClick={() => handleSelect(allOptionValue)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                  isAllSelected
                    ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-extrabold text-sm">🌐</span>
                  <div>
                    <div className="font-bold">{allOptionLabel}</div>
                    <div className="text-[10px] text-slate-500">View aggregate metrics for all monitored machines</div>
                  </div>
                </div>
                {isAllSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 font-mono">
                No matching options for "{searchTerm}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {opt.icon && <span className="mt-0.5 shrink-0 text-cyan-400">{opt.icon}</span>}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-100">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded border uppercase ${getBadgeClass(
                                opt.badgeColor
                              )}`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5 max-w-[220px]">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
