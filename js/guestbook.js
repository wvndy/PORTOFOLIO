/**
 * guestbook.js — Swandy Sianturi Portfolio
 * Drawer-style guestbook with Supabase + GitHub/Google auth.
 * Falls back to localStorage demo mode if Supabase is not configured.
 */

/* ── Config ─────────────────────────────────────────────── */
const CFG      = window.GUESTBOOK_CONFIG || {};
const SB_URL   = (CFG.supabaseUrl   || '').trim();
const SB_KEY   = (CFG.supabaseAnonKey || '').trim();
const CONFIGURED = /^https?:\/\//.test(SB_URL) && SB_KEY.length > 20 &&
                   !/your-project|YOUR_|placeholder/i.test(SB_URL + SB_KEY);

const DEMO_KEY      = 'swandy_guestbook_v2';
const LEGACY_KEY    = 'swandy_guestbook_v1';
const DEMO_USER_KEY = 'swandy_gb_demo_user';
const AUTH_FLAG     = 'swandy_gb_open_after_auth';
const PAGE_LIMIT    = 15;
const MAX_LEN       = 280;

/* ── Demo data ───────────────────────────────────────────── */
const now = Date.now();
const DEMO_USERS = {
    github: { id: 'demo-github', name: 'GitHub Visitor', email: 'visitor@github.demo', provider: 'github', avatar: '' },
    google: { id: 'demo-google', name: 'Google Visitor', email: 'visitor@google.demo', provider: 'google', avatar: '' },
};

const DEMO_SEED = [
    { id: 'ds-1', created_at: new Date(now - 3 * 3600e3).toISOString(), user_id: 'demo-rizky', user_name: 'Rizky Pratama', user_avatar: '', user_provider: 'github', message: 'Porto-nya keren! Tema Spider-Man-nya dapet banget. Animasi web-nya smooth.', is_pinned: true,  parent_id: null },
    { id: 'ds-2', created_at: new Date(now - 2 * 3600e3).toISOString(), user_id: 'demo-owner', user_name: 'Swandy',        user_avatar: '', user_provider: 'google', message: 'Makasih banyak! Senang dengernya 🙏 Stay tuned buat update berikutnya!',  is_pinned: false, parent_id: 'ds-1' },
    { id: 'ds-3', created_at: new Date(now - 1 * 3600e3).toISOString(), user_id: 'demo-maya',  user_name: 'Maya Rizaldi',  user_avatar: '', user_provider: 'google', message: 'Semangat terus bikin project baru. Buku tamunya juga rapi!',               is_pinned: false, parent_id: null },
    { id: 'ds-4', created_at: new Date(now - 30 * 60e3).toISOString(),  user_id: 'demo-dimas', user_name: 'Dimas Aditya',  user_avatar: '', user_provider: 'github', message: 'Izin belajar layout-nya ya, clean banget. Gokil bro!',                     is_pinned: false, parent_id: null },
];

/* ── State ───────────────────────────────────────────────── */
let supabase       = null;
let demoMode       = !CONFIGURED;
let initError      = null;
let realtimeChannel = null;

const state = {
    messages:    [],
    user:        null,   // Supabase user
    demoUser:    null,   // demo user object
    loading:     true,
    error:       '',
    replyTo:     null,
    visibleCount: PAGE_LIMIT,
    sending:     false,
    hasRendered: false,
    lastFocus:   null,
    toastTimer:  null,
    prevOverflow: '',
    demoMemory:  null,
};

/* ── DOM refs ────────────────────────────────────────────── */
let fab, fabCount, overlay, drawer, closeBtn, modeEl, headerCount,
    notice, authEl, listEl, lockedEl, composerEl, msgEl, sendBtn,
    counterEl, replyBar, replyNameEl, replyCancelBtn, toastEl, navLinks;

