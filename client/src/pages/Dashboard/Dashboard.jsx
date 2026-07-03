import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar/Navbar';
import api from '../../api/axios';
import { copyToClipboard, formatDateTime } from '../../utils/helpers';
import './Dashboard.css';

const extractRoomId = (input) => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('/') || trimmed.includes('localhost') || trimmed.startsWith('http')) {
      const parts = trimmed.split('/');
      const lastSegment = parts.filter(Boolean).pop();
      if (lastSegment) {
        return lastSegment.split('?')[0].split('#')[0];
      }
    }
  } catch (e) {
    console.warn('Error extracting room ID:', e);
  }
  return trimmed;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState(formatDateTime());

  // Action / State flags
  const [joinRoomId, setJoinRoomId] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [newMeetingDropdownOpen, setNewMeetingDropdownOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [laterMeetingId, setLaterMeetingId] = useState(null);
  const [showLaterModal, setShowLaterModal] = useState(false);

  // Settings states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('audio'); // 'audio' | 'video' | 'general'
  const [micDevices, setMicDevices] = useState([]);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [lightTheme, setLightTheme] = useState(() => {
    return localStorage.getItem('theme') === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
  });

  const [toasts, setToasts] = useState([]);
  const toastCounterRef = useRef(0);
  const dropdownRef = useRef(null);
  const previewVideoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const navigate = useNavigate();

  // Greeting helper
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Clock updates
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentDateTime(formatDateTime());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Dropdown click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNewMeetingDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Media devices fetch for Settings Modal
  useEffect(() => {
    if (showSettingsModal) {
      const getDevices = async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices.filter(d => d.kind === 'audioinput');
          const cams = devices.filter(d => d.kind === 'videoinput');
          setMicDevices(mics);
          setCameraDevices(cams);
          if (mics.length > 0 && !selectedMic) setSelectedMic(mics[0].deviceId);
          if (cams.length > 0 && !selectedCamera) setSelectedCamera(cams[0].deviceId);
        } catch (e) {
          console.warn('Blocked settings devices retrieval:', e);
        }
      };
      getDevices();
    } else {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(t => t.stop());
        previewStreamRef.current = null;
      }
    }
  }, [showSettingsModal, selectedMic, selectedCamera]);

  // Settings webcam preview binding
  useEffect(() => {
    const startPreview = async () => {
      if (showSettingsModal && settingsTab === 'video' && selectedCamera) {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach(t => t.stop());
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedCamera } }
          });
          previewStreamRef.current = stream;
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Settings webcam preview failed:', err);
        }
      }
    };
    startPreview();
  }, [showSettingsModal, settingsTab, selectedCamera]);

  const addToast = useCallback((message, type = 'success') => {
    toastCounterRef.current += 1;
    const id = toastCounterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Fetch fresh rooms helper for updates/deletions
  const fetchMyRooms = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoadingRecent(true);
    }
    try {
      const response = await api.get('/api/rooms/my-rooms');
      setRecentRooms(response.data);
    } catch (error) {
      console.error('Failed to retrieve meetings:', error);
      addToast('Failed to retrieve recent meetings.', 'error');
    } finally {
      setLoadingRecent(false);
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    let active = true;
    const loadRooms = async () => {
      try {
        const response = await api.get('/api/rooms/my-rooms');
        if (active) {
          setRecentRooms(response.data);
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      } finally {
        if (active) {
          setLoadingRecent(false);
        }
      }
    };
    loadRooms();
    return () => {
      active = false;
    };
  }, []);

  // Instant meeting handler
  const handleStartInstantMeeting = async () => {
    setNewMeetingDropdownOpen(false);
    setCreatingRoom(true);
    try {
      const response = await api.post('/api/rooms/create', { 
        roomName: `${user?.username || 'Guest'}'s Instant Meeting` 
      });
      const { roomId } = response.data;
      addToast('Instant meeting created!', 'success');
      setTimeout(() => {
        navigate(`/lobby/${roomId}`, { replace: true, state: { showMeetingReady: true } });
      }, 1000);
    } catch (error) {
      console.error('Failed to create instant meeting:', error);
      addToast('Failed to create room.', 'error');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Scheduled meeting link generator
  const handleCreateMeetingForLater = async () => {
    setNewMeetingDropdownOpen(false);
    setCreatingRoom(true);
    try {
      const response = await api.post('/api/rooms/create', { 
        roomName: `${user?.username || 'Guest'}'s Scheduled Meeting` 
      });
      const { roomId } = response.data;
      // Optimistic update of local state
      setRecentRooms((prev) => [
        {
          _id: Math.random().toString(),
          roomId,
          roomName: `${user?.username || 'Guest'}'s Scheduled Meeting`,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      setLaterMeetingId(roomId);
      setShowLaterModal(true);
      addToast('Meeting link generated!', 'success');
    } catch (error) {
      console.error('Failed to create scheduled meeting:', error);
      addToast('Failed to generate meeting link.', 'error');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleScheduleMeeting = () => {
    setNewMeetingDropdownOpen(false);
    addToast('Opening Google Calendar...', 'success');
    setTimeout(() => {
      window.open('https://calendar.google.com/calendar/r/event/edit?text=NexMeet+Video+Call', '_blank');
    }, 1000);
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    const cleanRoomId = extractRoomId(joinRoomId);

    if (!cleanRoomId) {
      addToast('Please enter a valid Room ID code or link.', 'error');
      return;
    }

    setJoiningRoom(true);
    try {
      const response = await api.get(`/api/rooms/validate/${cleanRoomId}`);
      if (response.data.valid) {
        addToast('Entering Lobby...', 'success');
        setTimeout(() => {
          navigate(`/lobby/${cleanRoomId}`, { replace: true });
        }, 1000);
      }
    } catch (error) {
      console.error('Validate room request failed:', error);
      addToast('The entered Room ID does not exist.', 'error');
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleCopyLink = async (id) => {
    const fullLink = `${window.location.origin}/lobby/${id}`;
    const success = await copyToClipboard(fullLink);
    if (success) {
      addToast('Meeting link copied!', 'success');
    } else {
      addToast('Failed to copy link.', 'error');
    }
  };

  const deleteRoom = async (roomId) => {
    // Optimistic update: remove from UI immediately
    setRecentRooms(prev => prev.filter(r => r.roomId !== roomId));
    try {
      await api.delete(`/api/rooms/${roomId}`);
      addToast('Meeting deleted permanently.', 'success');
    } catch (error) {
      console.error('Failed to delete room:', error);
      // Rollback list fresh from database
      fetchMyRooms(true);
      addToast('Failed to delete meeting', 'error');
    }
  };

  const handleThemeChange = (theme) => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      setLightTheme(true);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setLightTheme(false);
    }
  };

  const handleTestSpeaker = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 600);
      
      addToast('Speaker chime tested!', 'success');
    } catch (e) {
      console.error('Speaker test failed:', e);
    }
  };

  return (
    <div className="new-dashboard-container">
      {/* Floating Navbar */}
      <Navbar 
        onOpenSettings={() => setShowSettingsModal(true)}
        currentDateTime={currentDateTime}
      />

      {/* Floating Toast Alerts */}
      <div className="dashboard-toast-overlay">
        {toasts.map((t) => (
          <div key={t.id} className={`custom-toast toast-${t.type}`}>
            <span className="material-icons-round">
              {t.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-content-layout">
        {/* HERO SECTION */}
        <section className="dashboard-hero-section">
          <h1 className="dashboard-greeting">
            {getGreeting()}, <span className="greeting-name">{user?.username || 'Guest'}</span> 👋
          </h1>
          <p className="dashboard-time-display">{currentDateTime}</p>
        </section>

        {/* 2 ACTION CARDS SIDE BY SIDE */}
        <section className="dashboard-action-cards">
          {/* Card 1: New Meeting */}
          <div className="glass-card action-card new-meeting-card" ref={dropdownRef}>
            <div className="action-card-header">
              <div className="card-icon-gradient-blue">
                <span className="material-icons-round">videocam</span>
              </div>
              <div className="card-header-titles">
                <h3>New Meeting</h3>
                <p>Start instantly or plan ahead</p>
              </div>
            </div>

            <div className="action-card-body">
              <button 
                className="btn-card-primary"
                onClick={() => setNewMeetingDropdownOpen(!newMeetingDropdownOpen)}
                disabled={creatingRoom}
              >
                Create meeting
                <span className="material-icons-round">keyboard_arrow_down</span>
              </button>

              {newMeetingDropdownOpen && (
                <div className="card-dropdown-menu">
                  <button onClick={handleCreateMeetingForLater}>
                    <span className="material-icons-round">link</span>
                    Create a meeting for later
                  </button>
                  <button onClick={handleStartInstantMeeting}>
                    <span className="material-icons-round">add</span>
                    Start an instant meeting
                  </button>
                  <button onClick={handleScheduleMeeting}>
                    <span className="material-icons-round">today</span>
                    Schedule in Calendar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Join Meeting */}
          <div className="glass-card action-card join-meeting-card">
            <div className="action-card-header">
              <div className="card-icon-gradient-green">
                <span className="material-icons-round">keyboard</span>
              </div>
              <div className="card-header-titles">
                <h3>Join Meeting</h3>
                <p>Enter meeting ID or invitation link</p>
              </div>
            </div>

            <form onSubmit={handleJoinMeeting} className="card-join-form">
              <input 
                type="text"
                placeholder="e.g. abc-defg-hij"
                className="card-join-input"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                disabled={joiningRoom}
              />
              <button 
                type="submit"
                className="btn-card-success"
                disabled={joiningRoom || !joinRoomId.trim()}
              >
                Join
              </button>
            </form>
          </div>
        </section>

        {/* RECENT MEETINGS LOGS */}
        <section className="dashboard-recent-section">
          <div className="recent-section-header">
            <h3>Recent Meetings</h3>
            <div className="recent-divider-line"></div>
          </div>

          {loadingRecent ? (
            <div className="recent-loading-placeholder">Fetching past meetings...</div>
          ) : recentRooms.length === 0 ? (
            <div className="recent-empty-placeholder">
              <span className="material-icons-round">history</span>
              <p>No recent meeting logs available.</p>
            </div>
          ) : (
            <div className="recent-meetings-grid">
              {recentRooms.map((room, index) => {
                const colors = [
                  'linear-gradient(135deg, #0A84FF, #5E5CE6)',
                  'linear-gradient(135deg, #30D158, #0A84FF)',
                  'linear-gradient(135deg, #FF9F0A, #FF3B30)',
                  'linear-gradient(135deg, #5E5CE6, #BF5AF2)'
                ];
                const calColor = colors[index % colors.length];
                const initialChar = (room.roomName || 'N').charAt(0).toUpperCase();

                return (
                  <div key={room._id} className="glass-card recent-meeting-tile">
                    <div className="recent-tile-left">
                      <div className="recent-tile-avatar" style={{ background: calColor }}>
                        {initialChar}
                      </div>
                      <div className="recent-tile-details">
                        <h4>{room.roomName || 'NexMeet Meeting'}</h4>
                        <p>
                          {new Date(room.createdAt).toLocaleDateString()} &bull; <code>{room.roomId}</code>
                        </p>
                      </div>
                    </div>

                    <div className="recent-tile-right">
                      <button 
                        className="btn-rejoin-pill"
                        onClick={() => navigate(`/lobby/${room.roomId}`, { replace: true })}
                      >
                        Rejoin
                      </button>

                      <div className="recent-tile-actions">
                        <button 
                          onClick={() => handleCopyLink(room.roomId)}
                          title="Copy link"
                        >
                          <span className="material-icons-round">content_copy</span>
                        </button>
                        <button 
                          className="delete-log-btn"
                          onClick={() => deleteRoom(room.roomId)}
                          title="Delete permanently"
                        >
                          <span className="material-icons-round">delete_outline</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* SCHEDULE LATER MODAL */}
      {showLaterModal && (
        <div className="google-modal-overlay">
          <div className="google-modal-card glass-card">
            <div className="google-modal-header">
              <h3>Your meeting is scheduled</h3>
              <button className="google-modal-close-btn" onClick={() => setShowLaterModal(false)}>
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <p className="google-modal-desc">
              Share this meeting link with other participants so they can join the call.
            </p>
            <div className="google-modal-link-box">
              <span className="google-modal-link-text">
                {`${window.location.origin}/lobby/${laterMeetingId}`}
              </span>
              <button 
                className="google-modal-copy-btn"
                onClick={() => handleCopyLink(laterMeetingId)}
                title="Copy Link"
              >
                <span className="material-icons-round">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS DIALOG */}
      {showSettingsModal && (
        <div className="google-modal-overlay">
          <div className="google-settings-modal-card glass-card">
            <div className="settings-modal-header">
              <h3>Settings</h3>
              <button className="google-modal-close-btn" onClick={() => setShowSettingsModal(false)}>
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="settings-modal-body">
              <div className="settings-tabs-menu">
                <button 
                  className={`settings-tab-item ${settingsTab === 'audio' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('audio')}
                >
                  <span className="material-icons-round">volume_up</span>
                  Audio
                </button>
                <button 
                  className={`settings-tab-item ${settingsTab === 'video' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('video')}
                >
                  <span className="material-icons-round">videocam</span>
                  Video
                </button>
                <button 
                  className={`settings-tab-item ${settingsTab === 'general' ? 'active' : ''}`}
                  onClick={() => setSettingsTab('general')}
                >
                  <span className="material-icons-round">settings_brightness</span>
                  Theme
                </button>
              </div>

              <div className="settings-panels-content">
                {settingsTab === 'audio' && (
                  <div className="settings-panel">
                    <h4>Audio settings</h4>
                    <div className="settings-control-group">
                      <label htmlFor="settings-mic">Microphone</label>
                      <select 
                        id="settings-mic"
                        className="google-settings-select"
                        value={selectedMic}
                        onChange={(e) => setSelectedMic(e.target.value)}
                      >
                        {micDevices.map(d => (
                           <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                        ))}
                        {micDevices.length === 0 && <option value="">Default Microphone</option>}
                      </select>
                    </div>

                    <div className="settings-control-group">
                      <label>Speakers</label>
                      <div className="settings-speaker-test-row">
                        <select className="google-settings-select test-speaker-select">
                          <option value="default">Default Speakers</option>
                        </select>
                        <button 
                          className="btn-google-secondary test-speaker-btn"
                          onClick={handleTestSpeaker}
                        >
                          <span className="material-icons-round">volume_up</span>
                          Test
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'video' && (
                  <div className="settings-panel">
                    <h4>Video settings</h4>
                    <div className="settings-control-group">
                      <label htmlFor="settings-camera">Camera</label>
                      <select 
                        id="settings-camera"
                        className="google-settings-select"
                        value={selectedCamera}
                        onChange={(e) => setSelectedCamera(e.target.value)}
                      >
                        {cameraDevices.map(d => (
                          <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                        ))}
                        {cameraDevices.length === 0 && <option value="">Default Camera</option>}
                      </select>
                    </div>

                    <div className="settings-camera-preview-wrapper">
                      {selectedCamera ? (
                        <video 
                          ref={previewVideoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="settings-camera-preview"
                        />
                      ) : (
                        <div className="preview-fallback-gray">
                          <span className="material-icons-round">videocam_off</span>
                          <span>Webcam preview unavailable</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === 'general' && (
                  <div className="settings-panel">
                    <h4>Interface appearance</h4>
                    <div className="settings-control-group">
                      <label>Visual Mode Theme</label>
                      <div className="theme-toggle-options">
                        <button 
                          className={`theme-toggle-btn ${!lightTheme ? 'active' : ''}`}
                          onClick={() => handleThemeChange('dark')}
                        >
                          <span className="material-icons-round">dark_mode</span>
                          Classic Dark
                        </button>
                        <button 
                          className={`theme-toggle-btn ${lightTheme ? 'active' : ''}`}
                          onClick={() => handleThemeChange('light')}
                        >
                          <span className="material-icons-round">light_mode</span>
                          Material Light
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="settings-modal-footer">
              <button 
                className="btn-google-primary settings-done-btn"
                onClick={() => setShowSettingsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
