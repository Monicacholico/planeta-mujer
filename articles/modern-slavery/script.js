(function () {
    const TOTAL_DOTS = 10000;
    const DOT_RADIUS = 1.8;
    const BASE_SPEED = 0.3;
    const FRICTION = 0.96;
    const MIN_SPEED = 0.15;

    const PALETTE = [
        [230, 180, 120],   // warm sand
        [200, 140, 100],   // terracotta
        [160, 120, 90],    // umber
        [210, 170, 160],   // blush
        [180, 160, 200],   // soft lavender
        [140, 190, 180],   // sage
        [190, 210, 160],   // soft chartreuse
        [220, 200, 140],   // gold
        [170, 140, 160],   // mauve
        [140, 170, 200],   // slate blue
        [200, 160, 130],   // sienna
        [180, 200, 190],   // celadon
    ];

    const STEP_IMPULSES = {
        "hero": null,
        "dots-intro": "scatter",
        "normalize": "agitate",
        "scale-intro": "gather",
        "spacer": "scatter"
    };

    const canvas = document.getElementById("viz");
    const ctx = canvas.getContext("2d");

    let width, height, dpr;
    let dots = [];
    let currentStep = "hero";
    let animationId;

    // ── Resize ──────────────────────────────────
    function resize() {
        dpr = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Create dots ─────────────────────────────
    function createDots() {
        dots = [];
        for (let i = 0; i < TOTAL_DOTS; i++) {
            const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
            const angle = Math.random() * Math.PI * 2;
            dots.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: Math.cos(angle) * BASE_SPEED,
                vy: Math.sin(angle) * BASE_SPEED,
                baseRadius: DOT_RADIUS * (0.6 + Math.random() * 0.8),
                opacity: 0.3 + Math.random() * 0.45,
                color
            });
        }
    }

    // ── Apply one-time impulse ───────────────────
    function applyImpulse(type) {
        const cx = width / 2;
        const cy = height / 2;

        for (const d of dots) {
            if (type === "scatter") {
                const dx = d.x - cx;
                const dy = d.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const strength = 2 + Math.random() * 2;
                d.vx += (dx / dist) * strength;
                d.vy += (dy / dist) * strength;
            } else if (type === "agitate") {
                d.vx += (Math.random() - 0.5) * 4;
                d.vy += (Math.random() - 0.5) * 4;
            } else if (type === "gather") {
                const dx = cx - d.x;
                const dy = cy - d.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const strength = 1.5 + Math.random() * 1.5;
                d.vx += (dx / dist) * strength;
                d.vy += (dy / dist) * strength;
            }
        }
    }

    // ── Smoothly send dots back to random positions ──
    function resetDots() {
        for (const d of dots) {
            const tx = Math.random() * width;
            const ty = Math.random() * height;
            d.vx = (tx - d.x) * 0.02;
            d.vy = (ty - d.y) * 0.02;
        }
    }

    // ── Update dot positions ────────────────────
    function updateDots() {
        for (const d of dots) {
            d.vx *= FRICTION;
            d.vy *= FRICTION;

            const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
            if (speed < MIN_SPEED) {
                const angle = Math.atan2(d.vy, d.vx) + (Math.random() - 0.5) * 0.5;
                d.vx = Math.cos(angle) * MIN_SPEED;
                d.vy = Math.sin(angle) * MIN_SPEED;
            }

            d.x += d.vx;
            d.y += d.vy;

            if (d.x < -10) d.x = width + 10;
            if (d.x > width + 10) d.x = -10;
            if (d.y < -10) d.y = height + 10;
            if (d.y > height + 10) d.y = -10;
        }
    }

    // ── Draw frame ──────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, width, height);

        const boost = currentStep !== "hero" ? 0.15 : 0;

        for (const d of dots) {
            const [r, g, b] = d.color;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.baseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${d.opacity + boost})`;
            ctx.fill();
        }
    }

    // ── Animation loop ──────────────────────────
    function tick() {
        updateDots();
        draw();
        animationId = requestAnimationFrame(tick);
    }

    // ── Scrollama setup ─────────────────────────
    function setupScrollama() {
        const scroller = scrollama();

        scroller
            .setup({
                step: ".step",
                offset: 0.5,
                debug: false
            })
            .onStepEnter(({ element, direction }) => {
                currentStep = element.dataset.step;
                element.classList.add("is-active");

                if (element.dataset.step === "hero" && direction === "up") {
                    resetDots();
                } else {
                    const impulse = STEP_IMPULSES[element.dataset.step];
                    if (impulse) applyImpulse(impulse);
                }
            })
            .onStepExit(({ element, direction }) => {
                if (direction === "up") {
                    element.classList.remove("is-active");
                }
            });

        window.addEventListener("resize", scroller.resize);
    }

    // ── Init ────────────────────────────────────
    function init() {
        resize();
        createDots();
        setupScrollama();
        tick();

        window.addEventListener("resize", () => {
            resize();
            createDots();
        });

        document.querySelector('.step[data-step="hero"]').classList.add("is-active");
    }

    init();
})();
