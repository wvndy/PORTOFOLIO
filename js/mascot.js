/* =========================================================
   Mascot — a small reactive character (bottom-left).
   Behaviors driven by data-state on #mascot:
     idle    — default, eyes follow the cursor
     sleep   — after a stretch of inactivity (shows "zZ")
     wave    — on hover (shows 🖐️)
     excited — on click (shows "!")
     search  — occasionally peeks around with a 🔍
   Eyes blink at random. Respects prefers-reduced-motion.
   ========================================================= */

(function () {
    'use strict';

    const mascot = document.getElementById('mascot');
    if (!mascot) return;

    const eyeL = mascot.querySelector('[data-eye-l]');
    const eyeR = mascot.querySelector('[data-eye-r]');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!eyeL || !eyeR) return;

    // ---------------------------------------------------------
    // State management
    // ---------------------------------------------------------
    let state = 'idle';
    let stateTimer = null;
    let idleTimer = null;
    let searchTimer = null;
    let excitedTimer = null;
    let isHovering = false;

    function setState(next, duration) {
        state = next;
        mascot.dataset.state = next;

        if (stateTimer) { clearTimeout(stateTimer); stateTimer = null; }
        if (duration) {
            stateTimer = setTimeout(() => {
                // After a transient state, return to a sensible resting state.
                if (next === 'sleep') return;
                setState(isHovering ? 'wave' : 'idle');
            }, duration);
        }
    }

    // ---------------------------------------------------------
    // Idle -> sleep, and occasional "search"
    // ---------------------------------------------------------
    const IDLE_TO_SLEEP = 9000;   // ms of inactivity before sleeping
    const SEARCH_EVERY = 14000;   // ms between peeks (roughly)

    function resetIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        // Wake from sleep / stop searching on activity.
        if (state === 'sleep' || state === 'search') {
            setState(isHovering ? 'wave' : 'idle');
        }
        idleTimer = setTimeout(() => {
            if (state === 'idle') setState('sleep');
        }, IDLE_TO_SLEEP);
    }

    function scheduleSearch() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            // Only peek if we're resting and not hovered/focused.
            if (state === 'idle' && !isHovering) {
                setState('search', 2200);
            }
            scheduleSearch();
        }, SEARCH_EVERY + Math.random() * 6000);
    }

    // ---------------------------------------------------------
    // Eye tracking (follow cursor, clamped)
    // ---------------------------------------------------------
    let hoverX = 0; // px offset applied to eyes
    let hoverY = 0;

    function trackEyes(clientX, clientY) {
        const rect = mascot.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;

        // Clamp the pupil travel to a small radius so eyes stay in the face.
        const maxTravel = 2.4; // px
        const nx = (dx / dist) * Math.min(1, dist / 140);
        const ny = (dy / dist) * Math.min(1, dist / 140);

        hoverX = nx * maxTravel;
        hoverY = ny * maxTravel;

        if (state !== 'sleep') {
            const t = `translate(${hoverX.toFixed(2)}px, ${hoverY.toFixed(2)}px)`;
            eyeL.style.transform = t;
            eyeR.style.transform = t;
        }
    }

    if (!reduceMotion) {
        window.addEventListener('mousemove', (e) => {
            trackEyes(e.clientX, e.clientY);
            resetIdle();
        }, { passive: true });
        window.addEventListener('scroll', resetIdle, { passive: true });
        window.addEventListener('keydown', resetIdle);
    }

    // ---------------------------------------------------------
    // Blinking
    // ---------------------------------------------------------
    function scheduleBlink() {
        if (reduceMotion) return;
        const delay = 2200 + Math.random() * 4200;
        setTimeout(() => {
            if (state !== 'sleep') {
                mascot.classList.add('is-blinking');
                setTimeout(() => mascot.classList.remove('is-blinking'), 130);
            }
            scheduleBlink();
        }, delay);
    }

    // ---------------------------------------------------------
    // Run away left/right in sync with leg steps
    // ---------------------------------------------------------
    let offsetX = 0;
    let returnTimer = null;
    let stopStepTimer = null;
    let fleeLockUntil = 0;

    function moveHorizontalTo(nextX, durationMs) {
        const dist = Math.abs(nextX - offsetX);
        if (dist < 2) return;

        const dir = nextX > offsetX ? 'right' : 'left';
        offsetX = nextX;

        mascot.dataset.dir = dir;
        mascot.classList.add('is-running');
        mascot.style.transition = `translate ${durationMs}ms linear`;
        mascot.style.translate = `${nextX.toFixed(1)}px 0px`;

        if (stopStepTimer) clearTimeout(stopStepTimer);
        stopStepTimer = setTimeout(() => {
            mascot.classList.remove('is-running');
            delete mascot.dataset.dir;
        }, durationMs);
    }

    function fleeFromCursor(clientX) {
        if (reduceMotion) return;

        const rect = mascot.getBoundingClientRect();
        const baseLeft = rect.left - offsetX;
        const pad = 20;
        const minX = pad - baseLeft;
        const maxX = Math.max(minX, window.innerWidth - pad - rect.width - baseLeft);

        const cx = rect.left + rect.width / 2;
        const goRight = typeof clientX === 'number' ? clientX < cx : Math.random() > 0.5;

        const step = Math.min(260, Math.max(120, window.innerWidth * 0.28));
        let nextX = goRight
            ? Math.min(maxX, offsetX + step)
            : Math.max(minX, offsetX - step);

        // If cornered near an edge, run the opposite way
        if (Math.abs(nextX - offsetX) < 55) {
            nextX = goRight
                ? Math.max(minX, offsetX - step * 0.75)
                : Math.min(maxX, offsetX + step * 0.75);
        }

        // Sync duration with leg step cycle (~200ms per half-step -> ~300 px/sec)
        const dist = Math.abs(nextX - offsetX);
        const durationMs = Math.min(900, Math.max(320, Math.round(dist * 3.1)));
        moveHorizontalTo(nextX, durationMs);

        if (returnTimer) clearTimeout(returnTimer);
        returnTimer = setTimeout(() => {
            const backDist = Math.abs(offsetX);
            const backMs = Math.min(1100, Math.max(360, Math.round(backDist * 3.4)));
            moveHorizontalTo(0, backMs);
        }, 4500);
    }

    window.addEventListener('resize', () => {
        if (offsetX !== 0) {
            offsetX = 0;
            mascot.style.transition = 'none';
            mascot.style.translate = '0px 0px';
            mascot.classList.remove('is-running');
            delete mascot.dataset.dir;
        }
    }, { passive: true });

    // ---------------------------------------------------------
    // Pointer interaction
    // ---------------------------------------------------------
    function onEnter() {
        isHovering = true;
        if (!reduceMotion) setState('wave');
        resetIdle();
    }
    function onLeave() {
        isHovering = false;
        if (state === 'wave') setState('idle');
    }
    function onClick(clientX) {
        const now = Date.now();
        if (now < fleeLockUntil) return;
        fleeLockUntil = now + 80;

        setState('excited');
        if (excitedTimer) clearTimeout(excitedTimer);
        excitedTimer = setTimeout(() => {
            setState(isHovering ? 'wave' : 'idle');
        }, 1400);

        fleeFromCursor(clientX);
        resetIdle();
    }

    mascot.addEventListener('mouseenter', onEnter);
    mascot.addEventListener('mouseleave', onLeave);
    mascot.addEventListener('click', (e) => onClick(e.clientX));
    // Touch: treat a tap like a poke.
    mascot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches && e.touches[0];
        onClick(t ? t.clientX : undefined);
    }, { passive: false });

    // ---------------------------------------------------------
    // Boot
    // ---------------------------------------------------------
    setState('idle');
    resetIdle();
    if (!reduceMotion) {
        scheduleBlink();
        scheduleSearch();
    }
})();

