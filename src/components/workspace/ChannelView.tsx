import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import ThreadView from './ThreadView';
import TypingIndicator, { useTypingBroadcast } from './TypingIndicator';
import { Hash, Pin, Pencil, X, Check } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

interface MessageWithProfile extends Message {
  profiles?: { username: string; avatar_url: string | null } | null;
}

interface ChannelViewProps {
  channelId: string;
  channelName: string;
  workspaceId: string;
  onMarkRead?: () => void;
}

const ChannelView = ({ channelId, channelName, workspaceId, onMarkRead }: ChannelViewProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<MessageWithProfile | null>(null);
  const [topic, setTopic] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [username, setUsername] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current user's username for typing indicator
  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('username').eq('user_id', user.id).single().then(({ data }) => {
        if (data) setUsername(data.username);
      });
    }
  }, [user]);

  const { startTyping, stopTyping } = useTypingBroadcast(channelId, username);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Mark channel as read
  const markRead = useCallback(async () => {
    if (!user) return;
    await supabase.from('channel_reads').upsert(
      { channel_id: channelId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: 'channel_id,user_id' }
    );
    onMarkRead?.();
  }, [channelId, user, onMarkRead]);

  useEffect(() => {
    fetchMessages();
    fetchTopic();
    markRead();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            // Only show top-level messages (no parent_id)
            if ((newMsg as any).parent_id) return;
            
            if (newMsg.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('user_id', newMsg.user_id)
                .single();
              setMessages(prev => [...prev, { ...newMsg, profiles: profile }]);
            } else {
              setMessages(prev => [...prev, { ...newMsg, profiles: null }]);
            }
            markRead();
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchTopic = async () => {
    const { data } = await supabase
      .from('channels')
      .select('topic')
      .eq('id', channelId)
      .single();
    if (data) setTopic(data.topic || '');
  };

  const saveTopic = async () => {
    await supabase.from('channels').update({ topic: topicDraft }).eq('id', channelId);
    setTopic(topicDraft);
    setEditingTopic(false);
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('parent_id', null) // Only top-level messages
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && data) {
      const userIds = [...new Set(data.filter(m => m.user_id).map(m => m.user_id!))];
      let pMap: Record<string, { username: string; avatar_url: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', userIds);
        if (profiles) {
          pMap = Object.fromEntries(profiles.map(p => [p.user_id, { username: p.username, avatar_url: p.avatar_url }]));
        }
      }

      setMessages(data.map(m => ({
        ...m,
        profiles: m.user_id ? pMap[m.user_id] || null : null,
      })));
    }
    setLoading(false);
  };

  const handleSendMessage = async (content: string) => {
    if (!user || !content.trim()) return;
    stopTyping();
    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: user.id,
      content: content.trim(),
    });
    if (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Channel header */}
        <header className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
            <h2 className="text-lg font-semibold text-foreground">{channelName}</h2>

            {/* Pinned indicator */}
            <button
              onClick={() => setShowPinned(!showPinned)}
              className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              title="Pinned messages"
            >
              <Pin className="h-4 w-4" />
            </button>
          </div>

          {/* Topic */}
          <div className="mt-0.5 flex items-center gap-1 min-h-[20px]">
            {editingTopic ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  placeholder="Set a topic..."
                  className="flex-1 bg-transparent text-xs text-muted-foreground outline-none border-b border-primary/30 py-0.5"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTopic();
                    if (e.key === 'Escape') setEditingTopic(false);
                  }}
                  maxLength={200}
                />
                <button onClick={saveTopic} className="text-primary p-0.5"><Check className="h-3 w-3" /></button>
                <button onClick={() => setEditingTopic(false)} className="text-muted-foreground p-0.5"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setTopicDraft(topic); setEditingTopic(true); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
              >
                {topic || 'Add a topic...'}
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Hash className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">This is the start of <span className="font-semibold">#{channelName}</span></p>
              <p className="text-sm text-muted-foreground mt-1">Send a message to get started</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUserId={user?.id}
                onOpenThread={(m) => setActiveThread(m)}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        <TypingIndicator channelId={channelId} />

        {/* Input */}
        <MessageInput
          onSend={handleSendMessage}
          channelName={channelName}
          onTyping={startTyping}
        />
      </div>

      {/* Thread panel */}
      {activeThread && (
        <ThreadView
          parentMessage={activeThread}
          channelId={channelId}
          onClose={() => setActiveThread(null)}
        />
      )}
    </div>
  );
};

export default ChannelView;
