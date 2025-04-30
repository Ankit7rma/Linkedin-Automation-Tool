-- schema.sql
CREATE DATABASE IF NOT EXISTS linkedin_tool;
USE linkedin_tool;

-- Users table (unchanged)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  linkedin_id VARCHAR(255) UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry DATETIME
);

-- Posts table (unchanged, for scheduling)
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  content TEXT,
  scheduled_time DATETIME,
  status VARCHAR(50) DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Scraped posts table (updated with user_id)
CREATE TABLE IF NOT EXISTS scraped_posts (
  postId VARCHAR(36) PRIMARY KEY,
  user_id INT, -- Links to users(id)
  author VARCHAR(255) NOT NULL,
  content TEXT,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  niche VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);