/* ═══════════════════════════════════════════════════════════
   DOM helpers
═══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

function mk(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls)  n.className = cls;
    if (text != null) n.textContent = text;
    return n;
}

function spiderSvg(size = 24) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
        '<ellipse cx="24" cy="20" rx="7" ry="6"/>' +
        '<ellipse cx="24" cy="31" rx="10" ry="9"/>' +
        '<path d="M18 16 L6 8 M20 14 L12 3 M28 14 L36 3 M30 16 L42 8 M15 29 L3 25 M14 33 L2 34 M33 33 L46 34 M34 29 L45 25" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    return svg;
}

function providerIcon(provider, cls = '') {
    const i = mk('i');
    const map = { github: 'fa-brands fa-github', google: 'fa-brands fa-google', local: 'fa-solid fa-hard-drive' };
    i.className = (map[provider] || 'fa-solid fa-envelope') + (cls ? ' ' + cls : '');
    i.setAttribute('aria-hidden', 'true');
    return i;
}

function avatarEl(name, url, cls = 'gb-avatar-sm') {
    const box = mk('span', cls);
    box.textContent = initial(name);
    if (url && /^https:\/\//.test(url)) {
        const img = document.createElement('img');
        img.src = url; img.alt = ''; img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => { img.remove(); box.textContent = initial(name); };
        box.textContent = '';
        box.appendChild(img);
    }
    return box;
}

function initial(name) { return (String(name || '?')[0] || '?').toUpperCase(); }

function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
}

/* ═══════════════════════════════════════════════════════════
   Toast
═══════════════════════════════════════════════════════════ */
function showToast(text, type = 'info') {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.className   = 'gb-toast show' + (type ? ' gb-toast--' + type : '');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3800);
}

/* ═══════════════════════════════════════════════════════════
   Demo localStorage store
═══════════════════════════════════════════════════════════ */
function seedDemo() {
    const base = DEMO_SEED.map(m => ({ ...m }));
    // Migrate legacy v1 messages
    try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
            const old = JSON.parse(raw);
            if (Array.isArray(old)) {
                old.slice(-20).forEach((g, i) => base.push({
                    id: 'legacy-' + i + '-' + Date.now(),
                    created_at: new Date(g.ts || Date.now()).toISOString(),
                    user_id: 'legacy-' + i,
                    user_name: String(g.name || 'Tamu').slice(0, 40),
                    user_avatar: '', user_provider: 'local',
                    message: String(g.msg || '').slice(0, MAX_LEN),
                    is_pinned: false, parent_id: null,
                }));
            }
        }
    } catch { /* ignore */ }
    return base;
}

function readDemoStore() {
    if (state.demoMemory) return state.demoMemory.slice();
    try {
        const raw = localStorage.getItem(DEMO_KEY);
        const data = raw ? JSON.parse(raw) : seedDemo();
        state.demoMemory = data;
        if (!raw) writeDemoStore(data);
        return data.slice();
    } catch {
        state.demoMemory = seedDemo();
        return state.demoMemory.slice();
    }
}

function writeDemoStore(rows) {
    state.demoMemory = rows.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1);
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(state.demoMemory)); } catch { /* ignore */ }
}

function getDemoUser() {
    const p = sessionStorage.getItem(DEMO_USER_KEY);
    return (p && DEMO_USERS[p]) ? { ...DEMO_USERS[p] } : null;
}

function getDisplayUser() {
    if (demoMode) return state.demoUser;
    if (!state.user) return null;
    return {
        id:       state.user.id,
        name:     state.user.user_metadata?.full_name || state.user.user_metadata?.user_name || state.user.user_metadata?.name || state.user.email?.split('@')[0] || 'Tamu',
        email:    state.user.email || '',
        provider: state.user.app_metadata?.provider || 'email',
        avatar:   state.user.user_metadata?.avatar_url || '',
    };
}

