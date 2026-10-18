'use client';

import React, { useState, useEffect } from 'react';
import { Laptop, X } from 'lucide-react';

interface DesktopRecommendedBannerProps {
  portalName?: string;
  storageKey?: string;
}

export const DesktopRecommendedBanner: React.FC<DesktopRecommendedBannerProps> = ({
  portalName = 'Dashboard',
  storageKey = 'woodlem_laptop_warn_dismissed',
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === 'true') {
        setIsDismissed(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [storageKey]);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, 'true');
      }
    } catch {
      // Ignore storage access errors
    }
  };

  return (
    <div className="mobile-desktop-warning-banner" role="alert">
      <div className="mobile-warning-content">
        <div className="mobile-warning-icon-wrap" aria-hidden="true">
          <Laptop size={17} />
        </div>
        <div className="mobile-warning-text">
          <div className="mobile-warning-title">
            <span>Laptop Version Recommended</span>
          </div>
          <p className="mobile-warning-desc">
            The {portalName} contains extensive data tables, grade registers, and management tools optimized for laptop or desktop screens.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="mobile-warning-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss Laptop Recommendation Notice"
        title="Dismiss notice"
      >
        <X size={15} />
      </button>
    </div>
  );
};
