const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));

// Aggregation endpoint
app.get('/trending', async (req, res) => {
  try {
    const category = req.query.category || '';
    const [newsapiArticles, redditArticles, hnArticles, guardianArticles, worldNewsArticles, mediaStackArticles] = await Promise.all([
      fetchNewsAPI(category),
      fetchReddit(category),
      fetchHackerNews(),
      fetchGuardian(category),
      fetchWorldNews(category),
      fetchMediaStack(category),
    ]);
    // Combine all articles
    const allArticles = [...newsapiArticles, ...redditArticles, ...hnArticles, ...guardianArticles, ...worldNewsArticles, ...mediaStackArticles];
    // Sort by publishedAt descending
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    // Return top 10
    res.json(allArticles.slice(0, 10));
  } catch (error) {
    console.error('Error in /trending:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Fallback to serve index.html for any unmatched routes (for SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const dotenv = require('dotenv');
dotenv.config();

// Helper function to fetch from NewsAPI
async function fetchNewsAPI(category = '') {
  const apiKey = process.env.NEWSAPI_KEY || ''; // User should set this in env
  if (!apiKey) {
    console.warn('NewsAPI key not set. Skipping NewsAPI fetch.');
    return [];
  }
  try {
    const categoryParam = category ? `&category=${category}` : '';
    const response = await axios.get(
      `https://newsapi.org/v2/top-headlines?language=en&pageSize=10&apiKey=${apiKey}${categoryParam}`
    );
    console.log(`NewsAPI fetched ${response.data.articles.length} articles for category: ${category || 'general'}.`);
    return response.data.articles.map(article => ({
      source: 'NewsAPI',
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      description: article.description,
    }));
  } catch (error) {
    console.error('Error fetching NewsAPI:', error.message);
    return [];
  }
}

// Helper function to fetch from The Guardian
async function fetchGuardian(category = '') {
  const apiKey = process.env.GUARDIAN_API_KEY || ''; // User should set this in env
  if (!apiKey) {
    console.warn('Guardian API key not set. Skipping Guardian fetch.');
    return [];
  }
  try {
    const sectionParam = category ? `&section=${category}` : '';
    const response = await axios.get(
      `https://content.guardianapis.com/search?api-key=${apiKey}&page-size=10&show-fields=trailText${sectionParam}`
    );
    console.log(`Guardian fetched ${response.data.response.results.length} articles for section: ${category || 'all'}.`);
    return response.data.response.results.map(article => ({
      source: 'The Guardian',
      title: article.webTitle,
      url: article.webUrl,
      publishedAt: article.webPublicationDate,
      description: article.fields ? article.fields.trailText : '',
    }));
  } catch (error) {
    console.error('Error fetching Guardian:', error.message);
    return [];
  }
}

// Helper function to fetch from World News API
async function fetchWorldNews(category = '') {
  const apiKey = process.env.WORLDNEWS_API_KEY || ''; // User should set this in env
  if (!apiKey) {
    console.warn('World News API key not set. Skipping World News fetch.');
    return [];
  }
  try {
    const categoryParam = category ? `&category=${category}` : '';
    const response = await axios.get(
      `https://api.worldnewsapi.com/search-news?api-key=${apiKey}&number=10&language=en${categoryParam}`
    );
    console.log(`World News fetched ${response.data.news.length} articles for category: ${category || 'all'}.`);
    return response.data.news.map(article => ({
      source: 'World News API',
      title: article.title,
      url: article.url,
      publishedAt: article.publish_date,
      description: article.text || article.summary || '',
    }));
  } catch (error) {
    console.error('Error fetching World News:', error.message);
    return [];
  }
}

async function fetchMediaStack(category = '') {
  const apiKey = process.env.MEDIASTACK_API_KEY || ''; // User should set this in env
  if (!apiKey) {
    console.warn('Media Stack API key not set. Skipping Media Stack fetch.');
    return [];
  }
  try {
    // Media Stack API does not support categories parameter as 'categories', it uses 'categories' but with comma separated values
    // Also, the API endpoint should be https, not http
    const categoryParam = category ? `&categories=${category}` : '';
    const url = `https://api.mediastack.com/v1/news?access_key=${apiKey}&languages=en&limit=10${categoryParam}`;
    const response = await axios.get(url);
    if (!response.data || !response.data.data) {
      console.warn('Media Stack API returned no data.');
      return [];
    }
    console.log(`Media Stack fetched ${response.data.data.length} articles for category: ${category || 'all'}.`);
    return response.data.data.map(article => ({
      source: 'Media Stack',
      title: article.title,
      url: article.url,
      publishedAt: article.published_at,
      description: article.description || '',
    }));
  } catch (error) {
    console.error('Error fetching Media Stack:', error.message);
    return [];
  }
}

// Helper function to simulate error for testing
async function fetchNewsAPIWithError() {
  throw new Error('Simulated NewsAPI fetch error');
}

// Helper function to fetch from Reddit (r/news)
async function fetchReddit(category = '') {
  try {
    const subreddit = category ? `r/${category}` : 'r/news';
    const response = await axios.get(
      `https://www.reddit.com/${subreddit}/top.json?limit=10&t=day`
    );
    return response.data.data.children.map(item => ({
      source: 'Reddit',
      title: item.data.title,
      url: 'https://reddit.com' + item.data.permalink,
      publishedAt: new Date(item.data.created_utc * 1000).toISOString(),
      description: item.data.selftext || '',
    }));
  } catch (error) {
    console.error('Error fetching Reddit:', error.message);
    return [];
  }
}

// Helper function to fetch from Hacker News
async function fetchHackerNews() {
  try {
    const topStoriesRes = await axios.get(
      'https://hacker-news.firebaseio.com/v0/topstories.json'
    );
    const top10Ids = topStoriesRes.data.slice(0, 10);
    const storyPromises = top10Ids.map(async id => {
      const storyRes = await axios.get(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      );
      return {
        source: 'Hacker News',
        title: storyRes.data.title,
        url: storyRes.data.url || `https://news.ycombinator.com/item?id=${id}`,
        publishedAt: new Date(storyRes.data.time * 1000).toISOString(),
        description: '',
      };
    });
    return await Promise.all(storyPromises);
  } catch (error) {
    console.error('Error fetching Hacker News:', error.message);
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`News Aggregator API running on port ${PORT}`);
});
