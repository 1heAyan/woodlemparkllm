'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type SidebarMode = 'expanded' | 'collapsed';

export function useSidebarState(
  userKey?: string | boolean,
  defaultCollapsed: boolean = false
) {
  // Determine personalized storage key per user
  const sanitizedKey = typeof userKey === 'string' && userKey.trim() !== '' && userKey !== 'auto-hide' && userKey !== 'expanded' && userKey !== 'collapsed'
    ? `woodlem_sidebar_collapsed_${userKey.trim()}`
    : 'woodlem_sidebar_collapsed_default';

  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const [isMounted, setIsMounted] = useState(false);
  const currentKeyRef = useRef(sanitizedKey);
  currentKeyRef.current = sanitizedKey;

  // Load and synchronize personalized preference from localStorage
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(sanitizedKey);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else {
        setIsCollapsed(defaultCollapsed);
      }
    } catch (e) {}
  }, [sanitizedKey, defaultCollapsed]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(currentKeyRef.current, String(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(currentKeyRef.current, String(collapsed));
    } catch (e) {}
  }, []);

  const isExpanded = !isCollapsed;
  const sidebarMode: SidebarMode = isCollapsed ? 'collapsed' : 'expanded';

  // Compatibility stubs
  const togglePin = toggleCollapse;
  const handleMouseEnter = () => {};
  const handleMouseLeave = () => {};
  const handleNavClick = () => {};

  return {
    isCollapsed,
    isExpanded,
    sidebarMode,
    isMounted,
    isPinned: !isCollapsed,
    isHovered: false,
    feedbackToast: null,
    toggleCollapse,
    setCollapsed,
    togglePin,
    handleMouseEnter,
    handleMouseLeave,
    handleNavClick,
  };
}
