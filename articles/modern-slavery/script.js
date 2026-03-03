(function () {
    const TOTAL_DOTS = 10000;
    const WOMEN_COUNT = Math.round(TOTAL_DOTS * 0.71);
    const MEN_COUNT = TOTAL_DOTS - WOMEN_COUNT;
    const DOT_RADIUS = 1.8;
    const BASE_SPEED = 0.3;
    const FRICTION = 0.96;
    const MIN_SPEED = 0.15;

    const COLOR_WOMEN = [232, 160, 191];
    const COLOR_MEN = [126, 184, 218];
    const COLOR_HIGHLIGHT = [255, 220, 120];

    const PALETTE = [
        [230, 180, 120], [200, 140, 100], [160, 120, 90],
        [210, 170, 160], [180, 160, 200], [140, 190, 180],
        [190, 210, 160], [220, 200, 140], [170, 140, 160],
        [140, 170, 200], [200, 160, 130], [180, 200, 190],
    ];

    const WORLD_IDS = {
        "032": "argentina", "724": "spain",
        "504": "morocco", "116": "cambodia"
    };

    const SHAPE_NAMES = {
        argentina: "Argentina", spain: "Spain",
        morocco: "Morocco", cambodia: "Cambodia",
        california: "California", "va-md": "Virginia &\nMaryland"
    };

    const GENDER_PAIRS = {
        "morocco-cambodia": { women: "morocco", men: "cambodia" },
        "california-vamd": { women: "california", men: "va-md" }
    };

    const HISTORY_HIGHLIGHTS = {
        "history-slavery": Math.round(12500000 / 5000),
        "history-holocaust": Math.round(17000000 / 5000),
        "history-ww2": TOTAL_DOTS
    };

    const canvas = document.getElementById("viz");
    const ctx = canvas.getContext("2d");

    let width, height, dpr;
    let dots = [];
    let currentStep = "hero";
    let shapeMode = null;
    let activeLabels = [];
    let colorBlend = 0;
    let colorBlendTarget = 0;
    let highlightCount = 0;
    let highlightTarget = 0;

    let shapeFeatures = {};
    let shapeTargets = {};
    let shapeLabelPos = {};
    let circleTargets = [];

    let simulation;

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
                color,
                genderColor: i < WOMEN_COUNT ? COLOR_WOMEN : COLOR_MEN,
                tx: undefined,
                ty: undefined
            });
        }
    }

    // ── Generate circle targets (planet shape) ──
    function computeCircleTargets() {
        const cx = width > 768 ? width * 0.65 : width * 0.5;
        const cy = height * 0.5;
        const radius = Math.min(width, height) * (width > 768 ? 0.35 : 0.3);

        circleTargets = [];
        for (let i = 0; i < TOTAL_DOTS; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = radius * Math.sqrt(Math.random());
            circleTargets.push({
                x: cx + Math.cos(a) * r,
                y: cy + Math.sin(a) * r
            });
        }
    }

    // ── Load TopoJSON (world + US states) ───────
    async function loadData() {
        const [world, us] = await Promise.all([
            d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
            d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
        ]);

        const worldFeatures = topojson.feature(world, world.objects.countries).features;
        for (const f of worldFeatures) {
            const name = WORLD_IDS[f.id];
            if (name) shapeFeatures[name] = f;
        }

        const caGeo = us.objects.states.geometries.find(g => g.id === "06");
        shapeFeatures.california = topojson.feature(us, caGeo);

        const vaGeo = us.objects.states.geometries.find(g => g.id === "51");
        const mdGeo = us.objects.states.geometries.find(g => g.id === "24");
        const merged = topojson.merge(us, [vaGeo, mdGeo]);
        shapeFeatures["va-md"] = { type: "Feature", geometry: merged, properties: {} };

        computeAllTargets();
    }

    // ── Generate random points inside a shape ───
    function generateTargets(feature, count, bounds) {
        const projection = d3.geoMercator().fitExtent(bounds, feature);
        const [[lonMin, latMin], [lonMax, latMax]] = d3.geoBounds(feature);

        const points = [];
        while (points.length < count) {
            const lon = lonMin + Math.random() * (lonMax - lonMin);
            const lat = latMin + Math.random() * (latMax - latMin);
            if (d3.geoContains(feature, [lon, lat])) {
                const [px, py] = projection([lon, lat]);
                points.push({ x: px, y: py });
            }
        }

        const [cx, cy] = projection(d3.geoCentroid(feature));
        return { points, labelPos: { x: cx, y: cy } };
    }

    function computeAllTargets() {
        const mobile = width <= 768;
        const singleBounds = mobile
            ? [[width * 0.05, height * 0.15], [width * 0.95, height * 0.85]]
            : [[width * 0.42, height * 0.06], [width * 0.94, height * 0.94]];
        const leftBounds = mobile
            ? [[width * 0.05, height * 0.05], [width * 0.95, height * 0.45]]
            : [[width * 0.04, height * 0.06], [width * 0.46, height * 0.92]];
        const rightBounds = mobile
            ? [[width * 0.05, height * 0.55], [width * 0.95, height * 0.95]]
            : [[width * 0.54, height * 0.06], [width * 0.96, height * 0.92]];

        for (const name of ["argentina", "spain"]) {
            if (!shapeFeatures[name]) continue;
            const r = generateTargets(shapeFeatures[name], TOTAL_DOTS, singleBounds);
            shapeTargets[name] = r.points;
            shapeLabelPos[name] = r.labelPos;
        }

        for (const name of ["morocco", "california"]) {
            if (!shapeFeatures[name]) continue;
            const r = generateTargets(shapeFeatures[name], WOMEN_COUNT, leftBounds);
            shapeTargets[name] = r.points;
            shapeLabelPos[name] = r.labelPos;
        }

        for (const name of ["cambodia", "va-md"]) {
            if (!shapeFeatures[name]) continue;
            const r = generateTargets(shapeFeatures[name], MEN_COUNT, rightBounds);
            shapeTargets[name] = r.points;
            shapeLabelPos[name] = r.labelPos;
        }

        computeCircleTargets();
    }

    // ── Single-country shape targeting ──────────
    function setSingleShape(country) {
        shapeMode = country;
        activeLabels = [country];
        const targets = shapeTargets[country];
        if (!targets) return;

        for (let i = 0; i < dots.length; i++) {
            dots[i].tx = targets[i].x;
            dots[i].ty = targets[i].y;
        }
        startSimulation();
    }

    // ── Gender pair shape targeting ─────────────
    function setGenderPair(pairKey) {
        const pair = GENDER_PAIRS[pairKey];
        if (!pair) return;
        shapeMode = pairKey;
        activeLabels = [pair.women, pair.men];

        const wt = shapeTargets[pair.women];
        const mt = shapeTargets[pair.men];
        if (!wt || !mt) return;

        for (let i = 0; i < dots.length; i++) {
            if (i < WOMEN_COUNT) {
                dots[i].tx = wt[i].x;
                dots[i].ty = wt[i].y;
            } else {
                dots[i].tx = mt[i - WOMEN_COUNT].x;
                dots[i].ty = mt[i - WOMEN_COUNT].y;
            }
        }
        startSimulation();
    }

    // ── Circle shape targeting ──────────────────
    function setCircleShape() {
        shapeMode = "circle";
        activeLabels = [];

        for (let i = 0; i < dots.length; i++) {
            dots[i].tx = circleTargets[i].x;
            dots[i].ty = circleTargets[i].y;
        }
        startSimulation();
    }

    function startSimulation() {
        simulation
            .nodes(dots)
            .force("x", d3.forceX(d => d.tx).strength(0.06))
            .force("y", d3.forceY(d => d.ty).strength(0.06))
            .alpha(1)
            .restart()
            .stop();
    }

    function clearTargets() {
        shapeMode = null;
        activeLabels = [];
        simulation.force("x", null).force("y", null).alpha(0);

        for (const d of dots) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            d.vx = (rx - d.x) * 0.06;
            d.vy = (ry - d.y) * 0.06;
            d.tx = undefined;
            d.ty = undefined;
        }
    }

    function resetDots() {
        for (const d of dots) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            d.vx = (rx - d.x) * 0.08;
            d.vy = (ry - d.y) * 0.08;
        }
    }

    // ── Manual drift (free-floating mode) ───────
    function driftDots() {
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
        const p = colorBlend;
        const hlCount = Math.round(highlightCount);
        const inHistoryMode = hlCount > 0;

        for (let i = 0; i < dots.length; i++) {
            const d = dots[i];
            const [r, g, b] = d.color;
            const [gr, gg, gb] = d.genderColor;

            let fr = r + (gr - r) * p;
            let fg = g + (gg - g) * p;
            let fb = b + (gb - b) * p;
            let alpha = d.opacity + boost;

            if (inHistoryMode) {
                if (i < hlCount) {
                    const [hr, hg, hb] = COLOR_HIGHLIGHT;
                    fr = fr + (hr - fr) * 0.7;
                    fg = fg + (hg - fg) * 0.7;
                    fb = fb + (hb - fb) * 0.7;
                    alpha = Math.max(alpha, 0.7);
                } else {
                    alpha *= 0.15;
                }
            }

            ctx.beginPath();
            ctx.arc(d.x, d.y, d.baseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${fr},${fg},${fb},${alpha})`;
            ctx.fill();
        }

        if (activeLabels.length > 0) {
            const fontSize = width > 768 ? Math.min(56, width * 0.035) : Math.min(40, width * 0.08);
            ctx.font = `600 ${fontSize}px 'Playfair Display', Georgia, serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "rgba(255, 255, 255, 0.75)";

            for (const key of activeLabels) {
                const pos = shapeLabelPos[key];
                if (!pos) continue;
                const name = SHAPE_NAMES[key] || key;
                const lines = name.split("\n");
                for (let li = 0; li < lines.length; li++) {
                    ctx.fillText(lines[li], pos.x, pos.y + li * (fontSize * 1.2));
                }
            }

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
        }
    }

    // ── Animation loop ──────────────────────────
    function tick() {
        colorBlend += (colorBlendTarget - colorBlend) * 0.025;
        highlightCount += (highlightTarget - highlightCount) * 0.04;

        if (shapeMode) {
            simulation.tick();
        } else {
            driftDots();
        }
        draw();
        requestAnimationFrame(tick);
    }

    // ── Handle step transitions ─────────────────
    function handleStep(step, direction) {
        currentStep = step;

        if (step === "argentina" || step === "spain") {
            colorBlendTarget = 0;
            highlightTarget = 0;
            setSingleShape(step);
        } else if (GENDER_PAIRS[step]) {
            colorBlendTarget = 1;
            highlightTarget = 0;
            setGenderPair(step);
        } else if (step === "gender-intro") {
            colorBlendTarget = 1;
            highlightTarget = 0;
            if (shapeMode) clearTargets();
        } else if (step === "history-intro") {
            colorBlendTarget = 0;
            highlightTarget = 0;
            setCircleShape();
        } else if (HISTORY_HIGHLIGHTS[step] !== undefined) {
            colorBlendTarget = 0;
            highlightTarget = HISTORY_HIGHLIGHTS[step];
            if (shapeMode !== "circle") setCircleShape();
        } else {
            colorBlendTarget = 0;
            highlightTarget = 0;
            if (shapeMode) clearTargets();
            if (step === "hero" && direction === "up") resetDots();
        }
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
                handleStep(element.dataset.step, direction);
                element.classList.add("is-active");
            })
            .onStepExit(({ element, direction }) => {
                if (direction === "up") {
                    element.classList.remove("is-active");
                }
            });

        window.addEventListener("resize", scroller.resize);
    }

    // ── Init ────────────────────────────────────
    async function init() {
        resize();
        createDots();
        computeCircleTargets();

        simulation = d3.forceSimulation()
            .velocityDecay(0.35)
            .alphaDecay(0.015)
            .stop();

        setupScrollama();
        requestAnimationFrame(tick);

        await loadData();

        window.addEventListener("resize", () => {
            resize();
            createDots();
            computeAllTargets();
            if (shapeMode === "circle") {
                setCircleShape();
            } else if (shapeMode && !GENDER_PAIRS[shapeMode]) {
                setSingleShape(shapeMode);
            } else if (GENDER_PAIRS[shapeMode]) {
                setGenderPair(shapeMode);
            }
        });

        document.querySelector('.step[data-step="hero"]').classList.add("is-active");
    }

    init();
})();
