import React from 'react';

interface PromptNovaLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'emblem-only' | 'horizontal' | 'vertical';
}

export const PromptNovaLogo: React.FC<PromptNovaLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  variant = 'horizontal',
}) => {
  // Dimension presets
  const sizeMap = {
    sm: { box: 28, text: 'text-xs', sub: 'text-[8px]' },
    md: { box: 34, text: 'text-sm', sub: 'text-[9px]' },
    lg: { box: 44, text: 'text-base', sub: 'text-[10px]' },
    xl: { box: 64, text: 'text-xl', sub: 'text-xs' },
  };

  const dim = sizeMap[size];

  // SVG graphic for the iconic 3D PromptNova "P" with cosmic orbital trail & star
  const EmblemSvg = (
    <svg
      viewBox="0 0 160 160"
      width={dim.box}
      height={dim.box}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_2px_8px_rgba(147,51,234,0.35)]"
    >
      <defs>
        {/* Left vertical pillar 3D face */}
        <linearGradient id="pn_stem_left" x1="20" y1="30" x2="60" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Stem inner 3D facet */}
        <linearGradient id="pn_stem_facet" x1="40" y1="70" x2="70" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        {/* Outer sweeping P loop */}
        <linearGradient id="pn_loop_grad" x1="45" y1="20" x2="135" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="25%" stopColor="#2563eb" />
          <stop offset="55%" stopColor="#4f46e5" />
          <stop offset="78%" stopColor="#7c3aed" />
          <stop offset="92%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>

        {/* Orbital swoosh gradient */}
        <linearGradient id="pn_swoosh_grad" x1="50" y1="85" x2="140" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="40%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>

        {/* Star glow radial */}
        <radialGradient id="pn_star_glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background soft glow */}
      <circle cx="85" cy="75" r="55" fill="url(#pn_star_glow)" opacity="0.15" />

      {/* 1. Left Vertical 3D Beveled Stem */}
      <path
        d="M 38 42 L 58 42 L 58 126 L 38 126 Z"
        fill="url(#pn_stem_left)"
      />
      <path
        d="M 38 42 L 54 28 L 54 112 L 38 126 Z"
        fill="#0369a1"
        opacity="0.85"
      />
      <path
        d="M 58 72 L 72 86 L 72 126 L 58 126 Z"
        fill="url(#pn_stem_facet)"
      />

      {/* 2. Main 3D Curved Loop of the 'P' */}
      <path
        d="M 52 28 
           L 106 28 
           C 126 28, 142 44, 142 66 
           C 142 88, 126 102, 104 102 
           L 72 102 
           L 72 82 
           L 100 82 
           C 112 82, 120 75, 120 65 
           C 120 54, 112 48, 100 48 
           L 52 48 
           Z"
        fill="url(#pn_loop_grad)"
      />

      {/* 3. Deep inner shadow & 3D bevel contour */}
      <path
        d="M 58 48 
           L 102 48 
           C 114 48, 122 55, 122 65 
           C 122 75, 114 82, 102 82 
           L 72 82 
           L 78 88 
           L 104 88 
           C 120 88, 130 78, 130 65 
           C 130 52, 118 42, 102 42 
           L 58 42 Z"
        fill="#3b0764"
        opacity="0.55"
      />

      {/* 4. Dynamic Orbital Comet Swoosh Cutting Across */}
      <path
        d="M 46 84 
           C 66 84, 88 74, 112 56 
           C 126 45, 138 34, 144 24 
           C 134 32, 116 48, 92 64 
           C 72 77, 54 82, 46 84 Z"
        fill="url(#pn_swoosh_grad)"
        filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
      />

      {/* 5. Sparkling Nova Stars */}
      {/* Apex 4-point radiant Star */}
      <g transform="translate(144, 24)">
        <circle cx="0" cy="0" r="10" fill="url(#pn_star_glow)" opacity="0.6" />
        <path
          d="M 0 -13 Q 0 0 13 0 Q 0 0 0 13 Q 0 0 -13 0 Q 0 0 0 -13 Z"
          fill="#c084fc"
        />
        <path
          d="M 0 -7 Q 0 0 7 0 Q 0 0 0 7 Q 0 0 -7 0 Q 0 0 0 -7 Z"
          fill="#ffffff"
        />
      </g>

      {/* Secondary accent stars along trail */}
      <g transform="translate(112, 40)">
        <path
          d="M 0 -5 Q 0 0 5 0 Q 0 0 0 5 Q 0 0 -5 0 Q 0 0 0 -5 Z"
          fill="#ffffff"
        />
      </g>
      <g transform="translate(132, 52)">
        <path
          d="M 0 -4 Q 0 0 4 0 Q 0 0 0 4 Q 0 0 -4 0 Q 0 0 0 -4 Z"
          fill="#c084fc"
        />
      </g>
      <g transform="translate(150, 42)">
        <path
          d="M 0 -3.5 Q 0 0 3.5 0 Q 0 0 0 3.5 Q 0 0 -3.5 0 Q 0 0 0 -3.5 Z"
          fill="#a855f7"
        />
      </g>
    </svg>
  );

  if (variant === 'emblem-only' || !showText) {
    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {EmblemSvg}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {EmblemSvg}
      <div className="flex flex-col">
        <div className={`font-extrabold tracking-tight leading-none flex items-center ${dim.text}`}>
          <span className="text-slate-100 font-black">Prompt</span>
          <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent font-black ml-0.5">
            Nova
          </span>
        </div>
        <span className={`font-mono text-cyan-400 font-bold tracking-widest uppercase mt-0.5 ${dim.sub}`}>
          TEAM PROMPT NOVA
        </span>
      </div>
    </div>
  );
};
