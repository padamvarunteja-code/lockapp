import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, ConnectionContact } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { apiRequest } from '../lib/api';
import { socketClient } from '../lib/socket';
import { decryptChatMessage, encryptChatMessage } from '../lib/crypto';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  Lock,
  Clock,
  ShieldCheck,
  Loader2,
  Info,
} from 'lucide-react';

interface ChatScreenProps {
  contact: ConnectionContact;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ contact, onBack }) => {
  const { user } = useAuth();
  const { startVoiceCall, startVideoCall } = useCall();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch messages and decrypt client-side
  const loadMessages = async () => {
    try {
      const data = await apiRequest<{ messages: ChatMessage[] }>(
        `/api/chat/conversations/${contact.conversationId}/messages`
      );

      const decrypted = await Promise.all(
        data.messages.map(async (msg) => {
          const text = await decryptChatMessage(msg.encrypted_content, contact.conversationId);
          return {
            ...msg,
            decryptedText: text,
          };
        })
      );

      setMessages(decrypted);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    // Listen for new real-time WebSocket messages
    const unsubscribe = socketClient.on('message:new', async (payload: any) => {
      const newMsg = payload.message as ChatMessage;
      if (newMsg && newMsg.conversation_id === contact.conversationId) {
        const text = await decryptChatMessage(newMsg.encrypted_content, contact.conversationId);
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, decryptedText: text }];
        });
      }
    });

    // Refresh every minute to update countdown badges and drop expired ones
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => m.expires_at > now));
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [contact.conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const rawText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // 1. Genuine client-side Web Crypto AES-256-GCM encryption
      const encryptedPayload = await encryptChatMessage(rawText, contact.conversationId);

      // 2. Submit ciphertext to server
      const res = await apiRequest<{ message: ChatMessage }>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: contact.conversationId,
          encryptedContent: encryptedPayload,
        }),
      });

      const fullMsg: ChatMessage = {
        ...res.message,
        decryptedText: rawText,
      };

      setMessages((prev) => [...prev, fullMsg]);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
      setInputText(rawText);
    } finally {
      setSending(false);
    }
  };

  const formatRemainingTime = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  const formatMessageTime = (createdAt: number) => {
    const d = new Date(createdAt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07060B] text-neutral-100 overflow-hidden selection:bg-purple-900/60 selection:text-purple-200">
      {/* Chat Top Bar */}
      <div className="h-16 px-4 bg-[#140E24]/90 backdrop-blur border-b border-purple-900/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#18122B] border border-purple-900/40 flex items-center justify-center text-purple-300 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white font-mono">
                @{contact.contactUsername}
              </span>
              <span className="text-[10px] bg-[#251842] text-purple-300 border border-purple-600/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Lock size={9} /> E2E
              </span>
            </div>
            <div className="text-[10px] text-purple-300/70 flex items-center gap-1">
              <Clock size={10} className="text-purple-400" />
              <span>24h auto-destruction active</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => startVoiceCall(contact.contactId, contact.contactUsername)}
            className="w-9 h-9 rounded-full bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Start Encrypted Voice Call"
          >
            <Phone size={16} />
          </button>
          <button
            onClick={() => startVideoCall(contact.contactId, contact.contactUsername)}
            className="w-9 h-9 rounded-full bg-[#18122B] hover:bg-[#251842] border border-purple-900/40 text-purple-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Start Encrypted Video Call"
          >
            <Video size={16} />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-8 h-8 rounded-full text-purple-300/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Security Details"
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* Security Architecture Info Dropdown */}
      {showInfo && (
        <div className="p-3 bg-[#140E24] border-b border-purple-900/50 text-xs text-purple-200/90 flex items-start gap-2.5 animate-fadeIn">
          <ShieldCheck size={16} className="text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-white">Guaranteed 24-Hour Expiration:</span> Every message is stamped with a trusted server timestamp and permanently purged from database disks after 24 hours. The server only holds ciphertext.
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="h-full flex items-center justify-center text-purple-300/60 gap-2">
            <Loader2 size={18} className="animate-spin text-purple-400" />
            <span className="text-xs">Decrypting channel messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-purple-300/70">
            <div className="w-12 h-12 rounded-2xl bg-[#140E24] border border-purple-900/50 flex items-center justify-center text-purple-300 mb-3 shadow-lg">
              <Lock size={22} />
            </div>
            <p className="text-xs font-medium text-white">Direct End-to-End Encrypted Channel</p>
            <p className="text-[11px] text-purple-300/70 mt-1 max-w-xs">
              Say hello to @{contact.contactUsername}. Messages sent here will automatically self-destruct 24 hours after arrival.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-xs shadow-purple-950/40'
                      : 'bg-[#18122B] border border-purple-900/40 text-purple-100 rounded-bl-xs'
                  }`}
                >
                  <p className="break-words leading-relaxed">{m.decryptedText}</p>
                </div>

                {/* Metadata & Expiration Timer */}
                <div className="flex items-center gap-1.5 text-[10px] text-purple-400/60 mt-1 px-1 font-mono">
                  <span>{formatMessageTime(m.created_at)}</span>
                  <span>•</span>
                  <span className="text-purple-300/80 flex items-center gap-0.5">
                    <Clock size={9} className="text-purple-400" />
                    {formatRemainingTime(m.expires_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-[#140E24]/90 border-t border-purple-900/40 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Encrypted message (disappears in 24h)..."
          className="flex-1 px-4 py-2.5 bg-[#07060B] border border-purple-900/50 focus:border-purple-400 rounded-full text-sm text-white placeholder-purple-300/40 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md shadow-purple-950/50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
};
