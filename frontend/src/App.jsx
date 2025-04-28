import { useState, useEffect } from 'react';
import axios from 'axios';
import "./App.css"

function App() {
  const [user, setUser] = useState(null);
  const [content, setContent] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [niche, setNiche] = useState('');
  const [idea, setIdea] = useState('');

 
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const name = urlParams.get('name');
    if (userId && name) {
      setUser({ id: userId, name: decodeURIComponent(name) });
    }
  }, []);
 
  const schedulePost = async () => {
    if (!content || !scheduledTime) {
      alert('Please enter content and scheduled time');
      return;
    }
    try {
      await axios.post('http://localhost:3000/schedule-post', {
        content,
        scheduled_time: scheduledTime,
        user_id: user.id,
      }, { withCredentials: true });
      alert('Post scheduled!');
      setContent('');
      setScheduledTime('');
    } catch (error) {
      console.error('Schedule post error:', error.response?.data || error.message);
      alert(`Failed to schedule post: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  // Generate AI post idea
  const generateIdea = async () => {
    if (!niche) {
      alert('Please enter a niche');
      return;
    }
    try {
      const response = await axios.post('http://localhost:3000/generate-idea', { niche }, { withCredentials: true });
      setIdea(response.data.idea);
    } catch (error) {
      console.log(error.message)
    }
  };

  return (
    <div className="app-container">
      <div className="app-card">
        <div className="app-header">
          <h1>LinkedIn Marketing Tool</h1>
          <p>Schedule and generate engaging content for your professional network</p>
        </div>
        
        <div className="content-section">
          {!user ? (
            <div className="sign-in-section fade-in">
              <p>Please sign in with your LinkedIn account to continue.</p>
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <a
                  href="http://localhost:3000/auth/linkedin"
                  className="sign-in-button"
                >
                  Sign in with LinkedIn
                </a>
              </div>
            </div>
          ) : (
            <div className="fade-in">
              <div className="welcome-banner">
                <p>Welcome, {user.name}!</p>
              </div>
              
              <div>
                <h2 className="section-title">Schedule a Post</h2>
                <div className="form-group">
                  <label className="form-label">Post Content</label>
                  <textarea
                    className="form-textarea"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Enter your post content"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Schedule Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                  />
                </div>
                
                <button
                  className="button button-primary"
                  onClick={schedulePost}
                >
                  Schedule Post
                </button>
              </div>
              
              <div className="section-divider"></div>
              
              <div className="idea-section">
                <h2 className="section-title">Generate Post Idea</h2>
                <div className="form-group">
                  <label className="form-label">Niche / Industry</label>
                  <input
                    className="form-input"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    placeholder="Enter niche (e.g., marketing, tech, finance)"
                  />
                </div>
                
                <button
                  className="button button-primary"
                  onClick={generateIdea}
                >
                  Generate Idea
                </button>
                
                {idea && (
                  <div className="idea-result fade-in">
                    <h3>Generated Idea:</h3>
                    <p>{idea}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;