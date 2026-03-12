const margin = { top: 30, right: 30, bottom: 50, left: 55 };
const width = 900 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

const KEYFRAMES = [
    { at: 0.00, domain: [1960, 2023] },
    { at: 0.14, domain: [1958, 1972] },
    { at: 0.28, domain: [1968, 1982] },
    { at: 0.42, domain: [1976, 1990] },
    { at: 0.56, domain: [1988, 2002] },
    { at: 0.70, domain: [1998, 2012] },
    { at: 0.82, domain: [2008, 2024] },
    { at: 0.94, domain: [1960, 2023] },
];

const DECADES = [
    { label: "1960s", mid: 1965 },
    { label: "1970s", mid: 1975 },
    { label: "1980s", mid: 1985 },
    { label: "1990s", mid: 1995 },
    { label: "2000s", mid: 2005 },
    { label: "2010s", mid: 2015 },
];

function mapRange(x, a, b, c, d) {
    const val = ((x - a) * (d - c)) / (b - a) + c;
    if (c < d) return Math.min(Math.max(val, c), d);
    return Math.max(Math.min(val, c), d);
}

function lerpDomain(progress) {
    if (progress <= KEYFRAMES[0].at) return KEYFRAMES[0].domain;
    if (progress >= KEYFRAMES[KEYFRAMES.length - 1].at) return KEYFRAMES[KEYFRAMES.length - 1].domain;

    let i = 0;
    while (i < KEYFRAMES.length - 1 && KEYFRAMES[i + 1].at <= progress) i++;

    const kf0 = KEYFRAMES[i];
    const kf1 = KEYFRAMES[i + 1];
    const t = (progress - kf0.at) / (kf1.at - kf0.at);

    return [
        kf0.domain[0] + (kf1.domain[0] - kf0.domain[0]) * t,
        kf0.domain[1] + (kf1.domain[1] - kf0.domain[1]) * t,
    ];
}

const events = [
    { year: 1960, text: "The contraceptive pill\nis approved in the US", side: "right" },
    { year: 1968, text: "UN declares family\nplanning a human right", side: "right" },
    { year: 1974, text: "World Population Conference\nin Bucharest sets targets", side: "left" },
    { year: 1979, text: "China introduces\none-child policy", side: "right" },
    { year: 1994, text: "UN Cairo Conference redefines\nreproductive rights", side: "left" },
    { year: 2002, text: "Global rate falls below 2.7\n— half of its 1960s peak", side: "right" },
    { year: 2015, text: "China ends one-child\npolicy after 36 years", side: "left" },
];