/* =========================================================
   Roaming Black Spider Mascot — crawls randomly, splits on click
   Gen 0 (1 spider) → click → Gen 1 (2 spiders)
   Gen 1 → click → Gen 2 (4 spiders total)
   Gen 2 → click → poof! gone
   ========================================================= */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MARGIN = 36;
    const SIZES  = [64, 54, 44]; // px per generation

    // Spider SVG template
    function makeSVG(size) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 140 140');
        s.setAttribute('width',  size);
        s.setAttribute('height', size);
        s.classList.add('spider-mascot');
        s.innerHTML = `
            <g class="spider-legs-l">
                <path class="sleg sleg-l1" d="M56 54 L34 32 L18 16" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-l2" d="M52 62 L26 52 L10 42" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-l3" d="M52 72 L24 76 L8 88"  fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-l4" d="M56 82 L32 102 L18 122" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <g class="spider-legs-r">
                <path class="sleg sleg-r1" d="M84 54 L106 32 L122 16"  fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-r2" d="M88 62 L114 52 L130 42"  fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-r3" d="M88 72 L116 76 L132 88"  fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path class="sleg sleg-r4" d="M84 82 L108 102 L122 122" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <ellipse cx="70" cy="86" rx="22" ry="25" fill="#000"/>
            <ellipse cx="70" cy="52" rx="16" ry="15" fill="#000"/>
            <rect x="60.5" y="42" width="6.5" height="9.5" rx="3.25" fill="#fff"/>
            <rect x="73"   y="42" width="6.5" height="9.5" rx="3.25" fill="#fff"/>`;
        return s;
    }

    // Burst particles (little dots flying out)
    function burst(x, y) {
        for (let i = 0; i < 8; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = `
                position:fixed; left:${x}px; top:${y}px;
                width:7px; height:7px; border-radius:50%;
                background:#000; pointer-events:none;
                z-index:900; transform:translate(-50%,-50%);
                animation: spiderBurst 0.5s ease-out forwards;
                --bx:${((Math.random() - 0.5) * 90).toFixed(0)}px;
                --by:${((Math.random() - 0.5) * 90).toFixed(0)}px;`;
            document.body.appendChild(dot);
            setTimeout(() => dot.remove(), 550);
        }
    }

    function normalizeAngleDiff(target, current) {
        return ((target - current + 180) % 360 + 360) % 360 - 180;
    }

    // Single spider instance
    function createSpider(startX, startY, generation) {
        if (generation > 2) return; // max 2 splits (4 total then gone)

        const size = SIZES[generation];
        const half = size / 2;

        const el = document.createElement('div');
        el.className = 'roaming-spider';
        el.style.cssText = `width:${size}px; height:${size}px; left:0; top:0;`;
        el.appendChild(makeSVG(size));
        document.body.appendChild(el);

        let x = Math.min(window.innerWidth - MARGIN, Math.max(MARGIN, startX));
        let y = Math.min(window.innerHeight - MARGIN, Math.max(MARGIN, startY));
        let angle = Math.random() * 360;
        let tx = x, ty = y;
        let speed = 70 + Math.random() * 50;
        let crawling = false;
        let alive = true;
        let pauseTimer = null;
        let lastTime = performance.now();

        function render() {
            el.style.transform = `translate3d(${(x - half).toFixed(1)}px,${(y - half).toFixed(1)}px,0) rotate(${angle.toFixed(1)}deg)`;
        }

        function pickTarget() {
            if (!alive) return;
            const w = window.innerWidth, h = window.innerHeight;
            let nx, ny;
            for (let i = 0; i < 6; i++) {
                nx = MARGIN + Math.random() * (w - MARGIN * 2);
                ny = MARGIN + Math.random() * (h - MARGIN * 2);
                if (Math.hypot(nx - x, ny - y) > 100) break;
            }
            tx = nx; ty = ny;
            speed = 65 + Math.random() * 60;
            crawling = true;
            el.classList.add('is-crawling');
        }

        function tick(now) {
            if (!alive) return;
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            if (crawling) {
                const dx = tx - x, dy = ty - y;
                const dist = Math.hypot(dx, dy);
                if (dist < 5) {
                    crawling = false;
                    el.classList.remove('is-crawling');
                    pauseTimer = setTimeout(pickTarget, 1000 + Math.random() * 2200);
                } else {
                    const desired = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
                    angle += normalizeAngleDiff(desired, angle) * Math.min(1, dt * 7);
                    const step = Math.min(dist, speed * dt);
                    x += (dx / dist) * step;
                    y += (dy / dist) * step;
                    render();
                }
            }
            requestAnimationFrame(tick);
        }

        // Poof + split on click
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!alive) return;
            alive = false;
            clearTimeout(pauseTimer);
            el.remove();
            burst(x, y);

            if (generation < 2) {
                // Spawn 2 children slightly offset
                const offsets = [[-28, -18], [28, 18]];
                offsets.forEach(([ox, oy]) => {
                    createSpider(x + ox, y + oy, generation + 1);
                });
            }
            // gen 2 → just bursts, no more children
        });

        render();
        if (!reduceMotion) {
            pauseTimer = setTimeout(pickTarget, 400 + Math.random() * 600);
            requestAnimationFrame(tick);
        }
    }

    // Boot — 1 spider at upper-right area
    createSpider(window.innerWidth * 0.82, window.innerHeight * 0.22, 0);
})();
