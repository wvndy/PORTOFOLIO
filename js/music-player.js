/* =====================================================
   Music Player — Feel Good Inc. by Gorillaz
   Autoplay on load; toggle button in navbar.
   ===================================================== */

(function () {
    const audio  = document.getElementById('bg-music');
    const btn    = document.getElementById('music-toggle');

    if (!audio || !btn) return;

    let isPlaying = false;

    /* ---- Restore volume preference ---- */
    audio.volume = parseFloat(localStorage.getItem('music-volume') ?? '0.5');

    /* ---- UI sync ---- */
    function setPlaying(state) {
        isPlaying = state;
        btn.classList.toggle('is-playing', state);
        btn.setAttribute('aria-label', state ? 'Matikan musik' : 'Putar musik');
    }

    /* ---- Autoplay on page load ----
       Browsers block autoplay until a user gesture; we try immediately
       and silently ignore the NotAllowedError if the policy blocks it.
       Once the user interacts anywhere, we retry once. */
    function tryPlay() {
        audio.play().then(() => setPlaying(true)).catch(() => {
            // Policy blocked — wait for first interaction then retry once
            const handler = () => {
                document.removeEventListener('click',      handler, true);
                document.removeEventListener('keydown',    handler, true);
                document.removeEventListener('touchstart', handler, true);
                audio.play().then(() => setPlaying(true)).catch(() => {});
            };
            document.addEventListener('click',      handler, { once: true, capture: true });
            document.addEventListener('keydown',    handler, { once: true, capture: true });
            document.addEventListener('touchstart', handler, { once: true, capture: true, passive: true });
        });
    }

    /* ---- Toggle ---- */
    btn.addEventListener('click', async () => {
        if (isPlaying) {
            audio.pause();
            setPlaying(false);
        } else {
            try {
                await audio.play();
                setPlaying(true);
            } catch (err) {
                console.warn('[music-player] Play blocked:', err.message);
            }
        }
    });

    /* ---- Sync state if audio ends / errors ---- */
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('error', () => {
        setPlaying(false);
        console.warn('[music-player] Audio error. Place goodinc.m4a in assets/audio/');
    });

    /* ---- Boot ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryPlay);
    } else {
        tryPlay();
    }
})();