/* ═══════════════════════════════════════════════════════════
   Supabase init
═══════════════════════════════════════════════════════════ */
async function setupSupabase() {
    if (!CONFIGURED) return;
    try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        supabase = createClient(SB_URL, SB_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
        supabase.auth.onAuthStateChange((event, session) => {
            state.user = session?.user ?? null;
            renderAuth();
            updateComposer();
            if (event === 'SIGNED_IN') {
                sessionStorage.removeItem(AUTH_FLAG);
                openDrawer();
                cleanAuthUrl();
            }
        });
    } catch (err) {
        console.error('[Guestbook] Supabase init error:', err);
        initError = err;
        demoMode  = true;
    }
}

async function refreshAuth() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    state.user = data.session?.user ?? null;
    renderAuth();
    updateComposer();
}

/* ═══════════════════════════════════════════════════════════
   Fetch messages
═══════════════════════════════════════════════════════════ */
let refetchTimer;
function scheduleRefetch() { clearTimeout(refetchTimer); refetchTimer = setTimeout(fetchMessages, 300); }

async function fetchMessages() {
    const nearBottom = isNearBottom();
    state.loading = true;
    state.error   = '';
    renderList();

    if (demoMode) {
        state.messages = readDemoStore();
        state.loading  = false;
        renderList();
        updateCounts();
        if (!state.hasRendered || nearBottom) scrollBottom();
        state.hasRendered = true;
        return;
    }

    try {
        const { data, error } = await supabase.from('guestbook')
            .select('id,created_at,user_id,user_name,user_avatar,user_provider,message,is_pinned,parent_id')
            .order('created_at', { ascending: true });
        if (error) throw error;
        state.messages = data || [];
        state.error    = '';
    } catch (err) {
        console.error('[Guestbook] Fetch error:', err);
        state.error = 'Gagal memuat pesan: ' + (err.message || 'Error jaringan');
        if (err.code === '42P01') state.error = 'Tabel belum ada — jalankan supabase/schema.sql terlebih dahulu.';
    } finally {
        state.loading = false;
        renderList();
        updateCounts();
        if (!state.hasRendered || nearBottom) scrollBottom();
        state.hasRendered = true;
    }
}

function subscribeRealtime() {
    if (!supabase || realtimeChannel) return;
    realtimeChannel = supabase.channel('swandy_gb_rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guestbook' }, scheduleRefetch)
        .subscribe();
}

/* ═══════════════════════════════════════════════════════════
   Render: mode badge & notice
═══════════════════════════════════════════════════════════ */
function renderMode() {
    if (!modeEl) return;
    modeEl.textContent = demoMode ? 'PREVIEW' : 'LIVE';
    modeEl.className   = 'gb-mode ' + (demoMode ? 'gb-mode--preview' : 'gb-mode--live');
    if (notice) {
        if (demoMode) {
            notice.hidden = false;
            notice.textContent = initError
                ? 'Gagal memuat Supabase — mode preview aktif. Pesan disimpan di browser ini.'
                : 'Supabase belum dikonfigurasi. Mode preview: pesan tersimpan di browser ini. Isi supabase-config.js untuk mengaktifkan login & database.';
        } else {
            notice.hidden = true;
        }
    }
    if (lockedEl) {
        const p = lockedEl.querySelector('p');
        if (p) p.textContent = demoMode
            ? 'Login simulasi lewat tombol di atas untuk mencoba fitur posting.'
            : 'Login dengan GitHub atau Google untuk meninggalkan pesan.';
    }
}

