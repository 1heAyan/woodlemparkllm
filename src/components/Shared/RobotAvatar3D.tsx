'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RobotAvatar3DProps {
  size?: number; // width & height in px
  isThinking?: boolean;
  onClick?: () => void;
}

export const RobotAvatar3D: React.FC<RobotAvatar3DProps> = ({
  size = 72,
  isThinking = false,
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mouse tracking targets (-1 to 1)
  const targetLook = useRef({ x: 0, y: 0 });
  const currentLook = useRef({ x: 0, y: 0 });

  const [motion, setMotion] = useState({
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    antennaWobble: 0,
    eyeX: 0,
    eyeY: 0,
    bodyRotY: 0,
    bodyRotX: 0,
    glareX: 45,
    glareY: 25,
  });

  const [isBlinking, setIsBlinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHappy, setIsHappy] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.75;
      const clampedDist = Math.min(dist, maxDist) / maxDist;

      const angle = Math.atan2(deltaY, deltaX);
      targetLook.current = {
        x: Math.cos(angle) * clampedDist,
        y: Math.sin(angle) * clampedDist,
      };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let animId: number;
    const updateLoop = () => {
      const ease = 0.13;
      currentLook.current.x += (targetLook.current.x - currentLook.current.x) * ease;
      currentLook.current.y += (targetLook.current.y - currentLook.current.y) * ease;

      const rotY = currentLook.current.x * 30; // Head Yaw (-30deg to 30deg)
      const rotX = -currentLook.current.y * 22; // Head Pitch (-22deg to 22deg)
      const rotZ = currentLook.current.x * 7; // Cute head tilt

      const antennaWobble = -currentLook.current.x * 16; // Physics wobble in opposite direction

      const eyeX = currentLook.current.x * 7.5; // Eye tracking glide
      const eyeY = currentLook.current.y * 5.5;

      const bodyRotY = currentLook.current.x * 14;
      const bodyRotX = -currentLook.current.y * 10;

      const glareX = 45 + currentLook.current.x * 22;
      const glareY = 25 + currentLook.current.y * 16;

      setMotion({
        rotX,
        rotY,
        rotZ,
        antennaWobble,
        eyeX,
        eyeY,
        bodyRotY,
        bodyRotX,
        glareX,
        glareY,
      });

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);

    // Natural Astro Bot blinking
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 130);
    }, 3400 + Math.random() * 2400);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
      clearInterval(blinkInterval);
    };
  }, []);

  const handleClick = () => {
    setIsHappy(true);
    setTimeout(() => setIsHappy(false), 600);
    if (onClick) onClick();
  };

  const scale = size / 76;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: size,
        height: size + 8,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
      title="Astro Bot Companion"
    >
      {/* Dynamic Hover Ambient Floor Glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size * 0.65,
          height: 8,
          borderRadius: '50%',
          background: isThinking
            ? 'radial-gradient(ellipse, rgba(0, 229, 255, 0.7) 0%, transparent 75%)'
            : isHovered
            ? 'radial-gradient(ellipse, rgba(0, 136, 255, 0.6) 0%, transparent 75%)'
            : 'radial-gradient(ellipse, rgba(0, 136, 255, 0.35) 0%, transparent 75%)',
          filter: 'blur(2.5px)',
          transition: 'all 0.25s ease',
          pointerEvents: 'none',
        }}
      />

      {/* 3D ASTRO BOT STAGE */}
      <div
        style={{
          width: 76,
          height: 76,
          transform: `scale(${scale})`,
          transformStyle: 'preserve-3d',
          perspective: 800,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* ================= ASTRO BOT HEAD ================= */}
        <div
          style={{
            width: 56,
            height: 48,
            transform: `translateY(${isHovered ? -4 : 0}px) rotateX(${motion.rotX}deg) rotateY(${motion.rotY}deg) rotateZ(${motion.rotZ}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.05s ease-out',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Top Astro Antenna Rod & Glowing Tip */}
          <div
            style={{
              position: 'absolute',
              top: -16,
              left: '50%',
              transform: `translateX(-50%) rotateZ(${motion.antennaWobble}deg) translateZ(4px)`,
              transformOrigin: 'bottom center',
              width: 3.5,
              height: 18,
              borderRadius: '2px',
              background: 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 100%)',
              transition: 'transform 0.06s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 2,
            }}
          >
            {/* Glowing Cyan Tip Orb */}
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: isThinking ? '#00E5FF' : '#0088FF',
                boxShadow: isThinking
                  ? '0 0 12px #00E5FF, 0 0 4px #00E5FF, inset 0 0 3px #FFFFFF'
                  : '0 0 8px #0088FF, inset 0 0 2px #FFFFFF',
                marginTop: -4.5,
                border: '1px solid #FFFFFF',
                animation: isThinking ? 'pulse 0.7s infinite alternate' : 'none',
              }}
            />
          </div>

          {/* Blue Antenna Base Ring */}
          <div
            style={{
              position: 'absolute',
              top: -1,
              left: '50%',
              transform: 'translateX(-50%) translateZ(4px)',
              width: 12,
              height: 4,
              borderRadius: '50%',
              background: '#0088FF',
              boxShadow: '0 0 4px rgba(0, 136, 255, 0.6)',
              zIndex: 1,
            }}
          />

          {/* Left Astro Ear Node (Cyan / Blue Concentric Disc) */}
          <div
            style={{
              position: 'absolute',
              left: -6,
              top: 13,
              width: 9,
              height: 22,
              borderRadius: '6px 2px 2px 6px',
              background: 'linear-gradient(180deg, #0088FF 0%, #0055CC 100%)',
              border: '1.5px solid #00D2FF',
              boxShadow: '-2px 2px 6px rgba(0,0,0,0.25)',
              transform: 'translateZ(-2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 3.5,
                height: 12,
                borderRadius: 2,
                background: '#00E5FF',
                boxShadow: '0 0 6px #00E5FF',
              }}
            />
          </div>

          {/* Right Astro Ear Node (Cyan / Blue Concentric Disc) */}
          <div
            style={{
              position: 'absolute',
              right: -6,
              top: 13,
              width: 9,
              height: 22,
              borderRadius: '2px 6px 6px 2px',
              background: 'linear-gradient(180deg, #0088FF 0%, #0055CC 100%)',
              border: '1.5px solid #00D2FF',
              boxShadow: '2px 2px 6px rgba(0,0,0,0.25)',
              transform: 'translateZ(-2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 3.5,
                height: 12,
                borderRadius: 2,
                background: '#00E5FF',
                boxShadow: '0 0 6px #00E5FF',
              }}
            />
          </div>

          {/* Glossy Porcelain Astro Helmet */}
          <div
            style={{
              width: 56,
              height: 48,
              borderRadius: '26px 26px 22px 22px',
              background: `radial-gradient(circle at ${motion.glareX}% ${motion.glareY}%, #FFFFFF 0%, #F1F5F9 45%, #CBD5E1 100%)`,
              border: '2px solid #FFFFFF',
              boxShadow:
                '0 8px 22px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,1), inset 0 -3px 6px rgba(148, 163, 184, 0.35)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translateZ(6px)',
              overflow: 'hidden',
            }}
          >
            {/* Glossy Black Smoked Face Visor */}
            <div
              style={{
                width: 44,
                height: 32,
                borderRadius: '16px 16px 14px 14px',
                background: 'radial-gradient(ellipse at 50% 25%, #0F172A 0%, #030712 100%)',
                border: '1.5px solid #1E293B',
                boxShadow:
                  'inset 0 0 12px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.3)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                overflow: 'hidden',
                transform: 'translateZ(6px)',
              }}
            >
              {/* Visor Glare Glass Curve */}
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 5,
                  right: 5,
                  height: 7,
                  borderRadius: '10px 10px 4px 4px',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.02) 100%)',
                  pointerEvents: 'none',
                }}
              />

              {/* Digital Pixel Matrix Scanlines */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'linear-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 1px)',
                  backgroundSize: '100% 3px',
                  pointerEvents: 'none',
                }}
              />

              {/* LEFT ASTRO BOT EYE */}
              <div
                style={{
                  width: 11,
                  height: isBlinking ? 2.5 : isHappy ? 11 : 14,
                  borderRadius: isBlinking
                    ? '2px'
                    : isHappy
                    ? '10px 10px 3px 3px'
                    : '5px',
                  background: isThinking
                    ? 'linear-gradient(180deg, #67E8F9 0%, #06B6D4 100%)'
                    : 'linear-gradient(180deg, #00E5FF 0%, #0088FF 100%)',
                  boxShadow: isThinking
                    ? '0 0 14px #22D3EE, 0 0 4px #06B6D4'
                    : '0 0 12px #00E5FF, 0 0 4px #0088FF',
                  transform: `translate(${motion.eyeX}px, ${motion.eyeY}px) ${
                    isHappy ? 'rotateZ(-10deg)' : ''
                  }`,
                  transition: 'height 0.08s ease, transform 0.04s ease-out, border-radius 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {!isBlinking && !isHappy && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 0 3px #FFFFFF',
                      transform: 'translate(-1.5px, -1.5px)',
                    }}
                  />
                )}
              </div>

              {/* RIGHT ASTRO BOT EYE */}
              <div
                style={{
                  width: 11,
                  height: isBlinking ? 2.5 : isHappy ? 11 : 14,
                  borderRadius: isBlinking
                    ? '2px'
                    : isHappy
                    ? '10px 10px 3px 3px'
                    : '5px',
                  background: isThinking
                    ? 'linear-gradient(180deg, #67E8F9 0%, #06B6D4 100%)'
                    : 'linear-gradient(180deg, #00E5FF 0%, #0088FF 100%)',
                  boxShadow: isThinking
                    ? '0 0 14px #22D3EE, 0 0 4px #06B6D4'
                    : '0 0 12px #00E5FF, 0 0 4px #0088FF',
                  transform: `translate(${motion.eyeX}px, ${motion.eyeY}px) ${
                    isHappy ? 'rotateZ(10deg)' : ''
                  }`,
                  transition: 'height 0.08s ease, transform 0.04s ease-out, border-radius 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {!isBlinking && !isHappy && (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 0 3px #FFFFFF',
                      transform: 'translate(-1.5px, -1.5px)',
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= ASTRO BOT BODY & CAPE ================= */}
        <div
          style={{
            width: 32,
            height: 20,
            marginTop: -3,
            borderRadius: '10px 10px 14px 14px',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 100%)',
            border: '1.5px solid #FFFFFF',
            boxShadow: '0 4px 10px rgba(0,0,0,0.18), inset 0 1px 2px #FFFFFF',
            transform: `rotateX(${motion.bodyRotX}deg) rotateY(${motion.bodyRotY}deg) translateZ(-2px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 5,
          }}
        >
          {/* Astro Blue Collar Ring */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 4,
              right: 4,
              height: 4,
              borderRadius: '2px',
              background: 'linear-gradient(90deg, #0088FF 0%, #00D2FF 50%, #0088FF 100%)',
            }}
          />

          {/* Blue Side Racing Stripes */}
          <div
            style={{
              position: 'absolute',
              left: 2,
              top: 6,
              bottom: 4,
              width: 3,
              borderRadius: 2,
              background: '#0088FF',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 2,
              top: 6,
              bottom: 4,
              width: 3,
              borderRadius: 2,
              background: '#0088FF',
            }}
          />

          {/* Center Chest Emblem / LED Core */}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isThinking ? '#00E5FF' : '#0088FF',
              boxShadow: isThinking
                ? '0 0 8px #00E5FF, inset 0 0 2px #FFFFFF'
                : '0 0 6px #0088FF, inset 0 0 2px #FFFFFF',
              border: '1px solid #FFFFFF',
            }}
          />

          {/* Iconic Astro Mini Cape / Thruster Stream */}
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: `translateX(-50%) rotateZ(${motion.antennaWobble * 0.8}deg)`,
              width: 14,
              height: 5,
              borderRadius: '0 0 6px 6px',
              background: 'linear-gradient(180deg, #0088FF 0%, #0055CC 100%)',
              boxShadow: '0 2px 6px rgba(0, 136, 255, 0.4)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
