import { invoke } from '@tauri-apps/api/core'
import type { ChatMessage, ConversationView, Friend } from '~/types/social'

export const useSocialStore = defineStore('social', {
  state: () => ({
    friends: [] as Friend[],
    conversations: [] as ConversationView[],
    messages: {} as Record<string, ChatMessage[]>,
    mode: 'local' as 'local' | 'remote',
    loaded: false,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async ensureLoaded() {
      if (this.loaded || this.loading) return
      await this.refresh()
    },

    async refresh() {
      this.loading = true
      this.error = null
      try {
        const [mode, friends, conversations] = await Promise.all([
          invoke<string>('social_mode'),
          invoke<Friend[]>('social_list_friends'),
          invoke<ConversationView[]>('social_list_conversations'),
        ])
        this.mode = mode === 'remote' ? 'remote' : 'local'
        this.friends = friends
        this.conversations = conversations
        this.loaded = true
      } catch (e) {
        this.error = errorText(e)
      } finally {
        this.loading = false
      }
    },

    async addFriend(username: string, kind: 'microsoft' | 'offline') {
      const friend = await invoke<Friend>('social_add_friend', { args: { username, kind } })
      await this.refresh()
      return friend
    },

    async removeFriend(id: string) {
      await invoke('social_remove_friend', { id })
      await this.refresh()
    },

    async openConversation(friendId: string) {
      const conv = await invoke<ConversationView>('social_get_or_create_conversation', { friendId })
      await this.loadMessages(conv.id)
      await this.refresh()
      return conv
    },

    async loadMessages(conversationId: string) {
      const msgs = await invoke<ChatMessage[]>('social_list_messages', { conversationId, limit: 200 })
      this.messages = { ...this.messages, [conversationId]: msgs }
      return msgs
    },

    async sendMessage(conversationId: string, text?: string | null, imagePath?: string | null) {
      const msg = await invoke<ChatMessage>('social_send_message', {
        args: {
          conversation_id: conversationId,
          text: text ?? null,
          image_path: imagePath ?? null,
        },
      })
      const prev = this.messages[conversationId] ?? []
      this.messages = { ...this.messages, [conversationId]: [...prev, msg] }
      await this.refresh()
      return msg
    },
  },
})