/* ═══════════════════════════════════════════════════════════
   Render: auth panel
═══════════════════════════════════════════════════════════ */
function renderAuth() {
    if (!authEl) return;
    authEl.replaceChildren();
    const user = getDisplayUser();

    if (user) {
        /* ── Logged-in bar ── */
        const card  = mk('div', 'gb-auth-card gb-profile');
        const main  = mk('div', 'gb-profile-main');
        const av    = avatarEl(user.name, user.avatar, 'gb-avatar');
        main.appendChild(av);

        const info   = mk('div');
        const nameRow = mk('div', 'gb-profile-name-row');
        nameRow.appendChild(mk('span', 'gb-profile-name', user.name));
        if (demoMode) nameRow.appendChild(mk('span', 'gb-demo-badge', 'DEMO'));
        info.appendChild(nameRow);

        const meta = mk('span', 'gb-profile-meta');
        meta.appendChild(providerIcon(user.provider));
        meta.appendChild(document.createTextNode(' ' + (user.email || 'via ' + user.provider)));
        info.appendChild(meta);
        main.appendChild(info);
        card.appendChild(main);

        const out = mk('button', 'gb-signout');
        out.type = 'button';
        const icon = mk('i'); icon.className = 'fa-solid fa-right-from-bracket'; icon.setAttribute('aria-hidden','true');
        out.appendChild(icon);
        out.appendChild(document.createTextNode(' Keluar'));
        out.addEventListener('click', handleSignOut);
        card.appendChild(out);
        authEl.appendChild(card);
        return;
    }

    /* ── Logged-out card ── */
    const card = mk('div', 'gb-auth-card');
    const head = mk('div', 'gb-auth-head');
    const lockIcon = mk('i'); lockIcon.className = 'fa-solid fa-lock'; lockIcon.setAttribute('aria-hidden','true');
    head.appendChild(lockIcon);
    head.appendChild(document.createTextNode(demoMode ? ' Masuk untuk mencoba (mode preview)' : ' Masuk untuk meninggalkan jejak'));
    card.appendChild(head);
    card.appendChild(mk('p', 'gb-auth-desc', demoMode
        ? 'Login disimulasikan. Setelah Supabase dikonfigurasi, tombol ini membuka OAuth GitHub/Google asli.'
        : 'Autentikasi lewat GitHub atau Google. Tidak ada spam cuma login.'));

    const buttons = mk('div', 'gb-auth-buttons');
    for (const provider of ['github', 'google']) {
        const btn = mk('button', 'gb-auth-btn gb-auth-btn--' + provider);
        btn.type = 'button';
        btn.appendChild(providerIcon(provider));
        btn.appendChild(document.createTextNode(provider === 'github' ? ' GitHub' : ' Google'));
        btn.addEventListener('click', () => handleLogin(provider));
        buttons.appendChild(btn);
    }
    card.appendChild(buttons);
    authEl.appendChild(card);
}

/* ═══════════════════════════════════════════════════════════
   Render: message list
═══════════════════════════════════════════════════════════ */
function renderList() {
    if (!listEl) return;
    listEl.replaceChildren();

    if (state.loading) {
        const s = mk('div', 'gb-state');
        const ic = mk('i'); ic.className = 'fa-solid fa-circle-notch fa-spin'; ic.setAttribute('aria-hidden','true');
        s.appendChild(ic);
        s.appendChild(mk('span', null, 'Memuat pesan...'));
        listEl.appendChild(s);
        return;
    }

    if (state.error) {
        const s = mk('div', 'gb-state');
        const ic = mk('i'); ic.className = 'fa-solid fa-triangle-exclamation'; ic.setAttribute('aria-hidden','true');
        s.appendChild(ic);
        s.appendChild(mk('p', null, state.error));
        const retry = mk('button', 'gb-load-more', 'Coba lagi');
        retry.type = 'button';
        retry.addEventListener('click', fetchMessages);
        s.appendChild(retry);
        listEl.appendChild(s);
        return;
    }

    const tops    = state.messages.filter(m => !m.parent_id);
    const replies = Object.fromEntries(
        state.messages.filter(m => m.parent_id).reduce((map, m) => {
            (map.get(m.parent_id) || (map.set(m.parent_id, []) && map.get(m.parent_id))).push(m);
            return map;
        }, new Map())
    );

    if (!tops.length) {
        const empty = mk('div', 'gb-empty');
        empty.appendChild(spiderSvg(56));
        empty.appendChild(mk('strong', null, 'BELUM ADA PESAN'));
        empty.appendChild(mk('p', null, 'Jadi yang pertama meninggalkan jejak!'));
        listEl.appendChild(empty);
        return;
    }

    /* Load more button (oldest messages) */
    if (tops.length > state.visibleCount) {
        const older = tops.length - state.visibleCount;
        const loadBtn = mk('button', 'gb-load-more', `↑ Muat ${older} pesan sebelumnya`);
        loadBtn.type = 'button';
        loadBtn.addEventListener('click', () => {
            const prevH = listEl.scrollHeight;
            const prevT = listEl.scrollTop;
            state.visibleCount += PAGE_LIMIT;
            renderList();
            listEl.scrollTop = prevT + (listEl.scrollHeight - prevH);
        });
        listEl.appendChild(loadBtn);
    }

    const visible = tops.slice(Math.max(0, tops.length - state.visibleCount));
    visible.forEach(top => {
        const thread = mk('div', 'gb-item');
        thread.appendChild(buildMsgRow(top, replies[top.id]?.length || 0));
        const reps = replies[top.id];
        if (reps?.length) {
            const box = mk('div', 'gb-replies');
            reps.forEach(r => box.appendChild(buildReplyRow(r)));
            thread.appendChild(box);
        }
        listEl.appendChild(thread);
    });
}

