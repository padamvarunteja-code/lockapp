import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, getStoredToken } from '../lib/api';
import type { ConnectionContact, PendingRequest } from '../types';
import {
  MessageSquare,
  UserCheck,
  Lock,
  Settings,
  Search,
  Users,
  Check,
  X,
  Clock,
  Phone,
  Video,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { OnlyUsLogoIcon } from '../components/branding/OnlyUsLogoIcon';
import { useCall } from '../context/CallContext';
import { ChatScreen } from './ChatScreen';
import { SearchScreen } from './SearchScreen';
import { VaultView } from './VaultView';
import { SettingsScreen } from './SettingsScreen';
import { TestAccountsModal } from './TestAccountsModal';

export const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const { startVoiceCall, startVideoCall } = useCall();

  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'vault' | 'settings'>('chats');
  const [connections, setConnections] = useState<ConnectionContact[]>([]);
  const [pending, setPending] = useState<{ received: PendingRequest[]; sent: PendingRequest[] }>({
    received: [],
    sent: [],
  });
  const [loading, setLoading] = useState(false);

  // Active sub-views
  const [activeChatContact, setActiveChatContact] = useState<ConnectionContact | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const loadData = async () => {
    if (!getStoredToken()) return;
    setLoading(true);
    try {
      const [connsRes, pendingRes] = await Promise.all([
        apiRequest<{ connections: ConnectionContact[] }>('/api/connections/list'),
        apiRequest<{ received: PendingRequest[]; sent: PendingRequest[] }>('/api/connections/pending'),
      ]);
      setConnections(connsRes.connections);
      setPending(pendingRes);
    } catch (err: any) {
      if (err.message?.includes('Invalid or expired session') || err.message?.includes('Authentication required')) {
        // Auth expired, handled by custom event to transition view cleanly
        return;
      }
      console.warn('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (getStoredToken()) {
        loadData();
      }
    }, 10000); // 10s foreground update (no push notifications)
    return () => clearInterval(interval);
  }, []);

  const handleRespond = async (connectionId: string, action: 'accept' | 'reject') => {
    try {
      await apiRequest('/api/connections/respond', {
        method: 'POST',
        body: JSON.stringify({ connectionId, action }),
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to process request');
    }
  };

  // If currently inside a 1-to-1 Chat:
  if (activeChatContact) {
    return (
      <ChatScreen
        contact={activeChatContact}
        onBack={() => {
          setActiveChatContact(null);
          loadData();
        }}
      />
    );
  }

  // If currently inside Search Screen:
  if (showSearch) {
    return (
      <SearchScreen
        onBack={() => {
          setShowSearch(false);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#07060B] text-neutral-100 overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-4 bg-[#170914]/90 backdrop-blur border-b border-purple-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#20153B] border border-purple-600/40 flex items-center justify-center p-0.5 shadow-inner">
            <OnlyUsLogoIcon size={22} variant="flat" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white font-mono">
                @{user?.username}
              </span>
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-500/80 animate-pulse" title="Active foreground session" />
            </div>
            <div className="text-[10px] text-purple-200/80 font-mono">OnlyUs • 0 Notifications</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="w-9 h-9 rounded-full bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Search User by Username"
          >
            <Search size={16} />
          </button>

          <button
            onClick={() => setShowTestModal(true)}
            className="w-9 h-9 rounded-full bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Test Dual Users / Switch"
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chats' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                Direct Encrypted Chats
              </span>
              <span className="text-[10px] text-purple-300 font-mono">
                {connections.length} {connections.length === 1 ? 'Contact' : 'Contacts'}
              </span>
            </div>

            {loading && connections.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-purple-300/60 gap-2">
                <Loader2 size={18} className="animate-spin text-purple-400" />
                <span className="text-xs">Loading connections...</span>
              </div>
            ) : connections.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-purple-300/70">
                <div className="w-12 h-12 rounded-2xl bg-[#18122B] border border-purple-900/50 flex items-center justify-center text-purple-300 mb-3 shadow-lg">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-xs font-semibold text-white">No Connections Yet</h4>
                <p className="text-[11px] text-purple-300/70 mt-1 max-w-xs mb-4">
                  OnlyUs is a private sanctuary for you and your loved ones. Search for their username to connect privately.
                </p>
                <button
                  onClick={() => setShowSearch(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-950/50"
                >
                  <Search size={13} />
                  <span>Search Usernames</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.map((c) => (
                  <div
                    key={c.connectionId}
                    onClick={() => setActiveChatContact(c)}
                    className="p-3.5 bg-[#140E24]/85 hover:bg-[#250F21] border border-purple-900/40 hover:border-purple-600/50 rounded-2xl flex items-center justify-between transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#20153B] border border-purple-800/60 flex items-center justify-center text-xs font-mono font-bold text-purple-300 shadow-inner">
                        @
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white font-mono group-hover:text-purple-200 transition-colors">
                          @{c.contactUsername}
                        </div>
                        <div className="text-[11px] text-purple-300/70 flex items-center gap-1 font-mono mt-0.5">
                          <Lock size={10} className="text-purple-400" />
                          <span>E2E Channel</span>
                          {c.lastMessage && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-purple-300/80">
                                <Clock size={9} /> 24h timer
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startVoiceCall(c.contactId, c.contactUsername)}
                        className="w-8 h-8 rounded-xl bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 text-purple-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Start Voice Call"
                      >
                        <Phone size={14} />
                      </button>
                      <button
                        onClick={() => startVideoCall(c.contactId, c.contactUsername)}
                        className="w-8 h-8 rounded-xl bg-[#18122B] hover:bg-[#251842] border border-purple-900/50 text-purple-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Start Video Call"
                      >
                        <Video size={14} />
                      </button>
                      <ChevronRight size={16} className="text-purple-400/50 group-hover:text-purple-300 ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Incoming Requests */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Received Connection Requests ({pending.received.length})
                </span>
              </div>

              {pending.received.length === 0 ? (
                <div className="p-6 bg-[#140E24]/70 border border-purple-900/30 rounded-2xl text-center text-xs text-purple-300/60">
                  No pending received requests.
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.received.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 bg-[#140E24]/90 border border-purple-900/40 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#20153B] border border-purple-800/50 flex items-center justify-center text-xs font-mono font-bold text-purple-200">
                          @
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white font-mono">
                            @{req.requesterUsername}
                          </div>
                          <div className="text-[10px] text-purple-300/70">
                            Sent {new Date(req.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRespond(req.id, 'reject')}
                          className="w-8 h-8 rounded-xl bg-[#18122B] hover:bg-red-950/70 border border-purple-900/40 text-purple-300 hover:text-red-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="Reject"
                        >
                          <X size={15} />
                        </button>
                        <button
                          onClick={() => handleRespond(req.id, 'accept')}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 text-white rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-purple-950/50"
                          title="Accept"
                        >
                          <Check size={13} />
                          <span>Accept</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Requests */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-purple-300/80 uppercase tracking-wider">
                  Sent Requests ({pending.sent.length})
                </span>
              </div>

              {pending.sent.length === 0 ? (
                <div className="p-6 bg-[#140E24]/70 border border-purple-900/30 rounded-2xl text-center text-xs text-purple-300/60">
                  No outgoing requests pending.
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.sent.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 bg-[#140E24]/60 border border-purple-900/30 rounded-2xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-semibold text-white">
                          @{req.recipientUsername}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-purple-200 bg-[#2A1847] border border-purple-700/40 px-2 py-0.5 rounded-full font-mono">
                        <Clock size={11} />
                        Waiting for response
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'vault' && <VaultView />}

        {activeTab === 'settings' && <SettingsScreen />}
      </div>

      {/* Bottom Android Navigation Tabs */}
      <div className="h-16 bg-[#10091D]/95 backdrop-blur border-t border-purple-900/40 grid grid-cols-4 items-center shrink-0 px-2">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'chats' ? 'text-purple-300 font-medium' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px]">Chats</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors relative cursor-pointer ${
            activeTab === 'requests' ? 'text-purple-300 font-medium' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          <UserCheck size={18} />
          <span className="text-[10px]">Requests</span>
          {pending.received.length > 0 && (
            <span className="absolute top-1 right-6 w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-500/80" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'vault' ? 'text-purple-300 font-medium' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          <Lock size={18} />
          <span className="text-[10px]">Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
            activeTab === 'settings' ? 'text-purple-300 font-medium' : 'text-purple-300/50 hover:text-purple-200'
          }`}
        >
          <Settings size={18} />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>

      {/* Test helper modal */}
      {showTestModal && <TestAccountsModal onClose={() => { setShowTestModal(false); loadData(); }} />}
    </div>
  );
};
