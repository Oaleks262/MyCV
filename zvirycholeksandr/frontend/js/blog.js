/* ===== BLOG PAGE ===== */
let allPosts = [];

async function loadBlog() {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/blog');
    if (!res.ok) throw new Error('Failed');
    allPosts = await res.json();
    renderBlog(allPosts);
  } catch (e) {
    grid.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:3rem;grid-column:1/-1;">Не вдалося завантажити статті</p>';
  }
}

function renderBlog(posts) {
  const grid = document.getElementById('blog-grid');
  const noResults = document.getElementById('no-results');
  if (!grid) return;

  if (!posts.length) {
    grid.innerHTML = '';
    noResults?.classList.add('visible');
    return;
  }
  noResults?.classList.remove('visible');

  grid.innerHTML = posts.map(post => `
    <a href="/blog-post.html?slug=${post.slug}" class="blog-card fade-in">
      ${post.coverUrl
        ? `<img class="blog-card-cover" src="${post.coverUrl}" alt="${post.title}" loading="lazy">`
        : `<div class="blog-card-cover-placeholder">📝</div>`
      }
      <div class="blog-card-body">
        <div class="blog-card-meta">
          <span class="blog-card-date">${formatDate(post.publishedAt)}</span>
          <div class="blog-card-tags">
            ${(post.tags || []).slice(0, 2).map(t => `<span class="blog-tag">${t}</span>`).join('')}
          </div>
        </div>
        <h2 class="blog-card-title">${post.title}</h2>
        <p class="blog-card-excerpt">${post.excerpt}</p>
        <span class="blog-read-btn">Читати →</span>
      </div>
    </a>
  `).join('');

  // Fade-in
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  grid.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

/* ===== SEARCH ===== */
const searchInput = document.getElementById('blog-search');
searchInput?.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) {
    renderBlog(allPosts);
    return;
  }
  const filtered = allPosts.filter(post =>
    post.title.toLowerCase().includes(q) ||
    (post.tags || []).some(t => t.toLowerCase().includes(q)) ||
    (post.excerpt || '').toLowerCase().includes(q)
  );
  renderBlog(filtered);
});

/* ===== UTILS ===== */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

loadBlog();

/* ===== BLOG POST PAGE ===== */
async function loadBlogPost() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    showPostError();
    return;
  }

  try {
    const res = await fetch(`/api/blog/${slug}`);
    if (!res.ok) {
      showPostError();
      return;
    }
    const post = await res.json();
    renderPost(post);
  } catch (e) {
    showPostError();
  }
}

function renderPost(post) {
  // SEO мета-теги
  document.title = `${post.title} | zvirycholeksandr`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', post.excerpt || '');

  // Open Graph
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', post.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', post.excerpt || '');
  if (post.coverUrl) {
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', post.coverUrl);
  }

  // Заповнення контенту
  const dateEl = document.getElementById('post-date');
  const tagsEl = document.getElementById('post-tags');
  const titleEl = document.getElementById('post-title');
  const coverEl = document.getElementById('post-cover');
  const contentEl = document.getElementById('post-content');

  if (dateEl) dateEl.textContent = formatDate(post.publishedAt);
  if (tagsEl) {
    tagsEl.innerHTML = (post.tags || []).map(t => `<span class="blog-tag">${t}</span>`).join('');
  }
  if (titleEl) titleEl.textContent = post.title;

  if (coverEl) {
    if (post.coverUrl) {
      coverEl.src = post.coverUrl;
      coverEl.alt = post.title;
    } else {
      coverEl.style.display = 'none';
    }
  }

  // Markdown → HTML через marked.js
  if (contentEl) {
    if (typeof marked !== 'undefined') {
      contentEl.innerHTML = marked.parse(post.content || '');
    } else {
      // Fallback: просто текст
      contentEl.textContent = post.content || '';
    }
  }

  // Показати контент
  document.getElementById('post-loading')?.remove();
  document.getElementById('post-wrap')?.classList.remove('hidden');
}

function showPostError() {
  document.getElementById('post-loading')?.remove();
  const errorEl = document.getElementById('post-error');
  if (errorEl) errorEl.style.display = 'block';
}

// Запустити завантаження поста якщо ми на сторінці blog-post
if (document.getElementById('post-content')) {
  loadBlogPost();
}
