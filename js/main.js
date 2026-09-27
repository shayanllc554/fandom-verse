// FandomVerse Core Vanilla JavaScript Engine

// State Management with LocalStorage
const state = {
  theme: localStorage.getItem("fv_theme") || "dark",
  cart: JSON.parse(localStorage.getItem("fv_cart") || "[]"),
  bookmarks: JSON.parse(localStorage.getItem("fv_bookmarks") || "[]"),
  visitors: parseInt(localStorage.getItem("fv_visitors") || "14290") + 1,
  cartOpen: false,
  authMode: null, // "login" | "signup" | null
  chatbotOpen: false,
  chatMessages: [
    { from: "bot", text: "Hi! I'm Verse Bot 👾 — your automated rule-based fandom guide! Ask me anything or tap a quick suggestion below." }
  ],
  activeVideoUrl: null
};

// Keep the existing search, links, and account controls intact while moving
// them into a touch-friendly drawer at compact viewport sizes.
let mobileNavInitialized = false;
let mobileNavMarkers = null;
function initMobileNav() {
  if (mobileNavInitialized) return;
  const headerTop = document.querySelector(".header-top");
  const search = document.querySelector(".header-top > .search-box");
  const links = document.querySelector(".header-top > .nav-links");
  const actions = document.querySelector(".header-top > .nav-actions");
  const content = document.querySelector(".mobile-nav-content");
  const drawer = document.getElementById("mobile-nav-drawer");
  const toggle = document.querySelector(".nav-menu-toggle");
  if (!headerTop || !search || !links || !actions || !content || !drawer || !toggle) return;

  mobileNavMarkers = [search, links, actions].map(element => {
    const marker = document.createComment(` restore ${element.className} `);
    element.before(marker);
    return { element, marker };
  });
  const compact = window.matchMedia("(max-width: 1024px)");
  const relocate = () => {
    closeMobileNav(false);
    if (compact.matches) {
      mobileNavMarkers.forEach(({ element }) => content.append(element));
    } else {
      mobileNavMarkers.forEach(({ element, marker }) => marker.after(element));
    }
  };
  compact.addEventListener?.("change", relocate);
  relocate();

  drawer.addEventListener("click", event => {
    if (event.target.closest("a")) closeMobileNav();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("mobile-nav-open")) closeMobileNav();
  });
  let touchStartX = null;
  drawer.addEventListener("touchstart", event => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  drawer.addEventListener("touchend", event => {
    const touchEndX = event.changedTouches[0]?.clientX;
    if (touchStartX !== null && touchEndX !== undefined && touchStartX - touchEndX > 64) closeMobileNav();
    touchStartX = null;
  }, { passive: true });
  mobileNavInitialized = true;
}

function toggleMobileNav() {
  const drawer = document.getElementById("mobile-nav-drawer");
  if (!drawer) return;
  const isOpen = !drawer.classList.contains("open");
  drawer.classList.toggle("open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  drawer.inert = !isOpen;
  document.querySelector(".mobile-nav-backdrop")?.classList.toggle("open", isOpen);
  document.querySelector(".nav-menu-toggle")?.setAttribute("aria-expanded", String(isOpen));
  document.querySelector(".nav-menu-toggle")?.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  document.body.classList.toggle("mobile-nav-open", isOpen);
  if (isOpen) drawer.querySelector(".nav-link")?.focus({ preventScroll: true });
  else document.querySelector(".nav-menu-toggle")?.focus({ preventScroll: true });
}

function closeMobileNav(returnFocus = true) {
  const drawer = document.getElementById("mobile-nav-drawer");
  const toggle = document.querySelector(".nav-menu-toggle");
  if (!drawer) return;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawer.inert = true;
  document.querySelector(".mobile-nav-backdrop")?.classList.remove("open");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Open navigation menu");
  document.body.classList.remove("mobile-nav-open");
  if (returnFocus && window.matchMedia("(max-width: 1024px)").matches) toggle?.focus({ preventScroll: true });
}

// Save Visitor Count
localStorage.setItem("fv_visitors", state.visitors);

// Initialize Theme
function applyTheme() {
  if (state.theme === "light") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.innerHTML = state.theme === "light" ? "🌙" : "☀️";
  }
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem("fv_theme", state.theme);
  applyTheme();
}

