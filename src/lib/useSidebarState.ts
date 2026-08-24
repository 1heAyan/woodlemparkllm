'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type SidebarMode = 'auto-hide' | 'expanded';

const STORAGE_KEY = 'woodlem_sidebar_mode';
const HOVER_EXPAND_DELAY_MS = 1200; // 1.2s deliberate hover delay to prevent sudden/accidental expansion

export function useSidebarState(defaultMode: SidebarMode = 'auto-hide') {
  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(defaultMode);
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SidebarMode | null;
      if (saved && (saved === 'auto-hide' || saved === 'expanded')) {
        setSidebarModeState(saved);
      }
    } catch (e) {}
  }, []);

  // Show subtle toast feedback on double-click toggle
  const showFeedback = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setFeedbackToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setFeedbackToast(null);
    }, 2400);
  }, []);

  // Double click toggles between Pinned (Always expanded) and Auto-hide (Hover)
  const togglePin = useCallback(() => {
    setSidebarModeState((prev) => {
      const next: SidebarMode = prev === 'expanded' ? 'auto-hide' : 'expanded';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {}
      showFeedback(next === 'expanded' ? '📌 Sidebar Pinned (Always Open)' : '⚡ Auto-Hide (Hover ~1.2s to open)');
      return next;
    });
    setIsHovered(false);
  }, [showFeedback]);

  // Mouse enter handler: only opens after hovering for 1.2s
  const handleMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (sidebarMode === 'auto-hide') {
      enterTimeoutRef.current = setTimeout(() => {
        setIsHovered(true);
      }, HOVER_EXPAND_DELAY_MS);
    }
  }, [sidebarMode]);

  // Mouse leave handler: smooth collapse
  const handleMouseLeave = useCallback(() => {
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    if (sidebarMode === 'auto-hide') {
      leaveTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 200);
    }
  }, [sidebarMode]);

  // When clicking a navigation item, retract if in auto-hide mode
  const handleNavClick = useCallback(() => {
    if (sidebarMode === 'auto-hide') {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
      setIsHovered(false);
    }
  }, [sidebarMode]);

  // Compute effective expanded / collapsed state
  const isExpanded = sidebarMode === 'expanded' || (sidebarMode === 'auto-hide' && isHovered);
  const isCollapsed = !isExpanded;
  const isPinned = sidebarMode === 'expanded';

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  return {
    sidebarMode,
    isExpanded,
    isCollapsed,
    isHovered,
    isPinned,
    isMounted,
    feedbackToast,
    togglePin,
    handleMouseEnter,
    handleMouseLeave,
    handleNavClick,
  };
}
