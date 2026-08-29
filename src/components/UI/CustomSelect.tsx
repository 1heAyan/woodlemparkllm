'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (CustomSelectOption | string)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  id?: string;
  searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  style,
  menuStyle,
  buttonStyle,
  id,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward?: boolean;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normalize options to CustomSelectOption[]
  const normalizedOptions: CustomSelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const preferredMaxHeight = 260;

      // Determine if menu should open upwards
      const shouldOpenUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(preferredMaxHeight, Math.max(140, availableSpace));

      const top = shouldOpenUpward
        ? Math.max(8, rect.top - maxHeight - 4)
        : rect.bottom + 4;

      setMenuPos({
        top,
        left: rect.left,
        width: Math.max(rect.width, 180),
        maxHeight,
        openUpward: shouldOpenUpward,
      });
    }
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
    setSearchTerm('');
  };

  // Close on outside click or reposition on external scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const menuEl = menuRef.current || document.getElementById('__custom_select_portal__');
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !(menuEl && menuEl.contains(e.target as Node))
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScroll = (e: Event) => {
      const menuEl = menuRef.current || document.getElementById('__custom_select_portal__');
      // If the scroll event happened inside the dropdown menu itself, DO NOT close or reposition!
      if (menuEl && (menuEl === e.target || menuEl.contains(e.target as Node))) {
        return;
      }
      // If trigger button is still visible in viewport, recalculate position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false);
        } else {
          calculatePosition();
        }
      }
    };

    const handleResize = () => {
      calculatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, calculatePosition]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(term)) ||
      opt.value.toLowerCase().includes(term)
    );
  });

  const handleSelect = (val: string, isDisabled?: boolean) => {
    if (isDisabled || disabled) return;
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if ((e.key === 'Enter' || e.key === ' ') && !isOpen) {
      e.preventDefault();
      handleToggle();
    }
  };

  const menuNode = isOpen && menuPos ? (
    <div
      id="__custom_select_portal__"
      ref={menuRef}
      role="listbox"
      tabIndex={-1}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        background: '#FFFFFF',
        border: '1px solid var(--border-color, #E5E3DF)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08)',
        zIndex: 999999,
        maxHeight: menuPos.maxHeight || 260,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '6px',
        scrollbarWidth: 'thin',
        ...menuStyle,
      }}
    >
      {searchable && (
        <div style={{ padding: '4px', borderBottom: '1px solid #ECEAE5', marginBottom: 6 }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search options..."
            style={{
              width: '100%',
              padding: '7px 9px',
              fontSize: 12,
              border: '1px solid var(--border-color, #E5E3DF)',
              borderRadius: 6,
              outline: 'none',
              background: '#FAF9F6',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {filteredOptions.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary, #7A7874)', textAlign: 'center' }}>
          No options available
        </div>
      ) : (
        filteredOptions.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <div
              key={opt.value}
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(opt.value, opt.disabled)}
              style={{
                padding: '9px 12px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: isSelected ? 700 : 500,
                color: opt.disabled ? '#A09E9A' : isSelected ? '#1A1A1A' : 'var(--neutral-dark, #2D2C2A)',
                background: isSelected ? '#F2F1EE' : 'transparent',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.12s ease',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !opt.disabled) e.currentTarget.style.background = '#FAF9F6';
              }}
              onMouseLeave={(e) => {
                if (!isSelected && !opt.disabled) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {opt.label}
                </div>
                {opt.sublabel && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-secondary, #7A7874)', marginTop: 2 }}>
                    {opt.sublabel}
                  </div>
                )}
              </div>
              {isSelected && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      id={id}
      className={`custom-select-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#FFFFFF',
          border: isOpen ? '1px solid #1A1A1A' : '1px solid var(--border-color, #E5E3DF)',
          borderRadius: 6,
          color: selectedOption ? 'var(--neutral-dark, #2D2C2A)' : 'var(--text-secondary, #7A7874)',
          fontSize: 12.5,
          fontWeight: 500,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(26, 26, 26, 0.1)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          ...buttonStyle,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: 'var(--text-secondary, #7A7874)',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Portal dropdown — renders into document.body, escapes all overflow clipping */}
      {mounted && menuNode && createPortal(menuNode, document.body)}
    </div>
  );
};
