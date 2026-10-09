import React from 'react';
import { Smartphone } from 'lucide-react';
import { OnlyUsLogoIcon } from '../components/branding/OnlyUsLogoIcon';

interface WelcomeScreenProps {
  onGoLogin: () => void;
  onGoRegister: () => void;
  onOpenTestAccounts: () => void;
  onOpenAdmin?: () => void;
  onOpenGetApp: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGoLogin,
  onGoRegister,
  onOpenTestAccounts,
  onOpenAdmin,
  onOpenGetApp,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-center p-6 sm:p-8 bg-[#07060B] text-neutral-100 overflow-y-auto selection:bg-purple-900/60 selection:text-purple-200">
      {/* Top Branding */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <OnlyUsLogoIcon size={32} variant="flat" />
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-lg text-white font-sans">
              OnlyUs
            </span>
            <span className="text-[9px] text-purple-200/90 font-mono tracking-wider uppercase -mt-1">
              A space just for us
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="text-xs bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 px-2.5 py-1.5 rounded-full text-purple-200 font-mono transition-colors cursor-pointer"
              title="SecOps Administration Panel"
            >
              SecOps
            </button>
          )}
          {import.meta.env.DEV && (
            <button
              onClick={onOpenTestAccounts}
              className="text-xs bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 px-3 py-1.5 rounded-full text-purple-200 font-mono transition-colors cursor-pointer"
              title="Development Testing Helper"
            >
              Quick Test
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons - Centered */}
      <div className="my-auto w-full max-w-sm mx-auto flex flex-col justify-center items-center gap-3">
        <button
          onClick={onGoRegister}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 active:scale-[0.99] text-white font-medium rounded-2xl shadow-lg shadow-purple-950/50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Create Account</span>
        </button>

        <button
          onClick={onGoLogin}
          className="w-full py-3.5 px-4 bg-[#18122B] hover:bg-[#251842] active:scale-[0.99] text-purple-200 font-medium rounded-2xl border border-purple-900/50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Log In</span>
        </button>

        <button
          onClick={onOpenGetApp}
          className="w-full py-3 px-4 bg-transparent hover:bg-[#18122B] active:scale-[0.99] text-purple-300/80 hover:text-purple-200 font-medium rounded-2xl border border-purple-900/40 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <Smartphone size={14} />
          <span>Get the Android App / Use in Browser</span>
        </button>
      </div>
    </div>
  );
};
