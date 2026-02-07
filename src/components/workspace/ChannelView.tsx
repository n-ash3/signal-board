import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import { Hash } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

interface MessageWithProfile extends Message {
  profiles?: { username: string; avatar_url: string | null } | null;
}

interface ChannelViewProps {
  channelId: string;
  channelName: string;
  workspaceId: string;
}

const ChannelView = ({ channelId, channelName, workspaceId }: ChannelViewProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch profile for the new message
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

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
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
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <header className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{channelName}</h2>
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
            <MessageItem key={msg.id} message={msg} currentUserId={user?.id} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={handleSendMessage} channelName={channelName} />
    </div>
  );
};

export default ChannelView;