function buildMsgRow(msg, replyCount = 0) {
    const me  = getDisplayUser();
    const own = Boolean(me && msg.user_id === me.id);

    const row  = mk('div', 'gb-row' + (own ? ' gb-row--own' : ''));
    const av   = avatarEl(msg.user_name, msg.user_avatar);
    row.appendChild(av);

    const wrap = mk('div', 'gb-bubble-wrap');

    /* meta */
    const meta = mk('div', 'gb-meta');
    meta.appendChild(mk('span', 'gb-name', msg.user_name));
    if (own) meta.appendChild(mk('span', 'gb-own-badge', 'KAMU'));
    meta.appendChild(providerIcon(msg.user_provider, 'gb-provider'));
    if (msg.is_pinned) {
        const pin = mk('span', 'gb-pinned');
        const pi = mk('i'); pi.className = 'fa-solid fa-thumbtack'; pi.setAttribute('aria-hidden','true');
        pin.appendChild(pi);
        pin.appendChild(document.createTextNode(' Pinned'));
        meta.appendChild(pin);
    }
    wrap.appendChild(meta);

    /* bubble */
    const bubble = mk('div', 'gb-bubble');
    const txt    = mk('span');
    txt.textContent = msg.message;
    bubble.appendChild(txt);
    if (own) {
        const del = mk('button', 'gb-delete');
        del.type = 'button'; del.title = 'Hapus pesan'; del.setAttribute('aria-label','Hapus pesan');
        const di = mk('i'); di.className = 'fa-solid fa-trash-can'; di.setAttribute('aria-hidden','true');
        del.appendChild(di);
        del.addEventListener('click', () => deleteMessage(msg, Boolean(replies[msg.id]?.length)));
        bubble.appendChild(del);
    }
    wrap.appendChild(bubble);

    /* footer */
    const foot = mk('div', 'gb-foot');
    foot.appendChild(mk('span', 'gb-date', formatDate(msg.created_at)));
    const replyBtn = mk('button', 'gb-action');
    replyBtn.type = 'button';
    const ri = mk('i'); ri.className = 'fa-solid fa-reply'; ri.setAttribute('aria-hidden','true');
    replyBtn.appendChild(ri);
    replyBtn.appendChild(document.createTextNode(' Balas'));
    replyBtn.addEventListener('click', () => startReply(msg));
    foot.appendChild(replyBtn);
    if (replyCount) foot.appendChild(mk('span', 'gb-reply-count', `· ${replyCount} balasan`));
    wrap.appendChild(foot);

    row.appendChild(wrap);
    return row;
}

