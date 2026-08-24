'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '@/lib/supabaseClient';

export interface PortalNavigationTarget {
  role?: 'student' | 'teacher' | 'admin' | 'parent';
  view?: string; // e.g. 'class', 'awards', 'attendance', 'hub', 'settings', 'support', 'overview', 'directory', 'classes', 'documents', 'progress'
  classId?: string; // target subject classroom ID
  className?: string; // target class name / subject
  subTab?: string; // 'broadcasts' | 'resources' | 'tasks' | 'syllabus' | 'roster' | 'mark' | 'history'
  modalAction?: 'provision_user' | 'bulk_import' | 'create_class' | 'create_test' | 'create_assignment' | 'add_achievement';
  extraParams?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  navigationLinks?: {
    label: string;
    target: PortalNavigationTarget;
  }[];
}

interface PortalNavigationContextType {
  // AI Panel State
  isAiPanelOpen: boolean;
  setIsAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  openAiWithPrompt: (prompt: string) => void;

  // Active User & Context
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;

  // Navigation Bus
  navigateTo: (target: PortalNavigationTarget) => void;
  subscribeToNavigation: (handler: (target: PortalNavigationTarget) => void) => () => void;

  // Chat History
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearChatHistory: () => void;
  activeNavNotification: string | null;
  clearNavNotification: () => void;
}

const PortalNavigationContext = createContext<PortalNavigationContextType | undefined>(undefined);

const CHAT_STORAGE_KEY = 'woodlem_ai_chat_history_v2';
const AI_PANEL_STATE_KEY = 'woodlem_ai_panel_open_state_v2';

export const PortalNavigationProvider: React.FC<{
  children: React.ReactNode;
  initialUser?: UserProfile | null;
}> = ({ children, initialUser = null }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(initialUser);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [activeNavNotification, setActiveNavNotification] = useState<string | null>(null);

  // Keep track of subscribers (dashboards listening for navigation commands)
  const navListenersRef = useRef<Set<(target: PortalNavigationTarget) => void>>(new Set());

  // Initialize Welcome Message
  const getWelcomeMessage = useCallback((user: UserProfile | null): ChatMessage => {
    const role = user?.role || 'student';
    const name = user?.name || 'there';

    let greeting = `Hello **${name}**! I am your Woodlem Gemini AI Copilot.`;
    if (role === 'student') {
      greeting += ` I can help you submit assignments, view study resources, check your syllabus checklist, track attendance, and navigate all your subject classrooms.`;
    } else if (role === 'teacher') {
      greeting += ` I can guide you in posting class broadcasts, uploading learning materials, publishing tests, marking daily homeroom attendance, and grading assignments.`;
    } else if (role === 'admin') {
      greeting += ` I can help you manage user cohorts, reset student passwords, review clearance documents, inspect class rosters, and provision accounts.`;
    } else if (role === 'parent') {
      greeting += ` I can help you monitor your child's academic progress, upload official school clearance forms, and view extracurricular programs.`;
    }

    return {
      id: 'welcome-msg',
      sender: 'assistant',
      text: greeting,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your Woodlem Gemini AI Copilot. I can help you submit assignments, view study resources, check your syllabus checklist, track attendance, and navigate all your subject classrooms.',
      time: '12:00 PM',
    },
  ]);

  // Load chat messages & greeting on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to restore chat messages from localStorage:', e);
    }
    if (initialUser || currentUser) {
      setMessages([getWelcomeMessage(initialUser || currentUser)]);
    }
  }, [initialUser, currentUser, getWelcomeMessage]);

  // Restore panel open state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem(AI_PANEL_STATE_KEY);
        if (savedState === 'true') {
          setIsAiPanelOpen(true);
        }
      } catch (e) {}
    }
  }, []);

  // Save panel state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AI_PANEL_STATE_KEY, String(isAiPanelOpen));
      } catch (e) {}
    }
  }, [isAiPanelOpen]);

  // Persist chat messages
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
      } catch (e) {}
    }
  }, [messages]);

  // Sync user updates
  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
    }
  }, [initialUser]);

  const toggleAiPanel = useCallback(() => {
    setIsAiPanelOpen((prev) => !prev);
  }, []);

  const openAiWithPrompt = useCallback((prompt: string) => {
    setIsAiPanelOpen(true);
  }, []);

  const clearChatHistory = useCallback(() => {
    const welcome = getWelcomeMessage(currentUser);
    setMessages([welcome]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify([welcome]));
      } catch (e) {}
    }
  }, [currentUser, getWelcomeMessage]);

  const subscribeToNavigation = useCallback((handler: (target: PortalNavigationTarget) => void) => {
    navListenersRef.current.add(handler);
    return () => {
      navListenersRef.current.delete(handler);
    };
  }, []);

  const navigateTo = useCallback((target: PortalNavigationTarget) => {
    let label = 'Navigating...';
    if (target.view === 'class') {
      label = `Opening Classroom ${target.subTab ? `→ ${target.subTab.toUpperCase()}` : ''}`;
    } else if (target.view === 'awards') {
      label = 'Opening Achievements & Awards';
    } else if (target.view === 'attendance') {
      label = 'Opening Attendance Records';
    } else if (target.view === 'hub') {
      label = 'Opening Holistic Hub';
    } else if (target.view === 'settings') {
      label = 'Opening Settings & Passwords';
    } else if (target.view === 'support') {
      label = 'Opening Help & Support Portal';
    } else if (target.modalAction === 'provision_user') {
      label = 'Opening Provision User Modal';
    } else if (target.modalAction === 'bulk_import') {
      label = 'Opening Bulk Import Modal';
    } else if (target.view) {
      label = `Opening ${target.view.charAt(0).toUpperCase() + target.view.slice(1)}`;
    }

    setActiveNavNotification(label);
    setTimeout(() => {
      setActiveNavNotification(null);
    }, 2400);

    // Notify all active dashboard subscribers
    navListenersRef.current.forEach((handler) => {
      try {
        handler(target);
      } catch (err) {
        console.error('Error dispatching navigation event:', err);
      }
    });
  }, []);

  const clearNavNotification = useCallback(() => {
    setActiveNavNotification(null);
  }, []);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K or ⌘J
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setIsAiPanelOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <PortalNavigationContext.Provider
      value={{
        isAiPanelOpen,
        setIsAiPanelOpen,
        toggleAiPanel,
        openAiWithPrompt,
        currentUser,
        setCurrentUser,
        navigateTo,
        subscribeToNavigation,
        messages,
        setMessages,
        clearChatHistory,
        activeNavNotification,
        clearNavNotification,
      }}
    >
      {children}
    </PortalNavigationContext.Provider>
  );
};

export const usePortalNavigation = () => {
  const context = useContext(PortalNavigationContext);
  if (!context) {
    throw new Error('usePortalNavigation must be used within a PortalNavigationProvider');
  }
  return context;
};
