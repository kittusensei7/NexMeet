import { useState, useRef, useEffect } from 'react';
import EmojiPicker from '../EmojiPicker/EmojiPicker';
import './Controls.css';

/**
 * Controls Component
 * Completely redesigned premium control center bar.
 * Layout order: [Mic+▲] [Cam+▲] [CC] [Hand] [React] [Share] [More] | [Chat] [People] | [Leave]
 */
const Controls = ({
  isMuted,
  isCameraOff,
  isScreenSharing,
  isHandRaised,
  unreadMessages,
  participantCount,
  activeSidebar,
  audioDevices = [],
  videoDevices = [],
  selectedAudioId,
  selectedVideoId,
  layoutMode,
  onSelectAudioDevice,
  onSelectVideoDevice,
  onChangeLayout,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSidebar,
  onToggleHandRaise,
  onSendReaction,
  onLeaveClick,
  onOpenSettings,
  onToggleCaptions,
  isCaptionOn
}) => {
  // Dropdown states
  const [micDropdownOpen, setMicDropdownOpen] = useState(false);
  const [camDropdownOpen, setCamDropdownOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  // Refs for click outside triggers
  const micRef = useRef(null);
  const camRef = useRef(null);
  const emojiRef = useRef(null);
  const moreRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (micRef.current && !micRef.current.contains(event.target)) setMicDropdownOpen(false);
      if (camRef.current && !camRef.current.contains(event.target)) setCamDropdownOpen(false);
      if (emojiRef.current && !emojiRef.current.contains(event.target)) setEmojiOpen(false);
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreDropdownOpen(false);
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLayoutSelect = (mode) => {
    onChangeLayout(mode);
    setLayoutMenuOpen(false);
    setMoreDropdownOpen(false);
  };

  return (
    <div className="custom-meeting-controls">
      {/* GROUP 1: MEDIA & OPTIONS */}
      <div className="controls-group">
        {/* MIC & SELECTOR */}
        <div className="btn-split-wrapper" ref={micRef}>
          <button
            className={`btn-control-circle ${isMuted ? 'active-off-red' : ''}`}
            onClick={onToggleAudio}
            aria-label="Toggle mic"
          >
            <span className="material-icons-round">
              {isMuted ? 'mic_off' : 'mic'}
            </span>
            <span className="btn-tooltip">{isMuted ? 'Turn on mic' : 'Turn off mic'}</span>
          </button>
          <button 
            className={`btn-chevron-dropdown ${isMuted ? 'dropdown-off-red' : ''}`}
            onClick={() => setMicDropdownOpen(!micDropdownOpen)}
            aria-label="Microphone settings"
          >
            <span className="material-icons-round">keyboard_arrow_up</span>
          </button>

          {micDropdownOpen && (
            <div className="controls-selector-dropdown">
              <h4>Select Microphone</h4>
              <div className="selector-divider"></div>
              {audioDevices.length === 0 ? (
                <p className="no-devices">No microphone detected</p>
              ) : (
                audioDevices.map((d) => (
                  <button
                    key={d.deviceId}
                    className={`selector-item ${selectedAudioId === d.deviceId ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectAudioDevice(d.deviceId);
                      setMicDropdownOpen(false);
                    }}
                  >
                    <span className="material-icons-round">
                      {selectedAudioId === d.deviceId ? 'check' : 'mic'}
                    </span>
                    <span className="label-text">{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* CAMERA & SELECTOR */}
        <div className="btn-split-wrapper" ref={camRef}>
          <button
            className={`btn-control-circle ${isCameraOff ? 'active-off-red' : ''}`}
            onClick={onToggleVideo}
            aria-label="Toggle camera"
          >
            <span className="material-icons-round">
              {isCameraOff ? 'videocam_off' : 'videocam'}
            </span>
            <span className="btn-tooltip">{isCameraOff ? 'Turn on camera' : 'Turn off camera'}</span>
          </button>
          <button 
            className={`btn-chevron-dropdown ${isCameraOff ? 'dropdown-off-red' : ''}`}
            onClick={() => setCamDropdownOpen(!camDropdownOpen)}
            aria-label="Camera settings"
          >
            <span className="material-icons-round">keyboard_arrow_up</span>
          </button>

          {camDropdownOpen && (
            <div className="controls-selector-dropdown">
              <h4>Select Camera</h4>
              <div className="selector-divider"></div>
              {videoDevices.length === 0 ? (
                <p className="no-devices">No camera detected</p>
              ) : (
                videoDevices.map((d) => (
                  <button
                    key={d.deviceId}
                    className={`selector-item ${selectedVideoId === d.deviceId ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectVideoDevice(d.deviceId);
                      setCamDropdownOpen(false);
                    }}
                  >
                    <span className="material-icons-round">
                      {selectedVideoId === d.deviceId ? 'check' : 'videocam'}
                    </span>
                    <span className="label-text">{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* CLOSED CAPTIONS CC */}
        <button 
          className={`btn-control-circle ${isCaptionOn ? 'active-blue' : ''}`}
          onClick={onToggleCaptions}
          aria-label="Toggle subtitles"
        >
          <span className="material-icons-round">closed_caption</span>
          <span className="btn-tooltip">{isCaptionOn ? 'Turn off captions' : 'Turn on captions'}</span>
        </button>

        {/* RAISE HAND */}
        <button 
          className={`btn-control-circle ${isHandRaised ? 'active-blue' : ''}`}
          onClick={onToggleHandRaise}
          aria-label="Raise hand"
        >
          <span className="material-icons-round">back_hand</span>
          <span className="btn-tooltip">{isHandRaised ? 'Lower hand' : 'Raise hand'}</span>
        </button>

        {/* EMOTICON REACTION */}
        <div className="reaction-dropdown-anchor" ref={emojiRef}>
          <button 
            className={`btn-control-circle ${emojiOpen ? 'active-blue' : ''}`}
            onClick={() => setEmojiOpen(!emojiOpen)}
            aria-label="React emoji"
          >
            <span className="material-icons-round">add_reaction</span>
            <span className="btn-tooltip">Send reaction</span>
          </button>
          {emojiOpen && (
            <div className="floating-emoji-picker-box">
              <EmojiPicker onSelectEmoji={(emoji) => {
                onSendReaction(emoji);
                setEmojiOpen(false);
              }} />
            </div>
          )}
        </div>

        {/* SHARE SCREEN PRESENT */}
        <button 
          className={`btn-control-circle ${isScreenSharing ? 'active-green' : ''}`}
          onClick={onToggleScreenShare}
          aria-label="Present now"
        >
          <span className="material-icons-round">
            {isScreenSharing ? 'stop_screen_share' : 'present_to_all'}
          </span>
          <span className="btn-tooltip">{isScreenSharing ? 'Stop presenting' : 'Present screen'}</span>
        </button>

        {/* MORE OPTIONS */}
        <div className="more-dropdown-anchor" ref={moreRef}>
          <button 
            className={`btn-control-circle ${moreDropdownOpen ? 'active-blue' : ''}`}
            onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
            aria-label="More features"
          >
            <span className="material-icons-round">more_vert</span>
            <span className="btn-tooltip">More options</span>
          </button>
          
          {moreDropdownOpen && (
            <div className="controls-more-options-dropdown">
              {!layoutMenuOpen ? (
                <>
                  <button onClick={() => setLayoutMenuOpen(true)}>
                    <span className="material-icons-round">dashboard</span>
                    Change layout
                  </button>
                  <button onClick={() => { 
                    setMoreDropdownOpen(false); 
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else {
                      document.documentElement.requestFullscreen();
                    }
                  }}>
                    <span className="material-icons-round">fullscreen</span>
                    Toggle fullscreen
                  </button>
                  <button onClick={() => { 
                    setMoreDropdownOpen(false); 
                    if (onOpenSettings) onOpenSettings();
                  }}>
                    <span className="material-icons-round">settings</span>
                    Settings
                  </button>
                </>
              ) : (
                <div className="more-layout-picker">
                  <button className="back-to-options" onClick={() => setLayoutMenuOpen(false)}>
                    <span className="material-icons-round">arrow_back</span>
                    Back
                  </button>
                  <div className="selector-divider"></div>
                  {['auto', 'tiled', 'spotlight', 'sidebar'].map((mode) => (
                    <button 
                      key={mode}
                      className={`selector-item ${layoutMode === mode ? 'selected' : ''}`}
                      onClick={() => handleLayoutSelect(mode)}
                    >
                      <span className="material-icons-round">
                        {layoutMode === mode ? 'check' : 'radio_button_unchecked'}
                      </span>
                      <span className="label-text-capitalize">{mode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DIVIDER */}
      <div className="vertical-controls-divider"></div>

      {/* GROUP 2: SIDEBAR LISTS */}
      <div className="controls-group">
        {/* CHAT TOGGLE */}
        <button 
          className={`btn-control-circle ${activeSidebar === 'chat' ? 'active-blue' : ''}`}
          onClick={() => onToggleSidebar('chat')}
          aria-label="Chat panel"
        >
          <span className="material-icons-round">chat</span>
          {unreadMessages > 0 && <span className="controls-badge-count count-red">{unreadMessages}</span>}
          <span className="btn-tooltip">Chat with everyone</span>
        </button>

        {/* PEOPLE LIST TOGGLE */}
        <button 
          className={`btn-control-circle ${activeSidebar === 'participants' ? 'active-blue' : ''}`}
          onClick={() => onToggleSidebar('participants')}
          aria-label="Roster panel"
        >
          <span className="material-icons-round">people</span>
          {participantCount > 0 && <span className="controls-badge-count count-blue">{participantCount}</span>}
          <span className="btn-tooltip">Show everyone</span>
        </button>
      </div>

      {/* DIVIDER */}
      <div className="vertical-controls-divider"></div>

      {/* GROUP 3: HANG UP */}
      <div className="controls-group">
        <button 
          className="btn-leave-call-gradient"
          onClick={onLeaveClick}
          aria-label="End meeting"
        >
          Leave call
        </button>
      </div>
    </div>
  );
};

export default Controls;
