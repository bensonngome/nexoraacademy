import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  darkSurface?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, darkSurface = false }) => {
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 select-none">
      <img
        src="/assets/aistudio/IMG-20261122-WA0000_fa5b8039.jpg"
        alt="Nexora Digital Skills Academy logo"
        referrerPolicy="no-referrer"
        className={`h-10 w-10 rounded-lg object-cover shrink-0 border ${
          darkSurface ? 'border-slate-700' : 'border-amber-300/80 shadow-xs'
        }`}
      />
      <span className="flex flex-col leading-tight">
        <span
          className={`font-display text-base font-extrabold tracking-tight ${
            darkSurface ? 'text-white' : 'text-[#0B1F5B]'
          }`}
        >
          Nexora
        </span>
        {!compact && (
          <span
            className={`text-[11px] font-semibold tracking-wide ${
              darkSurface ? 'text-amber-300' : 'text-slate-600'
            }`}
          >
            Digital Skills Academy
          </span>
        )}
      </span>
    </span>
  );
};
