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
    function onClick() {
        setState('excited');
        if (excitedTimer) clearTimeout(excitedTimer);
        excitedTimer = setTimeout(() => {
            setState(isHovering ? 'wave' : 'idle');
        }, 1400);
        resetIdle();
    }

    mascot.addEventListener('mouseenter', onEnter);
    mascot.addEventListener('mouseleave', onLeave);
    mascot.addEventListener('click', onClick);
    // Touch: treat a tap like a poke.
    mascot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onClick();
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
