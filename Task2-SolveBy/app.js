
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  categories: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h4v8H3zM10 3h4v18h-4zM17 8h4v13h-4z"/></svg>`,
  create: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  leaderboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H3v2a4 4 0 004 4M17 6h4v2a4 4 0 01-4 4"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>`
};

const CATEGORY_ICONS = {
  9: "🧠", 10: "📚", 11: "🎬", 12: "🎵", 14: "📺", 15: "🎮", 17: "🔬", 18: "💻", 19: "➗", 20: "🏛️", 21: "⚽", 22: "🌍", 23: "🕰️", 27: "🐾", 28: "🚗", 17: "🔬"
};

const state = {
  route: "home",
  user: null,           // {uid, name, email}
  categories: [],        // from Open Trivia DB
  currentQuiz: null,     // {questions:[], category, difficulty, source:'api'|'custom'}
  quizIndex: 0,
  quizAnswers: [],       // [{selected, correct, question, options, explanation}]
  timer: null,
  timeLeft: 30,
  searchTerm: "",
  filterCategory: "",
  filterDifficulty: "",
  builderQuestions: [],
  localScores: [], // fallback leaderboard if no firebase
};

const LS_KEY = "solveby_quiz_state_v1";
function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      localScores: state.localScores,
      myQuizzes: state.myQuizzes || []
    }));
  } catch (e) { }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.localScores = parsed.localScores || [];
      state.myQuizzes = parsed.myQuizzes || [];
    }
  } catch (e) { }
}
loadLocal();