// Bookmarks Engine
function isBookmarked(id) {
  return state.bookmarks.includes(id);
}

function toggleBookmark(id) {
  if (isBookmarked(id)) {
    state.bookmarks = state.bookmarks.filter(b => b !== id);
    const notes = getBookmarkNotes();
    delete notes[id];
    saveBookmarkNotes(notes);
  } else {
    state.bookmarks.push(id);
  }
  localStorage.setItem("fv_bookmarks", JSON.stringify(state.bookmarks));
  updateBadges();
  renderPageContent();
}

function getBookmarkNotes() {
  try {
    return JSON.parse(sessionStorage.getItem("fv_bookmark_notes") || "{}");
  } catch {
    return {};
  }
}

function saveBookmarkNotes(notes) {
  try {
    sessionStorage.setItem("fv_bookmark_notes", JSON.stringify(notes));
  } catch (error) {
    console.warn("Session-only bookmark notes could not be saved:", error);
  }
}

function saveBookmarkNote(id, value) {
  const notes = getBookmarkNotes();
  const note = value.trim();
  if (note) notes[id] = note;
  else delete notes[id];
  saveBookmarkNotes(notes);
}

function escapeBookmarkText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getBookmarkedContent(id) {
  const collections = [
    ["Article", articles],
    ["Character", characters],
    ["Event", events],
    ["Media", media],
    ["Merchandise", merchandise]
  ];
  for (const [type, items] of collections) {
    const item = items.find(entry => entry.id === id);
    if (item) return { item, type };
  }
  return null;
}

