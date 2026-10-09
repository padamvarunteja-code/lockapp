import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { ArrowLeft, Search, UserPlus, Check, Clock, Loader2 } from 'lucide-react';

interface SearchResult {
  id: string;
  username: string;
  connectionStatus: 'accepted' | 'pending_sent' | 'pending_received' | null;
}

interface SearchScreenProps {
  onBack: () => void;
  onOpenChatWithContact?: (contact: any) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await apiRequest<{ results: SearchResult[] }>(
        `/api/connections/search?q=${encodeURIComponent(query.trim())}`
      );
      setResults(data.results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (user: SearchResult) => {
    setRequestingId(user.id);
    try {
      await apiRequest('/api/connections/request', {
        method: 'POST',
        body: JSON.stringify({ recipientId: user.id }),
      });

      // Update state locally
      setResults((prev) =>
        prev.map((r) => (r.id === user.id ? { ...r, connectionStatus: 'pending_sent' } : r))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to send request');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07060B] text-neutral-100 overflow-hidden selection:bg-purple-900/60 selection:text-purple-200">
      {/* Top Bar */}
      <div className="p-4 bg-[#140E24]/90 backdrop-blur border-b border-purple-900/40 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#18122B] border border-purple-900/40 flex items-center justify-center text-purple-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
          OnlyUs • Search Users
        </span>
      </div>

      {/* Search Input */}
      <div className="p-4">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exact username..."
            className="w-full pl-10 pr-24 py-3 bg-[#140E24] border border-purple-900/50 focus:border-purple-400 rounded-2xl text-sm text-white placeholder-purple-300/40 outline-none transition-all font-mono"
          />
          <Search size={16} className="absolute left-3.5 top-3.5 text-purple-400/60" />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-40 text-xs font-medium text-white rounded-xl transition-all cursor-pointer shadow-md shadow-purple-950/50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        <p className="text-[11px] text-purple-300/60 mt-2 px-1">
          Exact or partial username matching. No profiles, bios, or photos exist.
        </p>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {results.length === 0 && query && !loading && (
          <div className="text-center py-12 text-purple-300/60 text-xs">
            No users found matching &ldquo;{query}&rdquo;
          </div>
        )}

        <div className="flex flex-col gap-2">
          {results.map((u) => (
            <div
              key={u.id}
              className="p-3.5 bg-[#140E24]/85 border border-purple-900/40 rounded-2xl flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#20153B] border border-purple-800/50 flex items-center justify-center text-xs font-mono font-semibold text-purple-300">
                  @
                </div>
                <div>
                  <div className="text-sm font-semibold text-white tracking-tight font-mono">
                    {u.username}
                  </div>
                  <div className="text-[10px] text-purple-300/60">Private Identifier</div>
                </div>
              </div>

              {/* Status Action */}
              <div>
                {u.connectionStatus === 'accepted' ? (
                  <span className="flex items-center gap-1 text-xs text-purple-300 bg-[#251842] border border-purple-700/40 px-2.5 py-1 rounded-full">
                    <Check size={12} />
                    Connected
                  </span>
                ) : u.connectionStatus === 'pending_sent' ? (
                  <span className="flex items-center gap-1 text-xs text-purple-300 bg-[#251842] border border-purple-700/40 px-2.5 py-1 rounded-full font-mono">
                    <Clock size={12} />
                    Request Sent
                  </span>
                ) : u.connectionStatus === 'pending_received' ? (
                  <span className="text-xs text-purple-200 bg-[#18122B] border border-purple-900/40 px-2.5 py-1 rounded-full">
                    Sent You Request
                  </span>
                ) : (
                  <button
                    onClick={() => handleSendRequest(u)}
                    disabled={requestingId === u.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 text-xs font-medium text-white rounded-xl transition-all cursor-pointer shadow-md shadow-purple-950/50"
                  >
                    {requestingId === u.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UserPlus size={12} />
                    )}
                    <span>Connect</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
