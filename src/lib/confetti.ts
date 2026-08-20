'use client';

// High-Performance 60fps Native Canvas Confetti & Toast Engine (Zero Lag, No Emojis)

let activeCanvas: HTMLCanvasElement | null = null;
let animFrameId: number | null = null;

export function triggerConfetti(originX = 0.5, originY = 0.4) {
  if (typeof window === 'undefined') return;

  // Cleanup any previous animation
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (activeCanvas && activeCanvas.parentNode) {
    activeCanvas.parentNode.removeChild(activeCanvas);
    activeCanvas = null;
  }

  const canvas = document.createElement('canvas');
  activeCanvas = canvas;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const colors = [
    '#2C6E6A', // Woodlem Teal
    '#D97706', // Warm Amber
    '#059669', // Emerald
    '#2563EB', // Sapphire
    '#7C3AED', // Violet
    '#DC2626', // Coral Red
  ];

  const particleCount = 45;
  const particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    vRot: number;
    opacity: number;
  }[] = [];

  const startX = window.innerWidth * originX;
  const startY = window.innerHeight * originY;

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
    const speed = Math.random() * 7 + 3;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 3,
      size: Math.random() * 6 + 4,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 8,
      opacity: 1,
    });
  }

  const gravity = 0.25;
  const drag = 0.96;

  function render() {
    ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let activeCount = 0;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.rotation += p.vRot;
      p.opacity -= 0.016;

      if (p.opacity > 0) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    if (activeCount > 0) {
      animFrameId = requestAnimationFrame(render);
    } else {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      activeCanvas = null;
      animFrameId = null;
    }
  }

  render();
}

// Show a high-performance celebration toast
export function showCelebrationToast(title: string, subtitle?: string, xp = 50) {
  if (typeof window === 'undefined') return;

  triggerConfetti(0.5, 0.35);

  const toastId = 'woodlem-celebration-toast';
  const existing = document.getElementById(toastId);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  const toast = document.createElement('div');
  toast.id = toastId;
  toast.style.position = 'fixed';
  toast.style.bottom = '28px';
  toast.style.right = '28px';
  toast.style.zIndex = '999999';
  toast.style.background = '#1E293B';
  toast.style.color = '#FFFFFF';
  toast.style.border = '1px solid #334155';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)';
  toast.style.borderRadius = '8px';
  toast.style.padding = '12px 16px';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.transform = 'translateY(16px)';
  toast.style.opacity = '0';
  toast.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
  toast.style.fontFamily = 'var(--font-label), sans-serif';

  toast.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 6px; background: #0F766E; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; letter-spacing: 0.05em;">
      XP
    </div>
    <div>
      <div style="font-size: 13px; font-weight: 700; color: #FFFFFF;">${title}</div>
      <div style="font-size: 11px; color: #94A3B8; margin-top: 1px;">${subtitle || 'Completed successfully'}</div>
    </div>
    <div style="margin-left: 6px; padding: 3px 8px; border-radius: 4px; background: #0F766E; color: #FFFFFF; font-size: 11px; font-weight: 800; letter-spacing: 0.04em;">
      +${xp} XP
    </div>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.transform = 'translateY(10px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, 3200);
}
