import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MessageInput from './MessageInput';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare } from 'lucide-react';

interface DMMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  senderName?: string;
  senderAvatar?: string | null;
}

interface DirectMessageViewProps {
  dmChannelId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
}

const DirectMessageView = ({ dmChannelId, otherUserName, otherUserAvatar }: DirectMessageViewProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileMap, setProfileMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    isInitialLoad.current = true;
    fetchMessages();

    // Subscribe to new DMs - use channel_id column
    const channel = supabase
      .channel(`dm:${dmChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `channel_id=eq.${dmChannelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as DMMessage;
          // Fetch sender profile if not cached
          let profile = profileMap[newMsg.user_id];
          if (!profile) {
            const { data } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', newMsg.user_id)
              .single();
            if (data) {
              profile = data;
              setProfileMap(prev => ({ ...prev, [newMsg.user_id]: data }));
            }
          }
          setMessages(prev => [...prev, {
            ...newMsg,
            senderName: profile?.username || 'Unknown',
            senderAvatar: profile?.avatar_url || null,
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dmChannelId]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        setTimeout(() => scrollToBottom(true), 50);
        isInitialLoad.current = false;
      } else {
        scrollToBottom(false);
      }
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('channel_id', dmChannelId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && data) {
      const senderIds = [...new Set(data.map(m => m.user_id))];
      let pMap: Record<string, { username: string; avatar_url: string | null }> = {};

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url')
          .in('user_id', senderIds);
        if (profiles) {
          pMap = Object.fromEntries(profiles.map(p => [p.user_id, { username: p.username, avatar_url: p.avatar_url }]));
          setProfileMap(pMap);
        }
      }

      setMessages(data.map(m => ({
        ...m,
        senderName: pMap[m.user_id]?.username || 'Unknown',
        senderAvatar: pMap[m.user_id]?.avatar_url || null,
      })));
    }
    setLoading(false);
  };

  const handleSendMessage = async (content: string) => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from('direct_messages').insert({
      channel_id: dmChannelId,
      user_id: user.id,
      content: content.trim(),
    });
    if (error) {
      console.error('Failed to send DM:', error);
    }
  };

  const isGif = (content: string) => content.match(/\.(gif|webp)(\?|$)/i);

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div className="relative">
          <Avatar className="h-7 w-7">
            {otherUserAvatar ? (
              <AvatarImage src={otherUserAvatar} alt={otherUserName} />
            ) : null}
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {otherUserName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{otherUserName}</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Start a conversation with <span className="font-semibold">{otherUserName}</span></p>
          </div>
        ) : (
          messages.map((msg) => {
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={msg.id} className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors group">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  {msg.senderAvatar ? (
                    <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {(msg.senderName || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">{msg.senderName}</span>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
                  </div>
                  {isGif(msg.content) ? (
                    <img src={msg.content} alt="GIF" className="mt-1 max-w-[300px] max-h-[250px] rounded-lg" loading="lazy" />
                  ) : (
                    <p className="text-sm text-foreground/85 leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSendMessage} channelName={otherUserName} />
    </div>
  );
};

export default DirectMessageView;
