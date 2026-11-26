/* =========================================================
   Spider-Man Comic Portfolio — interactions
   Lenis smooth scroll + Lando horizontal pinned sections
   + mask text + page transition + cursor + mobile menu
   ========================================================= */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* -----------------------------------------------------
       1. Lenis Smooth Scroll
       ----------------------------------------------------- */
    let lenis = null;
    if (typeof Lenis !== 'undefined' && !reduceMotion) {
        lenis = new Lenis({
            duration: 1.1,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true
        });
    }

    /* -----------------------------------------------------
       2. Lando-style Horizontal Pinned Sections
       ----------------------------------------------------- */
    const hSections = Array.from(document.querySelectorAll('[data-horizontal-section]'));
    const hState = [];

    function setupHorizontalSections() {
        const isDesktop = window.innerWidth >= 768 && !reduceMotion;

        hSections.forEach((section, idx) => {
            const track = section.querySelector('.h-track');
            const progressBar = section.querySelector('[data-h-progress]');
            if (!track) return;

            if (!isDesktop) {
                section.style.height = '';
                track.style.transform = '';
                if (progressBar) progressBar.style.width = '0%';
                hState[idx] = null;
                return;
            }

            // Reset transform before measuring scrollWidth
            track.style.transform = 'translate3d(0, 0, 0)';
            const maxX = Math.max(0, track.scrollWidth - window.innerWidth + 48);
            section.style.height = `${window.innerHeight + maxX}px`;
            hState[idx] = { section, track, progressBar, maxX };
        });

        updateHorizontalSections();
    }

    function updateHorizontalSections() {
        hState.forEach((item) => {
            if (!item || item.maxX <= 0) return;
            const rect = item.section.getBoundingClientRect();
            const progress = Math.min(1, Math.max(0, -rect.top / item.maxX));
            const tx = -progress * item.maxX;
            item.track.style.transform = `translate3d(${tx.toFixed(2)}px, 0, 0)`;
            if (item.progressBar) {
                item.progressBar.style.width = `${(progress * 100).toFixed(2)}%`;
            }
        });
    }

    if (hSections.length) {
        setupHorizontalSections();
        window.addEventListener('load', setupHorizontalSections);
        window.addEventListener('resize', setupHorizontalSections);
        window.addEventListener('scroll', updateHorizontalSections, { passive: true });
    }

    if (lenis) {
        function raf(time) {
            lenis.raf(time);
            updateHorizontalSections();
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }

    /* -----------------------------------------------------
       3. Reveal on scroll + Mask Text
       ----------------------------------------------------- */
    const revealEls = document.querySelectorAll('.reveal-anim');
    const maskEls = document.querySelectorAll('[data-mask-text]');

    if ('IntersectionObserver' in window && !reduceMotion) {
        const revealObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

        revealEls.forEach((el) => revealObserver.observe(el));

        const maskObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    obs.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

        maskEls.forEach((el) => maskObserver.observe(el));
    } else {
        revealEls.forEach((el) => el.classList.add('visible'));
        maskEls.forEach((el) => el.classList.add('is-revealed'));
    }

    /* -----------------------------------------------------
       4. Card tilt + hover glow
       ----------------------------------------------------- */
    document.querySelectorAll('.comic-card').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            if (reduceMotion) return;
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);

            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const rotX = ((y - cy) / cy) * -2.2;
            const rotY = ((x - cx) / cx) * 2.2;
            card.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });

    /* -----------------------------------------------------
       5. Custom cursor + trails + click web-splat
       ----------------------------------------------------- */
    const cursorDot = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');
    const cursorGlow = document.getElementById('cursor-glow');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    const trailCount = 8;
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
        setTimeout(() => splat.remove(), 650);
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
            t.el.style.opacity = (1 - i / trailCount) * 0.55;
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
       6. Scroll spider
       ----------------------------------------------------- */
    const scrollSpider = document.getElementById('scroll-spider');
    if (scrollSpider) {
        const updateSpider = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const pct = max > 0 ? window.scrollY / max : 0;
            scrollSpider.style.top = `${pct * (window.innerHeight - 60) + 30}px`;
        };
        window.addEventListener('scroll', updateSpider, { passive: true });
        window.addEventListener('resize', updateSpider);
        updateSpider();
    }

    /* -----------------------------------------------------
       7. Mobile menu
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
       8. Page transition + smooth anchor navigation
       ----------------------------------------------------- */
    const pageTransition = document.getElementById('page-transition');

    function scrollToTarget(targetEl) {
        if (!targetEl) return;
        if (lenis) {
            lenis.scrollTo(targetEl, { offset: 0, immediate: true });
        } else {
            targetEl.scrollIntoView({ behavior: 'auto' });
        }
        updateHorizontalSections();
    }

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (link.hasAttribute('data-open-guestbook')) return;
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();

            if (!pageTransition || reduceMotion) {
                scrollToTarget(target);
                return;
            }

            pageTransition.classList.add('is-active');
            setTimeout(() => {
                scrollToTarget(target);
            }, 260);
            setTimeout(() => {
                pageTransition.classList.remove('is-active');
            }, 620);
        });
    });
})();
