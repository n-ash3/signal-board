import { useState, useRef, useEffect } from 'react';
import { Zap, MessageSquare, Smile, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import EmojiPicker, { QuickReactionBar } from './EmojiPicker';
import type { Tables } from '@/integrations/supabase/types';

type Message = Tables<'messages'>;

interface MessageWithProfile extends Message {
  profiles?: { username: string; avatar_url: string | null } | null;
  reactions?: { emoji: string; count: number; reacted: boolean }[];
}

interface MessageItemProps {
  message: MessageWithProfile;
  currentUserId?: string;
  onOpenThread?: (message: MessageWithProfile) => void;
}

const MessageItem = ({ message, currentUserId, onOpenThread }: MessageItemProps) => {
  const isSignal = message.is_signal;
  const isOwn = message.user_id === currentUserId;
  const username = message.profiles?.username || 'Unknown';
  const avatarUrl = message.profiles?.avatar_url || null;
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isDeleted = !!(message as any).deleted_at;
  const isEdited = !!(message as any).edited_at;
  const isGif = message.content.match(/\.(gif|webp)(\?|$)/i);

  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number; reacted: boolean }[]>(
    message.reactions || []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch reactions on mount
  useEffect(() => {
    fetchReactions();
  }, [message.id]);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('message_reactions')
      .select('emoji, user_id')
      .eq('message_id', message.id);

    if (data) {
      const emojiMap = new Map<string, { count: number; reacted: boolean }>();
      data.forEach(r => {
        const existing = emojiMap.get(r.emoji) || { count: 0, reacted: false };
        existing.count++;
        if (r.user_id === currentUserId) existing.reacted = true;
        emojiMap.set(r.emoji, existing);
      });
      setReactions(
        Array.from(emojiMap.entries()).map(([emoji, data]) => ({
          emoji,
          ...data,
        }))
      );
    }
  };

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;

    const existing = reactions.find(r => r.emoji === emoji && r.reacted);
    if (existing) {
      // Remove reaction
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', message.id)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji);
    } else {
      // Add reaction
      await supabase.from('message_reactions').insert({
        message_id: message.id,
        user_id: currentUserId,
        emoji,
      });
    }
    fetchReactions();
    setShowReactionPicker(false);
    setShowEmojiPicker(false);
  };

  const handleEdit = async () => {
    if (!editText.trim() || editText === message.content) {
      setIsEditing(false);
      return;
    }
    await supabase
      .from('messages')
      .update({ content: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', message.id);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await supabase
      .from('messages')
      .update({ content: '(message deleted)', deleted_at: new Date().toISOString() })
      .eq('id', message.id);
    setShowMenu(false);
  };

  // Click outside to close menu
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (isDeleted) {
    return (
      <div className="flex items-start gap-3 py-1.5 px-2 opacity-50">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">?</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground italic">Message deleted</p>
        </div>
      </div>
    );
  }

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
    <div
      className="relative flex items-start gap-3 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactionPicker(false); }}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
        <AvatarFallback className="bg-primary/20 text-primary text-xs">
          {username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">{username}</span>
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
          {isEdited && <span className="text-[10px] text-muted-foreground">(edited)</span>}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-input border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
              rows={2}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Press Enter to save, Escape to cancel</span>
              <button onClick={handleEdit} className="ml-auto p-0.5 text-primary hover:text-primary/80">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : isGif ? (
          <img src={message.content} alt="GIF" className="mt-1 max-w-[300px] max-h-[250px] rounded-lg" loading="lazy" />
        ) : (
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{message.content}</p>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => toggleReaction(r.emoji)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                  r.reacted
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-accent/50 border-border text-foreground/70 hover:border-primary/30'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
            <button
              onClick={() => setShowEmojiPicker(true)}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Smile className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Thread indicator */}
        {(message as any).thread_count > 0 && (
          <button
            onClick={() => onOpenThread?.(message)}
            className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            <span className="font-medium">{(message as any).thread_count} {(message as any).thread_count === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Action bar (hover) */}
      {showActions && !isEditing && (
        <div className="absolute -top-3 right-2 flex items-center gap-0.5 p-0.5 bg-card border border-border rounded-md shadow-md z-10 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Quick react */}
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="React"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>

          {/* Thread reply */}
          <button
            onClick={() => onOpenThread?.(message)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Reply in thread"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* More actions */}
          {isOwn && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="More"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-md shadow-lg z-20 py-1 animate-in fade-in-0 zoom-in-95 duration-100">
                  <button
                    onClick={() => { setIsEditing(true); setShowMenu(false); setShowActions(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit message
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete message
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reaction picker */}
      {showReactionPicker && (
        <div className="absolute -top-10 right-2 z-20">
          <QuickReactionBar onSelect={toggleReaction} />
        </div>
      )}

      {/* Full emoji picker */}
      {showEmojiPicker && (
        <div className="absolute left-16 z-30">
          <EmojiPicker
            onSelect={toggleReaction}
            onClose={() => setShowEmojiPicker(false)}
            position="top"
          />
        </div>
      )}
    </div>
  );
};

export default MessageItem;
