/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import axios from 'axios';
import "./App.css"
function App() {
  const [user, setUser] = useState(null);
  const [content, setContent] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [niche, setNiche] = useState('');
  const [idea, setIdea] = useState('');

  // Check for user on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const name = urlParams.get('name');
    if (userId && name) {
      setUser({ id: userId, name: decodeURIComponent(name) });
    }
  }, []);

  // Schedule post
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
      alert('Failed to generate idea');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>LinkedIn Marketing Tool</h1>
      {!user ? (
        <div>
          <p>Please sign in to continue.</p>
          <a
            href="http://localhost:3000/auth/linkedin"
            style={{ padding: '10px 20px', background: '#0077b5', color: 'white', textDecoration: 'none', borderRadius: '5px' }}
          >
            Sign in with LinkedIn
          </a>
        </div>
      ) : (
        <div>
          <p>Welcome, {user.name}!</p>
          <h2>Schedule a Post</h2>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Enter your post content"
            style={{ width: '100%', height: '100px', marginBottom: '10px' }}
          />
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <button
            onClick={schedulePost}
            style={{ padding: '10px 20px', background: '#0077b5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Schedule Post
          </button>

          <h2>Generate Post Idea</h2>
          <input
            value={niche}
            onChange={e => setNiche(e.target.value)}
            placeholder="Enter niche (e.g., marketing)"
            style={{ width: '100%', marginBottom: '10px', padding: '5px' }}
          />
          <button
            onClick={generateIdea}
            style={{ padding: '10px 20px', background: '#0077b5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Generate Idea
          </button>
          {idea && (
            <div style={{ marginTop: '20px' }}>
              <h3>Generated Idea:</h3>
              <p>{idea}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;