d3.csv("data/fertility-rate.csv", d3.autoType).then(data => {

    const xScale = d3.scaleLinear()
        .domain([1960, 2023])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fertility_rate) + 0.5])
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.fertility_rate))
        .curve(d3.curveLinear);

    const area = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.fertility_rate))
        .curve(d3.curveLinear);

    // ──── SVG setup ────
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.append("defs")
        .append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    const chartArea = svg.append("g")
        .attr("clip-path", "url(#chart-clip)");

    // ──── Grid ────
    const gridGroup = svg.append("g").attr("class", "grid");
    gridGroup.call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(""));

    // ──── Decade labels (behind data) ────
    const decadeLabels = chartArea.selectAll("text.decade-label")
        .data(DECADES)
        .join("text")
        .attr("class", "decade-label")
        .attr("text-anchor", "middle")
        .attr("y", height * 0.45)
        .text(d => d.label);

    // ──── Area & line ────
    const areaPath = chartArea.append("path")
        .datum(data)
        .attr("class", "area")
        .attr("d", area);

    const linePath = chartArea.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);

    // ──── Replacement level ────
    const replacementY = yScale(2.1);
    const replacementLine = chartArea.append("line")
        .attr("class", "replacement-line")
        .attr("y1", replacementY)
        .attr("y2", replacementY);

    const replacementLabel = chartArea.append("text")
        .attr("class", "replacement-label")
        .attr("y", replacementY - 6)
        .attr("text-anchor", "end")
        .text("Replacement level (2.1)");

    // ──── X axis ────
    const xAxisGroup = svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`);

    // ──── Y axis ────
    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale).ticks(6));

    svg.append("text")
        .attr("class", "replacement-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("Births per woman");

    // ──── Annotations ────
    const annotations = chartArea.selectAll("g.annotation")
        .data(events)
        .join("g")
        .attr("class", "annotation");

    annotations.append("line")
        .attr("class", "annotation-line");

    annotations.append("circle")
        .attr("class", "annotation-dot")
        .attr("r", 4);

    annotations.each(function(d) {
        const g = d3.select(this);
        const lines = d.text.split("\n");

        const textEl = g.append("text")
            .attr("class", "annotation-text")
            .attr("text-anchor", d.side === "left" ? "end" : "start");

        lines.forEach((lineText, i) => {
            textEl.append("tspan")
                .attr("dx", d.side === "left" ? -6 : 6)
                .attr("dy", i === 0 ? 0 : "1.1em")
                .text(lineText);
        });
    });

    // ──── Hover interaction ────
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip");

    const hoverLine = chartArea.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0)
        .attr("y2", height)
        .style("opacity", 0);

    const hoverCircle = chartArea.append("circle")
        .attr("class", "hover-circle")
        .attr("r", 5)
        .style("opacity", 0);

    const bisect = d3.bisector(d => d.year).left;

    let hoverEnabled = true;

    window.addEventListener("scroll", () => {
        if (!hoverEnabled) return;
        hoverEnabled = false;
        hoverLine.style("opacity", 0);
        hoverCircle.style("opacity", 0);
        tooltip.style("opacity", 0);
    }, { passive: true });

    window.addEventListener("scrollend", () => { hoverEnabled = true; });
    window.addEventListener("pointerup", () => { hoverEnabled = true; });

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mousemove", function(event) {
            if (!hoverEnabled) return;
            const [mx] = d3.pointer(event);
            const year = xScale.invert(mx);
            const i = bisect(data, year, 1);
            const d0 = data[i - 1];
            const d1 = data[i];
            if (!d0 || !d1) return;
            const d = year - d0.year > d1.year - year ? d1 : d0;

            const cx = xScale(d.year);
            const cy = yScale(d.fertility_rate);

            hoverLine.attr("x1", cx).attr("x2", cx).style("opacity", 1);
            hoverCircle.attr("cx", cx).attr("cy", cy).style("opacity", 1);

            tooltip
                .style("opacity", 1)
                .html(`<span class="year">${d.year}</span><br><span class="value">${d.fertility_rate.toFixed(2)}</span> births per woman`)
                .style("left", `${event.pageX + 14}px`)
                .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", function() {
            hoverLine.style("opacity", 0);
            hoverCircle.style("opacity", 0);
            tooltip.style("opacity", 0);
        });

    // ──── Continuous scroll-driven update ────
    function updateChart(domainStart, domainEnd) {
        xScale.domain([domainStart, domainEnd]);

        linePath.attr("d", line);
        areaPath.attr("d", area);

        const span = domainEnd - domainStart;
        const tickInterval = span <= 20 ? 2 : span <= 40 ? 5 : 10;
        xAxisGroup.call(
            d3.axisBottom(xScale).ticks(span / tickInterval).tickFormat(d3.format("d"))
        );

        replacementLine
            .attr("x1", xScale(domainStart))
            .attr("x2", xScale(domainEnd));

        replacementLabel
            .attr("x", xScale(domainEnd) - 4);

        // Decade labels — fade out when domain is wide (labels get squeezed)
        const spanFade = span > 35 ? Math.max(0, 1 - (span - 35) / 20) : 1;

        decadeLabels.each(function(d) {
            const el = d3.select(this);
            const cx = xScale(d.mid);
            const domainCenter = (domainStart + domainEnd) / 2;
            const dist = Math.abs(d.mid - domainCenter) / span;
            const centerFade = Math.max(0, 1 - dist * 2.5);
            const inView = d.mid >= domainStart && d.mid <= domainEnd;

            el.attr("x", cx)
              .style("opacity", inView ? centerFade * spanFade : 0);
        });

        // Annotations
        annotations.each(function(d) {
            const g = d3.select(this);
            const inView = d.year >= domainStart && d.year <= domainEnd;
            const rate = data.find(p => p.year === d.year);
            if (!rate) return;

            const cx = xScale(d.year);
            const cy = yScale(rate.fertility_rate);

            g.style("opacity", inView ? 1 : 0);

            g.select(".annotation-line")
                .attr("x1", cx).attr("x2", cx)
                .attr("y1", cy).attr("y2", cy - 40);

            g.select(".annotation-dot")
                .attr("cx", cx).attr("cy", cy);

            const baseY = cy - 46;
            g.select(".annotation-text")
                .selectAll("tspan")
                .attr("x", cx)
                .each(function(_, i) {
                    if (i === 0) d3.select(this).attr("y", baseY);
                });
        });
    }

    // ──── Illustration stroke animation ────
    let illuPaths = [];
    let illuTotalLength = 0;

    fetch("rate-fertility-timeline.svg")
        .then(r => r.text())
        .then(svgText => {
            const wrap = document.getElementById("illustration-wrap");
            wrap.innerHTML = svgText;
            const originalPath = wrap.querySelector("path");
            if (!originalPath) return;

            const svgEl = wrap.querySelector("svg");
            const stroke = originalPath.getAttribute("stroke") || "#FFC0CB";
            const strokeWidth = originalPath.getAttribute("stroke-width") || "5";
            const dAttr = originalPath.getAttribute("d");

            const subpathStrings = dAttr.split(/(?=M)/);
            originalPath.remove();

            let cumulative = 0;
            illuPaths = subpathStrings.map(sub => {
                const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pathEl.setAttribute("d", sub.trim());
                pathEl.setAttribute("fill", "none");
                pathEl.setAttribute("stroke", stroke);
                pathEl.setAttribute("stroke-width", strokeWidth);
                svgEl.appendChild(pathEl);

                const len = pathEl.getTotalLength();
                pathEl.style.strokeDasharray = len;
                pathEl.style.strokeDashoffset = len;

                const entry = { el: pathEl, length: len, start: cumulative };
                cumulative += len;
                return entry;
            });

            illuTotalLength = cumulative;
        });

    // ──── rAF animation loop ────
    const scrollyEl = document.getElementById("scrolly");
    let animationId = null;
    let isAnimating = false;

    function animate() {
        const rect = scrollyEl.getBoundingClientRect();
        const scrollyTop = window.pageYOffset + rect.top;
        const scrollyHeight = scrollyEl.offsetHeight;
        const viewH = window.innerHeight;

        const scrollStart = scrollyTop;
        const scrollEnd = scrollyTop + scrollyHeight - viewH;
        const progress = mapRange(window.pageYOffset, scrollStart, scrollEnd, 0, 1);

        const [y0, y1] = lerpDomain(progress);
        updateChart(y0, y1);

        if (illuPaths.length) {
            const drawn = progress * illuTotalLength;
            for (let p = 0; p < illuPaths.length; p++) {
                const sub = illuPaths[p];
                const subDrawn = drawn - sub.start;
                if (subDrawn <= 0) {
                    sub.el.style.strokeDashoffset = sub.length;
                } else if (subDrawn >= sub.length) {
                    sub.el.style.strokeDashoffset = 0;
                } else {
                    sub.el.style.strokeDashoffset = sub.length - subDrawn;
                }
            }
        }

        if (isAnimating) {
            animationId = requestAnimationFrame(animate);
        }
    }

    // ──── IntersectionObserver to start/stop rAF ────
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!isAnimating) {
                        isAnimating = true;
                        animate();
                    }
                } else {
                    isAnimating = false;
                    if (animationId) {
                        cancelAnimationFrame(animationId);
                        animationId = null;
                    }
                }
            });
        },
        { threshold: 0 }
    );

    observer.observe(scrollyEl);

    // ──── Scrollama (cards only) ────
    const scroller = scrollama();

    scroller
        .setup({
            step: ".step",
            offset: 0.5,
        })
        .onStepEnter(({ element }) => {
            document.querySelectorAll(".step").forEach(el => el.classList.remove("is-active"));
            element.classList.add("is-active");
        });

    window.addEventListener("resize", scroller.resize);

    // Initial draw
    updateChart(1960, 2023);
});
