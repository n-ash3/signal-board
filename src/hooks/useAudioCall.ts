import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AudioParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  muted: boolean;
}

interface UseAudioCallOptions {
  roomId: string;
  username: string;
  avatarUrl?: string | null;
}

interface OfferPayload {
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

interface AnswerPayload {
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

interface IcePayload {
  from: string;
  to: string;
  candidate: RTCIceCandidateInit;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useAudioCall({ roomId, username, avatarUrl = null }: UseAudioCallOptions) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<AudioParticipant[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signalChannelRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const roomIdRef = useRef(roomId);
  const leaveCallRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const getOrCreateAudioElement = useCallback((remoteUserId: string) => {
    const existing = remoteAudioElementsRef.current.get(remoteUserId);
    if (existing) return existing;

    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    remoteAudioElementsRef.current.set(remoteUserId, audio);
    return audio;
  }, []);

  const removeAudioElement = useCallback((remoteUserId: string) => {
    const audio = remoteAudioElementsRef.current.get(remoteUserId);
    if (!audio) return;
    audio.pause();
    audio.srcObject = null;
    audio.remove();
    remoteAudioElementsRef.current.delete(remoteUserId);
  }, []);

  const removePeer = useCallback((remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId);
    if (peer) {
      peer.close();
      peersRef.current.delete(remoteUserId);
    }
    pendingIceRef.current.delete(remoteUserId);
    removeAudioElement(remoteUserId);
  }, [removeAudioElement]);

  const broadcast = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const channel = signalChannelRef.current;
    if (!channel) return;
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const createPeerConnection = useCallback((remoteUserId: string) => {
    const existing = peersRef.current.get(remoteUserId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      const audio = getOrCreateAudioElement(remoteUserId);
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      void audio.play().catch(() => {
        // Playback may require user gesture on some browsers.
      });
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate || !user) return;
      void broadcast('ice-candidate', {
        from: user.id,
        to: remoteUserId,
        candidate: event.candidate.toJSON(),
      });
    };

    peer.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        removePeer(remoteUserId);
      }
    };

