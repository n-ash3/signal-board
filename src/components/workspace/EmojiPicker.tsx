import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  },
  {
    name: 'Gestures',
    icon: '👋',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'],
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','💑','💏'],
  },
  {
    name: 'Objects',
    icon: '🎉',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🔥','⭐','🌟','💫','✨','⚡','💥','💢','💦','💧','🎵','🎶','🎤','🎧','📱','💻','⌨️','🖥️','📧','📝','📌','📎','🔑','🔒','🔓','🛠️','⚙️','🔔','📢','💡','📚','📖'],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🌶️','🫑','🌽','🥕','🫒','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🧀','🥚','🍳','🥞','🧇','🥓','🍔','🍟','🌭','🍕','🥪','🌮','🌯','🥙','🧆','🥗','🍜','🍝','🍣','🍱','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','🍮','🍯','☕','🍵','🧃','🥤','🍺','🍻','🥂','🍷','🧉'],
  },
  {
    name: 'Work',
    icon: '💼',
    emojis: ['💼','📁','📂','📊','📈','📉','📋','📌','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔑','🔨','⛏️','🔧','🔩','⚙️','🧰','🛡️','🔗','🧲','⏰','⏱️','⏲️','🕐','📅','📆','🗓️','📇','💰','💳','💵','💴','💶','💷','✅','❌','❓','❗','‼️','⁉️','✳️','❇️','🏷️','🔖','📩','📨','📧','💌','📮','📪','📫','📬','📭','📦','📯'],
  },
];

// Quick reactions bar
const QUICK_REACTIONS = ['👍','❤️','😂','🎉','🔥','👀','🚀','💯'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

const EmojiPicker = ({ onSelect, onClose, position = 'top' }: EmojiPickerProps) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(() => true) // Simple: show all when searching
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      ref={ref}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-50 w-[320px] bg-card border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-150`}
    >
      {/* Category tabs */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-border overflow-x-auto">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => { setActiveCategory(i); setSearch(''); }}
            className={`p-1.5 rounded text-base hover:bg-accent transition-colors shrink-0 ${
              activeCategory === i && !search ? 'bg-accent' : ''
            }`}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji..."
          className="w-full bg-input border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
      </div>

      {/* Emoji grid */}
      <div className="h-[200px] overflow-y-auto px-2 pb-2">
        <div className="grid grid-cols-8 gap-0.5">
          {filteredEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => { onSelect(emoji); onClose(); }}
              className="p-1.5 rounded text-lg hover:bg-accent transition-colors text-center leading-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Quick reaction bar for messages
export const QuickReactionBar = ({ onSelect }: { onSelect: (emoji: string) => void }) => {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-card border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="p-1 rounded text-sm hover:bg-accent transition-colors"
        >
          {emoji}
        </button>
      ))}
      <button className="p-1 rounded text-sm hover:bg-accent transition-colors text-muted-foreground">
        <Smile className="h-4 w-4" />
      </button>
    </div>
  );
};

export default EmojiPicker;
