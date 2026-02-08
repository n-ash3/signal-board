import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { X, MessageSquare, Send } from 'lucide-react';

interface ThreadMessage {
  id: string;
  content: string;
  user_id: string | null;
  created_at: string;
  is_signal: boolean;
  profiles?: { username: string; avatar_url: string | null } | null;
}

interface ThreadViewProps {
  parentMessage: {
    id: string;
    content: string;
    user_id: string | null;
    created_at: string;
    profiles?: { username: string; avatar_url: string | null } | null;
  };
  channelId: string;
  onClose: () => void;
}

const ThreadView = ({ parentMessage, channelId, onClose }: ThreadViewProps) => {
  const { user } = useAuth();
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReplies();

    const channel = supabase
      .channel(`thread:${parentMessage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `parent_id=eq.${parentMessage.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', newMsg.user_id)
              .single();
            setReplies(prev => [...prev, { ...newMsg, profiles: profile }]);
          } else {
            setReplies(prev => [...prev, { ...newMsg, profiles: null }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentMessage.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const fetchReplies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('parent_id', parentMessage.id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
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

      setReplies(data.map(m => ({
        ...m,
        profiles: m.user_id ? pMap[m.user_id] || null : null,
      })));
    }
    setLoading(false);
  };

  const sendReply = async () => {
    if (!user || !replyText.trim()) return;
    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: user.id,
      content: replyText.trim(),
      parent_id: parentMessage.id,
    });
    if (!error) setReplyText('');
  };

  const parentUsername = parentMessage.profiles?.username || 'Unknown';
  const parentAvatar = parentMessage.profiles?.avatar_url;
  const parentTime = new Date(parentMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-[360px] border-l border-border flex flex-col h-full bg-background animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Thread</h3>
          <span className="text-xs text-muted-foreground">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-border bg-accent/20">
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            {parentAvatar ? <AvatarImage src={parentAvatar} alt={parentUsername} /> : null}
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {parentUsername.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-foreground">{parentUsername}</span>
              <span className="text-[10px] text-muted-foreground">{parentTime}</span>
            </div>
            <p className="text-sm text-foreground/85 mt-0.5">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No replies yet. Start the conversation!
          </div>
        ) : (
          replies.map((reply) => {
            const username = reply.profiles?.username || 'Unknown';
            const avatar = reply.profiles?.avatar_url;
            const time = new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={reply.id} className="flex items-start gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  {avatar ? <AvatarImage src={avatar} alt={username} /> : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">{username}</span>
                    <span className="text-[10px] text-muted-foreground">{time}</span>
                  </div>
                  {reply.content.match(/\.(gif|webp)(\?|$)/i) ? (
                    <img src={reply.content} alt="GIF" className="mt-1 max-w-[200px] rounded-md" />
                  ) : (
                    <p className="text-sm text-foreground/85">{reply.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="px-4 pb-3 pt-2 border-t border-border shrink-0">
        <div className="flex items-end gap-2 rounded-lg bg-input border border-border px-3 py-2 focus-within:border-primary/50 transition-colors">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendReply();
              }
            }}
            placeholder="Reply..."
            rows={1}
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[20px] max-h-[80px]"
          />
          <button onClick={sendReply} disabled={!replyText.trim()} className="text-primary disabled:text-muted-foreground transition-colors shrink-0 p-0.5">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadView;
