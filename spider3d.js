/* =========================================================
   Spider-Man Comic Portfolio — 3D crawling spider
   Procedural low-poly spider (Three.js) with a math-driven
   walk cycle. It crawls across the page as you scroll.

   Design notes:
   - No external model: everything is built from primitives,
     so there are no licenses/meshes to ship.
   - pointer-events: none + behind nav/drawers so it never
     blocks interaction.
   - Respects prefers-reduced-motion (static "hero" pose).
   - Hidden on small screens and when WebGL is unavailable,
     in which case the page simply works without it.
   ========================================================= */

import * as THREE from 'three';

(function () {
    'use strict';

    const container = document.getElementById('spider3d-canvas');
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Skip entirely on small screens / coarse pointers: keeps mobile fast
    // and avoids visual clutter. Re-checked on resize.
    const isDesktop = () => window.innerWidth >= 900 &&
        window.matchMedia('(pointer: fine)').matches;

    // ---------------------------------------------------------
    // WebGL feature check — bail out quietly if unsupported.
    // ---------------------------------------------------------
    function webglAvailable() {
        try {
            const c = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl') || c.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
    if (!webglAvailable()) {
        container.style.display = 'none';
        return;
    }

    // ---------------------------------------------------------
    // Renderer / scene / camera
    // ---------------------------------------------------------
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
        });
    } catch (e) {
        container.style.display = 'none';
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0); // transparent background
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Orthographic camera is far more predictable than perspective for a
    // flat "band" crawl: the spider keeps a constant on-screen size and the
    // crawl track maps directly to viewport pixels.
    // Slight high-front angle so we see the spider's back + face a little.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    camera.position.set(0, 9, 13);
    camera.lookAt(0, 0, 0);

    // How many world units one CSS pixel represents. Smaller => bigger
    // spider on screen. Tuned so the ~4u-wide spider reads at ~100px.
    const WORLD_PER_PX = 0.032;

    // ---------------------------------------------------------
    // Lights — red key + blue rim to match the comic theme
    // ---------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x8899ff, 0x110008, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xff4444, 2.2);
    keyLight.position.set(-6, 8, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2b6cb0, 1.8);
    rimLight.position.set(7, 4, -6);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(0, 10, 4);
    scene.add(fillLight);

    // ---------------------------------------------------------
    // Spider factory
    // ---------------------------------------------------------
    const RED = 0xe62429;
    const DARKRED = 0xa81219;
    const BODY = 0x1b1d2b;

    const bodyMat = new THREE.MeshStandardMaterial({
        color: BODY, roughness: 0.55, metalness: 0.25,
        emissive: new THREE.Color(RED), emissiveIntensity: 0.06,
    });
    const abdomenMat = new THREE.MeshStandardMaterial({
        color: 0x14161f, roughness: 0.5, metalness: 0.3,
        emissive: new THREE.Color(DARKRED), emissiveIntensity: 0.12,
    });
    const legMat = new THREE.MeshStandardMaterial({
        color: 0x0e0f16, roughness: 0.45, metalness: 0.4,
        emissive: new THREE.Color(RED), emissiveIntensity: 0.05,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
        color: RED, emissive: new THREE.Color(RED), emissiveIntensity: 1.6,
        roughness: 0.3,
    });
    const markingMat = new THREE.MeshStandardMaterial({
        color: RED, roughness: 0.4, metalness: 0.3,
        emissive: new THREE.Color(RED), emissiveIntensity: 0.35,
    });

    // Simple capsule-ish limb between two Y-positions, built once and reused.
    function makeSegment(radius, length) {
        const geo = new THREE.CylinderGeometry(radius * 0.8, radius, length, 6);
        const mesh = new THREE.Mesh(geo, legMat);
        // Move origin to the top so the segment hangs from its joint.
        mesh.geometry.translate(0, -length / 2, 0);
        return mesh;
    }

    // One leg: three nested pivot groups so joints rotate like a real limb.
    // Orientation: the leg root sits on the body; the chain points outward.
    const LEG_CONFIG = [
        // [zOffset, side(+1 right / -1 left), splay, reach]
        { z: 0.55, side: 1 }, { z: 0.30, side: 1 }, { z: -0.05, side: 1 }, { z: -0.35, side: 1 },
        { z: 0.55, side: -1 }, { z: 0.30, side: -1 }, { z: -0.05, side: -1 }, { z: -0.35, side: -1 },
    ];

    function buildLeg(index) {
        const cfg = LEG_CONFIG[index];
        const s = cfg.side;

        const root = new THREE.Group();        // attaches to the body
        root.position.set(0, 0.35, cfg.z);
        // Point the whole leg chain outward + slightly up for a natural pose
        root.rotation.z = s * THREE.MathUtils.degToRad(58);
        root.rotation.y = -s * THREE.MathUtils.degToRad(80 + index * 4);

        const femur = makeSegment(0.11, 1.5);
        root.add(femur);

        const knee = new THREE.Group();         // joint at the end of the femur
        knee.position.y = -1.5;
        knee.rotation.x = THREE.MathUtils.degToRad(-55);
        femur.add(knee);

        const tibia = makeSegment(0.075, 1.35);
        knee.add(tibia);

        const ankle = new THREE.Group();        // joint at the end of the tibia
        ankle.position.y = -1.35;
        ankle.rotation.x = THREE.MathUtils.degToRad(30);
        tibia.add(ankle);

        const tarsus = makeSegment(0.05, 0.7);
        ankle.add(tarsus);

        // Store joint refs + resting poses for animation.
        return {
            root, femur, knee, tibia, ankle, tarsus,
            base: {
                rootZ: root.rotation.z,
                rootY: root.rotation.y,
                kneeX: knee.rotation.x,
                ankleX: ankle.rotation.x,
            },
            // Phase offset: half the legs are out of sync (tetrapod gait).
            phase: (index % 2 === 0 ? 0 : Math.PI) + (index >= 4 ? Math.PI / 2 : 0),
            side: s,
        };
    }

    function buildSpider() {
        const spider = new THREE.Group();
        const legs = [];
        for (let i = 0; i < 8; i++) legs.push(buildLeg(i));
        legs.forEach((l) => spider.add(l.root));

        // A "legs/body" rig for easy bobbing.
        const body = new THREE.Group();
        spider.add(body);

        // Cephalothorax (front head/thorax)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), bodyMat);
        head.scale.set(1, 0.8, 1.1);
        head.position.set(0, 0, 1.05);
        body.add(head);

        // Abdomen (big rear)
        const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 16), abdomenMat);
        abdomen.scale.set(1, 1, 1.25);
        abdomen.position.set(0, 0.06, -0.7);
        body.add(abdomen);

        // Red hourglass-ish stripe marking on abdomen (comic nod)
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20, 1, true), markingMat);
        stripe.rotation.z = Math.PI / 2;
        stripe.position.set(0, 0.9, -0.7);
        stripe.scale.set(1, 1.3, 1);
        body.add(stripe);

        // Fangs / chelicerae
        const fangGeo = new THREE.ConeGeometry(0.07, 0.34, 6);
        [-1, 1].forEach((s) => {
            const fang = new THREE.Mesh(fangGeo, legMat);
            fang.position.set(s * 0.22, -0.28, 1.55);
            fang.rotation.x = THREE.MathUtils.degToRad(18);
            head.add(fang);
        });

        // Eyes — two big red lenses + a row of small ones (Spidey mask nod)
        const eyeGeo = new THREE.SphereGeometry(0.14, 12, 10);
        [-1, 1].forEach((s) => {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.scale.set(1, 1.4, 0.6);
            eye.position.set(s * 0.26, 0.12, 1.5);
            head.add(eye);
        });
        const smallEyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
        [-1, 1].forEach((s) => {
            for (let k = 0; k < 3; k++) {
                const e = new THREE.Mesh(smallEyeGeo, eyeMat);
                e.position.set(s * (0.42 + k * 0.08), 0.14 - k * 0.02, 1.28 - k * 0.06);
                head.add(e);
            }
        });

        spider.userData = { legs, body, head, abdomen };
        return spider;
    }

    const spider = buildSpider();
    scene.add(spider);

    // A tiny contact shadow so it feels grounded on the page.
    const shadowMat = new THREE.MeshBasicMaterial({
        color: RED, transparent: true, opacity: 0.14, depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.35;
    scene.add(shadow);

    // ---------------------------------------------------------
    // Sizing — the ortho frustum is derived from the band's pixel size
    // so 1 CSS pixel == WORLD_PER_PX world units. The crawl track then
    // maps directly onto the viewport width.
    // ---------------------------------------------------------
    let VW = 0;   // band width in CSS px
    let VH = 0;   // band height in CSS px

    function resize() {
        if (!isDesktop()) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';

        const rect = container.getBoundingClientRect();
        VW = Math.round(rect.width || window.innerWidth);
        VH = Math.round(rect.height || 160);

        renderer.setSize(VW, VH, false);

        // Orthographic frustum in world units.
        const halfW = (VW * WORLD_PER_PX) / 2;
        const halfH = (VH * WORLD_PER_PX) / 2;
        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();
    }

    // The crawl track spans the visible world width, inset a little so the
    // spider's legs never clip off-screen.
    function getCrawlBounds() {
        const halfW = (VW * WORLD_PER_PX) / 2;
        const inset = 4.0; // world units reserved at each edge so the body never clips
        return { min: -halfW + inset, max: halfW - inset };
    }

    // ---------------------------------------------------------
    // State
    // ---------------------------------------------------------
    let scrollProgress = 0;   // 0..1 across the whole page
    let targetProgress = 0;
    let walkPhase = 0;        // drives the leg gait
    let facing = 1;           // 1 => walking right, -1 => left
    let currentFacing = 1;
    let visible = true;
    let running = true;
    const clock = new THREE.Clock();

    function updateScroll() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        targetProgress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }

    // ---------------------------------------------------------
    // Animation
    // ---------------------------------------------------------
    function animate() {
        if (!running) return;
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05);

        // Ease scroll progress (smoothed crawl).
        const prev = scrollProgress;
        scrollProgress += (targetProgress - scrollProgress) * (1 - Math.pow(0.001, dt));
        const delta = scrollProgress - prev;

        // Travel speed drives how fast the legs march.
        const bounds = getCrawlBounds();
        const trackWidth = bounds.max - bounds.min;
        // Position along the track (left -> right as you scroll down).
        const x = bounds.min + scrollProgress * trackWidth;

        // Facing: flip when moving; smooth the turn so it isn't instant.
        if (Math.abs(delta) > 0.00002) facing = delta > 0 ? 1 : -1;
        currentFacing += (facing - currentFacing) * Math.min(1, dt * 6);

        // Leg marching speed: always a gentle idle march, faster with scroll.
        const scrollSpeed = Math.abs(delta) / Math.max(dt, 0.001); // progress/sec
        const marchSpeed = 1.6 + Math.min(scrollSpeed * 26, 9);
        walkPhase += dt * marchSpeed;

        spider.position.x = x;
        // Center the spider vertically in the band (its legs hang below 0).
        spider.position.y = 0.55;
        // Face along the track; keep the model's forward (+z) to the right.
        spider.rotation.y = THREE.MathUtils.lerp(
            spider.rotation.y,
            currentFacing > 0 ? -Math.PI / 2 : Math.PI / 2,
            Math.min(1, dt * 7)
        );

        const ud = spider.userData;

        // Body bob + sway synced to the gait.
        const bob = Math.sin(walkPhase * 2) * 0.09;
        const sway = Math.sin(walkPhase) * 0.05;
        ud.body.position.y = bob;
        ud.body.rotation.z = sway * 0.6;

        // Animate each leg. 8 legs in a tetrapod-ish alternating gait:
        // each leg has a phase offset; sweep = forward/back swing, lift = up.
        for (const leg of ud.legs) {
            const p = walkPhase + leg.phase;
            const sweep = Math.sin(p);            // -1..1 fore/aft swing
            const lift = Math.max(0, Math.sin(p)); // 0..1 lift during swing

            // Femur swings fore/aft around the body (rotate around Y of root).
            leg.root.rotation.y = leg.base.rootY + sweep * THREE.MathUtils.degToRad(16) * leg.side;

            // Knee flexes during lift for a convincing step.
            leg.knee.rotation.x = leg.base.kneeX - lift * THREE.MathUtils.degToRad(22);

            // Slight splay pulse so legs "breathe".
            leg.root.rotation.z = leg.base.rootZ +
                Math.sin(p * 0.5) * THREE.MathUtils.degToRad(3) * -leg.side;
        }

        // Keep the shadow under the body and match width-ish.
        shadow.position.x = x;
        shadow.position.y = spider.position.y - 1.35;
        shadow.scale.setScalar(1 + bob * 0.15);

        renderer.render(scene, camera);
    }

    // Static pose for reduced-motion users (a nice "landed" stance).
    function renderStaticPose() {
        scrollProgress = targetProgress;
        const bounds = getCrawlBounds();
        spider.position.x = (bounds.min + bounds.max) / 2;
        spider.position.y = 0.55;
        spider.rotation.y = -Math.PI / 2;
        shadow.position.x = spider.position.x;
        shadow.position.y = spider.position.y - 1.35;
        renderer.render(scene, camera);
    }

    // ---------------------------------------------------------
    // Wire up events
    // ---------------------------------------------------------
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', () => {
        resize();
        if (reduceMotion || !running) renderStaticPose();
    });

    // Pause rendering when the tab is hidden (saves battery / CPU).
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            running = false;
        } else if (!reduceMotion && visible) {
            running = true;
            clock.getDelta(); // reset delta so it doesn't jump
            animate();
        }
    });

    // Pause when the band scrolls out of view.
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                visible = entry.isIntersecting;
                if (reduceMotion) return;
                if (visible && !document.hidden && !running) {
                    running = true;
                    clock.getDelta();
                    animate();
                } else if (!visible) {
                    running = false;
                }
            });
        }, { threshold: 0 });
        io.observe(container);
    }

    // ---------------------------------------------------------
    // Boot
    // ---------------------------------------------------------
    resize();
    updateScroll();

    if (reduceMotion) {
        renderStaticPose();
    } else {
        container.classList.add('is-ready');
        animate();
    }

    // Expose a tiny debug handle (harmless, handy for testing).
    window.__spider3d = { scene, camera, renderer, spider };
})();
