export interface User {
  id: string;
  username: string;
  hasVaultPin?: boolean;
}

export interface ConnectionContact {
  connectionId: string;
  contactId: string;
  contactUsername: string;
  conversationId: string;
  connectedAt: number;
  lastMessage?: {
    createdAt: number;
    expiresAt: number;
  };
}

export interface PendingRequest {
  id: string;
  requesterId?: string;
  requesterUsername?: string;
  recipientId?: string;
  recipientUsername?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  created_at: number;
  expires_at: number;
  decryptedText?: string;
}

export interface VaultItem {
  id: string;
  user_id: string;
  file_name: string;
  media_type: 'photo' | 'video';
  mime_type: string;
  file_size: number;
  iv: string;
  salt: string;
  created_at: number;
  decryptedBlobUrl?: string;
}
