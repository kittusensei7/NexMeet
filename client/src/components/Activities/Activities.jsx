import { useState, useRef, useEffect } from 'react';
import './Activities.css';

const Activities = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'whiteboard' | 'polls'
  
  // Whiteboard drawing states
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1A73E8');
  const [lineWidth, setLineWidth] = useState(4);

  // Polls state
  const [polls, setPolls] = useState([
    {
      id: 1,
      question: "How do you rate the NexMeet UX/UI design?",
      options: [
        { label: "Premium & Stunning", votes: 12 },
        { label: "Good / Standard", votes: 4 },
        { label: "Needs Improvements", votes: 1 }
      ],
      userVoted: null // index of voted option
    },
    {
      id: 2,
      question: "Should we implement End-to-End Encryption?",
      options: [
        { label: "Yes, definitely", votes: 20 },
        { label: "No, unnecessary", votes: 2 }
      ],
      userVoted: null
    }
  ]);

  // Set up whiteboard canvas listeners
  useEffect(() => {
    if (activeTab === 'whiteboard' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Fill canvas background white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [activeTab]);

  // Whiteboard drawing handlers
  const startDrawing = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    // Support mobile touch and desktop mouse coords
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Poll voting handler
  const handleVote = (pollId, optionIdx) => {
    setPolls(prev => prev.map(poll => {
      if (poll.id !== pollId) return poll;
      if (poll.userVoted !== null) return poll; // restrict double vote
      
      const newOptions = poll.options.map((opt, idx) => {
        if (idx === optionIdx) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      return { ...poll, options: newOptions, userVoted: optionIdx };
    }));
  };

  return (
    <div className="google-activities-drawer">
      <div className="google-activities-header">
        {activeTab !== 'overview' && (
          <button className="activities-back-btn" onClick={() => setActiveTab('overview')}>
            <span className="material-icons-round">arrow_back</span>
          </button>
        )}
        <h3>
          {activeTab === 'overview' && "Activities"}
          {activeTab === 'whiteboard' && "Interactive Whiteboard"}
          {activeTab === 'polls' && "Real-time Polls"}
        </h3>
        <button className="google-activities-close-btn" onClick={onClose}>
          <span className="material-icons-round">close</span>
        </button>
      </div>

      <div className="google-activities-content">
        {/* OVERVIEW SCREEN */}
        {activeTab === 'overview' && (
          <div className="activities-overview-list">
            <p className="activities-info-desc">Select an activity to collaborate with other participants in real-time.</p>
            
            <button className="activity-card-btn" onClick={() => setActiveTab('whiteboard')}>
              <div className="activity-card-icon-wrapper blue">
                <span className="material-icons-round">gesture</span>
              </div>
              <div className="activity-card-text">
                <h4>Whiteboarding</h4>
                <p>Draw, sketch, and brainstorm together on a shared digital canvas.</p>
              </div>
              <span className="material-icons-round card-arrow">chevron_right</span>
            </button>

            <button className="activity-card-btn" onClick={() => setActiveTab('polls')}>
              <div className="activity-card-icon-wrapper green">
                <span className="material-icons-round">poll</span>
              </div>
              <div className="activity-card-text">
                <h4>Polls</h4>
                <p>Create quick vote surveys and check real-time participant responses.</p>
              </div>
              <span className="material-icons-round card-arrow">chevron_right</span>
            </button>
          </div>
        )}

        {/* WHITEBOARD SCREEN */}
        {activeTab === 'whiteboard' && (
          <div className="activities-whiteboard-stage">
            <div className="whiteboard-toolbar">
              <div className="whiteboard-colors">
                {['#1A73E8', '#EA4335', '#34A853', '#FBBC04', '#202124'].map(c => (
                  <button 
                    key={c}
                    className={`color-dot ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              
              <div className="whiteboard-widths">
                {[2, 4, 8, 12].map(w => (
                  <button 
                    key={w}
                    className={`width-btn ${lineWidth === w ? 'active' : ''}`}
                    onClick={() => setLineWidth(w)}
                  >
                    <span className="dot" style={{ width: `${w + 2}px`, height: `${w + 2}px` }} />
                  </button>
                ))}
              </div>

              <button className="whiteboard-clear-btn" onClick={clearCanvas} title="Clear board">
                <span className="material-icons-round">delete</span>
                Clear
              </button>
            </div>

            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={320}
                height={380}
                className="whiteboard-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="whiteboard-help-text">Click and drag inside the area to sketch.</p>
          </div>
        )}

        {/* POLLS SCREEN */}
        {activeTab === 'polls' && (
          <div className="activities-polls-stage">
            <div className="polls-list">
              {polls.map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
                return (
                  <div key={poll.id} className="poll-item-card">
                    <h4 className="poll-question-title">{poll.question}</h4>
                    <div className="poll-options-list">
                      {poll.options.map((option, idx) => {
                        const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                        const isSelected = poll.userVoted === idx;
                        const hasVoted = poll.userVoted !== null;
                        
                        return (
                          <div key={idx} className="poll-option-row">
                            {hasVoted ? (
                              <div className="poll-results-bar-wrapper">
                                <div className="poll-results-bar-fill" style={{ width: `${percent}%` }} />
                                <span className="poll-results-label">
                                  {option.label} {isSelected && " (Your vote)"}
                                </span>
                                <span className="poll-results-percent">{percent}% ({option.votes})</span>
                              </div>
                            ) : (
                              <button 
                                className="poll-option-vote-btn"
                                onClick={() => handleVote(poll.id, idx)}
                              >
                                <span className="material-icons-round checkbox-icon">radio_button_unchecked</span>
                                <span className="option-label">{option.label}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {poll.userVoted !== null && (
                      <p className="poll-votes-total">Total votes: {totalVotes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Activities;