function exportBookmarks() {
  const notes = getBookmarkNotes();
  const lines = state.bookmarks.map((id, index) => {
    const saved = getBookmarkedContent(id);
    if (!saved) return null;
    const { item, type } = saved;
    const title = item.title || item.name;
    const category = catName(item.category);
    const detail = item.series ? `\n   Series: ${item.series}` : "";
    const link = item.url ? `\n   Link: ${item.url}` : "";
    const note = notes[id] ? `\n   Personal note (this session): ${notes[id]}` : "";
    return `${index + 1}. ${title}\n   Type: ${type}\n   Category: ${category}${detail}${link}${note}`;
  }).filter(Boolean);

  if (!lines.length) return;
  const file = new Blob([`FandomVerse Bookmarks\n${"=".repeat(24)}\n\n${lines.join("\n\n")}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fandomverse-bookmarks.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBookmarkButton(id) {
  const bookmarked = isBookmarked(id);
  return `<button type="button" onclick="event.stopPropagation();toggleBookmark('${id}')" aria-label="${bookmarked ? "Remove bookmark" : "Add bookmark"}" title="${bookmarked ? "Remove bookmark" : "Add bookmark"}" style="position:absolute;top:0.75rem;right:0.75rem;z-index:3;height:2.15rem;width:2.15rem;border-radius:var(--radius-xl);border:1px solid var(--border);background:color-mix(in oklab,var(--background) 78%,transparent);color:${bookmarked ? "var(--primary)" : "var(--foreground)"};cursor:pointer;display:grid;place-items:center;">${bookmarked ? "❤️" : "🤍"}</button>`;
}

// Shopping Cart Engine
function addToCart(productId) {
  const item = merchandise.find(m => m.id === productId);
  if (!item) return;
  const existing = state.cart.find(i => i.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
  localStorage.setItem("fv_cart", JSON.stringify(state.cart));
  updateBadges();
  renderCartDrawer();
  openCart();
}

function updateCartQty(productId, delta) {
  const existing = state.cart.find(i => i.id === productId);
  if (existing) {
    existing.qty += delta;
    if (existing.qty <= 0) {
      state.cart = state.cart.filter(i => i.id !== productId);
    }
  }
  localStorage.setItem("fv_cart", JSON.stringify(state.cart));
  updateBadges();
  renderCartDrawer();
}

function updateBadges() {
  const bCount = state.bookmarks.length;
  const cCount = state.cart.reduce((s, i) => s + i.qty, 0);

  const bBadge = document.getElementById("bookmark-badge");
  if (bBadge) {
    bBadge.textContent = bCount;
    bBadge.style.display = bCount > 0 ? "grid" : "none";
  }

  const cBadge = document.getElementById("cart-badge");
  if (cBadge) {
    cBadge.textContent = cCount;
    cBadge.style.display = cCount > 0 ? "grid" : "none";
  }
}

// UI Drawer & Modal Triggers
function openCart() {
  const overlay = document.getElementById("cart-overlay");
  const drawer = document.getElementById("cart-drawer");
  if (overlay && drawer) {
    overlay.classList.add("open");
    drawer.classList.add("open");
  }
}

function closeCart() {
  const overlay = document.getElementById("cart-overlay");
  const drawer = document.getElementById("cart-drawer");
  if (overlay && drawer) {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
  }
}

function openAuth(mode) {
  state.authMode = mode;
  const overlay = document.getElementById("auth-overlay");
  const title = document.getElementById("auth-title");
  const submitBtn = document.getElementById("auth-submit-btn");
  const nameInput = document.getElementById("auth-name-input");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const successBox = document.getElementById("auth-success");
  const form = document.getElementById("auth-form");

  if (overlay) {
    overlay.classList.add("open");
    if (successBox) successBox.style.display = "none";
    if (form) form.style.display = "flex";
    if (title) title.textContent = mode === "signup" ? "Join the Verse" : "Welcome back";
    if (submitBtn) submitBtn.textContent = mode === "signup" ? "Create account" : "Log in";
    if (nameInput) nameInput.style.display = mode === "signup" ? "block" : "none";
    if (toggleBtn) toggleBtn.textContent = mode === "signup" ? "Already a member? Log in" : "New here? Sign up";
  }
}

function closeAuth() {
  state.authMode = null;
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.classList.remove("open");
}

function toggleAuthMode() {
  openAuth(state.authMode === "signup" ? "login" : "signup");
}

function submitAuthForm(e) {
  e.preventDefault();
  const form = document.getElementById("auth-form");
  const successBox = document.getElementById("auth-success");
  if (form && successBox) {
    form.style.display = "none";
    successBox.style.display = "block";
  }
}

// Video Lightbox
function openLightbox(videoUrl, title) {
  state.activeVideoUrl = videoUrl;
  const overlay = document.getElementById("lightbox-overlay");
  const iframe = document.getElementById("lightbox-iframe");
  const titleEl = document.getElementById("lightbox-title");
  if (overlay && iframe) {
    iframe.src = videoUrl + "?autoplay=1";
    if (titleEl) titleEl.textContent = title || "Trailer Video";
    overlay.classList.add("open");
  }
}

function closeLightbox() {
  state.activeVideoUrl = null;
  const overlay = document.getElementById("lightbox-overlay");
  const iframe = document.getElementById("lightbox-iframe");
  if (overlay && iframe) {
    iframe.src = "";
    overlay.classList.remove("open");
  }
}

// Rule-Based AI Chatbot Engine
function matchChatRule(userInput) {
  const q = userInput.toLowerCase();
  let bestMatch = null;
  let maxScore = 0;

  for (const f of faqs) {
    let score = 0;
    for (const kw of f.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length * 2;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = f;
    }
  }

  if (bestMatch && maxScore > 0) {
    return {
      from: "bot",
      text: bestMatch.answer,
      link: bestMatch.link
    };
  }

  return {
    from: "bot",
    text: "I'm a rule-based AI assistant! Try asking about 'Anime', 'Gaming', 'Trailers', 'Store merch', 'Events', 'Bookmarks', or tap a quick topic chip below."
  };
}

function toggleChatbot() {
  state.chatbotOpen = !state.chatbotOpen;
  const drawer = document.getElementById("chatbot-drawer");
  const backdrop = document.getElementById("chatbot-backdrop");
  const trigger = document.querySelector(".chatbot-fab");
  if (drawer) {
    drawer.classList.toggle("open", state.chatbotOpen);
    drawer.setAttribute("aria-hidden", String(!state.chatbotOpen));
    drawer.inert = !state.chatbotOpen;
    if (state.chatbotOpen) {
      renderChatMessages();
    }
  }
  backdrop?.classList.toggle("open", state.chatbotOpen);
  trigger?.setAttribute("aria-expanded", String(state.chatbotOpen));
}

function renderChatMessages() {
  const container = document.getElementById("chat-messages");
  if (!container) return;

  let html = "";
  state.chatMessages.forEach(m => {
    if (m.from === "user") {
      html += `
        <div style="align-self:flex-end;background:var(--primary);color:var(--primary-foreground);padding:0.5rem 0.875rem;border-radius:1rem 1rem 0.25rem 1rem;max-width:82%;font-size:0.875rem;margin-bottom:0.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          ${m.text}
        </div>
      `;
    } else {
      const linkHtml = m.link ? `<br/><a href="${m.link}" onclick="toggleChatbot()" style="display:inline-block;margin-top:0.5rem;padding:0.25rem 0.75rem;background:var(--primary);color:var(--primary-foreground);border-radius:0.5rem;font-size:0.75rem;font-weight:700;text-decoration:none;">Take me there →</a>` : "";
      html += `
        <div style="align-self:flex-start;background:var(--secondary);color:var(--foreground);padding:0.625rem 0.875rem;border-radius:1rem 1rem 1rem 0.25rem;max-width:85%;font-size:0.875rem;margin-bottom:0.5rem;border:1px solid var(--border);">
          ${m.text}${linkHtml}
        </div>
      `;
    }
  });

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function sendChatMessageText(text) {
  if (!text || !text.trim()) return;
  const clean = text.trim();
  state.chatMessages.push({ from: "user", text: clean });
  renderChatMessages();

  // Show typing indicator
  const container = document.getElementById("chat-messages");
  if (container) {
    const typingDiv = document.createElement("div");
    typingDiv.id = "chat-typing-indicator";
    typingDiv.style.alignSelf = "flex-start";
    typingDiv.style.background = "var(--secondary)";
    typingDiv.style.padding = "0.5rem 0.75rem";
    typingDiv.style.borderRadius = "1rem";
    typingDiv.style.fontSize = "0.75rem";
    typingDiv.style.color = "var(--muted-foreground)";
    typingDiv.style.marginBottom = "0.5rem";
    typingDiv.textContent = "Verse Bot is typing... 💬";
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }

  setTimeout(() => {
    const indicator = document.getElementById("chat-typing-indicator");
    if (indicator) indicator.remove();

    const botResponse = matchChatRule(clean);
    state.chatMessages.push(botResponse);
    renderChatMessages();
  }, 400);
}

function sendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  if (input) {
    sendChatMessageText(input.value);
    input.value = "";
  }
}

function resetChat() {
  state.chatMessages = [
    { from: "bot", text: "Chat history cleared! Ask me anything or choose a quick suggestion below." }
  ];
  renderChatMessages();
}

// Cart Drawer Renderer
function renderCartDrawer() {
  const container = document.getElementById("cart-items-container");
  const totalEl = document.getElementById("cart-total-price");
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `<p style="padding: 3rem 0; text-align: center; color: var(--muted-foreground);">Your cart is empty. Browse the <a href="merch.html" style="color:var(--primary);text-decoration:underline;">Store</a>.</p>`;
    if (totalEl) totalEl.textContent = "$0.00";
    return;
  }

  let total = 0;
  let html = "";
  state.cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div style="display:flex;align-items:center;gap:0.75rem;border:1px solid var(--border);border-radius:var(--radius-xl);padding:0.75rem;margin-bottom:0.75rem;">
        <div style="flex:1;min-width:0;">
          <p style="font-weight:600;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</p>
          <p style="font-size:0.75rem;color:var(--muted-foreground);">$${item.price.toFixed(2)} each</p>
        </div>
        <div style="display:flex;align-items:center;gap:0.25rem;">
          <button onclick="updateCartQty('${item.id}', -1)" style="height:2rem;width:2rem;border-radius:var(--radius-md);border:none;background:var(--secondary);color:var(--foreground);cursor:pointer;">-</button>
          <span style="width:1.5rem;text-align:center;font-size:0.875rem;font-weight:700;">${item.qty}</span>
          <button onclick="updateCartQty('${item.id}', 1)" style="height:2rem;width:2rem;border-radius:var(--radius-md);border:none;background:var(--secondary);color:var(--foreground);cursor:pointer;">+</button>
        </div>
        <p style="width:4rem;text-align:right;font-size:0.875rem;font-weight:700;">$${itemTotal.toFixed(2)}</p>
      </div>
    `;
  });
  container.innerHTML = html;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

// Component Render Helpers
function renderArticleCard(a) {
  const imgUrl = images[a.category] || images.anime;
  return `
    <article class="article-card card-lift" style="position:relative;">
      ${renderBookmarkButton(a.id)}
      <div>
        <a href="article.html?id=${a.id}">
          <img src="${imgUrl}" alt="${a.title}" loading="lazy" />
        </a>
      </div>
      <div class="card-content">
        <span class="card-tag">${catName(a.category)}</span>
        <h3 class="card-title"><a href="article.html?id=${a.id}">${a.title}</a></h3>
        <p class="card-excerpt">${a.excerpt}</p>
        <div style="margin-top:auto;padding-top:0.75rem;display:flex;justify-content:space-between;font-size:0.75rem;color:var(--muted-foreground);">
          <span>${formatDate(a.date)}</span>
          <span>🔥 ${a.popularity}</span>
        </div>
      </div>
    </article>
  `;
}

function renderCharacterCard(c) {
  return `
    <div class="character-card card-lift" style="position:relative;">
      ${renderBookmarkButton(c.id)}
      <img src="${c.image || images[c.category] || images.anime}" alt="${c.name}" loading="lazy" style="display:block;width:calc(100% + 2.5rem);height:10rem;object-fit:cover;margin:-1.25rem -1.25rem 1rem;border-bottom:1px solid var(--border);" />
      <span class="char-badge">${catName(c.category)}</span>
      <h3 class="char-name" style="margin-top:0.25rem;">${c.name}</h3>
      <p class="char-series">${c.series}</p>
      <p style="margin-top:0.5rem;font-size:0.875rem;color:var(--muted-foreground);">${c.bio}</p>
      <div class="char-traits">
        ${c.traits.map(t => `<span class="trait-tag">${t}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderMediaCard(item) {
  const image = images[item.image] || images[item.category] || images.anime;
  const label = `${catName(item.category)} · ${item.subtype || item.type}`;

  if (item.type === "audio") {
    return `
      <article class="card-lift" style="position:relative;border-radius:var(--radius-2xl);border:1px solid var(--border);background:var(--card);padding:1.25rem;">
        ${renderBookmarkButton(item.id)}
        <span style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;">${label}</span>
        <h3 style="font-size:1.125rem;font-weight:700;margin-top:0.35rem;">${item.title}</h3>
        <p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.35rem;">${item.description || "Listen to this fandom feature."}</p>
        <audio controls preload="none" style="width:100%;margin-top:1rem;"><source src="${item.url}" type="audio/mpeg"></audio>
      </article>`;
  }

  if (item.type === "image") {
    return `
      <article class="card-lift" style="position:relative;overflow:hidden;border-radius:var(--radius-2xl);border:1px solid var(--border);background:var(--card);">
        ${renderBookmarkButton(item.id)}
        <img src="${image}" alt="${item.title}" loading="lazy" style="aspect-ratio:16/9;width:100%;object-fit:cover;filter:hue-rotate(${item.hue || 0}deg);" />
        <div style="padding:1rem;"><span style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;">${label}</span><h3 style="font-size:1rem;font-weight:700;margin-top:0.25rem;">${item.title}</h3><p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.35rem;">${item.description || "A gallery from this fandom."}</p></div>
      </article>`;
  }

  return `
    <article class="card-lift" onclick="openLightbox('${item.url}', '${item.title}')" style="position:relative;overflow:hidden;border-radius:var(--radius-2xl);border:1px solid var(--border);background:var(--card);cursor:pointer;">
      ${renderBookmarkButton(item.id)}
      <img src="${image}" alt="${item.title}" loading="lazy" style="aspect-ratio:16/9;width:100%;object-fit:cover;" />
      <div style="position:absolute;inset:0;background:linear-gradient(to top,var(--background),transparent);display:flex;align-items:center;justify-content:center;"><span style="font-size:2.5rem;">▶️</span></div>
      <div style="position:absolute;right:0;bottom:0;left:0;padding:1rem;"><span style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;">${label}</span><h3 style="font-size:1rem;font-weight:700;margin-top:0.25rem;">${item.title}</h3><p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.35rem;">${item.description || "Watch this fandom feature."}</p></div>
    </article>`;
}

function renderEventCard(e) {
  const dateObj = new Date(e.date + "T00:00:00");
  const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = dateObj.getDate();

  return `
    <div class="event-card card-lift" style="position:relative;">
      <div class="event-date-box">
        <span style="font-size:0.75rem;font-weight:700;">${month}</span>
        <span style="font-size:1.5rem;font-weight:900;">${day}</span>
      </div>
      <div style="flex:1;min-width:0;padding-right:1.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <span style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;">${catName(e.category)}</span>
            <h3 style="font-size:1.125rem;font-weight:700;">${e.title}</h3>
          </div>
          ${renderBookmarkButton(e.id)}
        </div>
        <p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.25rem;">📍 ${e.location}</p>
        <p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.25rem;">${e.description}</p>
      </div>
    </div>
  `;
}

function renderProductCard(p) {
  const imgUrl = p.image || images[p.category] || images.anime;
  return `
    <div class="product-card card-lift" style="position:relative;">
      ${renderBookmarkButton(p.id)}
      <img src="${imgUrl}" alt="${p.name}" style="aspect-ratio:1;width:100%;object-fit:cover;border-radius:var(--radius-xl);" />
      <div style="margin-top:0.75rem;display:flex;flex-direction:column;flex:1;">
        <span style="font-size:0.75rem;font-weight:700;color:var(--accent);text-transform:uppercase;">${catName(p.category)}</span>
        <h3 style="font-size:1rem;font-weight:700;margin-top:0.25rem;">${p.name}</h3>
        <p style="font-size:0.875rem;color:var(--muted-foreground);margin-top:0.25rem;">${p.description}</p>
        <div style="margin-top:auto;padding-top:1rem;display:flex;align-items:center;justify-content:space-between;">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button onclick="addToCart('${p.id}')" class="bg-neon" style="border:none;border-radius:var(--radius-xl);padding:0.5rem 1rem;font-size:0.875rem;font-weight:700;color:var(--primary-foreground);cursor:pointer;">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
}

// Live Clock Initializer
function startLiveClock() {
  const clockEl = document.getElementById("live-clock");
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    clockEl.textContent = `🕒 ${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${now.toLocaleTimeString()}`;
  };
  update();
  setInterval(update, 1000);
}

// Search Form Handler
function handleGlobalSearch(e) {
  e.preventDefault();
  const input = document.getElementById("search-query-input");
  const query = input?.value.trim();
  if (!query) return;

  const nextHash = `#search?q=${encodeURIComponent(query)}`;
  if (window.location.hash === nextHash) {
    renderPageContent();
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    return;
  }
  window.location.hash = nextHash;
}

// Initialize Page Logic
document.addEventListener("DOMContentLoaded", async () => {
  initMobileNav();
  const data = await window.fandomDataReady;
  if (!data) return;

  applyTheme();
  updateBadges();
  renderCartDrawer();
  startLiveClock();
  renderPageContent();

  const visEl = document.getElementById("visitor-count");
  if (visEl) visEl.textContent = state.visitors.toLocaleString();
});
