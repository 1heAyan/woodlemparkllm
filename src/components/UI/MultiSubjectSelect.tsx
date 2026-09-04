'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export const CURATED_SUBJECT_PRESETS = [
  // Languages
  'English',
  'English Core',
  'English Literature',
  'Communicative English',
  'Arabic',
  'French',
  'Hindi',
  'Islamic Studies',
  'Malayalam',
  'Urdu',
  'Tamil',
  'Moral Education',
  'Special Arabic',
  'Spanish',
  'German',

  // Mathematics
  'Mathematics',
  'Math',
  'Applied Mathematics',
  'Standard Mathematics',
  'Basic Mathematics',
  'Statistics',

  // Sciences
  'Physics',
  'Chemistry',
  'Biology',
  'General Science',
  'Environmental Science',
  'Biotechnology',

  // Computer & Technology
  'Computer Science',
  'Artificial Intelligence',
  'Informatics Practices',
  'Information Technology',
  'AI & Robotics',
  'Data Science',
  'Coding & Programming',
  'Cyber Security',

  // Social Sciences & Humanities
  'History',
  'Geography',
  'Political Science',
  'Economics',
  'Sociology',
  'Psychology',
  'Global Perspectives',

  // Commerce & Business
  'Accountancy',
  'Business Studies',
  'Entrepreneurship',
  'Marketing',
  'Financial Markets',

  // Physical Education & Wellness
  'Physical Education',
  'Sports & Fitness',
  'Yoga',
  'Athletics',
  'Health Education',

  // Arts & Creative
  'Art & Design',
  'Visual Arts',
  'Fine Arts',
  'Music',
  'Drama',
  'Dance',
  'Performing Arts',
  'Craft',
];

interface MultiSubjectSelectProps {
  value: string | string[];
  onChange: (valueStr: string, valueArr: string[]) => void;
  placeholder?: string;
  maxDisplay?: number;
  label?: string;
  disabled?: boolean;
}

export const MultiSubjectSelect: React.FC<MultiSubjectSelectProps> = ({
  value,
  onChange,
  placeholder = 'Search or type to add subjects...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse current selected subjects into array
  const selectedSubjects = useMemo<string[]>(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((v) => !!v && v.trim() !== '');
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !!s && s !== '—' && s !== '-' && s !== 'null' && s !== 'undefined');
  }, [value]);

  // Maintain local list of dynamically added custom subjects
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  // Combined master subjects list (deduped case-insensitively)
  const allSubjects = useMemo(() => {
    const list: string[] = [...CURATED_SUBJECT_PRESETS];
    [...customSubjects, ...selectedSubjects].forEach((s) => {
      if (s && !list.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
        list.push(s);
      }
    });
    return list;
  }, [customSubjects, selectedSubjects]);

  // Filtered list based on current search term
  const filteredSubjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allSubjects;
    return allSubjects.filter((s) => s.toLowerCase().includes(term));
  }, [allSubjects, searchTerm]);

  // Check if search term is an exact match for an existing subject
  const exactMatchExists = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return allSubjects.some((s) => s.toLowerCase() === term);
  }, [allSubjects, searchTerm]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleSubject = (subjectName: string) => {
    const exists = selectedSubjects.some((s) => s.toLowerCase() === subjectName.toLowerCase());
    let nextArr: string[];
    if (exists) {
      nextArr = selectedSubjects.filter((s) => s.toLowerCase() !== subjectName.toLowerCase());
    } else {
      nextArr = [...selectedSubjects, subjectName];
    }
    onChange(nextArr.join(', '), nextArr);
    setSearchTerm('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleRemoveSubject = (subjectName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextArr = selectedSubjects.filter((s) => s.toLowerCase() !== subjectName.toLowerCase());
    onChange(nextArr.join(', '), nextArr);
  };

  const handleAddNewCustomSubject = () => {
    const clean = searchTerm.trim();
    if (!clean) return;
    // Capitalize each word nicely
    const formatted = clean
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');

    if (!customSubjects.includes(formatted)) {
      setCustomSubjects((prev) => [...prev, formatted]);
    }
    if (!selectedSubjects.some((s) => s.toLowerCase() === formatted.toLowerCase())) {
      const nextArr = [...selectedSubjects, formatted];
      onChange(nextArr.join(', '), nextArr);
    }
    setSearchTerm('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!exactMatchExists && searchTerm.trim()) {
        handleAddNewCustomSubject();
      } else if (filteredSubjects.length > 0) {
        handleToggleSubject(filteredSubjects[0]);
      }
    } else if (e.key === 'Backspace' && !searchTerm && selectedSubjects.length > 0) {
      // Remove last tag
      const last = selectedSubjects[selectedSubjects.length - 1];
      handleRemoveSubject(last);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Box container with pills and input */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            if (inputRef.current) inputRef.current.focus();
          }
        }}
        style={{
          minHeight: 40,
          padding: '6px 10px',
          borderRadius: 6,
          border: isOpen ? '1px solid #2C6E6A' : '1px solid var(--border-color, #E5E3DF)',
          background: disabled ? '#F3F4F6' : '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          cursor: disabled ? 'not-allowed' : 'text',
          boxShadow: isOpen ? '0 0 0 2px rgba(44,110,106,0.12)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Render Selected Subject Pills */}
        {selectedSubjects.map((sub) => (
          <span
            key={sub}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 4,
              background: '#EAF3EF',
              border: '1px solid #C7E4D8',
              color: '#2C6E6A',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>{sub}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => handleRemoveSubject(sub, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#2C6E6A',
                  opacity: 0.7,
                  marginLeft: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}

        {/* Input box */}
        {!disabled && (
          <div style={{ display: 'flex', flex: 1, minWidth: 160, alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selectedSubjects.length === 0 ? placeholder : 'Add another subject...'}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12.5,
                color: 'var(--neutral-dark, #1A1A1A)',
                padding: '2px 0',
              }}
            />
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: 'var(--text-secondary, #6B7280)' }}>
          <ChevronDown size={15} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderRadius: 8,
            border: '1px solid var(--border-color, #E5E3DF)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            zIndex: 1050,
            maxHeight: 260,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {/* Add custom subject button if typed term does not exact match */}
          {!exactMatchExists && searchTerm.trim() && (
            <div
              onClick={handleAddNewCustomSubject}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: '#EAF3EF',
                border: '1px dashed #2C6E6A',
                color: '#2C6E6A',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 4,
              }}
            >
              <Plus size={14} />
              <span>Add custom subject &quot;<strong>{searchTerm.trim()}</strong>&quot;</span>
            </div>
          )}

          {/* List of matched subjects */}
          {filteredSubjects.length === 0 && !searchTerm.trim() ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              No subjects found. Type to add a custom subject.
            </div>
          ) : (
            filteredSubjects.map((sub) => {
              const isSelected = selectedSubjects.some((s) => s.toLowerCase() === sub.toLowerCase());
              return (
                <div
                  key={sub}
                  onClick={() => handleToggleSubject(sub)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 5,
                    fontSize: 12.5,
                    color: isSelected ? '#2C6E6A' : 'var(--neutral-dark, #1A1A1A)',
                    background: isSelected ? '#F0FDF4' : 'transparent',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{sub}</span>
                  {isSelected && <Check size={14} style={{ color: '#2C6E6A' }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
