import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getInitials } from '../../utils/helpers';
import './Navbar.css';

/**
 * Navbar Component
 * Overhauled to match Google Meet's sleek top header bar with sidebar hamburger.
 * Adds fully functional Help FAQ modal, rating Feedback modal, and NexSuite Apps grid.
 */
const Navbar = ({ onToggleSidebar, onOpenSettings, currentDateTime }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Custom Interaction States
  const [showApps, setShowApps] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const isLightTheme = theme === 'light';
  const handleToggleTheme = toggleTheme;
  
  // Feedback states
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const appsRef = useRef(null);
  const avatarRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (appsRef.current && !appsRef.current.contains(event.target)) {
        setShowApps(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenHelp = () => {
    setShowHelp(true);
    setDropdownOpen(false);
    setShowApps(false);
  };

  const handleOpenFeedback = () => {
    setShowFeedback(true);
    setFeedbackSubmitted(false);
    setRating(0);
    setFeedbackComment('');
    setDropdownOpen(false);
    setShowApps(false);
  };

  const handleOpenApps = () => {
    setShowApps(!showApps);
    setDropdownOpen(false);
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setShowFeedback(false);
    }, 2000);
  };

  return (
    <nav className="google-navbar" id="nexmeet-navbar">
      <div className="google-nav-left">
        {/* Responsive Hamburger Toggle */}
        <button 
          className="google-nav-icon-btn hamburger-menu" 
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
          style={{ marginRight: '8px' }}
        >
          <span className="material-icons-round">menu</span>
        </button>
        
        <span className="material-icons-round google-logo-icon">videocam</span>
        <span className="google-logo-text">NexMeet</span>
      </div>

      <div className="google-nav-right">
        {currentDateTime && (
          <div className="google-nav-time">
            {currentDateTime}
          </div>
        )}
        
        {/* Help icon */}
        <button 
          className="google-nav-icon-btn" 
          aria-label="Help"
          onClick={handleOpenHelp}
        >
          <span className="material-icons-round">help_outline</span>
        </button>

        {/* Feedback icon */}
        <button 
          className="google-nav-icon-btn" 
          aria-label="Send feedback"
          onClick={handleOpenFeedback}
        >
          <span className="material-icons-round">feedback</span>
        </button>

        {/* Theme Toggle icon */}
        <button 
          className="google-nav-icon-btn" 
          aria-label={isLightTheme ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          onClick={handleToggleTheme}
          title={isLightTheme ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          <span className="material-icons-round">
            {isLightTheme ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        {/* Settings icon */}
        <button 
          className="google-nav-icon-btn" 
          aria-label="Settings"
          onClick={onOpenSettings || (() => alert('Settings is available on Dashboard or Room screen.'))}
        >
          <span className="material-icons-round">settings</span>
        </button>

        {/* Apps grid icon */}
        <div ref={appsRef} style={{ position: 'relative' }}>
          <button 
            className="google-nav-icon-btn apps-grid-btn" 
            aria-label="NexMeet apps"
            onClick={handleOpenApps}
          >
            <span className="material-icons-round">apps</span>
          </button>
          
          {showApps && (
            <div className="google-apps-dropdown">
              <button className="google-app-item active" onClick={() => setShowApps(false)}>
                <span className="material-icons-round">videocam</span>
                <span className="google-app-name">NexMeet</span>
              </button>
              <button className="google-app-item" onClick={() => alert('Launching NexChat Suite...')}>
                <span className="material-icons-round">chat</span>
                <span className="google-app-name">NexChat</span>
              </button>
              <button className="google-app-item" onClick={() => alert('Launching NexDocs Suite...')}>
                <span className="material-icons-round">description</span>
                <span className="google-app-name">NexDocs</span>
              </button>
              <button className="google-app-item" onClick={() => alert('Opening NexCalendar...')}>
                <span className="material-icons-round">today</span>
                <span className="google-app-name">NexCalendar</span>
              </button>
              <button className="google-app-item" onClick={() => alert('Opening NexDrive Cloud...')}>
                <span className="material-icons-round">cloud_queue</span>
                <span className="google-app-name">NexDrive</span>
              </button>
              <button className="google-app-item" onClick={() => alert('Opening NexMail Inboxes...')}>
                <span className="material-icons-round">mail</span>
                <span className="google-app-name">NexMail</span>
              </button>
            </div>
          )}
        </div>

        {/* User avatar profile */}
        <div className="google-avatar-container" ref={avatarRef}>
          <button 
            className="google-nav-avatar" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="User account menu"
          >
            {getInitials(user?.username || 'U')}
          </button>

          {dropdownOpen && (
            <div className="google-avatar-dropdown">
              <div className="google-dropdown-info">
                <span className="google-dropdown-name">{user?.username || 'NexMeet User'}</span>
                <span className="google-dropdown-email">{user?.email || 'user@nexmeet.com'}</span>
              </div>
              <div className="google-dropdown-divider"></div>
              <button className="google-dropdown-logout-btn" onClick={logout}>
                <span className="material-icons-round">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* HELP & FAQ OVERLAY MODAL */}
      {showHelp && (
        <div className="google-modal-overlay">
          <div className="google-modal-card">
            <div className="google-modal-header">
              <h3>NexMeet Help Center</h3>
              <button 
                className="google-modal-close-btn"
                onClick={() => setShowHelp(false)}
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="google-faq-list">
              <div className="google-faq-item">
                <p className="google-faq-q">How do I invite others to join my meeting?</p>
                <p className="google-faq-a">Click "New meeting" and choose "Create meeting for later" or "Start instant meeting". Copy the generated code (e.g. abc-defg-hij) or link and share it with participants. They can enter it in the join code box on their dashboard.</p>
              </div>

              <div className="google-faq-item">
                <p className="google-faq-q">Why is my camera or microphone not working?</p>
                <p className="google-faq-a">Ensure that you have granted camera and microphone access to NexMeet in your browser's permissions settings, then click "Try again". You can also select other devices in the settings menu during a meeting.</p>
              </div>

              <div className="google-faq-item">
                <p className="google-faq-q">Can I test my mic level before joining?</p>
                <p className="google-faq-a">Yes! The Lobby (green room) has a mic level visualizer bar at the bottom left of the preview and a "Test Microphone" button to record a 3-second diagnostic playback of your voice.</p>
              </div>

              <div className="google-faq-item">
                <p className="google-faq-q">How do I share my screen?</p>
                <p className="google-faq-a">During a meeting, click the screen sharing button (arrow icon in a square) in the bottom control panel. Your browser will prompt you to select the window or monitor you wish to present.</p>
              </div>
            </div>
            
            <div className="google-modal-actions">
              <button className="btn-google-primary" onClick={() => setShowHelp(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK OVERLAY MODAL */}
      {showFeedback && (
        <div className="google-modal-overlay">
          <div className="google-modal-card">
            <div className="google-modal-header">
              <h3>Send Feedback to NexMeet</h3>
              <button 
                className="google-modal-close-btn"
                onClick={() => setShowFeedback(false)}
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <span className="material-icons-round" style={{ fontSize: '48px', color: 'var(--accent-green)', marginBottom: '12px' }}>check_circle</span>
                <h4 style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff' }}>Thank you for your feedback!</h4>
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '13px' }}>Your review helps us make NexMeet video calls better for everyone.</p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="google-feedback-form">
                <div className="google-rating-row">
                  <span className="google-rating-label">How would you rate your video call quality?</span>
                  <div className="google-rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          className={`google-star-btn ${isActive ? 'active' : ''}`}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                        >
                          <span className="material-icons-round">
                            {isActive ? 'star' : 'star_border'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="google-rating-row">
                  <label className="google-rating-label" htmlFor="feedback-comment">Tell us more (Optional)</label>
                  <textarea
                    id="feedback-comment"
                    className="google-feedback-textarea"
                    placeholder="What went well? What can we improve on NexMeet?"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                  />
                </div>

                <div className="google-modal-actions">
                  <button 
                    type="button" 
                    className="btn-google-secondary" 
                    onClick={() => setShowFeedback(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-google-primary"
                    disabled={rating === 0}
                  >
                    Submit
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
