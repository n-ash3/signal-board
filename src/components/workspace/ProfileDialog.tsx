import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Camera, User } from 'lucide-react';

export default function ProfileDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, bio')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
      setBio(data.bio || '');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        // If bucket doesn't exist, fall back to URL input
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
          toast.error('Avatar storage not set up. Use a URL instead.');
          setUploading(false);
          return;
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now());
      toast.success('Photo uploaded!');
    } catch (err: any) {
      console.error(err);
      toast.error('Upload failed — try pasting an image URL instead');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !username.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          avatar_url: avatarUrl.trim() || null,
          bio: bio.trim() || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Profile updated!');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const displayName = username || user?.email?.split('@')[0] || 'User';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-white/10">
          <Avatar className="h-6 w-6">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{displayName}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-indigo-600 text-white text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-6 w-6 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {uploading && <span className="text-xs text-slate-400">Uploading...</span>}
          </div>

          {/* Avatar URL fallback */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Profile Picture URL</Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="bg-slate-700 border-slate-600 text-white text-sm"
            />
            <p className="text-[10px] text-slate-500">Upload above or paste an image URL</p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your display name"
              className="bg-slate-700 border-slate-600 text-white text-sm"
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-md px-3 py-2 outline-none focus:border-indigo-500 resize-none"
              rows={3}
              maxLength={200}
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Email</Label>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
