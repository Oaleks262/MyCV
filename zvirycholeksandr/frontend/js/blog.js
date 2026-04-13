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
    <a href="/blog/${post.slug}" class="blog-card fade-in">
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
        <div class="blog-card-footer">
          <span class="blog-read-btn">Читати →</span>
          ${post.views ? `<span class="blog-card-views">👁 ${formatViews(post.views)}</span>` : ''}
        </div>
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

function formatViews(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

loadBlog();

/* ===== BLOG POST PAGE ===== */
async function loadBlogPost() {
  // Підтримуємо обидва формати: /blog/slug і /blog-post?slug=...
  const pathMatch = window.location.pathname.match(/\/blog\/(.+)/);
  const slug = pathMatch ? pathMatch[1] : new URLSearchParams(window.location.search).get('slug');
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

  if (dateEl) {
    dateEl.textContent = formatDate(post.publishedAt);
    if (post.views) dateEl.textContent += ` · 👁 ${formatViews(post.views)} переглядів`;
  }
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

  // Завантажити пов'язані статті
  loadRelatedPosts(post);
}

async function loadRelatedPosts(currentPost) {
  const container = document.getElementById('related-posts');
  if (!container) return;

  try {
    const res = await fetch('/api/blog');
    if (!res.ok) return;
    const all = await res.json();

    // Виключаємо поточну статтю
    const others = all.filter(p => p.slug !== currentPost.slug);
    if (!others.length) return;

    // Сортуємо: спочатку ті що мають спільні теги, потім решта
    const currentTags = new Set(currentPost.tags || []);
    const sorted = others.sort((a, b) => {
      const aMatch = (a.tags || []).filter(t => currentTags.has(t)).length;
      const bMatch = (b.tags || []).filter(t => currentTags.has(t)).length;
      return bMatch - aMatch;
    }).slice(0, 3);

    const cards = sorted.map(p => `
      <a href="/blog/${p.slug}" class="related-card">
        ${p.coverUrl
          ? `<img class="related-card-img" src="${p.coverUrl}" alt="${p.title}" loading="lazy">`
          : `<div class="related-card-img related-card-placeholder">📝</div>`}
        <div class="related-card-body">
          ${(p.tags||[]).slice(0,1).map(t=>`<span class="blog-tag">${t}</span>`).join('')}
          <p class="related-card-title">${p.title}</p>
          <span class="related-card-date">${formatDate(p.publishedAt)}</span>
        </div>
      </a>
    `).join('');

    container.innerHTML = `
      <div class="related-posts">
        <h3 class="related-posts-title">Інші статті</h3>
        <div class="related-grid">${cards}</div>
        <div style="text-align:center;margin-top:1.5rem">
          <a href="/blog" class="btn-secondary" style="display:inline-flex">Всі статті →</a>
        </div>
      </div>`;
  } catch {}
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
