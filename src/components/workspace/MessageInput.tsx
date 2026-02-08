import { useState, useRef } from 'react';
import { Send, Smile, ImageIcon, AtSign, Bold, Italic, Paperclip } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';

interface MessageInputProps {
  onSend: (content: string) => void;
  channelName: string;
  onTyping?: () => void;
}

const MessageInput = ({ onSend, channelName, onTyping }: MessageInputProps) => {
  const [value, setValue] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onTyping?.();
  };

  const insertEmoji = (emoji: string) => {
    const textarea = inputRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = value.substring(0, start) + emoji + value.substring(end);
      setValue(newVal);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setValue(prev => prev + emoji);
    }
    setShowEmoji(false);
  };

  const sendGif = (gifUrl: string) => {
    onSend(gifUrl);
    setShowGif(false);
  };

  return (
    <div className="px-5 pb-4 pt-2 shrink-0">
      <div className="rounded-lg bg-input border border-border focus-within:border-primary/50 transition-colors">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 pt-2 pb-1">
          <div className="relative">
            <button
              onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
              className={`p-1.5 rounded transition-colors ${showEmoji ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={insertEmoji}
                onClose={() => setShowEmoji(false)}
                position="top"
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
              className={`p-1.5 rounded transition-colors ${showGif ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
              title="GIF"
            >
              <span className="text-xs font-bold">GIF</span>
            </button>
            {showGif && <GifPicker onSelect={sendGif} onClose={() => setShowGif(false)} />}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <button
            onClick={() => {
              const textarea = inputRef.current;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selected = value.substring(start, end);
                const newVal = value.substring(0, start) + `**${selected || 'text'}**` + value.substring(end);
                setValue(newVal);
                textarea.focus();
              }
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => {
              const textarea = inputRef.current;
              if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selected = value.substring(start, end);
                const newVal = value.substring(0, start) + `_${selected || 'text'}_` + value.substring(end);
                setValue(newVal);
                textarea.focus();
              }
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => {
              const textarea = inputRef.current;
              if (textarea) {
                const start = textarea.selectionStart;
                const newVal = value.substring(0, start) + '@' + value.substring(start);
                setValue(newVal);
                textarea.focus();
              }
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Mention"
          >
            <AtSign className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Text input */}
        <div className="flex items-end gap-2 px-3 pb-2">
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[24px] max-h-[120px]"
            style={{ lineHeight: '24px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="text-primary disabled:text-muted-foreground transition-colors shrink-0 p-1 hover:bg-primary/10 rounded"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