function buildReplyRow(msg) {
    const me  = getDisplayUser();
    const own = Boolean(me && msg.user_id === me.id);
    const rep = mk('div', 'gb-reply');
    rep.appendChild(avatarEl(msg.user_name, msg.user_avatar));
    const wrap = mk('div', 'gb-bubble-wrap');
    const meta = mk('div', 'gb-meta');
    meta.appendChild(mk('span', 'gb-name', msg.user_name));
    if (own) meta.appendChild(mk('span', 'gb-own-badge', 'KAMU'));
    meta.appendChild(providerIcon(msg.user_provider, 'gb-provider'));
    wrap.appendChild(meta);
    const bubble = mk('div', 'gb-bubble');
    const txt = mk('span'); txt.textContent = msg.message; bubble.appendChild(txt);
    if (own) {
        const del = mk('button', 'gb-delete');
        del.type = 'button'; del.title = 'Hapus balasan'; del.setAttribute('aria-label','Hapus balasan');
        const di = mk('i'); di.className = 'fa-solid fa-trash-can'; di.setAttribute('aria-hidden','true');
        del.appendChild(di);
        del.addEventListener('click', () => deleteMessage(msg, false));
        bubble.appendChild(del);
    }
    wrap.appendChild(bubble);
    const foot = mk('div', 'gb-foot');
    foot.appendChild(mk('span', 'gb-date', formatDate(msg.created_at)));
    wrap.appendChild(foot);
    rep.appendChild(wrap);
    return rep;
}

/* ═══════════════════════════════════════════════════════════
   Update helpers
═══════════════════════════════════════════════════════════ */
function updateCounts() {
    const count = state.messages.filter(m => !m.parent_id).length;
    if (fabCount)     fabCount.textContent     = String(count);
    if (headerCount)  headerCount.textContent  = String(count);
}

function updateComposer() {
    const user = getDisplayUser();
    if (!composerEl || !lockedEl) return;
    composerEl.hidden = !user;
    lockedEl.hidden   = Boolean(user);
    if (!user) cancelReply();
    updateCounter();
}

function updateCounter() {
    if (!msgEl || !counterEl || !sendBtn) return;
    const rem = MAX_LEN - msgEl.value.length;
    counterEl.textContent = rem + ' karakter tersisa';
    counterEl.classList.toggle('is-low',  rem <= 30 && rem > 0);
    counterEl.classList.toggle('is-over', rem < 0);
    sendBtn.disabled = state.sending || msgEl.value.trim().length === 0 || rem < 0;
}

function isNearBottom() {
    if (!listEl) return true;
    return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 150;
}

function scrollBottom() {
    requestAnimationFrame(() => { if (listEl) listEl.scrollTop = listEl.scrollHeight; });
}

/* ═══════════════════════════════════════════════════════════
   Auth actions
═══════════════════════════════════════════════════════════ */
async function handleLogin(provider) {
    if (demoMode) {
        state.demoUser = { ...DEMO_USERS[provider] };
        sessionStorage.setItem(DEMO_USER_KEY, provider);
        renderAuth();
        updateComposer();
        showToast('Login demo sebagai ' + state.demoUser.name + '.', 'success');
        return;
    }
    if (!supabase) { showToast('Supabase belum siap.', 'error'); return; }
    if (location.protocol === 'file:') { showToast('OAuth butuh server HTTP, bukan file://', 'error'); return; }
    try {
        sessionStorage.setItem(AUTH_FLAG, '1');
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
    } catch (err) {
        sessionStorage.removeItem(AUTH_FLAG);
        showToast('Gagal login: ' + (err.message || 'Unknown'), 'error');
    }
}

async function handleSignOut() {
    if (demoMode) {
        state.demoUser = null;
        sessionStorage.removeItem(DEMO_USER_KEY);
        renderAuth();
        updateComposer();
        showToast('Keluar dari mode demo.', 'success');
        return;
    }
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) showToast('Gagal keluar: ' + error.message, 'error');
    else { state.user = null; renderAuth(); updateComposer(); showToast('Kamu sudah keluar.', 'success'); }
}

