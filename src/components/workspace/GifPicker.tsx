import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public Tenor API key
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

interface GifResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<GifResult[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Load trending on mount
  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&client_key=signal_app&limit=20&media_filter=gif,tinygif`
      );
      const data = await resp.json();
      setTrending(parseResults(data.results));
    } catch {
      // Silently fail - GIFs are a nice-to-have
    }
    setLoading(false);
  };

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) {
      setGifs([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${TENOR_BASE}/search?key=${TENOR_API_KEY}&client_key=signal_app&q=${encodeURIComponent(q)}&limit=20&media_filter=gif,tinygif`
      );
      const data = await resp.json();
      setGifs(parseResults(data.results));
    } catch {
      setGifs([]);
    }
    setLoading(false);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGifs(val), 400);
  };

  const parseResults = (results: any[]): GifResult[] => {
    if (!results) return [];
    return results.map(r => {
      const gif = r.media_formats?.gif || r.media_formats?.tinygif;
      const preview = r.media_formats?.tinygif || r.media_formats?.gif;
      return {
        id: r.id,
        title: r.title || '',
        url: gif?.url || '',
        preview: preview?.url || gif?.url || '',
        width: preview?.dims?.[0] || 200,
        height: preview?.dims?.[1] || 150,
      };
    }).filter(g => g.url);
  };

  const displayGifs = query.trim() ? gifs : trending;

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 z-50 w-[360px] bg-card border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-foreground">GIFs</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full bg-input border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            autoFocus
          />
        </div>
      </div>

      {/* GIF Grid */}
      <div className="h-[280px] overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayGifs.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            {query ? 'No GIFs found' : 'Search for GIFs'}
          </div>
        ) : (
          <div className="columns-2 gap-1.5">
            {displayGifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => { onSelect(gif.url); onClose(); }}
                className="mb-1.5 w-full rounded-md overflow-hidden hover:opacity-80 transition-opacity break-inside-avoid"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full h-auto rounded-md"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="px-3 py-1.5 border-t border-border text-center">
        <span className="text-[10px] text-muted-foreground">Powered by Tenor</span>
      </div>
    </div>
  );
};

export default GifPicker;