    peersRef.current.set(remoteUserId, peer);
    return peer;
  }, [broadcast, getOrCreateAudioElement, removePeer, user?.id]);

  const drainPendingIce = useCallback(async (remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId);
    if (!peer) return;
    const pending = pendingIceRef.current.get(remoteUserId) || [];
    if (pending.length === 0) return;

    for (const candidate of pending) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error('Failed to apply pending ICE candidate:', err);
      }
    }
    pendingIceRef.current.delete(remoteUserId);
  }, []);

  const maybeCreateOffer = useCallback(async (remoteUserId: string) => {
    if (!user || !isInCall) return;
    // Deterministic initiator avoids dual offers/glare.
    if (user.id > remoteUserId) return;

    const peer = createPeerConnection(remoteUserId);
    if (peer.signalingState !== 'stable') return;

    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
    });
    await peer.setLocalDescription(offer);
    await broadcast('offer', {
      from: user.id,
      to: remoteUserId,
      sdp: offer,
    });
  }, [broadcast, createPeerConnection, isInCall, user]);

  const leaveCall = useCallback(async () => {
    if (user && (isInCall || signalChannelRef.current)) {
      await broadcast('leave', { from: user.id });
    }

    const signalChannel = signalChannelRef.current;
    if (signalChannel) {
      try {
        await signalChannel.untrack();
      } catch (err) {
        console.error('Failed to untrack call presence:', err);
      }
      supabase.removeChannel(signalChannel);
      signalChannelRef.current = null;
    }

    peersRef.current.forEach((_, remoteUserId) => {
      removePeer(remoteUserId);
    });
    peersRef.current.clear();

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setParticipants([]);
    setIsInCall(false);
    setIsJoining(false);
    setIsMicMuted(false);
  }, [broadcast, isInCall, removePeer, user]);

  useEffect(() => {
    leaveCallRef.current = leaveCall;
  }, [leaveCall]);

  const joinCall = useCallback(async () => {
    if (!user || isInCall || isJoining) return;
    setError(null);
    setIsJoining(true);

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = localStream;

      const signalChannel = supabase.channel(`audio-call:${roomIdRef.current}`, {
        config: { presence: { key: user.id } },
      });

      signalChannel
        .on('presence', { event: 'sync' }, () => {
          const state = signalChannel.presenceState();
          const nextParticipants: AudioParticipant[] = [];

          Object.entries(state).forEach(([id, metas]: [string, any]) => {
            const latest = metas?.[metas.length - 1];
            if (!latest) return;
            nextParticipants.push({
              userId: id,
              username: latest.username || 'Unknown',
              avatarUrl: latest.avatar_url || null,
              muted: Boolean(latest.muted),
            });
          });

          nextParticipants.sort((a, b) => a.username.localeCompare(b.username));
          setParticipants(nextParticipants);

          const remoteUserIds = nextParticipants
            .map((p) => p.userId)
            .filter((id) => id !== user.id);

          // Remove stale peers that are no longer in the room.
          peersRef.current.forEach((_, remoteUserId) => {
            if (!remoteUserIds.includes(remoteUserId)) {
              removePeer(remoteUserId);
            }
          });

          // Try creating outbound offers for currently connected peers.
          remoteUserIds.forEach((remoteUserId) => {
            if (!peersRef.current.has(remoteUserId)) {
              void maybeCreateOffer(remoteUserId);
            }
          });
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }: { payload: OfferPayload }) => {
          if (!payload || payload.to !== user.id) return;
          const peer = createPeerConnection(payload.from);
          await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await drainPendingIce(payload.from);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await broadcast('answer', { from: user.id, to: payload.from, sdp: answer });
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }: { payload: AnswerPayload }) => {
          if (!payload || payload.to !== user.id) return;
          const peer = peersRef.current.get(payload.from);
          if (!peer) return;
          await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await drainPendingIce(payload.from);
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: { payload: IcePayload }) => {
          if (!payload || payload.to !== user.id) return;
          const peer = peersRef.current.get(payload.from);
          if (!peer || !peer.remoteDescription) {
            const pending = pendingIceRef.current.get(payload.from) || [];
            pending.push(payload.candidate);
            pendingIceRef.current.set(payload.from, pending);
            return;
          }
          try {
            await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (err) {
            console.error('Failed adding ICE candidate:', err);
          }
        })
        .on('broadcast', { event: 'leave' }, async ({ payload }: { payload: { from?: string } }) => {
          const remoteId = payload?.from;
          if (!remoteId) return;
          removePeer(remoteId);
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            signalChannelRef.current = signalChannel;
            await signalChannel.track({
              user_id: user.id,
              username,
              avatar_url: avatarUrl,
              muted: false,
              joined_at: new Date().toISOString(),
            });
            setIsInCall(true);
            setIsJoining(false);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError('Unable to connect to audio room.');
            setIsJoining(false);
            await leaveCallRef.current();
          }
        });
    } catch (err: any) {
      const msg = err?.message || 'Could not access your microphone.';
      setError(msg);
      setIsJoining(false);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    }
  }, [
    avatarUrl,
    broadcast,
    createPeerConnection,
    drainPendingIce,
    isInCall,
    isJoining,
    maybeCreateOffer,
    removePeer,
    user,
    username,
  ]);

  const toggleMic = useCallback(async () => {
    const localStream = localStreamRef.current;
    if (!localStream || !user || !signalChannelRef.current) return;
    const nextMuted = !isMicMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMicMuted(nextMuted);
    await signalChannelRef.current.track({
      user_id: user.id,
      username,
      avatar_url: avatarUrl,
      muted: nextMuted,
      joined_at: new Date().toISOString(),
    });
  }, [avatarUrl, isMicMuted, user, username]);

  useEffect(() => {
    return () => {
      if (signalChannelRef.current || localStreamRef.current || peersRef.current.size > 0) {
        void leaveCallRef.current();
      }
    };
  }, []);

  return {
    participants,
    isInCall,
    isJoining,
    isMicMuted,
    error,
    joinCall,
    leaveCall,
    toggleMic,
  };
}
