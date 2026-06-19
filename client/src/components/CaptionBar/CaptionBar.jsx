import './CaptionBar.css';

/**
 * CaptionBar Component
 * Renders bottom-centered subtitle lines similar to YouTube/Netflix.
 */
const CaptionBar = ({ captions, myCaption, myUsername }) => {
  const allCaptions = [];
  
  if (myCaption?.text) {
    allCaptions.push({
      username: myUsername,
      text: myCaption.text,
      isSelf: true,
      isFinal: myCaption.isFinal
    });
  }
  
  Object.values(captions).forEach(c => {
    if (c.text) {
      allCaptions.push(c);
    }
  });

  if (allCaptions.length === 0) return null;

  return (
    <div className="caption-overlay">
      {allCaptions.map((c, i) => (
        <div key={i} className="caption-line">
          <span className="caption-speaker">
            {c.username}
          </span>
          <span className={`caption-words ${c.isFinal ? 'final' : 'interim'}`}>
            {c.text}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CaptionBar;
