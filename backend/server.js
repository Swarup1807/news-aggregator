const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));

// Simple in-memory cache for /trending results by category
const cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Aggregation endpoint with caching and timeout
app.get('/trending', async (req, res) => {
  try {
    const category = req.query.category || '';
    const cacheKey = category.toLowerCase();
    const cached = cache[cacheKey];
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return res.json(cached.data);
    }

    // Helper to add timeout to fetch functions
    const fetchWithTimeout = (name, fetchFunc, timeoutMs = 3000) => {
      return Promise.race([
        fetchFunc(category),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${name} fetch timed out after ${timeoutMs} ms`)), timeoutMs)
        )
      ]).catch(error => {
        console.error(`Error fetching ${name}:`, error.message);
        return [];
      });
    };

    // Fetch fresh data with timeout limits in parallel
    const [
      newsapiArticles,
      redditArticles,
      hnArticles,
      guardianArticles,
      worldNewsArticles,
      mediaStackArticles,
      gnewsArticles,
      currentsArticles
    ] = await Promise.all([
      fetchWithTimeout('NewsAPI', fetchNewsAPI),
      fetchWithTimeout('Reddit', fetchReddit),
      fetchWithTimeout('HackerNews', fetchHackerNews),
      fetchWithTimeout('Guardian', fetchGuardian),
      fetchWithTimeout('WorldNews', fetchWorldNews),
      fetchWithTimeout('MediaStack', fetchMediaStack),
      fetchWithTimeout('GNews', fetchGNews),
      fetchWithTimeout('Currents', fetchCurrents),
    ]);

    // Combine all articles
    let allArticles = [...newsapiArticles, ...redditArticles, ...hnArticles, ...guardianArticles, ...worldNewsArticles, ...mediaStackArticles, ...gnewsArticles, ...currentsArticles];

    // Fix missing images by trying to assign fallback images from other fields or default
    allArticles = allArticles.map(article => {
      if (!article.image) {
        // Try to assign fallback image from description HTML if available
        if (article.description) {
          const imgMatch = article.description.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            article.image = imgMatch[1];
          }
        }
        // If still no image, assign a default placeholder
        if (!article.image) {
          article.image = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMwMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
        }
      }
      return article;
    });

    // Filter articles by category if category is set (some sources may not filter properly)
    if (category) {
      const categoryLower = category.toLowerCase();
      allArticles = allArticles.filter(article => {
        if (!article.title) return false;
        // Use article.category if available, else fallback to keyword matching
        if (article.category) {
          return article.category.toLowerCase() === categoryLower;
        }
        // Fallback keyword matching in title, description, source
        return article.title.toLowerCase().includes(categoryLower) ||
               (article.description && article.description.toLowerCase().includes(categoryLower)) ||
               (article.source && article.source.toLowerCase().includes(categoryLower));
      });
    }

    // Sort by publishedAt descending
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Take top 10
    const topArticles = allArticles.slice(0, 10);

    // Cache the result
    cache[cacheKey] = {
      timestamp: now,
      data: topArticles,
    };

    res.json(topArticles);
  } catch (error) {
    console.error('Error in /trending:', error);
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
      image: article.urlToImage || null,
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
      image: article.fields && article.fields.thumbnail ? article.fields.thumbnail : null,
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
      image: article.image_url || null,
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
      image: article.image || null,
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
    // Use Reddit's public RSS feed as an alternative to avoid 403 errors
    const subreddit = category ? category : 'news';
    const rssUrl = `https://www.reddit.com/r/${subreddit}/top/.rss?limit=10&t=day`;
    const rssResponse = await axios.get(rssUrl);
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(rssResponse.data);
    const items = parsed.feed.entry || [];
    return items.map(item => {
      // Try to extract image URL from media:content or content if available
      let imageUrl = null;
      if (item['media:content'] && item['media:content'][0] && item['media:content'][0].$.url) {
        imageUrl = item['media:content'][0].$.url;
      } else if (item.content && item.content[0] && typeof item.content[0]._ === 'string') {
        // Try to extract img src from content HTML string
        const imgMatch = item.content[0]._.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }
      return {
        source: 'Reddit',
        title: item.title[0],
        url: item.link[0].$.href,
        publishedAt: new Date(item.updated[0]).toISOString(),
        description: item.content ? item.content[0]._ : '',
        image: imageUrl,
      };
    });
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

const xml2js = require('xml2js');
const parser = new xml2js.Parser();

async function fetchTamilNaduNews() {
  const rssUrls = [
    'https://www.thehindu.com/news/national/tamil-nadu/?service=rss',
    'https://www.dinamalar.com/rss_feed.asp?cat=1'
  ];
  let articles = [];
  try {
    for (const url of rssUrls) {
      const response = await axios.get(url);
      const result = await parser.parseStringPromise(response.data);
      const items = result.rss.channel[0].item;
      const siteName = result.rss.channel[0].title[0] || 'Tamil Nadu News';
      const siteArticles = items.slice(0, 10).map(item => {
        // Try to extract image URL from description HTML if available
        let imageUrl = null;
        if (item.description && item.description[0]) {
          const imgMatch = item.description[0].match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
        }
        return {
          source: siteName,
          title: item.title[0],
          url: item.link[0],
          publishedAt: new Date(item.pubDate[0]).toISOString(),
          description: item.description ? item.description[0] : '',
          category: item.category ? item.category[0].toLowerCase() : 'general',
          image: imageUrl,
        };
      });
      articles = articles.concat(siteArticles);
    }
    return articles;
  } catch (error) {
    console.error('Error fetching Tamil Nadu news:', error.message);
    return [];
  }
}

async function fetchSouthIndiaNews() {
  const rssFeeds = {
    tamilnadu: [
      'https://www.thehindu.com/news/national/tamil-nadu/?service=rss',
      'https://www.dinamalar.com/rss_feed.asp?cat=1'
    ],
    kerala: [
      'https://www.thehindu.com/news/national/kerala/?service=rss',
      'https://malayalam.samayam.com/rssfeed.cms'
    ],
    karnataka: [
      'https://www.thehindu.com/news/national/karnataka/?service=rss',
      'https://kannada.oneindia.com/rss/news-karnataka-fb.xml'
    ],
    andhrapradesh: [
      'https://www.thehindu.com/news/national/andhra-pradesh/?service=rss',
      'https://telugu.samayam.com/rssfeed.cms'
    ],
    telangana: [
      'https://www.thehindu.com/news/national/telangana/?service=rss',
      'https://telugu.samayam.com/rssfeed.cms'
    ]
  };

  let articles = [];
  try {
    for (const [state, urls] of Object.entries(rssFeeds)) {
      for (const url of urls) {
        const response = await axios.get(url);
        const result = await parser.parseStringPromise(response.data);
        const items = result.rss.channel[0].item;
        const siteName = result.rss.channel[0].title[0] || `${state} News`;
        const siteArticles = items.slice(0, 10).map(item => ({
          source: siteName,
          title: item.title[0],
          url: item.link[0],
          publishedAt: new Date(item.pubDate[0]).toISOString(),
          description: item.description ? item.description[0] : '',
          category: item.category ? item.category[0].toLowerCase() : 'general',
          region: state,
          image: null,
        }));
        articles = articles.concat(siteArticles);
      }
    }
    return articles;
  } catch (error) {
    console.error('Error fetching South India news:', error.message);
    return [];
  }
}

// Aggregation endpoint with caching
app.get('/trending', async (req, res) => {
  try {
    const category = req.query.category || '';
  // Check cache
  const cacheKey = category.toLowerCase();
  const cached = cache[cacheKey];
  const now = Date.now();
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return res.json(cached.data);
  }

    // Fetch fresh data with timing logs
    const startTime = Date.now();

    const fetchWithTiming = async (name, fetchFunc) => {
      const t0 = Date.now();
      try {
        const result = await fetchFunc(category);
        const t1 = Date.now();
        console.log(`${name} fetch took ${t1 - t0} ms and returned ${result.length} articles.`);
        return result;
      } catch (error) {
        console.error(`Error fetching ${name}:`, error.message);
        return [];
      }
    };

    const [
      newsapiArticles,
      redditArticles,
      hnArticles,
      guardianArticles,
      worldNewsArticles,
      mediaStackArticles,
      gnewsArticles,
      currentsArticles,
      tamilNaduArticles,
      southIndiaArticles
    ] = await Promise.all([
      fetchWithTiming('NewsAPI', fetchNewsAPI),
      fetchWithTiming('Reddit', fetchReddit),
      fetchWithTiming('HackerNews', fetchHackerNews),
      fetchWithTiming('Guardian', fetchGuardian),
      fetchWithTiming('WorldNews', fetchWorldNews),
      fetchWithTiming('MediaStack', fetchMediaStack),
      fetchWithTiming('GNews', fetchGNews),
      fetchWithTiming('Currents', fetchCurrents),
      fetchWithTiming('TamilNaduNews', fetchTamilNaduNews),
      fetchWithTiming('SouthIndiaNews', fetchSouthIndiaNews),
    ]);

    const totalTime = Date.now() - startTime;
    console.log(`Total fetch time: ${totalTime} ms`);

    // Combine all articles
    // Prioritize South India news by placing them at the front
    let allArticles = [...southIndiaArticles, ...tamilNaduArticles, ...newsapiArticles, ...redditArticles, ...hnArticles, ...guardianArticles, ...worldNewsArticles, ...mediaStackArticles, ...gnewsArticles, ...currentsArticles];

    // Filter articles by category if category is set (some sources may not filter properly)
    if (category) {
      const categoryLower = category.toLowerCase();
      allArticles = allArticles.filter(article => {
        if (!article.title) return false;
        return article.title.toLowerCase().includes(categoryLower) ||
               (article.description && article.description.toLowerCase().includes(categoryLower)) ||
               (article.source && article.source.toLowerCase().includes(categoryLower));
      });
    }

    // Sort by publishedAt descending
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Take top 10
    const topArticles = allArticles.slice(0, 10);

    // Cache the result
    cache[cacheKey] = {
      timestamp: now,
      data: topArticles,
    };

    res.json(topArticles);
  } catch (error) {
    console.error('Error in /trending:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`News Aggregator API running on port ${PORT}`);
  });
}

module.exports = app;

// Helper function to fetch from GNews
async function fetchGNews(category = '') {
  const apiKey = process.env.GNEWS_API_KEY || ''; // User should set this in env
  if (!apiKey) {
    console.warn('GNews API key not set. Skipping GNews fetch.');
    return [];
  }
  try {
    const categoryParam = category ? `&topic=${category}` : '';
    const response = await axios.get(
      `https://gnews.io/api/v4/top-headlines?lang=en&max=10&apikey=${apiKey}${categoryParam}`
    );
    console.log(`GNews fetched ${response.data.articles.length} articles for category: ${category || 'general'}.`);
    return response.data.articles.map(article => ({
      source: 'GNews',
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      description: article.description || '',
      image: article.image || null,
    }));
  } catch (error) {
    console.error('Error fetching GNews:', error.message);
    return [];
  }
}

async function fetchCurrents(category = '') {
  // Currents API is rate limited and often returns 429 errors
  // To avoid blocking the entire /trending endpoint, skip Currents fetch
  console.warn('Skipping Currents fetch due to rate limiting issues.');
  return [];
}
