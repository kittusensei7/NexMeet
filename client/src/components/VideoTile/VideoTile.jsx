import { useRef, useEffect, useState } from 'react'
import './VideoTile.css'

const VideoTile = ({
  stream,
  username,
  isMuted = false,
  isCameraOff = false,
  isLocal = false,
  isScreenSharing = false,
  localVideoRef = null,
  isHandRaised = false
}) => {
  const internalVideoRef = useRef(null)
  const videoRef = localVideoRef || internalVideoRef
  const [tracksVersion, setTracksVersion] = useState(0)

  // Listen to stream track changes to dynamically update state (e.g. readyState, enabled)
  useEffect(() => {
    if (!stream) return

    const updateTracks = () => {
      setTracksVersion(prev => prev + 1)
    }

    stream.addEventListener('addtrack', updateTracks)
    stream.addEventListener('removetrack', updateTracks)

    const currentTracks = stream.getTracks()
    currentTracks.forEach(track => {
      track.addEventListener('mute', updateTracks)
      track.addEventListener('unmute', updateTracks)
      track.addEventListener('ended', updateTracks)
    })

    return () => {
      stream.removeEventListener('addtrack', updateTracks)
      stream.removeEventListener('removetrack', updateTracks)
      currentTracks.forEach(track => {
        track.removeEventListener('mute', updateTracks)
        track.removeEventListener('unmute', updateTracks)
        track.removeEventListener('ended', updateTracks)
      })
    }
  }, [stream])

  // Autoplay handler with a silent retry loop
  useEffect(() => {
    if (!videoRef.current) return

    if (stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream
      }

      const playVideo = () => {
        videoRef.current?.play().catch(() => {
          // Silent catch for autoplay restrictions
        })
      }

      // Try playing immediately
      playVideo()

      // Set up a 5-second interval retry loop
      const intervalId = setInterval(playVideo, 5000)

      // Play on addtrack
      const handleAddTrack = () => {
        playVideo()
      }
      stream.addEventListener('addtrack', handleAddTrack)

      return () => {
        clearInterval(intervalId)
        stream.removeEventListener('addtrack', handleAddTrack)
      }
    } else {
      videoRef.current.srcObject = null
    }
  }, [stream, videoRef])

  const getAvatarGradient = (name) => {
    if (!name) return 'linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)'
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const gradients = [
      'linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)', // Blue/Purple
      'linear-gradient(135deg, #30D158 0%, #0A84FF 100%)', // Green/Blue
      'linear-gradient(135deg, #FF9F0A 0%, #FF375F 100%)', // Orange/Red
      'linear-gradient(135deg, #BF5AF2 0%, #FF375F 100%)', // Purple/Pink
      'linear-gradient(135deg, #5E5CE6 0%, #BF5AF2 100%)', // Indigo/Purple
      'linear-gradient(135deg, #64D2FF 0%, #5E5CE6 100%)'  // Light Blue/Indigo
    ]
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  const videoTracks = stream ? stream.getVideoTracks() : []
  const hasLiveVideoTrack = tracksVersion >= 0 && videoTracks.length > 0 && videoTracks.some(track => track.enabled && track.readyState === 'live')
  const showVideo = stream && !isCameraOff && hasLiveVideoTrack

  const initials = username
    ?.slice(0, 2)?.toUpperCase() || '??'

  return (
    <div className={`video-tile 
      ${isLocal ? 'local-tile' : ''}
      ${isScreenSharing ? 'sharing-tile' : ''}`}>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: '100%',
          height: '100%',
          objectFit: isScreenSharing ? 'contain' : 'cover',
          display: showVideo ? 'block' : 'none',
          background: '#111'
        }}
      />

      {!showVideo && (
        <div className="avatar-wrapper">
          <div 
            className="avatar-circle" 
            style={{ background: getAvatarGradient(username) }}
          >
            {initials}
          </div>
          <div className="avatar-status-text">
            {isLocal ? 'Your camera is off' : `${username}'s camera is off`}
          </div>
          {!stream && !isLocal && (
            <div className="connecting-text">
              Connecting...
            </div>
          )}
        </div>
      )}

      {isMuted && (
        <div className="mute-badge">
          <span className="material-icons-round">
            mic_off
          </span>
        </div>
      )}

      {isHandRaised && (
        <div className="hand-badge">
          <span className="material-icons-round">
            back_hand
          </span>
        </div>
      )}

      <div className="tile-name-label">
        {isLocal ? `${username} (You)` : username}
      </div>

      {isScreenSharing && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: '#0A84FF',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          🖥️ Presenting
        </div>
      )}
    </div>
  )
}

export default VideoTile
