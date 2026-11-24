(function () {
    'use strict';

    const loader = document.getElementById('site-loader');
    if (!loader) return;

    const html = document.documentElement;
    const video = document.getElementById('site-loader-video');
    const bar = document.getElementById('site-loader-bar');
    const percentEl = document.getElementById('site-loader-percent');
    const statusEl = loader.querySelector('.site-loader__status');
    const progressEl = loader.querySelector('.site-loader__progress');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const WEIGHTS = { dom: 15, load: 35, fonts: 20, videoReady: 10, videoEnded: 20 };
    const MIN_VISIBLE = reduceMotion ? 800 : 2200;
    const MAX_WAIT = 8000;

    let shown = 0;
    let target = 0;
    let closing = false;
    let closeTimer = 0;
    let safetyTimer = 0;
    let rafId = 0;
    let lastFrame = performance.now();
    const startedAt = performance.now();
    const done = new Set();

    function failOpen() {
        html.classList.remove('site-loading');
        html.classList.add('js-ready');
        loader.remove();
    }

    try {
        html.classList.remove('js-ready');
        html.classList.add('site-loading');

        function paint() {
            const value = Math.max(0, Math.min(100, Math.floor(shown)));
            bar.style.width = value + '%';
            percentEl.textContent = value + '%';
            progressEl.setAttribute('aria-valuenow', String(value));
            if (value >= 100 && statusEl) statusEl.textContent = 'SIAP!';
        }

        function targetValue() {
            let earned = 0;
            let total = 0;
            Object.keys(WEIGHTS).forEach(function (key) {
                total += WEIGHTS[key];
                if (done.has(key)) earned += WEIGHTS[key];
            });
            return total ? Math.round((earned / total) * 100) : 0;
        }

        function animate(now) {
            const dt = Math.max(0, Math.min(64, now - lastFrame));
            lastFrame = now;
            target = targetValue();
            if (target > shown) {
                const factor = 1 - Math.pow(0.86, dt / 16.67);
                shown += (target - shown) * factor;
                if (target - shown < 0.15) shown = target;
            } else {
                shown = target;
            }
            paint();
            rafId = window.requestAnimationFrame(animate);
        }

        function allDone() {
            return Object.keys(WEIGHTS).every(function (key) {
                return done.has(key);
            });
        }

        function finish() {
            if (closing) return;
            closing = true;
            window.clearTimeout(safetyTimer);
            window.clearTimeout(closeTimer);
            window.cancelAnimationFrame(rafId);
            shown = 100;
            target = 100;
            paint();
            if (video) {
                try { video.pause(); } catch (error) {}
            }
            loader.classList.add('is-leaving');
            html.classList.add('js-ready');
            window.setTimeout(function () {
                html.classList.remove('site-loading');
                loader.remove();
                document.dispatchEvent(new CustomEvent('site-loader:done'));
            }, reduceMotion ? 20 : 950);
        }

        function maybeFinish() {
            if (closing || closeTimer) return;
            if (!allDone()) return;
            const remaining = Math.max(0, MIN_VISIBLE - (performance.now() - startedAt));
            closeTimer = window.setTimeout(finish, remaining);
        }

        function mark(key) {
            if (closing || done.has(key)) return;
            done.add(key);
            if (allDone()) maybeFinish();
        }

        safetyTimer = window.setTimeout(function () {
            Object.keys(WEIGHTS).forEach(function (key) { done.add(key); });
            finish();
        }, MAX_WAIT);

        rafId = window.requestAnimationFrame(animate);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { mark('dom'); }, { once: true });
        } else {
            mark('dom');
        }

        if (document.readyState === 'complete') {
            mark('load');
        } else {
            window.addEventListener('load', function () { mark('load'); }, { once: true });
        }

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready
                .then(function () { mark('fonts'); })
                .catch(function () { mark('fonts'); });
            window.setTimeout(function () { mark('fonts'); }, 4000);
        } else {
            mark('fonts');
        }

        if (!video) {
            mark('videoReady');
            mark('videoEnded');
        } else {
            const videoReady = function () {
                loader.classList.add('is-video-ready');
                mark('videoReady');
            };

            if (video.readyState >= 2) videoReady();
            else video.addEventListener('loadeddata', videoReady, { once: true });

            video.addEventListener('ended', function () {
                loader.classList.add('is-video-ended');
                mark('videoEnded');
            }, { once: true });

            video.addEventListener('error', function () {
                loader.classList.add('is-video-error');
                mark('videoReady');
                mark('videoEnded');
            }, { once: true });

            if (reduceMotion) {
                try { video.pause(); } catch (error) {}
                mark('videoReady');
                mark('videoEnded');
            } else if (video.ended) {
                videoReady();
                mark('videoEnded');
            } else {
                const playAttempt = video.play();
                if (playAttempt && typeof playAttempt.catch === 'function') {
                    playAttempt.catch(function () {});
                }
                window.setTimeout(function () {
                    loader.classList.add('is-video-ready');
                    mark('videoReady');
                }, 3500);
                window.setTimeout(function () { mark('videoEnded'); }, 5000);
            }
        }

        window.addEventListener('pageshow', function (event) {
            if (event.persisted) finish();
        });

        if (!bar || !percentEl || !progressEl) failOpen();
    } catch (error) {
        console.error('[Loader] Init error:', error);
        failOpen();
    }
})();
