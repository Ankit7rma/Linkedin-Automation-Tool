const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
const schedule = require('node-schedule');
const cors = require('cors');
require('dotenv').config();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

 
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: process.env.MYSQL_PASSWORD,
  database: 'linkedin_tool',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

 
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';

app.use(require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 requests
}));

app.get('/auth/linkedin', (req, res) => {
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid%20profile%20email%20w_member_social`;
  res.redirect(authUrl);
});

 
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });
    const { access_token, refresh_token, expires_in } = response.data;

    // Fetch user info
    const userInfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const linkedinId = userInfo.data.sub;
    const name = userInfo.data.name;

    // Store in MySQL
    await pool.query(
      'INSERT INTO users (linkedin_id, access_token, refresh_token, token_expiry) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_token = ?, refresh_token = ?, token_expiry = ?',
      [
        linkedinId,
        access_token,
        refresh_token || '',
        new Date(Date.now() + expires_in * 1000),
        access_token,
        refresh_token || '',
        new Date(Date.now() + expires_in * 1000),
      ]
    );

    // Redirect to frontend with user info (temporary, use sessions/JWT in production)
    res.redirect(`http://localhost:5173/dashboard?user_id=${linkedinId}&name=${encodeURIComponent(name)}`);
  } catch (error) {
    console.error('Auth error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

 
app.get('/user', async (req, res) => {
  const { user_id } = req.query; // Temporary, use auth middleware in production
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE linkedin_id = ?', [user_id]);
    if (users.length) {
      res.json({ id: users[0].id, linkedin_id: user_id, name: req.query.name });
    } else {
      res.status(401).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/logout', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'User ID required' });
  }
  try {
    // Clear tokens for this user
    await pool.query(
      'UPDATE users SET access_token = NULL, refresh_token = NULL, token_expiry = NULL WHERE linkedin_id = ?',
      [user_id]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});
 
const authenticate = async (req, res, next) => {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(401).json({ error: 'User ID required' });
    }
    const [users] = await pool.query('SELECT id FROM users WHERE linkedin_id = ?', [user_id]);
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.dbUserId = users[0].id;
    next();
  };
  
  app.post('/schedule-post', authenticate, async (req, res) => {
    const { content, scheduled_time } = req.body;
    const dbUserId = req.dbUserId;
    try {
      if (!content || !scheduled_time) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      const formattedTime = new Date(scheduled_time).toISOString().slice(0, 19).replace('T', ' ');
  
      await pool.query(
        'INSERT INTO posts (user_id, content, scheduled_time) VALUES (?, ?, ?)',
        [dbUserId, content, formattedTime]
      );
      res.json({ message: 'Post scheduled' });
    } catch (error) {
      console.error('Schedule error:', error.message, error.stack);
      res.status(500).json({ error: 'Failed to schedule post', details: error.message });
    }
  });
  
 
async function publishPost(post) {
    let [user] = await pool.query('SELECT * FROM users WHERE id = ?', [post.user_id]);
    if (!user.length) {
      console.error(`User ${post.user_id} not found for post ${post.id}`);
      await pool.query('UPDATE posts SET status = ? WHERE id = ?', ['failed', post.id]);
      return;
    }
  
    // Check token expiry and refresh if needed
    if (new Date(user[0].token_expiry) <= new Date()) {
      try {
        const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
          params: {
            grant_type: 'refresh_token',
            refresh_token: user[0].refresh_token,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          },
        });
        const { access_token, expires_in } = response.data;
        await pool.query(
          'UPDATE users SET access_token = ?, token_expiry = ? WHERE linkedin_id = ?',
          [access_token, new Date(Date.now() + expires_in * 1000), user[0].linkedin_id]
        );
        user[0].access_token = access_token;
        console.log(`Token refreshed for user ${user[0].linkedin_id}`);
      } catch (error) {
        console.error(`Token refresh failed for post ${post.id}:`, error.response?.data || error.message);
        await pool.query('UPDATE posts SET status = ? WHERE id = ?', ['failed', post.id]);
        return;
      }
    }
  
    try {
      const response = await axios.post(
        'https://api.linkedin.com/rest/posts',
        {
          author: `urn:li:person:${user[0].linkedin_id}`,
          lifecycleState: 'PUBLISHED',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          visibility: 'PUBLIC',
          commentary: post.content,
        },
        {
          headers: {
            Authorization: `Bearer ${user[0].access_token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202410', // Updated to latest version
          },
        }
      );
      console.log(`Post ${post.id} published successfully:`, response.data);
      await pool.query('UPDATE posts SET status = ? WHERE id = ?', ['published', post.id]);
    } catch (error) {
      console.error(`Failed to publish post ${post.id}:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      await pool.query('UPDATE posts SET status = ? WHERE id = ?', ['failed', post.id]);
    }
  }

schedule.scheduleJob('*/1 * * * *', async () => {
  const [posts] = await pool.query('SELECT * FROM posts WHERE scheduled_time <= NOW() AND status = ?', ['pending']);
  for (const post of posts) {
    await publishPost(post);
  }
});


app.post('/generate-idea', async (req, res) => {
  const { niche } = req.body;
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/gpt2',
      { inputs: `Generate a LinkedIn post idea for ${niche}:` },
      { headers: { Authorization: `Bearer YOUR_HUGGINGFACE_API_KEY` } }
    );
    res.json({ idea: response.data[0].generated_text });
  } catch (error) {
    console.error('AI error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate idea' });
  }
});

async function scrapeLinkedInPosts(niche, maxPosts = 10) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(niche)}&sortBy=relevance`;

  await page.goto(url, { waitUntil: 'networkidle2' });

  // Scroll to load more posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Use waitForSelector to wait for an element to ensure the page has loaded
    await page.waitForSelector('div.feed-shared-update-v2', { visible: true });
  }

  const content = await page.content();
  const $ = cheerio.load(content);
  const posts = [];

  $('div.feed-shared-update-v2').each((i, element) => {
    if (i >= maxPosts) return false;

    const author = $(element).find('span.feed-shared-actor__name').text().trim() || 'Unknown';
    const contentText = $(element).find('span.break-words').text().trim() || '';
    const likesText = $(element).find('span.social-details-social-counts__reactions-count').text().trim() || '0';
    const commentsText = $(element).find('span.social-details-social-counts__comments').text().trim() || '0';

    const likes = parseInt(likesText.replace(/\D/g, '')) || 0;
    const comments = parseInt(commentsText.replace(/\D/g, '')) || 0;

    posts.push({
      postId: uuidv4(),
      author,
      content: contentText.length > 200 ? contentText.slice(0, 200) + '...' : contentText,
      likes,
      comments,
      niche,
    });
  });

  await browser.close();
  console.log(posts)
  return posts;
}
 
 
app.post('/api/scrape', async (req, res) => {
  const { niche } = req.body;
  console.log(niche)
  if (!niche) return res.status(400).json({ error: 'Niche is required' });

  try {
    const posts = await scrapeLinkedInPosts(niche);
    if (!posts.length) return res.status(404).json({ error: 'No posts found' });

 
    const connection = await pool.getConnection();
    try {
      for (const post of posts) {
        await connection.query(
          'INSERT INTO posts (postId, author, content, likes, comments, niche) VALUES (?, ?, ?, ?, ?, ?)',
          [post.postId, post.author, post.content, post.likes, post.comments, post.niche]
        );
      }
    } finally {
      connection.release();
    }

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

 
app.get('/api/posts/:niche', async (req, res) => {
  const { niche } = req.params;
  try {
    const [posts] = await pool.query(
      'SELECT * FROM posts WHERE niche = ? ORDER BY createdAt DESC LIMIT 10',
      [niche]
    );
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});




app.listen(3000, () => console.log('Server running on http://localhost:3000'));