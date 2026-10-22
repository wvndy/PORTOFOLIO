/* =========================================================
   Spider-Man Comic Portfolio — interactions
   Canvas 2D web network + cursor + guestbook + timeline
   ========================================================= */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* -----------------------------------------------------
       1. Background: web network on 2D canvas
       ----------------------------------------------------- */
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let W, H, DPR;
        let nodes = [];
        let mouse = { x: -9999, y: -9999 };
        let scrollY = 0;
        let currentScroll = 0;

        const RED = '230, 36, 41';
        const BLUE = '43, 108, 176';

        function resize() {
            DPR = Math.min(window.devicePixelRatio || 1, 2);
            W = window.innerWidth;
            H = window.innerHeight;
            canvas.width = W * DPR;
            canvas.height = H * DPR;
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            buildNodes();
        }

        function buildNodes() {
            const count = Math.min(90, Math.floor((W * H) / 16000));
            nodes = [];
            for (let i = 0; i < count; i++) {
                nodes.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    r: Math.random() * 1.8 + 0.8,
                    c: Math.random() > 0.5 ? RED : BLUE
                });
            }
        }

        const MAX_DIST = 150;

        function draw() {
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.clearRect(0, 0, W, H);

            currentScroll += (scrollY - currentScroll) * 0.1;
            ctx.save();
            ctx.translate(0, -currentScroll * 0.06);

            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;

                if (n.x < 0 || n.x > W) n.vx *= -1;
                if (n.y < 0 || n.y > H) n.vy *= -1;

                // gentle mouse repel
                const mdx = n.x - mouse.x;
                const mdy = n.y - mouse.y;
                const md = Math.hypot(mdx, mdy);
                if (md < 120 && md > 0) {
                    const f = (120 - md) / 120;
                    n.x += (mdx / md) * f * 1.2;
                    n.y += (mdy / md) * f * 1.2;
                }

                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${n.c}, 0.7)`;
                ctx.fill();
            }

            // draw web lines between nearby nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d = Math.hypot(dx, dy);
                    if (d < MAX_DIST) {
                        const alpha = (1 - d / MAX_DIST) * 0.28;
                        ctx.strokeStyle = `rgba(${BLUE}, ${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            // connect nodes to cursor (web catching)
            for (const n of nodes) {
                const d = Math.hypot(n.x - mouse.x, n.y - mouse.y);
                if (d < 180) {
                    const alpha = (1 - d / 180) * 0.45;
                    ctx.strokeStyle = `rgba(${RED}, ${alpha})`;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            ctx.restore();

            requestAnimationFrame(draw);
        }

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });
        window.addEventListener('mouseout', () => {
            mouse.x = -9999;
            mouse.y = -9999;
        });
        window.addEventListener('scroll', () => {
            scrollY = window.scrollY;
        });
        window.addEventListener('resize', resize);

        resize();
        if (!reduceMotion) draw();
        else {
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.clearRect(0, 0, W, H);
        }
    }

    /* -----------------------------------------------------
       2. Reveal on scroll
       ----------------------------------------------------- */
    const revealEls = document.querySelectorAll('.reveal-anim');

    function revealAll() {
        revealEls.forEach((el) => el.classList.add('visible'));
    }

    if ('IntersectionObserver' in window && !reduceMotion) {
        const revealObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

        revealEls.forEach((el) => revealObserver.observe(el));
        // Safety net: only if the observer failed to reveal anything.
        setTimeout(() => {
            if (!document.querySelector('.reveal-anim.visible')) revealAll();
        }, 2600);
    } else {
        revealAll();
    }

    /* -----------------------------------------------------
       3. Card tilt + hover glow
       ----------------------------------------------------- */
    document.querySelectorAll('.comic-card').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);

            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotX = ((y - cy) / cy) * -2.5;
            const rotY = ((x - cx) / cx) * 2.5;
            card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    /* -----------------------------------------------------
       4. Custom cursor + trails + click web-splat
       ----------------------------------------------------- */
    const cursorDot = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');
    const cursorGlow = document.getElementById('cursor-glow');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    const trailCount = 10;
    const trails = [];
    if (!reduceMotion && window.innerWidth >= 768) {
        for (let i = 0; i < trailCount; i++) {
            const t = document.createElement('div');
            t.className = 'cursor-trail';
            document.body.appendChild(t);
            trails.push({ el: t, x: mouseX, y: mouseY });
        }
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (cursorDot) {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        }
        if (cursorGlow) {
            cursorGlow.style.left = `${mouseX}px`;
            cursorGlow.style.top = `${mouseY}px`;
        }
    });

    document.addEventListener('click', (e) => {
        if (reduceMotion) return;
        const splat = document.createElement('div');
        splat.className = 'click-effect';
        splat.style.left = `${e.clientX}px`;
        splat.style.top = `${e.clientY}px`;
        document.body.appendChild(splat);
        setTimeout(() => splat.remove(), 700);
    });

    function animateCursor() {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        if (cursorRing) {
            cursorRing.style.left = `${ringX}px`;
            cursorRing.style.top = `${ringY}px`;
        }

        let lastX = mouseX;
        let lastY = mouseY;
        trails.forEach((t, i) => {
            t.x += (lastX - t.x) * (0.3 + i * 0.02);
            t.y += (lastY - t.y) * (0.3 + i * 0.02);
            t.el.style.left = `${t.x}px`;
            t.el.style.top = `${t.y}px`;
            t.el.style.opacity = (1 - i / trailCount) * 0.6;
            t.el.style.transform = `translate(-50%, -50%) scale(${1 - i / trailCount})`;
            lastX = t.x;
            lastY = t.y;
        });

        requestAnimationFrame(animateCursor);
    }
    if (!reduceMotion) animateCursor();

    document.querySelectorAll('a, button, .comic-card').forEach((el) => {
        el.addEventListener('mouseenter', () => document.body.classList.add('hovering-link'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('hovering-link'));
    });

    /* -----------------------------------------------------
       5. Scroll spider
       ----------------------------------------------------- */
    const scrollSpider = document.getElementById('scroll-spider');
    if (scrollSpider) {
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const pct = max > 0 ? window.scrollY / max : 0;
            scrollSpider.style.top = `${pct * (window.innerHeight - 60) + 30}px`;
        };
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* -----------------------------------------------------
       6. Mobile menu
       ----------------------------------------------------- */
    const burger = document.getElementById('nav-burger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (burger && mobileMenu) {
        burger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
        mobileMenu.querySelectorAll('a').forEach((a) =>
            a.addEventListener('click', () => mobileMenu.classList.remove('open'))
        );
    }

    /* -----------------------------------------------------
       7. Guestbook (localStorage)
       ----------------------------------------------------- */
    const GUEST_KEY = 'swandy_guestbook_v1';
    const form = document.getElementById('guest-form');
    const nameInput = document.getElementById('guest-name');
    const msgInput = document.getElementById('guest-msg');
    const list = document.getElementById('guest-list');
    const countEl = document.getElementById('guest-count');
    const clearBtn = document.getElementById('guest-clear');

    function loadGuests() {
        try {
            const raw = localStorage.getItem(GUEST_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            return [];
        }
    }

    function saveGuests(guests) {
        try {
            localStorage.setItem(GUEST_KEY, JSON.stringify(guests));
        } catch (err) {
            /* storage unavailable — ignore */
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function timeAgo(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'baru saja';
        if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
        if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
        return `${Math.floor(s / 86400)} hari lalu`;
    }

    function renderGuests() {
        if (!list) return;
        const guests = loadGuests();
        if (countEl) countEl.textContent = guests.length;

        if (!guests.length) {
            list.innerHTML = '<p class="guest-empty">Belum ada pesan. Jadi yang pertama!</p>';
            return;
        }

        list.innerHTML = guests
            .slice()
            .reverse()
            .map((g) => `
                <div class="guest-bubble">
                    <p class="g-name">${escapeHtml(g.name)}</p>
                    <p class="g-msg">${escapeHtml(g.msg)}</p>
                    <p class="g-time">${timeAgo(g.ts)}</p>
                </div>
            `)
            .join('');
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = (nameInput.value || '').trim();
            const msg = (msgInput.value || '').trim();
            if (!name || !msg) return;

            const guests = loadGuests();
            guests.push({ name, msg, ts: Date.now() });
            saveGuests(guests);
            form.reset();
            renderGuests();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Hapus semua pesan guestbook?')) {
                saveGuests([]);
                renderGuests();
            }
        });
    }

    renderGuests();
})();
