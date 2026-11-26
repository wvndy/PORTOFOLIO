/* =====================================================
   Music Player — Feel Good Inc. by Gorillaz
   Toggle button in navbar
   ===================================================== */

(function () {
    const audio  = document.getElementById('bg-music');
    const btn    = document.getElementById('music-toggle');

    if (!audio || !btn) return;

    let isPlaying  = false;
    let userGesture = false; // Browser requires user interaction before play

    /* ---- Restore volume preference ---- */
    audio.volume = parseFloat(localStorage.getItem('music-volume') ?? '0.5');

    /* ---- Helpers ---- */
    function setPlaying(state) {
        isPlaying = state;
        btn.classList.toggle('is-playing', state);
        btn.setAttribute('aria-label', state ? 'Matikan musik' : 'Putar musik');
    }

    /* ---- Toggle ---- */
    btn.addEventListener('click', async () => {
        if (!userGesture) {
            audio.load();
            userGesture = true;
        }

        if (isPlaying) {
            audio.pause();
            setPlaying(false);
        } else {
            try {
                await audio.play();
                setPlaying(true);
            } catch (err) {
                console.warn('[music-player] Autoplay blocked:', err.message);
            }
        }
    });

    /* ---- Sync state if audio ends / errors ---- */
    audio.addEventListener('ended', () => setPlaying(false)); // shouldn't fire because loop=true
    audio.addEventListener('error', () => {
        setPlaying(false);
        console.warn('[music-player] Audio file not found. Place goodinc.m4a in assets/audio/');
    });
})();