/* ═══════════════════════════════════════════════════════════
   Guestbook actions
═══════════════════════════════════════════════════════════ */
function startReply(msg) {
    const user = getDisplayUser();
    if (!user) { showToast('Login dulu untuk membalas.', 'error'); return; }
    state.replyTo = msg;
    if (replyBar)   replyBar.hidden   = false;
    if (replyNameEl) replyNameEl.textContent = '@' + msg.user_name;
    if (msgEl)       msgEl.focus();
}

function cancelReply() {
    state.replyTo = null;
    if (replyBar) replyBar.hidden = true;
}

async function deleteMessage(msg, hasReplies) {
    const user = getDisplayUser();
    if (!user || msg.user_id !== user.id) return;
    const warn = hasReplies ? '\n(Balasan pada pesan ini ikut terhapus.)' : '';
    if (!confirm('Hapus pesan ini?' + warn)) return;

    if (demoMode) {
        const rows = readDemoStore().filter(m => m.id !== msg.id && m.parent_id !== msg.id);
        writeDemoStore(rows);
        state.messages = readDemoStore();
        renderList();
        updateCounts();
        showToast('Pesan dihapus.', 'success');
        return;
    }

    try {
        const { error } = await supabase.from('guestbook').delete().eq('id', msg.id);
        if (error) throw error;
        state.messages = state.messages.filter(m => m.id !== msg.id && m.parent_id !== msg.id);
        renderList();
        updateCounts();
        showToast('Pesan dihapus.', 'success');
    } catch (err) {
        showToast('Gagal menghapus: ' + err.message, 'error');
    }
}

/* ── Form submit ── */
async function handleSubmit(e) {
    e.preventDefault();
    const user = getDisplayUser();
    if (!user) { showToast('Login dulu untuk menulis pesan.', 'error'); return; }
    if (state.sending) return;

    const text = msgEl.value.trim();
    if (!text || text.length > MAX_LEN) return;

    state.sending = true;
    updateCounter();
    sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>';

    try {
        if (demoMode) {
            const rows = readDemoStore();
            rows.push({
                id: 'dm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                created_at: new Date().toISOString(),
                user_id: user.id, user_name: user.name,
                user_avatar: user.avatar, user_provider: user.provider,
                message: text, is_pinned: false,
                parent_id: state.replyTo?.id || null,
            });
            writeDemoStore(rows);
            state.messages = readDemoStore();
        } else {
            const payload = {
                user_id: user.id, user_name: user.name,
                user_avatar: user.avatar || null, user_provider: user.provider,
                message: text,
                parent_id: state.replyTo?.id || null,
            };
            const { error } = await supabase.from('guestbook').insert(payload).select();
            if (error) throw error;
            await fetchMessages();
        }

        composerEl.reset();
        msgEl.style.height = 'auto';
        cancelReply();
        if (demoMode) { renderList(); updateCounts(); }
        scrollBottom();
        showToast('Pesan terkirim!', 'success');
    } catch (err) {
        showToast('Gagal mengirim: ' + (err.message || 'Error'), 'error');
    } finally {
        state.sending = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
        updateCounter();
    }
}

/* ═══════════════════════════════════════════════════════════
   Drawer open / close
═══════════════════════════════════════════════════════════ */
function openDrawer() {
    if (!drawer || drawer.classList.contains('open')) return;
    state.lastFocus   = document.activeElement;
    state.prevOverflow = document.body.style.overflow;

    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.removeAttribute('aria-hidden');
    fab.setAttribute('aria-expanded', 'true');

    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('guestbook:open'));

    setTimeout(() => closeBtn?.focus(), 60);
}

function closeDrawer() {
    if (!drawer || !drawer.classList.contains('open')) return;

    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');

    document.body.style.overflow = state.prevOverflow;

    if (location.hash === '#guestbook') {
        history.replaceState(null, '', location.pathname + location.search);
    }
    state.lastFocus?.focus?.();
}

