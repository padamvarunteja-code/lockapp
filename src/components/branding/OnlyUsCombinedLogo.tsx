import React from 'react';
import { OnlyUsLogoIcon } from './OnlyUsLogoIcon';
import { OnlyUsWordmark } from './OnlyUsWordmark';

interface CombinedLogoProps {
  layout?: 'vertical' | 'horizontal';
  className?: string;
  showTagline?: boolean;
}

export const OnlyUsCombinedLogo: React.FC<CombinedLogoProps> = ({
  layout = 'vertical',
  className = '',
  showTagline = true,
}) => {
  if (layout === 'horizontal') {
    return (
      <div className={`flex items-center gap-4 select-none ${className}`}>
        <OnlyUsLogoIcon size={68} variant="glow" />
        <div className="flex flex-col">
          <div className="flex items-baseline tracking-tight">
            <span className="text-3xl font-medium tracking-tight text-white font-sans">
              Only
            </span>
            <span className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-violet-300 to-purple-100 font-sans ml-0.5">
              Us
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-1 mb-1 self-end inline-block"></span>
          </div>
          {showTagline && (
            <span className="text-[10px] uppercase font-sans tracking-[0.25em] text-purple-200/90 font-medium -mt-0.5">
              A space just for us
            </span>
          )}
        </div>
      </div>
    );
  }

  // Vertical Centered Master Lockup
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      <div className="relative mb-2">
        <OnlyUsLogoIcon size={130} variant="glow" />
      </div>
      <OnlyUsWordmark showTagline={showTagline} scale={0.9} />
    </div>
  );
};
