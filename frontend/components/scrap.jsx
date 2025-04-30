// src/App.js
import React, { useState } from 'react';
import axios from 'axios';


function Scrap() {
  const [niche, setNiche] = useState('');
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!niche) {
      setError('Please enter a niche');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:3000/api/scrape', { niche });
      setPosts(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to scrape posts');
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">LinkedIn Viral Post Scraper</h1>
      <form onSubmit={handleScrape} className="mb-4">
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Enter your niche (e.g., digital marketing)"
          className="border p-2 rounded w-full mb-2"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded"
          disabled={loading}
        >
          {loading ? 'Scraping...' : 'Scrape Posts'}
        </button>
      </form>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="grid grid-cols-1 gap-4">
        {posts.map((post) => (
          <div key={post.postId} className="bg-white p-4 rounded shadow">
            <h2 className="text-lg font-semibold">{post.author}</h2>
            <p className="text-gray-600">{post.content}</p>
            <p className="text-sm text-gray-500">
              Likes: {post.likes} | Comments: {post.comments}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Scrap;
