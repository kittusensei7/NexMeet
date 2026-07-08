import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react'
import axios from '../../api/axios'
import socket from '../../socket/socket'
import './Room.css'

const Room = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const getUserName = () => {
    // Try all possible storage patterns
    const direct = localStorage.getItem('username') || sessionStorage.getItem('username')
    if (direct) return direct

    const userStr = localStorage.getItem('user') || sessionStorage.getItem('nexmeet_user') || localStorage.getItem('nexmeet_user')
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr)
        return parsed.username || 
               parsed.name || 
               parsed.email?.split('@')[0]
      } catch (err) {
        console.warn('Failed to parse user session JSON:', err)
      }
    }

    const userInfoStr = 
      localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo')
    if (userInfoStr) {
      try {
        const parsed = JSON.parse(userInfoStr)
        return parsed.username || parsed.name
      } catch (err) {
        console.warn('Failed to parse user info JSON:', err)
      }
    }

    return 'User'
  }

  const username = getUserName()
  const authToken = localStorage.getItem('token') || sessionStorage.getItem('nexmeet_token') || localStorage.getItem('nexmeet_token')

  const [livekitToken, setLivekitToken] = useState(null)
  const [livekitUrl, setLivekitUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [showChat, setShowChat] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const [isCaptionOn, setIsCaptionOn] = useState(false)
  const [myCaption, setMyCaption] = useState('')
  const [captions, setCaptions] = useState({})
  const [showEmoji, setShowEmoji] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState([])
  const [facingMode, setFacingMode] = useState('user')
  const recognitionRef = useRef(null)
  const isCaptionOnRef = useRef(false)
  const roomRef = useRef(null)

  const isMobileDevice = /Android|iPhone|iPad/i.test(navigator.userAgent)

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const flipCamera = async () => {
    try {
      const newMode = facingMode === 'user' ? 'environment' : 'user'
      const room = roomRef.current
      if (!room) return

      const localParticipant = room.localParticipant
      await localParticipant.switchActiveDevice(
        'videoinput',
        newMode === 'user' ? 'front' : 'back'
      )
      setFacingMode(newMode)
      showToast(newMode === 'user' ? 'Front camera' : 'Back camera')
    } catch (err) {
      console.error('Camera flip error:', err)
      showToast('Camera flip failed', 'error')
    }
  }

  // Get LiveKit token from backend
  useEffect(() => {
    const getToken = async () => {
      try {
        setIsLoading(true)
        const res = await axios.post(
          '/api/livekit/token',
          {
            roomName: roomId,
            participantName: username
          },
          {
            headers: { 
              Authorization: `Bearer ${authToken}` 
            }
          }
        )
        setLivekitToken(res.data.token)
        setLivekitUrl(
          res.data.url || 
          import.meta.env.VITE_LIVEKIT_URL
        )
        setIsLoading(false)
      } catch (err) {
        console.error('Token error:', err)
        setError('Failed to join meeting. Please try again.')
        setIsLoading(false)
      }
    }

    getToken()
  }, [roomId, username, authToken])

  // Socket.io for chat, reactions, and hand-raising
  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.emit('join-room', { roomId, username })

    socket.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg])
      if (!showChat) {
        setUnreadCount(prev => prev + 1)
      }
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

    socket.on('user-raised-hand', ({ username: uname }) => {
      showToast(`${uname} raised hand ✋`, 'info')
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

    // Click listener to close emoji picker when clicking outside
    const closePicker = () => {
      setShowEmoji(false)
    }
    window.addEventListener('click', closePicker)

    return () => {
      socket.emit('leave-room', { roomId, username })
      socket.off('receive-message')
      socket.off('receive-caption')
      socket.off('user-raised-hand')
      socket.off('receive-reaction')
      window.removeEventListener('click', closePicker)
      socket.disconnect()
    }
  }, [roomId, username, showChat, showToast])

  // Captions using Web Speech API
  const toggleCaptions = useCallback(() => {
    if (isCaptionOnRef.current) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      isCaptionOnRef.current = false
      setIsCaptionOn(false)
      setMyCaption('')
      socket.emit('caption-update', {
        roomId, socketId: socket.id,
        username, text: ''
      })
    } else {
      const SpeechRecognition = 
        window.SpeechRecognition || 
        window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        showToast('Captions only work in Chrome', 'error')
        return
      }
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        const latest = event.results[event.results.length - 1]
        const text = latest[0].transcript.trim()
        if (text) {
          setMyCaption(text)
          socket.emit('caption-update', {
            roomId, socketId: socket.id,
            username, text
          })
          if (latest.isFinal) {
            setTimeout(() => {
              setMyCaption('')
              socket.emit('caption-update', {
                roomId, socketId: socket.id,
                username, text: ''
              })
            }, 3000)
          }
        }
      }
      recognition.onend = () => {
        if (isCaptionOnRef.current) {
          try {
            recognition.start()
          } catch (err) {
            console.error('Failed to restart speech recognition:', err)
          }
        }
      }
      recognition.start()
      recognitionRef.current = recognition
      isCaptionOnRef.current = true
      setIsCaptionOn(true)
    }
  }, [roomId, username, showToast])

  useEffect(() => {
    isCaptionOnRef.current = isCaptionOn
  }, [isCaptionOn])

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return
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

  const handleDisconnected = useCallback(() => {
    socket.emit('leave-room', { roomId, username })
    socket.disconnect()
    navigate('/dashboard', { replace: true })
  }, [roomId, username, navigate])

  const raiseHand = useCallback(() => {
    socket.emit('raise-hand', { roomId, username })
    showToast('You raised hand ✋', 'success')
  }, [roomId, username, showToast])

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

  if (isLoading) {
    return (
      <div className="room-loading">
        <div className="loading-spinner" />
        <p>Joining meeting...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="room-error">
        <span style={{ fontSize: 48 }}>❌</span>
        <h2>{error}</h2>
        <button onClick={() => navigate('/dashboard', { replace: true })}>
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="room-container">
      <LiveKitRoom
        video={true}
        audio={true}
        token={livekitToken}
        serverUrl={livekitUrl}
        onDisconnected={handleDisconnected}
        onConnected={(room) => {
          roomRef.current = room
          console.log('Connected to LiveKit room')
        }}
        options={{
          publishDefaults: {
            videoEncoding: {
              maxBitrate: 600_000,
              maxFramerate: 24,
            },
            videoSimulcastLayers: [],
          },
          videoCaptureDefaults: {
            facingMode: 'user', // FRONT camera
            resolution: {
              width: 960,
              height: 540,
              frameRate: 24,
            }
          },
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          adaptiveStream: true,
          dynacast: true,
        }}
        data-lk-theme="default"
        style={{ height: '100dvh' }}
      >
        <VideoConference />
        
        <RoomAudioRenderer />

        {/* Caption overlay */}
        {isCaptionOn && (
          <div className="caption-overlay">
            {myCaption && (
              <div className="caption-line">
                <span className="caption-speaker">{username}:</span>
                {myCaption}
              </div>
            )}
            {Object.values(captions).map((c, i) =>
              c.text && (
                <div key={i} className="caption-line">
                  <span className="caption-speaker">{c.username}:</span>
                  {c.text}
                </div>
              )
            )}
          </div>
        )}

        {/* Custom top bar with room ID and share link */}
        <div className="room-top-bar">
          <span className="room-id-text">
            🔒 {roomId}
          </span>
          <button
            className="share-link-btn"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              showToast('Link copied! 🔗', 'success')
            }}>
            Share link
          </button>
          {isMobileDevice && (
            <button
              className="share-link-btn"
              onClick={flipCamera}
              title="Flip camera"
            >
              🔄
            </button>
          )}
          <button
            className={`ctrl-btn ${isCaptionOn ? 'active' : ''}`}
            onClick={toggleCaptions}>
            CC
          </button>
          <button
            className="ctrl-btn"
            onClick={raiseHand}>
            ✋
          </button>
          <button
            className="ctrl-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowEmoji(p => !p)
            }}>
            😀
          </button>
          <button
            className="ctrl-btn"
            onClick={() => {
              setShowChat(p => !p)
              setUnreadCount(0)
            }}>
            💬 {unreadCount > 0 && (
              <span className="ctrl-badge">{unreadCount}</span>
            )}
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

        {/* Emoji picker popup */}
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
              zIndex: 2147483647,
              width: '260px'
            }}
          >
            {['👍','❤️','😂','😮','👏','🎉','🔥','💯'].map(emoji => (
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
                }}
              >
                {emoji}
              </button>
            ))}
          </div>,
          document.body
        )}

        {/* Floating emojis */}
        {floatingEmojis.map(e => (
          <div 
            key={e.id} 
            className="floating-emoji"
            style={{
              right: `${e.rightOffset}px`
            }}
          >
            {e.emoji}
          </div>
        ))}

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

      </LiveKitRoom>
    </div>
  )
}

function ChatPanel({ messages, onSend, onClose }) {
  const [text, setText] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#16161A',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%'
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '16px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>
          Chat
        </span>
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            color: 'white', fontSize: 18, cursor: 'pointer'
          }}>
          ✕
        </button>
      </div>

      {/* Messages - scrollable, takes remaining space */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
            No messages yet. Say hi 👋
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.isSelf ? 'flex-end' : 'flex-start',
            maxWidth: '80%'
          }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
              {m.isSelf ? 'You' : m.username} · {m.time}
            </div>
            <div style={{
              background: m.isSelf ? '#0A84FF' : 'rgba(255,255,255,0.1)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 14
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - ALWAYS visible, fixed at bottom of this panel */}
      <div style={{
        flexShrink: 0,
        padding: '10px 12px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: '#16161A'
      }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 24,
            padding: '12px 16px',
            color: 'white',
            fontSize: 15,
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: '#0A84FF', border: 'none',
            color: 'white', fontSize: 18, cursor: 'pointer',
            flexShrink: 0
          }}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default Room