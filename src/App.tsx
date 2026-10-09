/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OnlyUsLogoIcon } from './components/branding/OnlyUsLogoIcon';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import { VaultProvider } from './context/VaultContext';
import { AndroidFrame } from './components/AndroidFrame';
import { CallModals } from './components/CallModals';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { HomeScreen } from './screens/HomeScreen';
import { TestAccountsModal } from './screens/TestAccountsModal';
import { AdminPanelModal } from './screens/AdminPanelModal';
import { GetAppModal } from './screens/GetAppModal';

function AppContent() {
  const { user, loading } = useAuth();
  const [unauthScreen, setUnauthScreen] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [showTestModal, setShowTestModal] = useState(false);
  const [showGetAppModal, setShowGetAppModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(
    typeof window !== 'undefined' && window.location.hash === '#admin'
  );

  React.useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') {
        setShowAdminModal(true);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#07060B] text-neutral-100 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-[#18122B] border border-purple-900/50 flex items-center justify-center shadow-2xl animate-pulse">
          <OnlyUsLogoIcon size={38} variant="glow" />
        </div>
        <span className="text-xs text-purple-300 font-mono tracking-wider">OnlyUs • Connecting</span>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <HomeScreen />
      ) : unauthScreen === 'login' ? (
        <LoginScreen
          onBack={() => setUnauthScreen('welcome')}
          onGoRegister={() => setUnauthScreen('register')}
        />
      ) : unauthScreen === 'register' ? (
        <RegisterScreen
          onBack={() => setUnauthScreen('welcome')}
          onGoLogin={() => setUnauthScreen('login')}
        />
      ) : (
        <WelcomeScreen
          onGoLogin={() => setUnauthScreen('login')}
          onGoRegister={() => setUnauthScreen('register')}
          onOpenTestAccounts={() => setShowTestModal(true)}
          onOpenAdmin={() => setShowAdminModal(true)}
          onOpenGetApp={() => setShowGetAppModal(true)}
        />
      )}

      {/* Get OnlyUs: use in browser or download the Android APK */}
      {showGetAppModal && (
        <GetAppModal
          onClose={() => setShowGetAppModal(false)}
          onContinueInBrowser={() => {
            setShowGetAppModal(false);
            setUnauthScreen('login');
          }}
        />
      )}

      {/* Global WebRTC Voice & Video Overlays */}
      <CallModals />

      {/* Test Accounts Quick Switcher (Development & Testing only) */}
      {import.meta.env.DEV && showTestModal && <TestAccountsModal onClose={() => setShowTestModal(false)} />}

      {/* High-Security Admin Panel */}
      {showAdminModal && <AdminPanelModal onClose={() => setShowAdminModal(false)} />}
    </>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen bg-[#07060B]">
      <AuthProvider>
        <CallProvider>
          <VaultProvider>
            <AndroidFrame>
              <AppContent />
            </AndroidFrame>
          </VaultProvider>
        </CallProvider>
      </AuthProvider>
    </div>
  );
}
