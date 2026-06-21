import {
  useEffect, useRef, useState, useCallback
} from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import SimplePeer from 'simple-peer'
import socket from '../../socket/socket'
import { useAuth } from '../../context/AuthContext'
import Loader from '../../components/Loader/Loader'
import VideoTile from '../../components/VideoTile/VideoTile'
import './Room.css'

const ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: "937b1cc1819bfc74abb1e2d5",
    credential: "Iecng+xD+Msuqxob",
  },
  {
    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
    username: "937b1cc1819bfc74abb1e2d5",
    credential: "Iecng+xD+Msuqxob",
  },
  {
    urls: "turn:standard.relay.metered.ca:443",
    username: "937b1cc1819bfc74abb1e2d5",
    credential: "Iecng+xD+Msuqxob",
  },
  {
    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
    username: "937b1cc1819bfc74abb1e2d5",
    credential: "Iecng+xD+Msuqxob",
  },
]

const Room = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const username = localStorage.getItem('username')
    || user?.username || user?.email?.split('@')[0]
    || 'Guest'

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)

  // ━━━━━━━━━━━━━━━━
  // REFS
  // ━━━━━━━━━━━━━━━━
  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const peersRef = useRef({})
  const pendingSignalsRef = useRef({})
  const isInitializedRef = useRef(false)
  const recognitionRef = useRef(null)
  const durationRef = useRef(0)

  // ━━━━━━━━━━━━━━━━
  // STATE
  // ━━━━━━━━━━━━━━━━
  const [peers, setPeers] = useState([])
  const [isMuted, setIsMuted] = useState(() => {
    return sessionStorage.getItem('isMuted') === 'true'
  })
  const [isCameraOff, setIsCameraOff] = useState(() => {
    return sessionStorage.getItem('cameraOff') === 'true'
  })
  const [isScreenSharing, setIsScreenSharing] =
    useState(false)
  const [messages, setMessages] = useState([])
  const [showChat, setShowChat] = useState(false)
  const [showParticipants, setShowParticipants] =
    useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const [duration, setDuration] = useState(0)
  const [screenSharingUser, setScreenSharingUser] =
    useState(null)
  const [captions, setCaptions] = useState({})
  const [myCaption, setMyCaption] = useState('')
  const [isCaptionOn, setIsCaptionOn] =
    useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState([])

  // Compatibility states for JSX
  const [localStream, setLocalStream] = useState(null)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [joinedMeeting, setJoinedMeeting] = useState(false)

  const isConnecting = !localStream

  // ━━━━━━━━━━━━━━━━
  // TOAST HELPER
  // ━━━━━━━━━━━━━━━━
  const showToast = useCallback((msg, type='info') => {
    const id = Date.now() + Math.random()
    setToasts(p => {
      const updated = [...p, { id, msg, message: msg, type }]
      if (updated.length > 5) {
        return updated.slice(updated.length - 5)
      }
      return updated
    })
    setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const copyMeetingLink = useCallback(() => {
    const link = window.location.href
    navigator.clipboard.writeText(link)
      .then(() => {
        showToast('Meeting link copied! Share it with others', 'success')
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = link
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        showToast('Link copied!', 'success')
      })
  }, [showToast])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CORE: CREATE PEER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const createPeer = useCallback((
    targetSocketId,
    targetUsername,
    isInitiator,
    initialMuted = false,
    initialCameraOff = false,
    initialHandRaised = false
  ) => {
    if (peersRef.current[targetSocketId]) {
      console.log(`[PEER] Already exists: ${targetUsername}`)
      return peersRef.current[targetSocketId].peer
    }

    if (!localStreamRef.current) {
      console.error('[PEER] No local stream!')
      return null
    }

    console.log(`[PEER] Creating for ${targetUsername} | initiator: ${isInitiator}`)

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: localStreamRef.current,
      trickle: true,
      config: {
        iceServers: ICE_SERVERS
      },
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }
    })

    peer.on('signal', signal => {
      console.log(`[SIGNAL] Sending to ${targetUsername}:`, signal.type || 'candidate')
      socket.emit('signal', {
        signal,
        to: targetSocketId,
        from: socket.id,
        username
      })
    })

    peer.on('stream', remoteStream => {
      console.log(`[STREAM] Received from ${targetUsername}`)
      if (peersRef.current[targetSocketId]) {
        peersRef.current[targetSocketId].stream = remoteStream
      }

      setPeers(prev => prev.map(p =>
        p.socketId === targetSocketId
          ? { ...p, stream: remoteStream }
          : p
      ))
    })

    peer.on('track', (track, stream) => {
      console.log(`[TRACK] From ${targetUsername}: ${track.kind}`)
      if (peersRef.current[targetSocketId]) {
        peersRef.current[targetSocketId].stream = stream
      }

      setPeers(prev => prev.map(p =>
        p.socketId === targetSocketId
          ? { ...p, stream }
          : p
      ))
    })

    peer.on('connect', () => {
      console.log(`[PEER] ✅ Connected: ${targetUsername}`)
    })

    peer.on('error', err => {
      console.error(`[PEER] Error ${targetUsername}:`, err.message)
    })

    peer.on('close', () => {
      console.log(`[PEER] Closed: ${targetUsername}`)
    })

    peersRef.current[targetSocketId] = {
      peer,
      username: targetUsername,
      stream: null
    }

    setPeers(prev => {
      const exists = prev.find(p => p.socketId === targetSocketId)
      if (exists) return prev
      return [...prev, {
        socketId: targetSocketId,
        username: targetUsername,
        stream: null,
        isMuted: initialMuted,
        isCameraOff: initialCameraOff,
        isHandRaised: initialHandRaised
      }]
    })

    const pending = pendingSignalsRef.current[targetSocketId]
    if (pending?.length > 0) {
      console.log(`[PEER] Processing ${pending.length} pending signals for ${targetUsername}`)
      pending.forEach(sig => {
        try {
          if (!peer.destroyed) peer.signal(sig)
        } catch (e) {
          console.error('[PEER] Pending signal error:', e)
        }
      })
      delete pendingSignalsRef.current[targetSocketId]
    }

    return peer
  }, [username])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CORE: DESTROY PEER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const destroyPeer = useCallback(socketId => {
    const peerData = peersRef.current[socketId]
    if (peerData) {
      try {
        if (!peerData.peer.destroyed) {
          peerData.peer.destroy()
        }
      } catch (err) {
        console.warn('[PEER] Destroy error:', err.message)
      }
      delete peersRef.current[socketId]
    }

    setPeers(prev => prev.filter(p => p.socketId !== socketId))
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CORE: CLEANUP ALL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const cleanupAll = useCallback(() => {
    console.log('[CLEANUP] Starting...')

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach(track => {
          track.stop()
          track.enabled = false
          console.log(`[CLEANUP] Stopped: ${track.kind}`)
        })
      localStreamRef.current = null
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
      localVideoRef.current.pause()
    }

    if (screenStreamRef.current) {
      screenStreamRef.current
        .getTracks()
        .forEach(t => t.stop())
      screenStreamRef.current = null
    }

    Object.keys(peersRef.current).forEach(sid => {
      try {
        const { peer } = peersRef.current[sid]
        if (!peer.destroyed) peer.destroy()
        console.log('[CLEANUP] Peer destroyed:', sid)
      } catch (err) {
        console.warn(`[CLEANUP] Peer destroy error for ${sid}:`, err.message)
      }
    })
    peersRef.current = {}
    pendingSignalsRef.current = {}

    setPeers([])

    if (socket.connected) {
      socket.emit('leave-room', { roomId, username })
    }
    socket.disconnect()

    console.log('[CLEANUP] Complete ✅')
  }, [roomId, username])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CORE: LEAVE MEETING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const leaveMeeting = useCallback(() => {
    console.log('=== LEAVE BUTTON CLICKED ===')

    // STEP 1: Stop camera/mic IMMEDIATELY
    // This must happen FIRST
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks()
      console.log('Found tracks to stop:', tracks.length)
      
      tracks.forEach(track => {
        track.stop()
        console.log('STOPPED:', track.kind, track.label)
      })
      
      localStreamRef.current = null
    } else {
      console.log('WARNING: localStreamRef was null!')
    }

    // STEP 2: Stop screen share if any
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }

    // STEP 3: Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    // STEP 4: Destroy peers
    Object.values(peersRef.current).forEach(({ peer }) => {
      try {
        if (!peer.destroyed) peer.destroy()
      } catch (err) {
        console.warn('Peer destroy error:', err)
      }
    })
    peersRef.current = {}

    // STEP 5: Tell server
    socket.emit('leave-room', { roomId, username })
    socket.disconnect()

    console.log('=== CLEANUP DONE - NAVIGATING NOW ===')

    // STEP 6: Navigate LAST (after everything above)
    navigate('/dashboard')
  }, [roomId, username, navigate])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INIT: Get media then join room
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (isInitializedRef.current) return
    isInitializedRef.current = true

    const initRoom = async () => {
      try {
        console.log('[INIT] Getting media...')

        const stream = await
          navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user'
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          })

        console.log('[INIT] Got stream:', stream.id)

        // Apply sessionStorage preferences immediately to tracks
        const initialMute = sessionStorage.getItem('isMuted') === 'true'
        const initialCameraOff = sessionStorage.getItem('cameraOff') === 'true'

        stream.getAudioTracks().forEach(track => {
          track.enabled = !initialMute
        })
        stream.getVideoTracks().forEach(track => {
          track.enabled = !initialCameraOff
        })

        localStreamRef.current = stream
        setLocalStream(stream)

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.muted = true
          localVideoRef.current.playsInline = true
          try {
            await localVideoRef.current.play()
          } catch (e) {
            console.log('[INIT] Play error:', e)
          }
        }

        console.log('[INIT] Connecting socket...')
        if (!socket.connected) {
          socket.connect()
          await new Promise(resolve => {
            if (socket.connected) {
              resolve()
            } else {
              socket.once('connect', resolve)
            }
          })
        }

        console.log('[INIT] Joining room:', roomId)
        socket.emit('join-room', {
          roomId,
          username,
          isMuted: initialMute,
          isCameraOff: initialCameraOff,
          isHandRaised: false
        })

      } catch (err) {
        console.error('[INIT] Error:', err)
        if (err.name === 'NotAllowedError') {
          showToast(
            'Camera/mic permission denied!',
            'error'
          )
        }
      }
    }

    initRoom()

    return () => {
      cleanupAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TIMER loop
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const timer = setInterval(() => {
      durationRef.current += 1
      setDuration(durationRef.current)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SOCKET EVENT HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    socket.on('all-users', users => {
      console.log('[SOCKET] all-users:', users.map(u => u.username))
      users.forEach(({ socketId, username: uname, isMuted: muted, isCameraOff: camOff, isHandRaised: handRaised }) => {
        if (socketId !== socket.id) {
          createPeer(socketId, uname, true, muted, camOff, handRaised || false)
        }
      })
    })

    socket.on('user-joined', ({ socketId, username: uname, isMuted: muted, isCameraOff: camOff, isHandRaised: handRaised }) => {
      console.log('[SOCKET] user-joined:', uname)
      if (socketId !== socket.id) {
        createPeer(socketId, uname, false, muted, camOff, handRaised || false)
        showToast(`${uname} joined`, 'success')
      }
    })

    socket.on('signal', ({ signal, from, username: uname }) => {
      console.log(`[SIGNAL] From ${uname}:`, signal.type || 'candidate')
      const peerData = peersRef.current[from]

      if (peerData && !peerData.peer.destroyed) {
        try {
          peerData.peer.signal(signal)
        } catch (e) {
          console.error('[SIGNAL] Error:', e)
        }
      } else {
        console.log(`[SIGNAL] Storing pending signal for ${uname}`)
        if (!pendingSignalsRef.current[from]) {
          pendingSignalsRef.current[from] = []
        }
        pendingSignalsRef.current[from].push(signal)
      }
    })

    socket.on('user-left', ({ socketId, username: uname }) => {
      console.log('[SOCKET] user-left:', uname)
      destroyPeer(socketId)
      showToast(`${uname} left the meeting`, 'info')

      if (screenSharingUser?.socketId === socketId) {
        setScreenSharingUser(null)
      }
    })

    socket.on('room-users', users => {
      console.log('[SOCKET] room-users:', users.map(u => u.username))
    })

    socket.on('receive-message', msg => {
      setMessages(prev => [...prev, msg])
      if (!showChat) {
        setUnreadCount(p => p + 1)
      }
    })

    socket.on('user-mute-status', ({ socketId, isMuted: muted }) => {
      setPeers(prev => prev.map(p =>
        p.socketId === socketId
          ? { ...p, isMuted: muted }
          : p
      ))
    })

    socket.on('user-camera-status', ({ socketId, isCameraOff: off }) => {
      setPeers(prev => prev.map(p =>
        p.socketId === socketId
          ? { ...p, isCameraOff: off }
          : p
      ))
    })

    socket.on('user-screen-sharing', ({ socketId, username: uname }) => {
      setScreenSharingUser({ socketId, username: uname })
      showToast(`${uname} is presenting 🖥️`, 'info')
    })

    socket.on('user-stopped-sharing', ({ username: uname }) => {
      setScreenSharingUser(null)
      showToast(`${uname} stopped presenting`, 'info')
    })

    socket.on('receive-caption', ({ socketId, username: uname, text }) => {
      if (text) {
        setCaptions(prev => ({
          ...prev,
          [socketId]: { text, username: uname }
        }))
      } else {
        setCaptions(prev => {
          const updated = { ...prev }
          delete updated[socketId]
          return updated
        })
      }
    })

    socket.on('user-hand-status', ({ socketId, isHandRaised: raised, username: uname }) => {
      setPeers(prev => prev.map(p =>
        p.socketId === socketId
          ? { ...p, isHandRaised: raised }
          : p
      ))
      showToast(raised ? `${uname} raised hand ✋` : `${uname} lowered hand`, 'info')
    })

    socket.on('receive-reaction', ({ username: uname, emoji }) => {
      showToast(`${uname} reacted ${emoji}`, 'info')
      const id = Date.now() + Math.random()
      const rightOffset = 60 + Math.random() * 60
      setFloatingEmojis(prev => [...prev, { id, emoji, rightOffset }])
      setTimeout(() => {
        setFloatingEmojis(prev => prev.filter(r => r.id !== id))
      }, 3000)
    })

    socket.on('meeting-ended', ({ by }) => {
      showToast(`${by} ended the meeting`, 'info')
      setTimeout(() => leaveMeeting(), 2000)
    })

    return () => {
      socket.off('all-users')
      socket.off('user-joined')
      socket.off('signal')
      socket.off('user-left')
      socket.off('room-users')
      socket.off('receive-message')
      socket.off('user-mute-status')
      socket.off('user-camera-status')
      socket.off('user-screen-sharing')
      socket.off('user-stopped-sharing')
      socket.off('receive-caption')
      socket.off('user-hand-status')
      socket.off('receive-reaction')
      socket.off('meeting-ended')
    }
  }, [
    createPeer,
    destroyPeer,
    showToast,
    showChat,
    screenSharingUser,
    leaveMeeting
  ])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HANDLE PAGE UNLOAD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const handleUnload = () => {
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach(t => t.stop())
      }
      if (screenStreamRef.current) {
        screenStreamRef.current
          .getTracks()
          .forEach(t => t.stop())
      }
      socket.emit('leave-room', { roomId, username })
      socket.disconnect()
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [roomId, username])

  useEffect(() => {
    const closeAll = () => {
      setShowEmoji(false)
      setShowMore(false)
    }
    document.addEventListener('click', closeAll)
    return () => {
      document.removeEventListener('click', closeAll)
    }
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONTROLS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return

    const audioTracks = localStreamRef.current.getAudioTracks()
    if (!audioTracks.length) return

    const track = audioTracks[0]
    track.enabled = !track.enabled
    const muted = !track.enabled

    Object.values(peersRef.current).forEach(({ peer }) => {
      try {
        peer._pc?.getSenders()
          .filter(s => s.track?.kind === 'audio')
          .forEach(s => {
            s.track.enabled = !muted
          })
      } catch (err) {
        console.warn('[PEER] Mute update error:', err.message)
      }
    })

    setIsMuted(muted)
    socket.emit('mute-status', {
      roomId, isMuted: muted, username
    })
  }, [roomId, username])

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return

    const videoTracks = localStreamRef.current.getVideoTracks()
    if (!videoTracks.length) return

    const track = videoTracks[0]
    track.enabled = !track.enabled
    const off = !track.enabled

    setIsCameraOff(off)
    socket.emit('camera-status', {
      roomId, isCameraOff: off, username
    })
  }, [roomId, username])

  const stopScreenShare = useCallback(async () => {
    try {
      const camStream = await
        navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })

      const camTrack = camStream.getVideoTracks()[0]

      for (const { peer } of Object.values(peersRef.current)) {
        try {
          const pc = peer._pc
          if (!pc) continue
          const sender = pc.getSenders()
            .find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(camTrack)
          }
        } catch (err) {
          console.warn('[PEER] Restore camera track error:', err.message)
        }
      }

      localStreamRef.current = camStream
      setLocalStream(camStream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = camStream
        localVideoRef.current.muted = true
      }

      if (screenStreamRef.current) {
        screenStreamRef.current
          .getTracks()
          .forEach(t => t.stop())
        screenStreamRef.current = null
      }

      setIsScreenSharing(false)
      setScreenSharingUser(null)
      socket.emit('screen-share-stopped', {
        roomId, username
      })

    } catch (e) {
      console.error('Stop screen share error:', e)
    }
  }, [roomId, username])

  const startScreenShare = useCallback(async () => {
    // Check if screen share is supported
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast(
        'Screen sharing is not supported on this device. Please use a desktop browser.', 
        'error'
      )
      return
    }

    try {
      const screenStream = await
        navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        })

      const screenTrack = screenStream.getVideoTracks()[0]
      screenStreamRef.current = screenStream

      for (const { peer } of Object.values(peersRef.current)) {
        try {
          const pc = peer._pc
          if (!pc) continue
          const sender = pc.getSenders()
            .find(s => s.track?.kind === 'video')
          if (sender) {
            await sender.replaceTrack(screenTrack)
          }
        } catch (e) {
          console.error('Screen share peer error:', e)
        }
      }

      setLocalStream(screenStream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream
        localVideoRef.current.muted = true
      }

      setIsScreenSharing(true)
      setScreenSharingUser({
        socketId: socket.id,
        username
      })

      socket.emit('screen-share-started', {
        roomId, username, socketId: socket.id
      })

      screenTrack.onended = () => stopScreenShare()

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.log('User cancelled')
      } else if (err.name === 'NotSupportedError' || 
                 err.name === 'NotFoundError') {
        showToast('Screen sharing not available on this device', 'error')
      } else {
        showToast('Screen share failed', 'error')
      }
    }
  }, [roomId, username, showToast, stopScreenShare])

  const sendMessage = useCallback(text => {
    if (!text?.trim()) return
    const msg = {
      text,
      username,
      time: new Date().toLocaleTimeString(),
      id: Date.now(),
      isSelf: true
    }
    socket.emit('send-message', { roomId, ...msg })
    setMessages(prev => [...prev, msg])
  }, [roomId, username])

  const sendReaction = useCallback(emoji => {
    socket.emit('send-reaction', {
      roomId, emoji, username
    })
    const id = Date.now() + Math.random()
    const rightOffset = 60 + Math.random() * 60
    setFloatingEmojis(prev => [...prev, { id, emoji, rightOffset }])
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }, [roomId, username])

  const toggleHandRaise = useCallback(() => {
    const newStatus = !isHandRaised
    setIsHandRaised(newStatus)
    socket.emit('hand-status', { roomId, isHandRaised: newStatus, username })
  }, [roomId, username, isHandRaised])

  const formatDuration = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // ── Caption speech recognition ─────────────────────────────────────────────
  const toggleCaptions = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }

    if (isCaptionOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsCaptionOn(false);
      setMyCaption('');
      socket.emit('caption-update', { roomId, socketId: socket.id, username, text: '' });
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const finalText = event.results[i][0].transcript;
            setMyCaption(finalText);
            socket.emit('caption-update', { roomId, socketId: socket.id, username, text: finalText });
            setTimeout(() => {
              setMyCaption('');
              socket.emit('caption-update', { roomId, socketId: socket.id, username, text: '' });
            }, 3000);
          } else {
            interim += event.results[i][0].transcript;
            setMyCaption(interim);
            socket.emit('caption-update', { roomId, socketId: socket.id, username, text: interim });
          }
        }
      };

      recognition.onerror = (e) => {
        console.error('[caption] Recognition error:', e.error);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsCaptionOn(true);
    }
  }, [isCaptionOn, showToast, roomId, username]);

  const totalTiles = peers.length + 1

  const getGridClass = (count) => {
    if (count <= 1) return 'grid-1'
    if (count === 2) return 'grid-2'
    if (count === 3) return 'grid-3'
    if (count === 4) return 'grid-4'
    if (count <= 6) return 'grid-6'
    return 'grid-9'
  }

  const hasSidebar = showChat || showParticipants;

  if (isConnecting) {
    return <Loader message="Setting up your camera and microphone..." />
  }

  return (
    <div className={`room-container 
      ${screenSharingUser ? 'has-spotlight' : ''}
      ${hasSidebar ? 'has-sidebar' : ''}`}>

      {/* Top Bar (Floating center) */}
      <div className="room-top-bar">
        <span className="material-icons-round" style={{color:'#30D158',fontSize:'16px'}}>
          lock
        </span>
        <span className="room-id-text">{roomId}</span>
        <span className="footer-divider" />
        <span className="room-timer">{formatDuration(duration)}</span>
      </div>

      {/* Top Right Bar */}
      <div className="room-top-right">
        <button 
          className="share-link-btn"
          onClick={copyMeetingLink}>
          <span className="material-icons-round" style={{fontSize:'16px'}}>
            link
          </span>
          <span className="btn-text">Share link</span>
        </button>
      </div>

      {/* Entry Click-to-Join Overlay */}
      {!joinedMeeting && (
        <div className="join-meet-overlay">
          <div className="join-meet-card">
            <div className="join-meet-badge">
              <div className="ready-green-dot" />
              Meeting is ready
            </div>
            <h2 className="join-meet-title">Ready to join?</h2>
            <p className="join-meet-username">Joining as <strong>{username}</strong></p>
            
            <button className="join-meet-btn" onClick={() => {
              setJoinedMeeting(true);
              if (localVideoRef.current && localStream) {
                localVideoRef.current.srcObject = localStream;
                localVideoRef.current.play().catch(()=>{});
              }
            }}>
              Join Meet
            </button>
          </div>
        </div>
      )}

      {/* Presenting banner */}
      {isScreenSharing && (
        <div className="presenting-banner">
          <span className="material-icons-round">
            present_to_all
          </span>
          You are presenting
          <button 
            className="stop-share-btn"
            onClick={stopScreenShare}>
            Stop presenting
          </button>
        </div>
      )}

      {screenSharingUser && 
       screenSharingUser.socketId !== socket.id && (
        <div className="presenting-banner">
          <span className="material-icons-round">
            present_to_all
          </span>
          {screenSharingUser.username} is presenting
        </div>
      )}

      {/* Video grid */}
      {!screenSharingUser ? (
        <div className="video-grid-wrapper">
          <div className={`video-grid 
            ${getGridClass(totalTiles)}`}>
            
            {/* Your own tile FIRST */}
            <VideoTile
              key="local"
              stream={localStream}
              username={username}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isLocal={true}
              localVideoRef={localVideoRef}
              isHandRaised={isHandRaised}
            />

            {/* Other participants */}
            {peers.map(peer => (
              <VideoTile
                key={peer.socketId}
                stream={peer.stream}
                username={peer.username}
                isMuted={peer.isMuted}
                isCameraOff={peer.isCameraOff}
                isLocal={false}
                isHandRaised={peer.isHandRaised}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Spotlight layout for screen share */
        <div className="video-grid-wrapper">
          <div className="spotlight-main">
            <VideoTile
              stream={
                screenSharingUser.socketId === socket.id
                  ? localStream
                  : peers.find(
                      p => p.socketId === 
                      screenSharingUser.socketId
                    )?.stream
              }
              username={screenSharingUser.username}
              isLocal={
                screenSharingUser.socketId === socket.id
              }
              isScreenSharing={true}
              isHandRaised={
                screenSharingUser.socketId === socket.id
                  ? isHandRaised
                  : peers.find(p => p.socketId === screenSharingUser.socketId)?.isHandRaised
              }
            />
          </div>
          <div className="spotlight-sidebar">
            {/* Show everyone except presenter */}
            <VideoTile
              stream={localStream}
              username={username}
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isLocal={true}
              localVideoRef={localVideoRef}
              isHandRaised={isHandRaised}
            />
            {peers
              .filter(p => 
                p.socketId !== screenSharingUser.socketId
              )
              .map(peer => (
                <VideoTile
                  key={peer.socketId}
                  stream={peer.stream}
                  username={peer.username}
                  isMuted={peer.isMuted}
                  isCameraOff={peer.isCameraOff}
                  isHandRaised={peer.isHandRaised}
                />
              ))
            }
          </div>
        </div>
      )}

      {/* Meeting Footer Controls Bar */}
      <div className="controls-bar" onClick={e => e.stopPropagation()}>
        <button 
          className={`ctrl-btn ${isMuted ? 'danger' : ''}`}
          onClick={toggleMute}
          data-tooltip={isMuted ? 'Unmute' : 'Mute'}>
          <span className="material-icons-round">
            {isMuted ? 'mic_off' : 'mic'}
          </span>
        </button>

        <button 
          className={`ctrl-btn ${isCameraOff ? 'danger' : ''}`}
          onClick={toggleCamera}
          data-tooltip={isCameraOff ? 'Start video' : 'Stop video'}>
          <span className="material-icons-round">
            {isCameraOff ? 'videocam_off' : 'videocam'}
          </span>
        </button>

        <button 
          className={`ctrl-btn ${isCaptionOn ? 'active' : ''}`}
          onClick={toggleCaptions}
          data-tooltip="Captions">
          <span className="material-icons-round">
            closed_caption
          </span>
        </button>

        <button 
          className={`ctrl-btn ${isHandRaised ? 'active' : ''}`}
          onClick={toggleHandRaise}
          data-tooltip={isHandRaised ? 'Lower hand' : 'Raise hand'}>
          <span className="material-icons-round">
            {isHandRaised ? 'pan_tool' : 'back_hand'}
          </span>
        </button>

        <div style={{position:'relative', flexShrink: 0}}>
          <button 
            className="ctrl-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowEmoji(p => !p)
              setShowMore(false)
            }}
            data-tooltip="React">
            <span className="material-icons-round">
              add_reaction
            </span>
          </button>
          {showEmoji && createPortal(
            <div 
              className="emoji-picker-popup"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                bottom: '70px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#2C2C2E',
                borderRadius: '16px',
                padding: '10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                zIndex: 2147483647, /* max z-index */
                width: '260px'
              }}>
              {['👍','❤️','😂','😮','👏','🎉','🔥','💯']
                .map(emoji => (
                  <button
                    key={emoji}
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      fontSize: '22px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={() => {
                      sendReaction(emoji)
                      setShowEmoji(false)
                    }}>
                    {emoji}
                  </button>
                ))}
            </div>,
            document.body
          )}
        </div>

        {!isMobile && (
          <button 
            className={`ctrl-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            data-tooltip={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
            <span className="material-icons-round">
              {isScreenSharing ? 'stop_screen_share' : 'screen_share'}
            </span>
          </button>
        )}

        <div style={{position:'relative', flexShrink: 0}}>
          <button 
            className="ctrl-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowMore(p => !p)
              setShowEmoji(false)
            }}
            data-tooltip="More options">
            <span className="material-icons-round">
              more_vert
            </span>
          </button>
          {showMore && createPortal(
            <div 
              className="more-options-menu"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                bottom: '70px',
                right: '12px',
                background: '#2C2C2E',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                zIndex: 2147483647,
                minWidth: '200px'
              }}>
              <button 
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '14px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  showToast('Link copied!')
                  setShowMore(false)
                }}>
                <span className="material-icons-round">
                  link
                </span>
                Copy meeting link
              </button>
            </div>,
            document.body
          )}
        </div>

        <span className="ctrl-divider" />

        <button 
          className={`ctrl-btn ${showParticipants ? 'active' : ''}`}
          onClick={() => {
            setShowParticipants(p => !p)
            setShowChat(false)
          }}
          data-tooltip="Participants">
          <span className="material-icons-round">people</span>
          <span className="ctrl-badge">{peers.length + 1}</span>
        </button>

        <button 
          className={`ctrl-btn ${showChat ? 'active' : ''}`}
          onClick={() => {
            setShowChat(p => !p)
            setShowParticipants(false)
            setUnreadCount(0)
          }}
          data-tooltip="Chat">
          <span className="material-icons-round">chat</span>
          {unreadCount > 0 && (
            <span className="ctrl-badge">{unreadCount}</span>
          )}
        </button>

        <button 
          className="leave-btn"
          onClick={leaveMeeting}>
          Leave call
        </button>
      </div>

      {/* Chat panel */}
      {showChat && (
        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          onClose={() => setShowChat(false)}
          username={username}
        />
      )}

      {/* Participants panel */}
      {showParticipants && (
        <ParticipantsPanel
          participants={[
            { 
              socketId: 'local', 
              username, 
              isMuted, 
              isCameraOff,
              isLocal: true 
            },
            ...peers
          ]}
          onClose={() => setShowParticipants(false)}
        />
      )}

      {/* Captions */}
      {isCaptionOn && (
        <div className="caption-overlay">
          {myCaption && (
            <div className="caption-line">
              <span className="caption-speaker">
                {username}:
              </span>
              {myCaption}
            </div>
          )}
          {Object.values(captions).map((c, i) => (
            c.text && (
              <div key={i} className="caption-line">
                <span className="caption-speaker">
                  {c.username}:
                </span>
                {c.text}
              </div>
            )
          ))}
        </div>
      )}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => {
          let icon = 'info'
          if (t.type === 'error') icon = 'error'
          if (t.type === 'success') icon = 'check_circle'
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="material-icons-round" style={{ fontSize: '18px', color: t.type === 'error' ? '#FF3B30' : t.type === 'success' ? '#30D158' : '#0A84FF' }}>
                {icon}
              </span>
              <span>{t.msg}</span>
            </div>
          )
        })}
      </div>

      {/* Floating emojis */}
      {floatingEmojis.map(e => (
        <div 
          key={e.id} 
          className="floating-emoji"
          style={{
            right: `${e.rightOffset}px`
          }}>
          {e.emoji}
        </div>
      ))}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ChatPanel = ({ messages, onSend, onClose, username }) => {
  const [text, setText] = useState('')
  const handleSend = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }
  return (
    <div className="side-panel">
      <div className="panel-header">
        <span className="panel-title">Chat</span>
        <button className="panel-close" onClick={onClose}>
          <span className="material-icons-round">close</span>
        </button>
      </div>
      <div className="messages-area">
        {messages.map((m) => {
          const isMine = m.username === username || m.isSelf
          return (
            <div key={m.id} className="messages-bubble-container" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <div className={`message-bubble ${isMine ? 'mine' : 'others'}`}>
                <div className="message-meta">
                  {m.username} • {m.time}
                </div>
                <div>{m.text}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
        />
        <button className="send-btn" onClick={handleSend}>
          <span className="material-icons-round">send</span>
        </button>
      </div>
    </div>
  )
}

const ParticipantsPanel = ({ participants, onClose }) => {
  return (
    <div className="side-panel">
      <div className="panel-header">
        <span className="panel-title">Participants</span>
        <button className="panel-close" onClick={onClose}>
          <span className="material-icons-round">close</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {participants.map((p) => {
          const initials = p.username?.slice(0, 2)?.toUpperCase() || '??'
          return (
            <div key={p.socketId} className="participant-row">
              <div className="participant-avatar">{initials}</div>
              <span className="participant-name">
                {p.isLocal ? `${p.username} (You)` : p.username}
              </span>
              <div className="participant-icons">
                {p.isMuted && (
                  <span className="material-icons-round participant-icon muted">
                    mic_off
                  </span>
                )}
                {p.isCameraOff && (
                  <span className="material-icons-round participant-icon">
                    videocam_off
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Room