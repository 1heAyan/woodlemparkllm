'use client';

import React from 'react';

interface WoodlemLogoProps {
  collapsed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * High-definition Woodlem Park School Emblem SVG
 * Faithfully reproduces the 3 colored leaf droplets (Orange, Green, Teal)
 * and the iconic architectural gate base with twin minaret spires.
 */
export const WoodlemEmblemSVG: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="14 12 72 78"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label="Woodlem Park School Emblem"
    >
      <defs>
        <linearGradient id="leaf-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="leaf-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#84CC16" />
          <stop offset="100%" stopColor="#65A30D" />
        </linearGradient>
        <linearGradient id="leaf-teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>

      <g>
        {/* 1. Left Leaf - Warm Coral/Orange */}
        <path
          d="M26 44 C26 31 37 18 37 18 C37 18 48 31 48 44 C48 53 38 58 37 58 C36 58 26 53 26 44 Z"
          fill="url(#leaf-orange)"
        />

        {/* 2. Right Leaf - Fresh Teal/Cyan */}
        <path
          d="M52 44 C52 31 63 18 63 18 C63 18 74 31 74 44 C74 53 64 58 63 58 C62 58 52 53 52 44 Z"
          fill="url(#leaf-teal)"
        />

        {/* 3. Center Leaf - Vibrant Green */}
        <path
          d="M39 40 C39 27 50 14 50 14 C50 14 61 27 61 40 C61 50 51 55 50 55 C49 55 39 50 39 40 Z"
          fill="url(#leaf-green)"
        />

        {/* 4. Base Gate / Fortress in Dark Slate/Charcoal */}
        <path
          d="M18 56 
             C24 56 26 53 37 53 
             C44 53 46 55 50 55 
             C54 55 56 53 63 53 
             C74 53 76 56 82 56 
             L82 82 
             C82 85 79 87 76 87 
             L24 87 
             C21 87 18 85 18 82 
             Z"
          fill="#1E293B"
        />

        {/* 5. Left Minaret Arch Cutout */}
        <rect x="33" y="66" width="6" height="21" rx="1.5" fill="#FFFFFF" />
        <path
          d="M36 59 C36 59 39 63 39 65 C39 66 38 67 36 67 C34 67 33 66 33 65 C33 63 36 59 36 59 Z"
          fill="#FFFFFF"
        />

        {/* 6. Right Minaret Arch Cutout */}
        <rect x="61" y="66" width="6" height="21" rx="1.5" fill="#FFFFFF" />
        <path
          d="M64 59 C64 59 67 63 67 65 C67 66 66 67 64 67 C62 67 61 66 61 65 C61 63 64 59 64 59 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
};

export const WoodlemLogo: React.FC<WoodlemLogoProps> = ({ collapsed = false, className = '', style }) => {
  return (
    <div
      className={`woodlem-logo-wrapper ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 52,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      title="Woodlem Park School"
    >
      {/* Collapsed Emblem SVG */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: collapsed ? 1 : 0,
          transform: collapsed ? 'scale(1)' : 'scale(0.8)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: collapsed ? 'auto' : 'none',
        }}
      >
        <WoodlemEmblemSVG size={34} />
      </div>

      {/* Expanded Full Logo */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? 'scale(0.92)' : 'scale(1)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
      >
        <img
          src="/Jurf-Logo-1.png"
          alt="Woodlem Park School"
          style={{
            width: '100%',
            maxHeight: 52,
            height: 'auto',
            objectFit: 'contain',
            objectPosition: 'left center',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};
