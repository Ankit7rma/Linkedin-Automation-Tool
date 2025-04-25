USE linkedin_tool;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  linkedin_id VARCHAR(255) UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry DATETIME
);

CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  content TEXT,
  scheduled_time DATETIME,
  status VARCHAR(50) DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id)
);