/* ---------------- Toast ---------------- */
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------- Router ---------------- */
const routes = ["home", "login", "register", "dashboard", "categories", "quiz", "results", "leaderboard", "create"];
function navigate(route, opts = {}) {
  if (!routes.includes(route)) route = "home";
  if ((route === "dashboard" || route === "create") && !state.user) {
    toast("Please log in to continue.");
    route = "login";
  }
  state.route = route;
  state._opts = opts;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.navigate = navigate;

/* ---------------- Nav rendering ---------------- */
function renderNav() {
  const navItems = [
    { id: "home", label: "Home", icon: ICONS.home },
    { id: "categories", label: "Quizzes", icon: ICONS.categories },
    { id: "dashboard", label: "Dashboard", icon: ICONS.dashboard },
    { id: "create", label: "Create", icon: ICONS.create },
    { id: "leaderboard", label: "Leaderboard", icon: ICONS.leaderboard },
  ];

  const navLinks = document.getElementById('navLinks');
  navLinks.innerHTML = navItems.map(it =>
    `<button data-route="${it.id}" class="${state.route === it.id ? 'active' : ''}">${it.label}</button>`
  ).join("");
  navLinks.querySelectorAll('button').forEach(b => b.onclick = () => navigate(b.dataset.route));

  const bottomNav = document.getElementById('bottomNav');
  bottomNav.innerHTML = navItems.map(it =>
    `<button data-route="${it.id}" class="${state.route === it.id ? 'active' : ''}">${it.icon}<span>${it.label}</span></button>`
  ).join("");
  bottomNav.querySelectorAll('button').forEach(b => b.onclick = () => navigate(b.dataset.route));

  const navActions = document.getElementById('navActions');
  if (state.user) {
    const initials = (state.user.name || state.user.email || "U").slice(0, 1).toUpperCase();
    navActions.innerHTML = `
      <div class="avatar-pill" id="avatarPill"><div class="avatar-circle">${initials}</div>${state.user.name || state.user.email.split('@')[0]}</div>
      <button class="icon-btn" id="logoutBtn" title="Log out">${ICONS.logout}</button>
    `;
    document.getElementById('logoutBtn').onclick = doLogout;
    document.getElementById('avatarPill').onclick = () => navigate('dashboard');
  } else {
    navActions.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="loginNavBtn">Log in</button>
      <button class="btn btn-primary btn-sm" id="registerNavBtn">Sign up</button>
    `;
    document.getElementById('loginNavBtn').onclick = () => navigate('login');
    document.getElementById('registerNavBtn').onclick = () => navigate('register');
  }
}

/* ---------------- Auth ---------------- */
async function doLogin(email, password) {
  const f = window.__fb;
  if (!f.fb.ready) {
    // demo/local mode
    state.user = { uid: "local-" + btoa(email), name: email.split('@')[0], email };
    toast("Logged in (demo mode — Firebase not configured).");
    navigate('dashboard');
    return;
  }
  try {
    const cred = await f.signInWithEmailAndPassword(f.fb.auth, email, password);
    state.user = { uid: cred.user.uid, name: cred.user.displayName, email: cred.user.email };
    toast("Welcome back!");
    navigate('dashboard');
  } catch (e) {
    showAuthError(e.message);
  }
}
async function doRegister(name, email, password) {
  const f = window.__fb;
  if (!f.fb.ready) {
    state.user = { uid: "local-" + btoa(email), name, email };
    toast("Account created (demo mode — Firebase not configured).");
    navigate('dashboard');
    return;
  }
  try {
    const cred = await f.createUserWithEmailAndPassword(f.fb.auth, email, password);
    await f.updateProfile(cred.user, { displayName: name });
    state.user = { uid: cred.user.uid, name, email };
    toast("Account created. Welcome!");
    navigate('dashboard');
  } catch (e) {
    showAuthError(e.message);
  }
}
function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg.replace('Firebase:', '').trim(); el.classList.remove('hidden'); }
}
async function doLogout() {
  const f = window.__fb;

  if (f.fb.ready) {
    await f.signOut(f.fb.auth);
  }

  state.user = null;
  navigate("home");
  toast("Logged out successfully.");
}
/* ---------------- Open Trivia DB ---------------- */
const OTDB_BASE = "https://opentdb.com";
async function fetchCategories() {
  if (state.categories.length) return state.categories;
  try {
    const res = await fetch(`${OTDB_BASE}/api_category.php`);
    const data = await res.json();
    state.categories = data.trivia_categories || [];
  } catch (e) {
    state.categories = [
      { id: 9, name: "General Knowledge" }, { id: 11, name: "Entertainment: Film" },
      { id: 17, name: "Science & Nature" }, { id: 18, name: "Science: Computers" },
      { id: 21, name: "Sports" }, { id: 22, name: "Geography" }, { id: 23, name: "History" }, { id: 27, name: "Animals" }
    ];
  }
  return state.categories;
}
function decodeHtml(str) {
  const t = document.createElement('textarea');
  t.innerHTML = str;
  return t.value;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function fetchQuiz({ amount = 10, category = "", difficulty = "" }) {
  let url = `${OTDB_BASE}/api.php?amount=${amount}&type=multiple`;
  if (category) url += `&category=${category}`;
  if (difficulty) url += `&difficulty=${difficulty}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.response_code !== 0 || !data.results || !data.results.length) {
    throw new Error("No questions found for this combination — try a different category/difficulty.");
  }
  return data.results.map(q => {
    const options = shuffle([...q.incorrect_answers, q.correct_answer]).map(decodeHtml);
    return {
      question: decodeHtml(q.question),
      options,
      correct: decodeHtml(q.correct_answer),
      explanation: `The correct answer is "${decodeHtml(q.correct_answer)}". This question is from the ${decodeHtml(q.category)} category (${q.difficulty} difficulty).`,
      category: decodeHtml(q.category),
      difficulty: q.difficulty
    };
  });
}

/* ---------------- Firestore helpers ---------------- */
async function saveScoreToLeaderboard(entry) {
  const f = window.__fb;
  if (f.fb.ready && state.user && !state.user.uid.startsWith('local-')) {
    try {
      await f.addDoc(f.collection(f.fb.db, "leaderboard"), {
        ...entry, createdAt: f.serverTimestamp()
      });
      return;
    } catch (e) { console.warn("Firestore save failed, falling back to local.", e); }
  }
  state.localScores.unshift({ ...entry, createdAt: Date.now() });
  state.localScores = state.localScores.slice(0, 200);
  saveLocal();
}
async function fetchLeaderboard() {
  const f = window.__fb;
  if (f.fb.ready) {
    try {
      const q = f.query(f.collection(f.fb.db, "leaderboard"), f.orderBy("percentage", "desc"), f.limit(50));
      const snap = await f.getDocs(q);
      const out = [];
      snap.forEach(d => out.push(d.data()));
      if (out.length) return out;
    } catch (e) { console.warn("Firestore leaderboard fetch failed, using local.", e); }
  }
  return [...state.localScores].sort((a, b) => b.percentage - a.percentage).slice(0, 50);
}
async function saveCustomQuiz(quiz) {
  const f = window.__fb;
  if (f.fb.ready && state.user && !state.user.uid.startsWith('local-')) {
    try {
      await f.addDoc(f.collection(f.fb.db, "quizzes"), {
        ...quiz, ownerId: state.user.uid, ownerName: state.user.name || state.user.email,
        createdAt: f.serverTimestamp()
      });
      return;
    } catch (e) { console.warn("Firestore quiz save failed, falling back to local.", e); }
  }
  state.myQuizzes = state.myQuizzes || [];
  state.myQuizzes.unshift({ ...quiz, ownerId: state.user?.uid, ownerName: state.user?.name, createdAt: Date.now() });
  saveLocal();
}
async function fetchMyQuizzes() {
  const f = window.__fb;
  if (f.fb.ready && state.user && !state.user.uid.startsWith('local-')) {
    try {
      const q = f.query(f.collection(f.fb.db, "quizzes"), f.where("ownerId", "==", state.user.uid));
      const snap = await f.getDocs(q);
      const out = [];
      snap.forEach(d => out.push(d.data()));
      return out;
    } catch (e) { console.warn("Firestore fetch quizzes failed.", e); }
  }
  return state.myQuizzes || [];
}

/* ===========================================================
   PAGE RENDERERS
   =========================================================== */
function render() {
  renderNav();
  const main = document.getElementById('main');
  main.innerHTML = "";
  const renderers = {
    home: renderHome, login: renderLogin, register: renderRegister,
    dashboard: renderDashboard, categories: renderCategories, quiz: renderQuizPage,
    results: renderResults, leaderboard: renderLeaderboard, create: renderCreate
  };
  (renderers[state.route] || renderHome)(main);
}

/* ---- HOME ---- */
function renderHome(main) {
  main.innerHTML = `
    <section class="hero">
      <span class="badge" style="background:rgba(255,255,255,.18);color:#fff;">⚡ Powered by Open Trivia DB</span>
      <h1>Test your knowledge.<br>Climb the leaderboard.</h1>
      <p>SolveBy Quiz brings thousands of trivia questions across every category, timed challenges, instant scoring, and quizzes you build yourself.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="ctaStart">Start a Quiz</button>
        <button class="btn btn-outline" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.5);" id="ctaCreate">Create a Quiz</button>
      </div>
      <div class="stats">
        <div class="stat"><b>24+</b><span>Categories</span></div>
        <div class="stat"><b>3</b><span>Difficulty levels</span></div>
        <div class="stat"><b>30s</b><span>Per question</span></div>
      </div>
    </section>

    <h3 class="section-title" style="margin-bottom:14px;">Why SolveBy</h3>
    <div class="feature-row">
      <div class="feature-chip"><div class="ic">⏱️</div><b>Timed rounds</b><span>30 seconds per question keeps it sharp</span></div>
      <div class="feature-chip"><div class="ic">📊</div><b>Live progress</b><span>See exactly where you are in the quiz</span></div>
      <div class="feature-chip"><div class="ic">🏅</div><b>Achievements</b><span>Earn badges based on your score</span></div>
      <div class="feature-chip"><div class="ic">🧩</div><b>Build your own</b><span>Create and share custom quizzes</span></div>
      <div class="feature-chip"><div class="ic">🌍</div><b>Global ranks</b><span>Compete on the live leaderboard</span></div>
    </div>

    <div class="grid grid-2" style="margin-top:28px;">
      <div class="card">
        <h3 style="color:var(--blue-900);margin-bottom:6px;">🎯 Quick Play</h3>
        <p class="section-sub" style="margin-bottom:14px;">Jump into a random 10-question mixed quiz right now.</p>
        <button class="btn btn-primary btn-block" id="quickPlayBtn">Quick Play</button>
      </div>
      <div class="card">
        <h3 style="color:var(--blue-900);margin-bottom:6px;">✍️ Make a Quiz</h3>
        <p class="section-sub" style="margin-bottom:14px;">Write your own questions and share them with friends.</p>
        <button class="btn btn-ghost btn-block" id="makeQuizBtn">Create Quiz</button>
      </div>
    </div>
  `;
  document.getElementById('ctaStart').onclick = () => navigate('categories');
  document.getElementById('ctaCreate').onclick = () => navigate('create');
  document.getElementById('makeQuizBtn').onclick = () => navigate('create');
  document.getElementById('quickPlayBtn').onclick = async () => {
    toast("Fetching your quiz...");
    try {
      const qs = await fetchQuiz({ amount: 10 });
      startQuizSession(qs, { category: "Mixed", difficulty: "mixed", source: "api" });
    } catch (e) { toast(e.message); }
  };
}

/* ---- LOGIN ---- */
function renderLogin(main) {
  main.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <div class="logo-big">S</div>
        <h2>Welcome back</h2>
        <p class="sub">Log in to track your scores and badges.</p>
        <div class="err-msg hidden" id="authError"></div>
        <form id="loginForm">
          <div class="field">
            <label class="field-label">Email</label>
            <input class="input" type="email" id="loginEmail" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label class="field-label">Password</label>
            <input class="input" type="password" id="loginPassword" placeholder="••••••••" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Log In</button>
        </form>
        <div class="switch-line">Don't have an account? <button id="goRegister">Sign up</button></div>
      </div>
    </div>
  `;
  document.getElementById('goRegister').onclick = () => navigate('register');
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault();
    doLogin(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
  };
}

/* ---- REGISTER ---- */
function renderRegister(main) {
  main.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <div class="logo-big">S</div>
        <h2>Create your account</h2>
        <p class="sub">Join SolveBy Quiz and start competing today.</p>
        <div class="err-msg hidden" id="authError"></div>
        <form id="registerForm">
          <div class="field">
            <label class="field-label">Full name</label>
            <input class="input" type="text" id="regName" placeholder="Jane Doe" required>
          </div>
          <div class="field">
            <label class="field-label">Email</label>
            <input class="input" type="email" id="regEmail" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label class="field-label">Password</label>
            <input class="input" type="password" id="regPassword" placeholder="At least 6 characters" minlength="6" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Sign Up</button>
        </form>
        <div class="switch-line">Already have an account? <button id="goLogin">Log in</button></div>
      </div>
    </div>
  `;
  document.getElementById('goLogin').onclick = () => navigate('login');
  document.getElementById('registerForm').onsubmit = (e) => {
    e.preventDefault();
    doRegister(
      document.getElementById('regName').value.trim(),
      document.getElementById('regEmail').value.trim(),
      document.getElementById('regPassword').value
    );
  };
}

/* ---- DASHBOARD ---- */
async function renderDashboard(main) {
  main.innerHTML = `<div class="loading-wrap"><div class="spinner"></div>Loading your dashboard...</div>`;
  const board = await fetchLeaderboard();
 if (!state.user) {
  navigate("login");
  return;
}

const mine = board.filter(
  b => b.userId === state.user?.uid || b.userEmail === state.user?.email
);
  const myQuizzes = await fetchMyQuizzes();
  const best = mine.length ? Math.max(...mine.map(m => m.percentage)) : 0;
  const played = mine.length;
  const avg = mine.length ? Math.round(mine.reduce((a, b) => a + b.percentage, 0) / mine.length) : 0;

  main.innerHTML = `
    <div class="dash-hero">
      <div>
        <h2>Hi, ${state.user.name || state.user.email.split('@')[0]} 👋</h2>
        <p>Ready to climb the leaderboard today?</p>
      </div>
      <button class="btn btn-primary" id="dashPlayBtn">Play a Quiz</button>
    </div>

    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card"><div class="num">${played}</div><div class="lbl">Quizzes played</div></div>
      <div class="stat-card"><div class="num">${best}%</div><div class="lbl">Best score</div></div>
      <div class="stat-card"><div class="num">${avg}%</div><div class="lbl">Average score</div></div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <h3 class="section-title" style="font-size:1.1rem;">Recent attempts</h3>
      <div id="recentList">${mine.length ? mine.slice(0, 6).map(m => `
        <div class="quiz-list-item">
          <div class="meta"><b>${m.category || 'Quiz'} · ${m.difficulty || ''}</b><span>${m.correctCount}/${m.totalCount} correct</span></div>
          <span class="badge">${m.percentage}%</span>
        </div>`).join("") : `<div class="empty-state"><div class="ic">📭</div>No attempts yet — play your first quiz!</div>`}
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h3 class="section-title" style="font-size:1.1rem;">My created quizzes</h3>
        <button class="btn btn-ghost btn-sm" id="dashCreateBtn">+ New</button>
      </div>
      ${myQuizzes.length ? myQuizzes.map(q => `
        <div class="quiz-list-item">
          <div class="meta"><b>${q.title}</b><span>${(q.questions || []).length} questions</span></div>
          <button class="btn btn-outline btn-sm" data-play-custom="${q.title}">Play</button>
        </div>`).join("") : `<div class="empty-state"><div class="ic">🧩</div>You haven't created any quizzes yet.</div>`}
    </div>
  `;
  document.getElementById('dashPlayBtn').onclick = () => navigate('categories');
  document.getElementById('dashCreateBtn').onclick = () => navigate('create');
  main.querySelectorAll('[data-play-custom]').forEach(btn => {
    btn.onclick = () => {
      const q = myQuizzes.find(x => x.title === btn.dataset.playCustom);
      if (q) startQuizSession(q.questions.map(qq => ({ ...qq, correct: qq.correct })), { category: q.title, difficulty: "custom", source: "custom" });
    };
  });
}

/* ---- CATEGORIES ---- */
async function renderCategories(main) {
  main.innerHTML = `<div class="loading-wrap"><div class="spinner"></div>Loading categories...</div>`;
  const cats = await fetchCategories();
  const popularIds = [9, 11, 17, 18, 21, 22, 23, 27, 15, 12, 19, 20];
  const popular = cats.filter(c => popularIds.includes(c.id));
  const list = popular.length ? popular : cats.slice(0, 12);

  function draw() {
    const term = state.searchTerm.toLowerCase();
    const filtered = list.filter(c => c.name.toLowerCase().includes(term));
    main.innerHTML = `
      <h2 class="section-title">Quiz Categories</h2>
      <p class="section-sub">Search and filter, then pick a category to start.</p>
      <div class="search-row">
        <input class="input" id="searchInput" placeholder="🔍 Search categories..." value="${state.searchTerm}">
      </div>
      <div class="filter-row">
        <select id="diffSelect">
          <option value="">Any difficulty</option>
          <option value="easy" ${state.filterDifficulty === 'easy' ? 'selected' : ''}>Easy</option>
          <option value="medium" ${state.filterDifficulty === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="hard" ${state.filterDifficulty === 'hard' ? 'selected' : ''}>Hard</option>
        </select>
        <select id="amountSelect">
          <option value="5">5 questions</option>
          <option value="10" selected>10 questions</option>
          <option value="15">15 questions</option>
          <option value="20">20 questions</option>
        </select>
      </div>
      <div class="grid grid-3" id="catGrid">
        ${filtered.map(c => `
          <div class="cat-card" data-id="${c.id}" data-name="${c.name}">
            <div class="ic">${CATEGORY_ICONS[c.id] || "❓"}</div>
            <h3>${c.name}</h3>
            <div class="diff-tags">
              <span class="diff-tag easy">Easy</span>
              <span class="diff-tag medium">Medium</span>
              <span class="diff-tag hard">Hard</span>
            </div>
          </div>
        `).join("") || `<div class="empty-state"><div class="ic">🔍</div>No categories match your search.</div>`}
      </div>
    `;
    document.getElementById('searchInput').oninput = (e) => { state.searchTerm = e.target.value; draw(); };
    document.getElementById('diffSelect').onchange = (e) => { state.filterDifficulty = e.target.value; };
    main.querySelectorAll('.cat-card').forEach(card => {
      card.onclick = async () => {
        const amount = document.getElementById('amountSelect').value;
        toast(`Loading ${card.dataset.name} quiz...`);
        try {
          const qs = await fetchQuiz({ amount, category: card.dataset.id, difficulty: state.filterDifficulty });
          startQuizSession(qs, { category: card.dataset.name, difficulty: state.filterDifficulty || 'mixed', source: 'api' });
        } catch (e) { toast(e.message); }
      };
    });
  }
  draw();
}

/* ---- QUIZ SESSION ---- */
function startQuizSession(questions, meta) {
  state.currentQuiz = { questions, ...meta };
  state.quizIndex = 0;
  state.quizAnswers = [];
  navigate('quiz');
}

function renderQuizPage(main) {
  const quiz = state.currentQuiz;
  if (!quiz || !quiz.questions || !quiz.questions.length) {
    main.innerHTML = `<div class="empty-state"><div class="ic">🧐</div>No active quiz.<br><button class="btn btn-primary" style="margin-top:14px;" id="backCat">Browse categories</button></div>`;
    document.getElementById('backCat').onclick = () => navigate('categories');
    return;
  }
  const i = state.quizIndex;
  const q = quiz.questions[i];
  const total = quiz.questions.length;
  const pct = Math.round((i / total) * 100);

  main.innerHTML = `
    <div class="quiz-header">
      <div>
        <div class="q-counter">QUESTION ${i + 1} OF ${total}</div>
        <span class="badge">${quiz.category} · ${quiz.difficulty}</span>
      </div>
      <div class="timer-ring" id="timerRing" style="--p:100;"><span id="timerVal">30</span></div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="card">
      <div class="q-text">${q.question}</div>
      <div id="optionsWrap">
        ${q.options.map((opt, idx) => `
          <button class="opt-btn" data-idx="${idx}">
            <span class="opt-letter">${String.fromCharCode(65 + idx)}</span> ${opt}
          </button>
        `).join("")}
      </div>
      <div id="explainWrap"></div>
      <div class="quiz-nav">
        <button class="btn btn-outline" id="skipBtn">Skip</button>
        <button class="btn btn-primary hidden" id="nextBtn">${i === total - 1 ? 'See Results' : 'Next Question'}</button>
      </div>
    </div>
  `;

  let answered = false;
  function lockIn(selectedIdx) {
    if (answered) return;
    answered = true;
    clearInterval(state.timer);
    const selectedText = selectedIdx === null ? null : q.options[selectedIdx];
    const isCorrect = selectedText === q.correct;
    state.quizAnswers.push({
      question: q.question, options: q.options, selected: selectedText,
      correct: q.correct, isCorrect, explanation: q.explanation
    });
    document.querySelectorAll('.opt-btn').forEach((btn, idx) => {
      btn.disabled = true;
      if (q.options[idx] === q.correct) btn.classList.add('correct');
      else if (idx === selectedIdx) btn.classList.add('wrong');
    });
    document.getElementById('explainWrap').innerHTML = `<div class="explain-box">💡 ${q.explanation}</div>`;
    document.getElementById('nextBtn').classList.remove('hidden');
    document.getElementById('skipBtn').classList.add('hidden');
  }

  main.querySelectorAll('.opt-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      lockIn(parseInt(btn.dataset.idx));
    };
  });
  document.getElementById('skipBtn').onclick = () => lockIn(null);
  document.getElementById('nextBtn').onclick = () => {
    if (i + 1 >= total) { finishQuiz(); }
    else { state.quizIndex++; render(); }
  };

  // timer
  state.timeLeft = 30;
  clearInterval(state.timer);
  const ring = document.getElementById('timerRing');
  const valEl = document.getElementById('timerVal');
  state.timer = setInterval(() => {
    state.timeLeft--;
    valEl.textContent = state.timeLeft;
    ring.style.setProperty('--p', Math.round((state.timeLeft / 30) * 100));
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      if (!answered) lockIn(null);
    }
  }, 1000);
}

async function finishQuiz() {
  const quiz = state.currentQuiz;
  const correctCount = state.quizAnswers.filter(a => a.isCorrect).length;
  const totalCount = state.quizAnswers.length;
  const percentage = totalCount ? Math.round((correctCount / totalCount) * 100) : 0;
  const entry = {
    userId: state.user?.uid || "guest",
    userEmail: state.user?.email || "guest",
    userName: state.user?.name || (state.user?.email ? state.user.email.split('@')[0] : "Guest"),
    category: quiz.category, difficulty: quiz.difficulty,
    correctCount, totalCount, percentage
  };
  await saveScoreToLeaderboard(entry);
  state._lastResult = entry;
  navigate('results');
}

/* ---- RESULTS ---- */
function getBadge(pct) {
  if (pct === 100) return { label: "Perfect Score", emoji: "🏆" };
  if (pct >= 80) return { label: "Quiz Master", emoji: "🥇" };
  if (pct >= 60) return { label: "Knowledge Pro", emoji: "🥈" };
  if (pct >= 40) return { label: "Getting There", emoji: "🥉" };
  return { label: "Keep Practicing", emoji: "🌱" };
}
function renderResults(main) {
  const result = state._lastResult;
  if (!result) {
    main.innerHTML = `<div class="empty-state"><div class="ic">📊</div>No results yet — play a quiz first!</div>`;
    return;
  }
  const badge = getBadge(result.percentage);
  main.innerHTML = `
    <div class="card results-hero">
      <div class="score-ring" style="--pct:${result.percentage}"><div class="val">${result.percentage}%<small>${result.correctCount}/${result.totalCount} correct</small></div></div>
      <div class="badge-pill">${badge.emoji} ${badge.label}</div>
      <p class="section-sub" style="margin-top:6px;">${result.category} · ${result.difficulty}</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px;">
        <button class="btn btn-primary" id="playAgainBtn">Play Again</button>
        <button class="btn btn-outline" id="viewLbBtn">View Leaderboard</button>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <h3 class="section-title" style="font-size:1.1rem;margin-bottom:10px;">Answer Review</h3>
      ${state.quizAnswers.map((a, idx) => `
        <div class="review-item">
          <div class="rq">${idx + 1}. ${a.question}</div>
          <div class="ra ${a.isCorrect ? 'correct' : 'wrong'}">${a.isCorrect ? '✔ Correct' : '✘ ' + (a.selected ? 'Your answer: ' + a.selected : 'No answer given')}</div>
          ${!a.isCorrect ? `<div class="ra correct">Correct answer: ${a.correct}</div>` : ''}
          <div class="rexp">💡 ${a.explanation}</div>
        </div>
      `).join("")}
    </div>
  `;
  document.getElementById('playAgainBtn').onclick = () => navigate('categories');
  document.getElementById('viewLbBtn').onclick = () => navigate('leaderboard');
}

/* ---- LEADERBOARD ---- */
async function renderLeaderboard(main) {
  main.innerHTML = `<div class="loading-wrap"><div class="spinner"></div>Loading leaderboard...</div>`;
  const board = await fetchLeaderboard();
  const sorted = [...board].sort((a, b) => b.percentage - a.percentage);
  main.innerHTML = `
    <h2 class="section-title">Leaderboard</h2>
    <p class="section-sub">Top scores from quiz takers across SolveBy Quiz.</p>
    <div id="lbList">
      ${sorted.length ? sorted.slice(0, 30).map((s, idx) => `
        <div class="lb-row ${idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : ''}">
          <div class="lb-rank">${idx + 1}</div>
          <div class="lb-name">${s.userName || 'Anonymous'}<small>${s.category || 'Quiz'} · ${s.difficulty || ''}</small></div>
          <div class="lb-score">${s.percentage}%</div>
        </div>
      `).join("") : `<div class="empty-state"><div class="ic">🏆</div>No scores yet — be the first to play!</div>`}
    </div>
  `;
}

/* ---- CREATE QUIZ ---- */
function renderCreate(main) {
  if (!state.builderQuestions.length) {
    state.builderQuestions = [blankQuestion()];
  }
  draw();
  function blankQuestion() {
    return { question: "", options: ["", "", "", ""], correctIdx: 0, explanation: "" };
  }
  function draw() {
    main.innerHTML = `
      <h2 class="section-title">Create a Quiz</h2>
      <p class="section-sub">Write your own questions, set the correct answer, and add an explanation.</p>
      <div class="card" style="margin-bottom:18px;">
        <div class="field">
          <label class="field-label">Quiz title</label>
          <input class="input" id="quizTitle" placeholder="e.g. World Capitals Challenge" value="${state.builderTitle || ''}">
        </div>
      </div>
      <div id="builderList"></div>
      <button class="btn btn-ghost" id="addQBtn" style="margin-bottom:20px;">+ Add Question</button>
      <div style="display:flex;gap:12px;">
        <button class="btn btn-primary btn-block" id="saveQuizBtn">Save Quiz</button>
      </div>
    `;
    const list = document.getElementById('builderList');
    list.innerHTML = state.builderQuestions.map((q, qi) => `
      <div class="q-builder-item">
        ${state.builderQuestions.length > 1 ? `<button class="rm-btn" data-rm="${qi}">×</button>` : ''}
        <div class="field">
          <label class="field-label">Question ${qi + 1}</label>
          <input class="input" data-qtext="${qi}" placeholder="Type your question..." value="${q.question}">
        </div>
        ${q.options.map((opt, oi) => `
          <div class="opt-input-row">
            <input type="radio" name="correct-${qi}" data-correct="${qi}-${oi}" ${q.correctIdx === oi ? 'checked' : ''}>
            <input class="input" data-opt="${qi}-${oi}" placeholder="Option ${oi + 1}" value="${opt}">
          </div>
        `).join("")}
        <div class="field" style="margin-top:8px;">
          <label class="field-label">Explanation (optional)</label>
          <input class="input" data-exp="${qi}" placeholder="Why is this the correct answer?" value="${q.explanation}">
        </div>
      </div>
    `).join("");

    document.getElementById('quizTitle').oninput = (e) => state.builderTitle = e.target.value;
    list.querySelectorAll('[data-qtext]').forEach(inp => inp.oninput = (e) => {
      state.builderQuestions[+e.target.dataset.qtext].question = e.target.value;
    });
    list.querySelectorAll('[data-opt]').forEach(inp => inp.oninput = (e) => {
      const [qi, oi] = e.target.dataset.opt.split('-').map(Number);
      state.builderQuestions[qi].options[oi] = e.target.value;
    });
    list.querySelectorAll('[data-correct]').forEach(inp => inp.onchange = (e) => {
      const [qi, oi] = e.target.dataset.correct.split('-').map(Number);
      state.builderQuestions[qi].correctIdx = oi;
    });
    list.querySelectorAll('[data-exp]').forEach(inp => inp.oninput = (e) => {
      state.builderQuestions[+e.target.dataset.exp].explanation = e.target.value;
    });
    list.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      state.builderQuestions.splice(+btn.dataset.rm, 1);
      draw();
    });
    document.getElementById('addQBtn').onclick = () => {
      state.builderQuestions.push(blankQuestion());
      draw();
    };
    document.getElementById('saveQuizBtn').onclick = onSave;
  }
  async function onSave() {
    const title = (state.builderTitle || "").trim();
    if (!title) { toast("Please give your quiz a title."); return; }
    const invalid = state.builderQuestions.some(q => !q.question.trim() || q.options.some(o => !o.trim()));
    if (invalid) { toast("Please fill in every question and all four options."); return; }
    const questions = state.builderQuestions.map(q => ({
      question: q.question.trim(),
      options: q.options.map(o => o.trim()),
      correct: q.options[q.correctIdx].trim(),
      explanation: q.explanation.trim() || `The correct answer is "${q.options[q.correctIdx].trim()}".`
    }));
    await saveCustomQuiz({ title, questions });
    toast("Quiz saved! Find it in your dashboard.");
    state.builderQuestions = [];
    state.builderTitle = "";
    navigate('dashboard');
  }
}
const fbObj = window.__fb;

if (fbObj.fb.ready) {
  fbObj.onAuthStateChanged(fbObj.fb.auth, (user) => {
    if (user) {
      state.user = {
        uid: user.uid,
        name: user.displayName || user.email.split("@")[0],
        email: user.email
      };
    } else {
      state.user = null;
    }

    render();
  });
} else {
  render();
}