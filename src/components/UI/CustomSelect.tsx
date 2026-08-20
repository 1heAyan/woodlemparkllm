'use client';

import React, { useState, useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to CustomSelectOption[]
  const normalizedOptions: CustomSelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Filter options if searchable
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
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    }
  };

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
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
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
          border: isOpen ? '1px solid #2C6E6A' : '1px solid var(--border-color, #E5E3DF)',
          borderRadius: 6,
          color: selectedOption ? 'var(--neutral-dark, #2D2C2A)' : 'var(--text-secondary, #7A7874)',
          fontSize: 12.5,
          fontWeight: 500,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(44, 110, 106, 0.12)' : 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          ...buttonStyle,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {/* Custom Chevron SVG */}
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
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #E5E3DF)',
            borderRadius: 6,
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
            zIndex: 1000,
            maxHeight: 260,
            overflowY: 'auto',
            padding: '4px',
            ...menuStyle,
          }}
        >
          {/* Optional Search Input */}
          {searchable && (
            <div style={{ padding: '4px', borderBottom: '1px solid #ECEAE5', marginBottom: 4 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 11.5,
                  border: '1px solid var(--border-color, #E5E3DF)',
                  borderRadius: 4,
                  outline: 'none',
                  background: '#FAF9F6',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary, #7A7874)', textAlign: 'center' }}>
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
                    padding: '8px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    color: opt.disabled
                      ? '#A09E9A'
                      : isSelected
                      ? '#2C6E6A'
                      : 'var(--neutral-dark, #2D2C2A)',
                    background: isSelected ? '#EAF3EF' : 'transparent',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !opt.disabled) {
                      e.currentTarget.style.background = '#FAF9F6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !opt.disabled) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-secondary, #7A7874)', marginTop: 1 }}>
                        {opt.sublabel}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2C6E6A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
