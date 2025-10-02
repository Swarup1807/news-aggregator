document.addEventListener('DOMContentLoaded', () => {
  const articlesContainer = document.getElementById('articles');
  const loadingIndicator = document.getElementById('loading');
  const searchInput = document.getElementById('search-input');
  const categoryNav = document.getElementById('category-nav');

  let allArticles = [];
  let filteredArticles = [];
  let currentCategory = '';

  // Fetch articles from backend with optional category filter
  async function fetchArticles(category = '') {
    loadingIndicator.style.display = 'block';
    try {
      const url = category ? `http://localhost:3000/trending?category=${category}` : 'http://localhost:3000/trending';
      const response = await fetch(url);
      const data = await response.json();
      allArticles = data;
      applyFiltersAndRender();
    } catch (error) {
      articlesContainer.innerHTML = '<p>Error loading articles. Please try again later.</p>';
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  // Filter articles by search input and render
  function applyFiltersAndRender() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    filteredArticles = allArticles.filter(article => {
      return article.title.toLowerCase().includes(searchTerm);
    });
    renderArticles(filteredArticles);
  }

  // Render articles to DOM
  function renderArticles(articles) {
    articlesContainer.innerHTML = '';
    if (articles.length === 0) {
      articlesContainer.innerHTML = '<p>No articles found.</p>';
      return;
    }
    articles.forEach(article => {
      const div = document.createElement('div');
      div.className = 'article-card';
      const imageUrl = (currentCategory === '' && !article.image) ? 'https://via.placeholder.com/180x120?text=Default+Image' : (article.image || 'https://via.placeholder.com/180x120?text=No+Image');
      div.innerHTML = `
        <img class="article-image" src="${imageUrl}" alt="Article Image" width="180" height="120" onerror="this.src='https://via.placeholder.com/180x120?text=No+Image';" />
        <div class="article-content">
          <h2 class="article-title"><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a></h2>
          <div class="article-meta"><strong>Source:</strong> ${article.source} | <strong>Published:</strong> ${new Date(article.publishedAt).toLocaleString()}</div>
          <p class="article-description">${article.description || ''}</p>
        </div>
      `;
      articlesContainer.appendChild(div);
    });
  }

  // Event listeners
  searchInput.addEventListener('input', () => {
    applyFiltersAndRender();
  });

  categoryNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      currentCategory = e.target.getAttribute('data-category');
      Array.from(categoryNav.children).forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      fetchArticles(currentCategory);
    }
  });

  // Initial fetch
  fetchArticles();
});
