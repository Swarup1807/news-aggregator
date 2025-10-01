document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('category');
  const container = document.getElementById('articles');
  const loading = document.getElementById('loading');

  async function fetchArticles(category = '') {
    loading.style.display = 'block';
    container.innerHTML = '';
    try {
      const url = category ? `http://localhost:3000/trending?category=${category}` : 'http://localhost:3000/trending';
      const response = await fetch(url);
      const articles = await response.json();
      loading.style.display = 'none';

      if (articles.length === 0) {
        container.innerHTML = '<p>No articles found for this category.</p>';
        return;
      }

      articles.forEach(article => {
        const div = document.createElement('div');
        div.className = 'article';
        div.innerHTML = `
          <h2><a href="${article.url}" target="_blank" rel="noopener noreferrer">${article.title}</a></h2>
          <p class="source">Source: ${article.source}</p>
          <p class="published">Published: ${new Date(article.publishedAt).toLocaleString()}</p>
          ${article.description ? `<p>${article.description}</p>` : ''}
        `;
        container.appendChild(div);
      });
    } catch (error) {
      loading.style.display = 'none';
      console.error('Error fetching articles:', error);
      container.innerHTML = '<p>Failed to load articles. Please try again later.</p>';
    }
  }

  categorySelect.addEventListener('change', () => {
    fetchArticles(categorySelect.value);
  });

  // Initial fetch
  fetchArticles();
});
