import { useState, useRef } from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  channelName: string;
}

const MessageInput = ({ onSend, channelName }: MessageInputProps) => {
  const [value, setValue] = useState('');
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

  return (
    <div className="px-5 pb-4 pt-2 shrink-0">
      <div className="flex items-end gap-2 rounded-lg bg-input border border-border px-3 py-2 focus-within:border-primary/50 transition-colors">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none min-h-[24px] max-h-[120px]"
          style={{ lineHeight: '24px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="text-primary disabled:text-muted-foreground transition-colors shrink-0 p-1"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
