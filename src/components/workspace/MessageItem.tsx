import { Zap } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

interface MessageWithProfile extends Message {
  profiles?: { username: string; avatar_url: string | null } | null;
}

interface MessageItemProps {
  message: MessageWithProfile;
  currentUserId?: string;
}

const MessageItem = ({ message, currentUserId }: MessageItemProps) => {
  const isSignal = message.is_signal;
  const username = message.profiles?.username || 'Unknown';
  const avatarUrl = message.profiles?.avatar_url || null;
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSignal) {
    return (
      <div className="flex items-start gap-3 py-2 px-3 my-1 rounded-lg bg-signal/5 border border-signal/20 animate-fade-in-up">
        <div className="h-8 w-8 rounded-full bg-signal/20 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="h-4 w-4 text-signal" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-signal uppercase tracking-wide">Signal</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <p className="text-sm text-foreground/90 mt-0.5">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors group">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={username} />
        ) : null}
        <AvatarFallback className="bg-primary/20 text-primary text-xs">
          {username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">{username}</span>
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
        </div>
        <p className="text-sm text-foreground/85 leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
};

export default MessageItem;
