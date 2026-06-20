import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar/Navbar';
import api from '../../api/axios';
import { getInitials } from '../../utils/helpers';
import Loader from '../../components/Loader/Loader';
import './Lobby.css';

/**
 * Lobby Component
 * Redesigned to match Google Meet's green room layout.
 */
const Lobby = () => {
  const { roomId } = useParams();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [roomName, setRoomName] = useState('');
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [validating, setValidating] = useState(true);
  
  // Custom display name state
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [nameFocused, setNameFocused] = useState(false);

  // Microphone testing states
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [testCountdown, setTestCountdown] = useState(5);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // AudioContext refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);

  // Transition gate
  const isJoiningRef = useRef(false);
  const localStreamRef = useRef(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    return () => {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  // Validate Room exists on startup
  useEffect(() => {
    const checkRoomAndStartMedia = async () => {
      try {
        const response = await api.get(`/api/rooms/validate/${roomId}`);
        if (response.data.valid) {
          setRoomName(response.data.roomName);
          setValidating(false);
          
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
              }
            });
            setLocalStream(stream);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
            setPermissionError(false);
          } catch (deviceError) {
            console.warn('Lobby full media access failed, trying audio-only fallback:', deviceError);
            try {
              const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  sampleRate: 44100
                }
              });
              setLocalStream(audioStream);
              setCameraOn(false);
              setPermissionError(false);
            } catch (audioError) {
              console.warn('Lobby audio-only fallback failed too. Proceeding with media off:', audioError);
              const emptyStream = new MediaStream();
              setLocalStream(emptyStream);
              setMicOn(false);
              setCameraOn(false);
              setPermissionError(false); 
            }
          } finally {
            setLoadingRoom(false);
          }
        }
      } catch (error) {
        console.error('Lobby room check failed:', error);
        navigate('/dashboard');
      }
    };

    checkRoomAndStartMedia();

    return () => {
      if (localStreamRef.current && !isJoiningRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId, navigate]);

  // Handle local video bind if camera gets turned back on
  useEffect(() => {
    if (videoRef.current && localStream && cameraOn && !permissionError && !loadingRoom) {
      videoRef.current.srcObject = localStream;
    }
  }, [cameraOn, localStream, permissionError, loadingRoom]);

  // Audio level visualizer analyzer
  useEffect(() => {
    let animationFrameId;
    
    if (localStream && localStream.getAudioTracks().length > 0 && micOn) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const microphone = audioContext.createMediaStreamSource(localStream);
        microphoneRef.current = microphone;

        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = Math.min(100, Math.floor((average / 128) * 100));
          setAudioLevel(level);
          
          animationFrameId = requestAnimationFrame(updateMeter);
        };
        
        animationFrameId = requestAnimationFrame(updateMeter);
      } catch (err) {
        console.error('Audio meter analyzer failed:', err);
      }
    } else {
      setTimeout(() => {
        setAudioLevel(0);
      }, 0);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (microphoneRef.current) microphoneRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      setAudioLevel(0);
    };
  }, [localStream, micOn]);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !micOn;
      });
      sessionStorage.setItem('isMuted', String(micOn));
      setMicOn(!micOn);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOn;
      });
      sessionStorage.setItem('cameraOff', String(cameraOn));
      setCameraOn(!cameraOn);
    }
  };

  const startMicTest = async () => {
    if (!localStream || localStream.getAudioTracks().length === 0) return;
    
    try {
      audioChunksRef.current = [];
      const audioStream = new MediaStream([localStream.getAudioTracks()[0]]);
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        setIsPlayingBack(true);
        audio.play();
        audio.onended = () => {
          setIsPlayingBack(false);
        };
      };

      setIsRecording(true);
      setTestCountdown(5);
      mediaRecorder.start();

      let count = 5;
      const timer = setInterval(() => {
        count -= 1;
        setTestCountdown(count);
        if (count === 0) {
          clearInterval(timer);
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 1000);

    } catch (err) {
      console.error('Mic test recording failed:', err);
    }
  };

  const handleJoin = () => {
    isJoiningRef.current = true;
    window.lobbyStream = localStream;
    
    // Save final states to sessionStorage
    sessionStorage.setItem('cameraOff', String(!cameraOn));
    sessionStorage.setItem('isMuted', String(!micOn));
    
    if (displayName.trim() && displayName !== user?.username) {
      const updatedUser = { ...user, username: displayName.trim() };
      login(updatedUser, sessionStorage.getItem('nexmeet_token'));
    }

    try {
      navigate(`/room/${roomId}`, {
        state: {
          initialMicOn: micOn,
          initialCameraOn: cameraOn,
          roomName: roomName,
          stream: localStream,
          showMeetingReady: location.state?.showMeetingReady
        }
      });
    } catch (e) {
      console.warn("Could not pass stream via state, utilizing global fallback:", e);
      navigate(`/room/${roomId}`, {
        state: {
          initialMicOn: micOn,
          initialCameraOn: cameraOn,
          roomName: roomName,
          showMeetingReady: location.state?.showMeetingReady
        }
      });
    }
  };

  if (validating) {
    return <Loader message="Verifying room credentials..." />;
  }

  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      background: '#1C1C1E'
    }}>
      <div className="lobby-container-page" style={{ paddingBottom: '60px' }}>
      <Navbar />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="lobby-floating-toast">
          <span className="material-icons-round">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="lobby-content-layout">
        {/* LEFT COLUMN: CAMERA PREVIEW & FLOATING CONTROLS */}
        <div className="lobby-preview-pane">
          <div className="camera-preview-box">
            {loadingRoom ? (
              <div className="preview-loading-card">
                <span className="material-icons-round spin-loader">sync</span>
                <p>Initializing camera...</p>
              </div>
            ) : permissionError ? (
              <div className="preview-error-card">
                <span className="material-icons-round error-icon">videocam_off</span>
                <h4>Camera and microphone access blocked</h4>
                <p>Allow camera/microphone permissions in your browser bar, then click reload.</p>
                <button className="btn-primary btn-reload" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            ) : !cameraOn ? (
              <div className="preview-avatar-fallback">
                <div className="preview-avatar-circle">
                  {getInitials(displayName || user?.username)}
                </div>
                <p className="preview-status-text">Your camera is off</p>
                
                {/* Embedded Display Name Badge */}
                <div className="preview-name-badge">
                  <span>{displayName || user?.username}</span>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="preview-video-tag"
                />
                
                {/* Embedded Display Name Badge */}
                <div className="preview-name-badge">
                  <span>{displayName || user?.username}</span>
                </div>
              </div>
            )}

            {/* FLOATING GLASS PILL CONTROLS */}
            {!permissionError && !loadingRoom && (
              <div className="preview-floating-controls">
                {/* Equalizer dots */}
                <div className="preview-audio-visualizer">
                  <div className="level-dot-bar">
                    {[1, 2, 3, 4, 5].map((idx) => {
                      const active = audioLevel >= idx * 12;
                      return (
                        <span key={idx} className={`level-dot ${active ? 'active' : ''}`} />
                      );
                    })}
                  </div>
                </div>

                <div className="preview-control-buttons">
                  <button
                    className={`preview-pill-btn ${!micOn ? 'btn-inactive-red' : ''}`}
                    onClick={toggleMic}
                    title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    <span className="material-icons-round">
                      {micOn ? 'mic' : 'mic_off'}
                    </span>
                  </button>
                  <button
                    className={`preview-pill-btn ${!cameraOn ? 'btn-inactive-red' : ''}`}
                    onClick={toggleCamera}
                    title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
                  >
                    <span className="material-icons-round">
                      {cameraOn ? 'videocam' : 'videocam_off'}
                    </span>
                  </button>
                  <button className="preview-pill-btn button-more" title="Device settings">
                    <span className="material-icons-round">more_vert</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MIC RECORDER TEST */}
          {!permissionError && !loadingRoom && (
            <div className="mic-diagnostic-block">
              {isRecording ? (
                <span className="diagnostic-status rec">
                  <span className="material-icons-round pulse">fiber_manual_record</span>
                  Recording voice test... {testCountdown}s
                </span>
              ) : isPlayingBack ? (
                <span className="diagnostic-status play">
                  <span className="material-icons-round">volume_up</span>
                  Voice test playback...
                </span>
              ) : (
                <button className="btn-diagnostic-trigger" onClick={startMicTest}>
                  <span className="material-icons-round">graphic_eq</span>
                  Test microphone playback
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: JOIN DETAILS PANEL */}
        <div className="lobby-join-pane">
          <div className="glass-card join-glass-panel">
            {/* Top ready badge */}
            <div className="join-ready-badge">
              <span className="ready-green-dot"></span>
              <span>Ready to join?</span>
            </div>

            <h2 className="join-room-title">{roomName || 'NexMeet Meeting'}</h2>

            {/* Display Name Input */}
            <div className={`google-material-group ${nameFocused || displayName ? 'active' : ''}`}>
              <input
                type="text"
                id="displayNameInput"
                className="google-material-input"
                placeholder=" "
                value={displayName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loadingRoom}
                autoComplete="off"
              />
              <label className="google-material-label" htmlFor="displayNameInput">
                Join as
              </label>
            </div>

            {/* Action Buttons */}
            <div className="lobby-join-action-buttons">
              <button
                className="btn-join-gradient"
                onClick={handleJoin}
                disabled={loadingRoom}
              >
                Join Now
              </button>
              
              <button 
                className="btn-present-secondary" 
                onClick={handleJoin}
                disabled={loadingRoom}
              >
                <span className="material-icons-round">present_to_all</span>
                Present
              </button>
            </div>

            <div className="lobby-link-section">
              <p className="lobby-link-label">
                Share this link to invite others:
              </p>
              <div className="lobby-link-box">
                <input 
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="lobby-link-input"
                  onClick={(e) => e.target.select()}
                />
                <button 
                  className="lobby-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      window.location.href
                    )
                    showToast('Link copied!')
                  }}>
                  <span className="material-icons-round">
                    content_copy
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default Lobby;