function cleanAuthUrl() {
    const url = new URL(location.href);
    ['code', 'state', 'error', 'error_description', 'error_code'].forEach(k => url.searchParams.delete(k));
    if (/access_token|refresh_token|expires_in/.test(url.hash)) url.hash = '';
    history.replaceState(null, '', url.pathname + url.search + (url.hash || ''));
}

/* ── Focus trap ── */
function trapFocus(e) {
    if (!drawer.classList.contains('open')) return;
    if (e.key !== 'Tab') return;
    const focusables = Array.from(
        drawer.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ═══════════════════════════════════════════════════════════
   Init
═══════════════════════════════════════════════════════════ */
const AUTH_RETURN = (() => {
    try {
        const u = new URL(location.href);
        return u.searchParams.has('code') || u.searchParams.has('error') ||
               /access_token|refresh_token/.test(u.hash) ||
               sessionStorage.getItem(AUTH_FLAG) === '1';
    } catch { return false; }
})();

function cacheDom() {
    fab          = $('guestbook-toggle');
    fabCount     = $('guestbook-fab-count');
    overlay      = $('guestbook-overlay');
    drawer       = $('guestbook-drawer');
    closeBtn     = $('guestbook-close');
    modeEl       = $('guestbook-mode');
    headerCount  = $('guestbook-header-count');
    notice       = $('guestbook-notice');
    authEl       = $('guestbook-auth');
    listEl       = $('guestbook-list');
    lockedEl     = $('guestbook-locked');
    composerEl   = $('guestbook-form');
    msgEl        = $('guestbook-message');
    sendBtn      = $('guestbook-send');
    counterEl    = $('guestbook-counter');
    replyBar     = $('guestbook-reply-bar');
    replyNameEl  = $('guestbook-reply-name');
    replyCancelBtn = $('guestbook-reply-cancel');
    toastEl      = $('guestbook-toast');
    navLinks     = document.querySelectorAll('[data-open-guestbook]');
}

function bindEvents() {
    /* FAB */
    fab?.addEventListener('click', openDrawer);

    /* Close */
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    /* Nav links */
    navLinks?.forEach(link => link.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('mobile-menu')?.classList.remove('open');
        openDrawer();
    }));

    /* Escape & focus trap */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drawer?.classList.contains('open')) closeDrawer();
        else trapFocus(e);
    });

    /* Composer */
    msgEl?.addEventListener('input', () => {
        msgEl.style.height = 'auto';
        msgEl.style.height = Math.min(msgEl.scrollHeight, 120) + 'px';
        updateCounter();
    });
    msgEl?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            composerEl?.requestSubmit();
        }
    });
    composerEl?.addEventListener('submit', handleSubmit);
    replyCancelBtn?.addEventListener('click', cancelReply);

    /* Realtime cleanup */
    window.addEventListener('pagehide', () => {
        if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel);
    });
}

async function init() {
    cacheDom();
    bindEvents();

    /* Initial render (before async) */
    renderMode();
    state.demoUser = demoMode ? getDemoUser() : null;
    renderAuth();
    updateComposer();
    updateCounter();

    if (!demoMode) {
        await setupSupabase();
        if (demoMode) {
            /* init error → fell back to demo */
            renderMode();
            state.demoUser = getDemoUser();
        }
        renderAuth();
        updateComposer();

        if (!demoMode) {
            await refreshAuth();
            await fetchMessages();
            subscribeRealtime();
            if (AUTH_RETURN) {
                sessionStorage.removeItem(AUTH_FLAG);
                if (state.user) cleanAuthUrl();
                const errDesc = new URLSearchParams(location.search).get('error_description');
                if (errDesc) showToast(decodeURIComponent(errDesc), 'error');
            }
        } else {
            state.messages = readDemoStore();
            state.loading  = false;
            renderList();
            updateCounts();
        }
    } else {
        state.messages = readDemoStore();
        state.loading  = false;
        renderList();
        updateCounts();
    }

    /* Auto-open */
    if (AUTH_RETURN || location.hash === '#guestbook') openDrawer();
}

init().catch(err => console.error('[Guestbook] Init error:', err));
