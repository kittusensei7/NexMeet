/**
 * Utility helper functions for NexMeet Frontend
 */

/**
 * Extracts initials from a user's name
 * e.g., "Jagadeesh Babu" -> "JB", "Alice" -> "AL"
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return cleanName.slice(0, 2).toUpperCase();
};

/**
 * Copies a given string to the clipboard with modern API & fallback support
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback approach
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; // prevent scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return false;
  }
};

/**
 * Formats seconds into HH:MM:SS duration string
 */
export const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Formats a Date object into a readable localized greeting text
 */
export const formatDateTime = (date = new Date()) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};
