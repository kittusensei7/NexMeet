import { useState, useRef, useEffect } from 'react';
import { getInitials } from '../../utils/helpers';
import './Participants.css';

/**
 * Participants Component
 * Redesigned to support a modern list with custom avatar hash-generated background colors.
 */
const Participants = ({ participants = [], onClose, onPinParticipant, pinnedId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredParticipants = participants.filter((p) =>
    (p.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePinClick = (socketId) => {
    onPinParticipant(socketId);
    setActiveMenuId(null);
  };

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
    }
  };

  const getAvatarGradient = (name) => {
    const avatarColors = [
      'linear-gradient(135deg, #0A84FF, #5E5CE6)',
      'linear-gradient(135deg, #30D158, #0A84FF)',
      'linear-gradient(135deg, #FF9F0A, #FF3B30)',
      'linear-gradient(135deg, #5E5CE6, #BF5AF2)',
      'linear-gradient(135deg, #64D2FF, #0A84FF)',
    ];
    const firstChar = name && name.length > 0 ? name.charCodeAt(0) : 85; // 'U' character code fallback
    const colorIndex = firstChar % 5;
    return avatarColors[colorIndex];
  };

  return (
    <div className="google-participants-panel slide-in-panel" id="nexmeet-participants">
      {/* HEADER */}
      <div className="participants-header-section">
        <div className="participants-title-row">
          <h3>People ({participants.length})</h3>
          <div className="participants-header-actions">
            <button 
              className={`participants-action-btn ${showSearch ? 'active' : ''}`}
              onClick={handleSearchToggle}
              title="Search participants"
            >
              <span className="material-icons-round">search</span>
            </button>
            <button 
              className="participants-action-btn" 
              onClick={onClose} 
              title="Close panel"
            >
              <span className="material-icons-round">close</span>
            </button>
          </div>
        </div>

        {/* SEARCH BAR INPUT */}
        {showSearch && (
          <div className="participants-search-bar">
            <input
              type="text"
              className="participants-search-field"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              autoComplete="off"
            />
            {searchQuery && (
              <button 
                className="search-clear-action"
                onClick={() => setSearchQuery('')}
              >
                <span className="material-icons-round">clear</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* PARTICIPANTS ROSTER LIST */}
      <div className="participants-body-section">
        <span className="in-call-label">In this meeting</span>

        <div className="participants-list-view">
          {filteredParticipants.map((p) => {
            const isUserPinned = pinnedId === p.socketId;
            return (
              <div key={p.socketId} className="participant-row-tile">
                <div className="participant-row-left">
                  <div
                    className="participant-row-avatar"
                    style={{ background: getAvatarGradient(p.username) }}
                  >
                    {getInitials(p.username || 'U')}
                  </div>
                  <div className="participant-row-info">
                    <span className="participant-name-text">
                      {p.username || 'NexMeet User'}
                      {p.isLocal && ' (You)'}
                    </span>
                    {p.isHost && <span className="host-indicator-chip">Host</span>}
                  </div>
                </div>

                <div className="participant-row-right">
                  {p.isHandRaised && (
                    <span className="participant-indicator-icon hand" title="Hand raised">
                      <span className="material-icons-round">back_hand</span>
                    </span>
                  )}
                  
                  <span 
                    className={`participant-indicator-icon mic ${p.isMuted ? 'muted' : ''}`}
                    title={p.isMuted ? 'Muted' : 'Voice enabled'}
                  >
                    <span className="material-icons-round">
                      {p.isMuted ? 'mic_off' : 'mic'}
                    </span>
                  </span>

                  <span 
                    className={`participant-indicator-icon cam ${p.isCameraOff ? 'off' : ''}`}
                    title={p.isCameraOff ? 'Camera off' : 'Camera enabled'}
                  >
                    <span className="material-icons-round">
                      {p.isCameraOff ? 'videocam_off' : 'videocam'}
                    </span>
                  </span>

                  {/* Context dropdown menu */}
                  <div className="participant-actions-anchor">
                    <button 
                      className="row-menu-trigger-btn"
                      onClick={() => setActiveMenuId(activeMenuId === p.socketId ? null : p.socketId)}
                      title="Actions"
                    >
                      <span className="material-icons-round">more_vert</span>
                    </button>
                    {activeMenuId === p.socketId && (
                      <div className="participant-context-dropdown" ref={menuRef}>
                        <button onClick={() => handlePinClick(p.socketId)}>
                          <span className="material-icons-round">push_pin</span>
                          {isUserPinned ? 'Unpin video' : 'Pin video'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredParticipants.length === 0 && (
            <div className="participants-empty-search">No match found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Participants;
