/**
 * useWebRTC.js — Complete Rewrite
 *
 * Key fixes:
 *  1. trickle: true  → fixes black screen for 3rd+ participants
 *  2. pendingSignals → handles signals arriving before peer is created
 *  3. replaceTrack   → fixes screen share showing avatar
 *  4. destroyPeer    → proper cleanup on leave/disconnect
 *  5. cleanupAll     → stops all tracks + destroys peers on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import socket from '../socket/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

/**
 * @param {string} roomId
 * @param {string} username
 * @param {boolean} initialMicOn
 * @param {boolean} initialCameraOn
 */
export function useWebRTC(roomId, username, initialMicOn = true, initialCameraOn = true) {
  // ── Refs (no re-render on change) ─────────────────────────────────────────
  const localStreamRef   = useRef(null);
  const screenStreamRef  = useRef(null);
  const peersRef         = useRef({});
  // peersRef.current = { [socketId]: { peer, username, stream } }
  const pendingSignals   = useRef({});
  // pendingSignals.current = { [socketId]: [signal, ...] }

  // ── State (triggers re-render) ────────────────────────────────────────────
  const [localStream, setLocalStream]       = useState(null);
  const [peers, setPeers]                   = useState([]);
  // peers = [{ socketId, username, stream, isMuted, isCameraOff, isHandRaised }]
  const [isMuted, setIsMuted]               = useState(!initialMicOn);
  const [isCameraOff, setIsCameraOff]       = useState(!initialCameraOn);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUser, setScreenSharingUser] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [participants, setParticipants]     = useState([]);
  const [reactions, setReactions]           = useState([]);
  const [captions, setCaptions]             = useState({});
  const [unreadCount, setUnreadCount]       = useState(0);
  const [isConnecting, setIsConnecting]     = useState(true);
  const chatOpenRef = useRef(false);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ── HELPER: Create a SimplePeer connection ─────────────────────────────────
  const createPeer = useCallback(
    (targetSocketId, targetUsername, isInitiator) => {
      console.log(
        `[webrtc] Creating peer for ${targetUsername} (${targetSocketId}), initiator: ${isInitiator}`
      );

      if (!localStreamRef.current) {
        console.error('[webrtc] No local stream when creating peer!');
        return null;
      }

      // Don't create duplicate peers
      if (peersRef.current[targetSocketId]) {
        console.warn(`[webrtc] Peer already exists for ${targetSocketId}, skipping`);
        return peersRef.current[targetSocketId].peer;
      }

      const peer = new SimplePeer({
        initiator: isInitiator,
        stream: localStreamRef.current,
        trickle: true,   // ← CRITICAL FIX: false caused black screen with 3+ peers
        config: ICE_SERVERS,
      });

      // ── Signal: send our SDP / ICE candidate to the other peer ──
      peer.on('signal', (signal) => {
        console.log(
          `[webrtc] Sending signal to ${targetUsername}: ${signal.type || 'candidate'}`
        );
        socket.emit('signal', {
          signal,
          to: targetSocketId,
          from: socket.id,
          username,
        });
      });

      // ── Stream: received remote video/audio ──
      peer.on('stream', (remoteStream) => {
        console.log(
          `[webrtc] ✅ Got stream from ${targetUsername}:`,
          `video tracks: ${remoteStream.getVideoTracks().length}`,
          `audio tracks: ${remoteStream.getAudioTracks().length}`
        );

        if (peersRef.current[targetSocketId]) {
          peersRef.current[targetSocketId].stream = remoteStream;
        }

        setPeers((prev) =>
          prev.map((p) =>
            p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
          )
        );
      });

      // ── Track: individual track added (screen share updates) ──
      peer.on('track', (track, stream) => {
        console.log(`[webrtc] Track from ${targetUsername}: ${track.kind}`);

        if (peersRef.current[targetSocketId]) {
          peersRef.current[targetSocketId].stream = stream;
        }

        setPeers((prev) =>
          prev.map((p) =>
            p.socketId === targetSocketId ? { ...p, stream } : p
          )
        );
      });

      peer.on('connect', () => {
        console.log(`[webrtc] ✅ Connected to ${targetUsername}`);
      });

      peer.on('error', (err) => {
        console.error(`[webrtc] Peer error with ${targetUsername}:`, err.message);
      });

      peer.on('close', () => {
        console.log(`[webrtc] Peer closed: ${targetUsername}`);
      });

      // Store peer in ref
      peersRef.current[targetSocketId] = {
        peer,
        username: targetUsername,
        stream: null,
      };

      // Add to peers state (avoid duplicates)
      setPeers((prev) => {
        const exists = prev.find((p) => p.socketId === targetSocketId);
        if (exists) return prev;
        return [
          ...prev,
          {
            socketId: targetSocketId,
            username: targetUsername,
            stream: null,
            isMuted: false,
            isCameraOff: false,
            isHandRaised: false,
          },
        ];
      });

      // Process any signals that arrived before peer was created
      if (pendingSignals.current[targetSocketId]) {
        console.log(
          `[webrtc] Processing ${pendingSignals.current[targetSocketId].length} pending signals for ${targetUsername}`
        );
        pendingSignals.current[targetSocketId].forEach((sig) => {
          try {
            peer.signal(sig);
          } catch (e) {
            console.error('[webrtc] Pending signal error:', e);
          }
        });
        delete pendingSignals.current[targetSocketId];
      }

      return peer;
    },
    [username]
  );

  // ── HELPER: Destroy a peer connection ─────────────────────────────────────
  const destroyPeer = useCallback((socketId) => {
    const peerData = peersRef.current[socketId];
    if (peerData) {
      try {
        if (!peerData.peer.destroyed) {
          peerData.peer.destroy();
        }
      } catch (e) {
        console.error('[webrtc] destroyPeer error:', e);
      }
      delete peersRef.current[socketId];
    }
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  // ── INIT: Get media stream ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const initMedia = async () => {
      try {
        console.log('[webrtc] Requesting user media...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        console.log('[webrtc] Got local stream:', stream.id);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Apply initial mic/camera state
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = initialMicOn;
        if (videoTrack) videoTrack.enabled = initialCameraOn;

        setIsConnecting(false);
      } catch (err) {
        console.error('[webrtc] getUserMedia failed:', err);
        if (isMounted) {
          setIsConnecting(false);
          showToast(
            err.name === 'NotAllowedError'
              ? 'Camera/microphone permission denied'
              : 'Could not access camera/mic',
            'error'
          );
        }
      }
    };

    initMedia();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount — initialMicOn/initialCameraOn are intentionally read once

  // ── SOCKET: Join room once stream is ready ─────────────────────────────────
  useEffect(() => {
    if (!localStream) return; // Wait for stream first

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join-room', { roomId, username });
    console.log('[webrtc] Emitted join-room:', roomId);
  }, [localStream, roomId, username]);

  // ── SOCKET EVENTS ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStream) return; // Don't attach events until stream is ready

    // ── all-users: people already in the room when YOU join ──
    const onAllUsers = (users) => {
      console.log('[socket] all-users:', users);
      users.forEach(({ socketId, username: uname }) => {
        if (socketId !== socket.id) {
          createPeer(socketId, uname, true); // We initiate
        }
      });
    };

    // ── user-joined: someone joins AFTER you ──
    const onUserJoined = ({ socketId, username: uname }) => {
      console.log('[socket] user-joined:', uname, socketId);
      if (socketId === socket.id) return;
      createPeer(socketId, uname, false); // They initiate
      showToast(`${uname} joined the meeting`, 'info');
      // System message in chat
      setMessages((prev) => [
        ...prev,
        {
          isSystem: true,
          text: `${uname} joined the meeting`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: Date.now(),
        },
      ]);
    };

    // ── signal: receive WebRTC signal (offer / answer / candidate) ──
    const onSignal = ({ signal, from, username: uname }) => {
      console.log(`[socket] Signal from ${uname} (${from}): ${signal.type || 'candidate'}`);
      const peerData = peersRef.current[from];

      if (peerData && !peerData.peer.destroyed) {
        try {
          peerData.peer.signal(signal);
        } catch (e) {
          console.error('[socket] peer.signal() error:', e);
        }
      } else {
        // Peer not created yet — queue the signal
        console.log(`[socket] Peer not ready for ${uname}, queuing signal`);
        if (!pendingSignals.current[from]) {
          pendingSignals.current[from] = [];
        }
        pendingSignals.current[from].push(signal);
      }
    };

    // ── user-left: someone left the meeting ──
    const onUserLeft = ({ socketId, username: uname }) => {
      console.log('[socket] user-left:', uname, socketId);
      destroyPeer(socketId);
      showToast(`${uname} left the meeting`, 'info');
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      setScreenSharingUser((prev) =>
        prev?.socketId === socketId ? null : prev
      );
      // System message
      setMessages((prev) => [
        ...prev,
        {
          isSystem: true,
          text: `${uname} left the meeting`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: Date.now(),
        },
      ]);
    };

    // ── room-users: full participant list update ──
    const onRoomUsers = (users) => {
      console.log('[socket] room-users:', users);
      setParticipants(
        users
          .filter((u) => u.socketId !== socket.id)
          .map((u) => ({ ...u }))
      );
    };

    // ── receive-message: chat message from others ──
    const onReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, { ...msg, isOwn: false }]);
      if (!chatOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    // ── user-mute-status ──
    const onUserMuteStatus = ({ socketId, isMuted: muted }) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isMuted: muted } : p))
      );
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isMuted: muted } : p))
      );
    };

    // ── user-camera-status ──
    const onUserCameraStatus = ({ socketId, isCameraOff: off }) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isCameraOff: off } : p))
      );
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isCameraOff: off } : p))
      );
    };

    // ── user-screen-sharing ──
    const onUserScreenSharing = ({ socketId, username: uname }) => {
      setScreenSharingUser({ socketId, username: uname });
      showToast(`${uname} is sharing their screen 🖥️`, 'info');
    };

    // ── user-stopped-sharing ──
    const onUserStoppedSharing = ({ socketId, username: uname }) => {
      setScreenSharingUser((prev) =>
        prev?.socketId === socketId ? null : prev
      );
      showToast(`${uname} stopped sharing their screen`, 'info');
    };

    // ── user-raised-hand ──
    const onUserRaisedHand = ({ socketId, username: uname }) => {
      showToast(`${uname} raised their hand ✋`, 'info');
      setPeers((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isHandRaised: true } : p))
      );
    };

    // ── user-lowered-hand ──
    const onUserLoweredHand = ({ socketId: loweredId }) => {
      setPeers((prev) =>
        prev.map((p) => (p.socketId === loweredId ? { ...p, isHandRaised: false } : p))
      );
    };

    // ── receive-reaction ──
    const onReceiveReaction = ({ emoji, username: uname }) => {
      const id = Date.now() + Math.random();
      const left = `${15 + Math.random() * 70}%`;
      setReactions((prev) => [...prev, { id, emoji, username: uname, left }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    };

    // ── receive-caption ──
    const onReceiveCaption = ({ socketId, username: uname, text }) => {
      setCaptions((prev) => {
        if (!text) {
          const updated = { ...prev };
          delete updated[socketId];
          return updated;
        }
        return { ...prev, [socketId]: { text, username: uname } };
      });
    };

    // Register all event listeners
    socket.on('all-users', onAllUsers);
    socket.on('user-joined', onUserJoined);
    socket.on('signal', onSignal);
    socket.on('user-left', onUserLeft);
    socket.on('room-users', onRoomUsers);
    socket.on('receive-message', onReceiveMessage);
    socket.on('user-mute-status', onUserMuteStatus);
    socket.on('user-camera-status', onUserCameraStatus);
    socket.on('user-screen-sharing', onUserScreenSharing);
    socket.on('user-stopped-sharing', onUserStoppedSharing);
    socket.on('user-raised-hand', onUserRaisedHand);
    socket.on('user-lowered-hand', onUserLoweredHand);
    socket.on('receive-reaction', onReceiveReaction);
    socket.on('receive-caption', onReceiveCaption);

    return () => {
      socket.off('all-users', onAllUsers);
      socket.off('user-joined', onUserJoined);
      socket.off('signal', onSignal);
      socket.off('user-left', onUserLeft);
      socket.off('room-users', onRoomUsers);
      socket.off('receive-message', onReceiveMessage);
      socket.off('user-mute-status', onUserMuteStatus);
      socket.off('user-camera-status', onUserCameraStatus);
      socket.off('user-screen-sharing', onUserScreenSharing);
      socket.off('user-stopped-sharing', onUserStoppedSharing);
      socket.off('user-raised-hand', onUserRaisedHand);
      socket.off('user-lowered-hand', onUserLoweredHand);
      socket.off('receive-reaction', onReceiveReaction);
      socket.off('receive-caption', onReceiveCaption);
    };
  }, [localStream, createPeer, destroyPeer, showToast]);

  // ── CLEANUP: Stop all tracks and destroy peers ─────────────────────────────
  const cleanupAll = useCallback(() => {
    console.log('[webrtc] === CLEANUP ALL STARTED ===');

    // STEP 1: Stop local camera/mic tracks (turns off camera LED)
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log(`[webrtc] Stopping ${tracks.length} local tracks`);
      tracks.forEach((track) => {
        track.enabled = false; // disable before stopping
        track.stop();
        console.log(`[webrtc] Stopped local ${track.kind}: ${track.label}`);
      });
      localStreamRef.current = null;
    }
    // Clear state so VideoTile drops srcObject reference
    setLocalStream(null);

    // STEP 2: Stop screen share tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
        console.log('[webrtc] Stopped screen track');
      });
      screenStreamRef.current = null;
    }

    // STEP 3: Destroy all peer connections
    const peerIds = Object.keys(peersRef.current);
    console.log(`[webrtc] Destroying ${peerIds.length} peer(s)`);
    peerIds.forEach((sid) => {
      try {
        if (!peersRef.current[sid].peer.destroyed) {
          peersRef.current[sid].peer.destroy();
          console.log('[webrtc] Peer destroyed:', sid);
        }
      } catch { /* ignore */ }
    });
    peersRef.current = {};
    pendingSignals.current = {};

    // STEP 4: Notify server then disconnect
    if (socket.connected) {
      socket.emit('leave-room', { roomId, username });
      console.log('[webrtc] leave-room emitted');
    }
    socket.disconnect();

    console.log('[webrtc] === CLEANUP ALL DONE ===');
  }, [roomId, username]);

  // ── CONTROLS ───────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMuted(muted);
      socket.emit('mute-status', { roomId, isMuted: muted, username });
    }
  }, [roomId, username]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const off = !videoTrack.enabled;
      setIsCameraOff(off);
      socket.emit('camera-status', { roomId, isCameraOff: off, username });
    }
  }, [roomId, username]);

  // Ref so startScreenShare can call stopScreenShare without a forward-reference
  const stopScreenShareRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      console.log('[webrtc] Starting screen share...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      screenStreamRef.current = screenStream;

      // Replace the video track in ALL existing peer connections
      for (const [sid, peerData] of Object.entries(peersRef.current)) {
        try {
          const pc = peerData.peer._pc; // Access underlying RTCPeerConnection
          if (!pc) {
            console.warn('[webrtc] No _pc for peer:', sid);
            continue;
          }
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenVideoTrack);
            console.log('[webrtc] Replaced video track for peer:', sid);
          } else {
            pc.addTrack(screenVideoTrack, screenStream);
            console.log('[webrtc] Added screen track for peer:', sid);
          }
        } catch (err) {
          console.error('[webrtc] replaceTrack error for', sid, ':', err);
        }
      }

      // Update local video to show screen
      setLocalStream(screenStream);
      localStreamRef.current = screenStream;

      setIsScreenSharing(true);
      setScreenSharingUser({ socketId: socket.id, username });
      socket.emit('screen-share-started', { roomId, username, socketId: socket.id });

      // Handle when user clicks browser's "Stop sharing" button.
      // Use a ref to avoid forward-reference to stopScreenShare.
      screenVideoTrack.onended = () => {
        stopScreenShareRef.current?.();
      };

      console.log('[webrtc] Screen share started');
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[webrtc] getDisplayMedia error:', err);
        showToast('Screen sharing failed', 'error');
      } else {
        console.log('[webrtc] Screen share cancelled by user');
      }
    }
  }, [roomId, username, showToast]);

  const stopScreenShare = useCallback(async () => {
    try {
      console.log('[webrtc] Stopping screen share...');

      // Get camera stream back
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      const cameraVideoTrack = cameraStream.getVideoTracks()[0];

      // Apply current camera enabled state
      cameraVideoTrack.enabled = !isCameraOff;

      // Restore camera track in all peers
      for (const [sid, peerData] of Object.entries(peersRef.current)) {
        try {
          const pc = peerData.peer._pc;
          if (!pc) continue;
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(cameraVideoTrack);
            console.log('[webrtc] Restored camera track for peer:', sid);
          }
        } catch (err) {
          console.error('[webrtc] Camera restore error for', sid, ':', err);
        }
      }

      // Stop screen stream tracks
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      // Restore local stream ref/state (keep original audio track)
      if (localStreamRef.current && localStreamRef.current !== cameraStream) {
        const oldAudio = localStreamRef.current.getAudioTracks()[0];
        if (oldAudio) {
          cameraStream.removeTrack(cameraStream.getAudioTracks()[0]);
          cameraStream.addTrack(oldAudio);
        }
      }
      localStreamRef.current = cameraStream;
      setLocalStream(cameraStream);

      setIsScreenSharing(false);
      setScreenSharingUser(null);
      socket.emit('screen-share-stopped', { roomId, username });

      console.log('[webrtc] Screen share stopped, camera restored');
    } catch (err) {
      console.error('[webrtc] stopScreenShare error:', err);
    }
  }, [roomId, username, isCameraOff]);

  // Keep the ref current after every render so startScreenShare.onended always
  // calls the latest stopScreenShare without a forward-reference.
  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  });

  const sendMessage = useCallback(
    (text) => {
      if (!text.trim()) return;
      const msg = {
        text,
        username,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now(),
        isOwn: true,
      };
      socket.emit('send-message', { roomId, ...msg });
      setMessages((prev) => [...prev, msg]);
    },
    [roomId, username]
  );

  const sendReaction = useCallback(
    (emoji) => {
      socket.emit('send-reaction', { roomId, emoji, username });
      // Local reaction
      const id = Date.now() + Math.random();
      const left = `${15 + Math.random() * 70}%`;
      setReactions((prev) => [...prev, { id, emoji, username, left }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 3000);
    },
    [roomId, username]
  );

  const raiseHand = useCallback(
    (isRaised) => {
      socket.emit(isRaised ? 'raise-hand' : 'lower-hand', { roomId, username });
    },
    [roomId, username]
  );

  const sendCaption = useCallback(
    (text) => {
      socket.emit('caption-update', { roomId, username, text });
    },
    [roomId, username]
  );

  const setChatOpen = useCallback((open) => {
    chatOpenRef.current = open;
    if (open) setUnreadCount(0);
  }, []);

  // ── Handle browser tab close / refresh ────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      socket.emit('leave-room', { roomId, username });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, username]);

  // ── meeting-ended event (host ended for all) ──────────────────────────────
  useEffect(() => {
    const onMeetingEnded = ({ by }) => {
      showToast(`${by} ended the meeting for everyone`, 'warning');
    };
    socket.on('meeting-ended', onMeetingEnded);
    return () => socket.off('meeting-ended', onMeetingEnded);
  }, [showToast]);

  return {
    // State
    localStream,
    localStreamRef,
    screenStreamRef,
    peers,
    isMuted,
    isCameraOff,
    isScreenSharing,
    screenSharingUser,
    messages,
    participants,
    reactions,
    captions,
    unreadCount,
    isConnecting,
    toasts,
    // Actions
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    sendMessage,
    sendReaction,
    raiseHand,
    sendCaption,
    setChatOpen,
    cleanupAll,
    showToast,
  };
}