/**
 * Lando Norris Style Topographic Wave Background (WebGL)
 * Pure vanilla WebGL - Simplex 3D Noise + 4-Point Contour Outline
 * + 3D Fluid Inertial Shadow Trail + Scroll & Drag Dynamic Color Palette Shifts
 * Extracted & adapted from landonorris.com (OFF+BRAND)
 */

(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
    }) || canvas.getContext('experimental-webgl');

    if (!gl) {
        console.warn('WebGL not supported for Lando background.');
        return;
    }

    // Vertex Shader: full-screen quad
    const vsSource = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
            vUv = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    // Fragment Shader
    const fsSource = `
        precision highp float;
        varying vec2 vUv;

        uniform float uTime;
        uniform float uAspect;
        uniform vec2 uMouse;
        uniform vec2 uShadowMouse;
        uniform float uMouseSpeed;
        uniform vec2 uDragForce;
        uniform vec2 uDragVel;
        uniform float uWaveImpulse;
        uniform float uThickness;
        uniform float uScale;
        uniform float uSpeed;
        uniform float uDistortScale;
        uniform float uDistortIntensity;
        uniform float uNoiseDetail;
        uniform float uCursorScale;
        uniform float uCursorIntensity;
        uniform float uCursorBounce;

        uniform vec3 uColorBg;
        uniform vec3 uColorFg;
        uniform vec3 uColorOutline;
        uniform vec3 uColorWaveHighlight;

        // 3D Simplex Noise implementation (Ian McEwan, Stefan Gustavson)
        vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
            const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + 1.0 * C.xxx;
            vec3 x2 = x0 - i2 + 2.0 * C.xxx;
            vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

            i = mod(i, 289.0);
            vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

            float n_ = 1.0 / 7.0;
            vec3 ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0) * 2.0 + 1.0;
            vec4 s1 = floor(b1) * 2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }

        // Noise sampler with drag wave perturbation
        float sampleNoise(vec2 coord) {
            vec2 p = coord;
            p.x *= uAspect;

            vec2 m = uMouse;
            m.x *= uAspect;

            float dist = distance(m, p);

            // Drag velocity wave displacement
            float dragRadius = exp(-dist * 2.6);
            vec2 waveShift = uDragForce * dragRadius * 0.45;

            // Concentric wave ripples from drag & movement
            float ripple = sin(dist * 22.0 - uTime * 4.5) * exp(-dist * 3.2) * (uWaveImpulse + uMouseSpeed * 0.15);
            vec2 rippleVec = vec2(0.0);
            if (dist > 0.001) {
                rippleVec = (p - m) / dist * ripple * 0.08;
            }

            vec2 warped = p + waveShift + rippleVec;

            // Cursor proximity pressure
            float cursor = 1.0 - dist * uCursorScale;
            cursor = clamp(cursor, uCursorBounce, 1.0) * (uMouseSpeed * 1.5 + uWaveImpulse * 1.2);

            // Background distortion noise
            float noiseDistort = 0.5 + snoise(vec3(warped.x * uDistortScale, warped.y * uDistortScale, uTime * uSpeed * 0.12)) * 0.5;

            // Final topographic contour noise
            vec2 finalCoords = (warped + (cursor * uCursorIntensity) + (noiseDistort * uDistortIntensity)) * uScale;
            float noiseFinal = 0.5 + snoise(vec3(finalCoords.x, finalCoords.y, uTime * uSpeed)) * 0.5;

            noiseFinal *= uNoiseDetail;
            noiseFinal = fract(noiseFinal);

            return step(0.5, noiseFinal);
        }

        void main() {
            vec2 uv = vUv;

            // Base noise state
            float noiseBase = sampleNoise(uv);

            // 4-point neighborhood sampling for crisp contour edge detection
            float sampleRight = sampleNoise(uv + vec2( uThickness,  0.0));
            float sampleLeft  = sampleNoise(uv + vec2(-uThickness,  0.0));
            float sampleUp    = sampleNoise(uv + vec2( 0.0,  uThickness));
            float sampleDown  = sampleNoise(uv + vec2( 0.0, -uThickness));

            float edge = 0.0;
            if (sampleRight != noiseBase || sampleLeft != noiseBase || sampleUp != noiseBase || sampleDown != noiseBase) {
                edge = 1.0;
            }

            // Blend background color & subtle foreground shade
            vec3 col = mix(uColorBg, uColorFg, noiseBase);

            // Dynamic fluid shadow that follows drag motion
            vec2 sm = uShadowMouse;
            sm.x *= uAspect;
            vec2 p = uv;
            p.x *= uAspect;
            float smDist = distance(sm, p);

            // Trailing wake shadow offset
            float velLen = length(uDragVel);
            vec2 trailDir = (velLen > 0.001) ? normalize(uDragVel) : vec2(0.0);
            vec2 wakePos = sm - trailDir * 0.05;
            float wakeDist = distance(wakePos, p);

            float cursorShadow = exp(-smDist * 3.2) * (uWaveImpulse * 0.75 + uMouseSpeed * 0.35);
            float wakeShadow = exp(-wakeDist * 3.6) * clamp(velLen * 0.5, 0.0, 0.6);
            float totalShadow = clamp(cursorShadow + wakeShadow, 0.0, 0.55);

            // Blend shadow into surface (darkening depressions & contour valleys)
            vec3 shadowTone = mix(col * 0.52, vec3(0.02, 0.03, 0.02), 0.35);
            col = mix(col, shadowTone, totalShadow);

            // Wave highlight on drag crests
            vec2 m = uMouse;
            m.x *= uAspect;
            float d = distance(m, p);
            float dragGlow = exp(-d * 3.0) * (uWaveImpulse * 0.6 + uMouseSpeed * 0.2);

            // Blend contour outline lines
            vec3 outlineCol = mix(uColorOutline, uColorWaveHighlight, clamp(dragGlow * 0.9, 0.0, 1.0));
            col = mix(col, outlineCol, edge);

            // Luminous wave wash on peak drag
            col = mix(col, uColorWaveHighlight, clamp(dragGlow * 0.2, 0.0, 0.28));

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return;
    }

    gl.useProgram(program);

    // Full screen quad buffer
    const quadVertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const u = {
        uTime: gl.getUniformLocation(program, 'uTime'),
        uAspect: gl.getUniformLocation(program, 'uAspect'),
        uMouse: gl.getUniformLocation(program, 'uMouse'),
        uShadowMouse: gl.getUniformLocation(program, 'uShadowMouse'),
        uMouseSpeed: gl.getUniformLocation(program, 'uMouseSpeed'),
        uDragForce: gl.getUniformLocation(program, 'uDragForce'),
        uDragVel: gl.getUniformLocation(program, 'uDragVel'),
        uWaveImpulse: gl.getUniformLocation(program, 'uWaveImpulse'),
        uThickness: gl.getUniformLocation(program, 'uThickness'),
        uScale: gl.getUniformLocation(program, 'uScale'),
        uSpeed: gl.getUniformLocation(program, 'uSpeed'),
        uDistortScale: gl.getUniformLocation(program, 'uDistortScale'),
        uDistortIntensity: gl.getUniformLocation(program, 'uDistortIntensity'),
        uNoiseDetail: gl.getUniformLocation(program, 'uNoiseDetail'),
        uCursorScale: gl.getUniformLocation(program, 'uCursorScale'),
        uCursorIntensity: gl.getUniformLocation(program, 'uCursorIntensity'),
        uCursorBounce: gl.getUniformLocation(program, 'uCursorBounce'),
        uColorBg: gl.getUniformLocation(program, 'uColorBg'),
        uColorFg: gl.getUniformLocation(program, 'uColorFg'),
        uColorOutline: gl.getUniformLocation(program, 'uColorOutline'),
        uColorWaveHighlight: gl.getUniformLocation(program, 'uColorWaveHighlight')
    };

    // Simulation parameters
    gl.uniform1f(u.uThickness, 0.0016);
    gl.uniform1f(u.uScale, 1.15);
    gl.uniform1f(u.uSpeed, 0.16);
    gl.uniform1f(u.uDistortScale, 1.1);
    gl.uniform1f(u.uDistortIntensity, 0.55);
    gl.uniform1f(u.uNoiseDetail, 3.0);
    gl.uniform1f(u.uCursorScale, 2.5);
    gl.uniform1f(u.uCursorIntensity, 0.32);
    gl.uniform1f(u.uCursorBounce, -0.65);

    // Color Palettes
    const PALETTES = [
        // 0: Hero - Lando White
        {
            bg: [0.973, 0.973, 0.953],
            fg: [0.941, 0.941, 0.922],
            outline: [0.796, 0.796, 0.725],
            highlight: [0.824, 1.0, 0.0]
        },
        // 1: About - Stealth Dark Olive / Ink
        {
            bg: [0.086, 0.102, 0.071],
            fg: [0.133, 0.157, 0.110],
            outline: [0.310, 0.367, 0.232],
            highlight: [0.824, 1.0, 0.0]
        },
        // 2: Journey - Deep Tech Navy / Slate
        {
            bg: [0.051, 0.075, 0.133],
            fg: [0.086, 0.125, 0.208],
            outline: [0.220, 0.310, 0.480],
            highlight: [1.0, 0.824, 0.247]
        },
        // 3: Contact - Comic Red Ink
        {
            bg: [0.102, 0.039, 0.047],
            fg: [0.169, 0.063, 0.078],
            outline: [0.545, 0.102, 0.141],
            highlight: [0.902, 0.141, 0.161]
        }
    ];

    // Current interpolated colors
    const currentColors = {
        bg: [...PALETTES[0].bg],
        fg: [...PALETTES[0].fg],
        outline: [...PALETTES[0].outline],
        highlight: [...PALETTES[0].highlight]
    };

    let targetPaletteIdx = 0;
    let manualPaletteShift = 0; // for drag flick color shifts

    // State & physics
    let W = 0, H = 0;
    let targetMouseX = 0.5, targetMouseY = 0.5;
    let mouseX = 0.5, mouseY = 0.5;
    let prevMouseX = 0.5, prevMouseY = 0.5;
    let shadowMouseX = 0.5, shadowMouseY = 0.5;
    let mouseSpeed = 0;

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragTotalDist = 0;
    let dragForceX = 0, dragForceY = 0;
    let dragVelX = 0, dragVelY = 0;
    let waveImpulse = 0;

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(u.uAspect, W / H);
    }
    window.addEventListener('resize', resize);
    resize();

    // Section scroll tracker for background color shift
    function updateSectionColorOnScroll() {
        const sections = [
            document.getElementById('hero'),
            document.getElementById('about'),
            document.getElementById('journey'),
            document.getElementById('contact')
        ];

        const scrollY = window.scrollY + window.innerHeight * 0.45;
        let activeIdx = 0;

        for (let i = 0; i < sections.length; i++) {
            if (sections[i]) {
                const top = sections[i].offsetTop;
                if (scrollY >= top) {
                    activeIdx = i;
                }
            }
        }
        targetPaletteIdx = activeIdx;

        // Sync data-theme on body for section text contrast
        const theme = (activeIdx === 0) ? 'light' : 'dark';
        if (document.body.getAttribute('data-theme') !== theme) {
            document.body.setAttribute('data-theme', theme);
        }
    }

    window.addEventListener('scroll', updateSectionColorOnScroll, { passive: true });
    updateSectionColorOnScroll();

    // Global Pointer Events (drag waves + drag shadow)
    function onPointerDown(e) {
        isDragging = true;
        const x = e.clientX / W;
        const y = 1.0 - (e.clientY / H);
        dragStartX = x;
        dragStartY = y;
        dragTotalDist = 0;
        targetMouseX = x;
        targetMouseY = y;
        waveImpulse = Math.min(waveImpulse + 0.7, 2.0);
    }

    function onPointerMove(e) {
        const x = e.clientX / W;
        const y = 1.0 - (e.clientY / H);
        targetMouseX = x;
        targetMouseY = y;

        if (isDragging) {
            const dx = (x - dragStartX);
            const dy = (y - dragStartY);
            dragVelX += dx * 2.2;
            dragVelY += dy * 2.2;
            dragStartX = x;
            dragStartY = y;

            const stepDist = Math.hypot(dx, dy);
            dragTotalDist += stepDist;
            waveImpulse = Math.min(waveImpulse + stepDist * 6.5, 2.5);
        }
    }

    function onPointerUp() {
        if (isDragging) {
            isDragging = false;
            waveImpulse = Math.min(waveImpulse + 0.5, 2.5);

            // If dragged significantly across the screen, shift color palette pulse!
            if (dragTotalDist > 0.18) {
                manualPaletteShift = (manualPaletteShift + 1) % PALETTES.length;
            }
        }
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // Touch support fallback
    window.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) onPointerDown(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) onPointerMove(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });

    // Render loop
    let lastTime = performance.now();

    function render(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        // Smooth mouse interpolation (lerp)
        const lerpFactor = 0.08;
        mouseX += (targetMouseX - mouseX) * lerpFactor;
        mouseY += (targetMouseY - mouseY) * lerpFactor;

        // Inertial shadow mouse lag (creates 3D trailing depression)
        const shadowLerp = 0.05;
        shadowMouseX += (mouseX - shadowMouseX) * shadowLerp;
        shadowMouseY += (mouseY - shadowMouseY) * shadowLerp;

        // Mouse speed calculation with damping
        const dx = mouseX - prevMouseX;
        const dy = mouseY - prevMouseY;
        const instSpeed = Math.hypot(dx, dy) / Math.max(dt, 0.001);
        mouseSpeed += (instSpeed - mouseSpeed) * 0.1;
        prevMouseX = mouseX;
        prevMouseY = mouseY;

        // Spring / Damping physics for Drag Force
        const springK = 26.0;
        const damping = 0.86;
        dragVelX += (-springK * dragForceX) * dt;
        dragVelY += (-springK * dragForceY) * dt;
        dragVelX *= damping;
        dragVelY *= damping;
        dragForceX += dragVelX * dt;
        dragForceY += dragVelY * dt;

        // Wave impulse decay
        waveImpulse *= 0.94;
        if (waveImpulse < 0.001) waveImpulse = 0;

        // Color Palette Interpolation
        // Combine scroll-targeted palette with any manual drag shift
        const activePaletteIdx = (targetPaletteIdx + manualPaletteShift) % PALETTES.length;
        const targetPal = PALETTES[activePaletteIdx];
        const colorLerp = 0.05;

        for (let i = 0; i < 3; i++) {
            currentColors.bg[i] += (targetPal.bg[i] - currentColors.bg[i]) * colorLerp;
            currentColors.fg[i] += (targetPal.fg[i] - currentColors.fg[i]) * colorLerp;
            currentColors.outline[i] += (targetPal.outline[i] - currentColors.outline[i]) * colorLerp;
            currentColors.highlight[i] += (targetPal.highlight[i] - currentColors.highlight[i]) * colorLerp;
        }

        // Pass uniforms
        gl.uniform1f(u.uTime, now * 0.001);
        gl.uniform2f(u.uMouse, mouseX, mouseY);
        gl.uniform2f(u.uShadowMouse, shadowMouseX, shadowMouseY);
        gl.uniform1f(u.uMouseSpeed, Math.min(mouseSpeed * 0.15, 1.2));
        gl.uniform2f(u.uDragForce, dragForceX, dragForceY);
        gl.uniform2f(u.uDragVel, dragVelX, dragVelY);
        gl.uniform1f(u.uWaveImpulse, waveImpulse);

        gl.uniform3fv(u.uColorBg, currentColors.bg);
        gl.uniform3fv(u.uColorFg, currentColors.fg);
        gl.uniform3fv(u.uColorOutline, currentColors.outline);
        gl.uniform3fv(u.uColorWaveHighlight, currentColors.highlight);

        // Draw quad
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();
