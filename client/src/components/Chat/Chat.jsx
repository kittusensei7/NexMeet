import { useState, useRef, useEffect } from 'react';
import { getInitials } from '../../utils/helpers';
import './Chat.css';

/**
 * Chat Component
 * Completely redesigned to match the frosted glass panel layout.
 */
const Chat = ({ messages = [], onSendMessage, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const insertEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
    setShowEmoji(false);
  };

  return (
    <div className="google-chat-panel slide-in-panel" id="nexmeet-chat">
      {/* HEADER */}
      <div className="chat-header-section">
        <div className="chat-header-top">
          <h3>Meeting Chat</h3>
          <button 
            className="chat-close-button-circle" 
            onClick={onClose} 
            aria-label="Close Chat"
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>
        <p className="chat-header-sub">
          Messages are cleared when the call ends. Only people in the meeting can view them.
        </p>
      </div>

      {/* MESSAGES VIEWPORT */}
      <div className="chat-messages-container">
        {messages.map((msg, index) => {
          if (msg.isSystem) {
            return (
              <div key={index} className="chat-msg-system-info">
                <span>{msg.text}</span>
                <span className="chat-msg-system-time">{msg.time}</span>
              </div>
            );
          }

          return (
            <div key={index} className={`chat-bubble-row ${msg.isOwn ? 'own-msg' : 'remote-msg'}`}>
              {/* Header metadata */}
              <div className="chat-bubble-meta">
                <span className="chat-bubble-sender">{msg.isOwn ? 'You' : msg.username}</span>
                <span className="chat-bubble-time">{msg.time}</span>
              </div>

              {/* Message Pill content */}
              <div className="chat-bubble-content-block">
                {!msg.isOwn && (
                  <div className="chat-bubble-avatar">
                    {getInitials(msg.username)}
                  </div>
                )}
                
                <div className="chat-bubble-text-wrapper">
                  <p className="chat-bubble-text">{msg.text}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* COMPOSER AT BOTTOM */}
      <div className="chat-composer-section">
        {showEmoji && (
          <div className="chat-quick-emoji-bar">
            {['👋', '👍', '👏', '😂', '🔥', '❤️', '🎉', '💡'].map(emoji => (
              <button 
                key={emoji}
                type="button" 
                onClick={() => insertEmoji(emoji)}
                className="quick-emoji-item"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="chat-composer-form">
          <div className="composer-glass-wrapper">
            {/* Emoji toggle btn */}
            <button
              type="button"
              className="composer-action-btn-circle"
              onClick={() => setShowEmoji(!showEmoji)}
              title="Add emoji"
            >
              <span className="material-icons-round">sentiment_satisfied_alt</span>
            </button>

            <input
              type="text"
              className="composer-text-input"
              placeholder="Send a message to everyone"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              autoComplete="off"
            />

            {/* Blue circle send button */}
            <button 
              type="submit" 
              className={`composer-send-btn-circle ${inputText.trim() ? 'enabled-blue' : ''}`}
              disabled={!inputText.trim()}
              title="Send message"
            >
              <span className="material-icons-round">send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
