export type FriendKind = 'microsoft' | 'offline'
export type FriendStatus = 'pending_in' | 'pending_out' | 'accepted'

export interface Friend {
  id: string
  username: string
  kind: FriendKind
  uuid?: string | null
  status: FriendStatus
  created_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  from: string
  text?: string | null
  image?: string | null
  created_at: string
}

export interface ConversationView {
  id: string
  friend: Friend
  updated_at: string
  last_message?: ChatMessage | null
}
