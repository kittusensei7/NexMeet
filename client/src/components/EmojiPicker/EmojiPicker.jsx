import { useState, useEffect } from 'react';
import './EmojiPicker.css';

const EMOJIS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💯', label: 'Perfect' },
];

const EXTENDED_EMOJIS = [
  { emoji: '😊', label: 'Smile' },
  { emoji: '🤣', label: 'ROFL' },
  { emoji: '🤔', label: 'Thinking' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '🙏', label: 'Thanks' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '🚀', label: 'Rocket' },
  { emoji: '👀', label: 'Eyes' },
  { emoji: '☠️', label: 'Dead' },
  { emoji: '💩', label: 'Poop' },
  { emoji: '🤡', label: 'Clown' },
  { emoji: '🌟', label: 'Star' },
  { emoji: '🎈', label: 'Balloon' },
  { emoji: '🤝', label: 'Deal' },
  { emoji: '👋', label: 'Wave' },
  { emoji: '💔', label: 'Broken' }
];

/**
 * EmojiPicker Component
 * Displays main reactions at the top and scrollable tray at the bottom,
 * with 2s cooldown throttling and visual cooldown ring indicators.
 */
const EmojiPicker = ({ onSelectEmoji }) => {
  const [cooldowns, setCooldowns] = useState({}); // { [emoji]: endTime }
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleEmojiClick = (emoji) => {
    const now = currentTime;
    if (cooldowns[emoji] && now < cooldowns[emoji]) {
      return;
    }

    setCooldowns(prev => ({
      ...prev,
      [emoji]: now + 400
    }));

    onSelectEmoji(emoji);
  };

  const getCooldownProgress = (emoji) => {
    const now = currentTime;
    const endTime = cooldowns[emoji];
    if (!endTime || now >= endTime) return 0;
    return ((endTime - now) / 400) * 100;
  };

  const renderEmojiButton = (item) => {
    const progress = getCooldownProgress(item.emoji);
    const onCooldown = progress > 0;

    return (
      <button
        key={item.emoji}
        className={`emoji-btn ${onCooldown ? 'on-cooldown' : ''}`}
        onClick={() => handleEmojiClick(item.emoji)}
        title={onCooldown ? `${item.label} (cooldown)` : item.label}
        disabled={onCooldown}
      >
        {onCooldown && (
          <svg className="cooldown-ring" viewBox="0 0 36 36">
            <path
              className="cooldown-ring-circle"
              strokeDasharray={`${progress}, 100`}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
        )}
        <span className="emoji-char">{item.emoji}</span>
        <span className="emoji-label">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="emoji-picker">
      <h4 className="emoji-picker-title">Reactions</h4>
      <div className="emoji-grid main-emojis">
        {EMOJIS.map(renderEmojiButton)}
      </div>
      <div className="emoji-picker-divider"></div>
      <h4 className="emoji-picker-title">More Reactions</h4>
      <div className="emoji-grid extended-emojis scroll-tray">
        {EXTENDED_EMOJIS.map(renderEmojiButton)}
      </div>
    </div>
  );
};

export default EmojiPicker;
