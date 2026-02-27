const width = 580;
const radius = width / 6;

d3.json("data/theories.json").then(rawData => {

    // ──── Layer 1: Build hierarchy ────
    const root = d3.hierarchy(rawData)
        .sum(d => d.children ? 0 : 1)
        .sort((a, b) => b.value - a.value);

        
        d3.partition()
        .size([2 * Math.PI, root.height + 1])
        (root);

        console.log("root", root);
        
    root.each(d => d.current = d);

    // ──── Layer 2: Color scale ────
    const theories = root.children.map(d => d.data.name);
    const pastelColors = [
        "#c6b4ef", "#f4b8c1", "#a8d8b9", "#f7d79a",
        "#9ac8eb", "#f2a2c4", "#b5e8d5", "#e8c3a0",
        "#d4a5e5"
    ];
    const colorScale = d3.scaleOrdinal()
        .domain(theories)
        .range(pastelColors);

    function getAncestor(d) {
        while (d.depth > 1) d = d.parent;
        return d;
    }

    function getShade(d) {
        const ancestor = getAncestor(d);
        if (d.depth === 0) return "#ddd";
        const base = d3.color(colorScale(ancestor.data.name));
        const depthRatio = d.depth / root.height;
        return base.brighter(depthRatio * 0.8).formatHex();
    }

    // ──── Layer 3: Arc generator ────
    // y values are depth levels (0, 1, 2…), multiplied by radius for pixel size
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    console.log("arc", arc);
    // ──── Layer 4: Render ────
    const breadcrumb = d3.select("#chart")
        .append("div")
        .attr("class", "breadcrumb");

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `${-width / 2} ${-width / 2} ${width} ${width}`)
        .attr("width", width)
        .attr("height", width)
        .style("font-family", "var(--font-body)");

    // Invisible circle covering the center — click to zoom out
    const parent = svg.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .style("cursor", "pointer")
        .on("click", (event, d) => clicked(event, d));

    const path = svg.append("g")
        .selectAll("path")
        .data(root.descendants().filter(d => d.depth))
        .join("path")
        .attr("fill", d => getShade(d))
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current))
        .style("cursor", d => d.children ? "pointer" : "default")
        .on("click", (event, d) => d.children && clicked(event, d))
        .on("mouseenter", (event, d) => {
            const chain = d.ancestors().reverse().slice(1).map(a => a.data.name);
            breadcrumb.html(chain.join(" <span>›</span> "));
        })
        .on("mouseleave", () => {
            breadcrumb.html("");
        });

    path.append("title")
        .text(d => {
            const chain = d.ancestors().reverse().map(a => a.data.name).join(" → ");
            return d.data.year ? `${chain} (${d.data.year})` : chain;
        });

    const MAX_CHARS = 16;
    const MAX_LINES = 2;

    function truncate(str, max) {
        return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
    }

    function wrapText(selection) {
        selection.each(function(d) {
            const text = d3.select(this);
            const name = d.data.name;
            text.text(null);

            if (name.length <= MAX_CHARS) {
                text.append("tspan").attr("x", 0).attr("dy", "0.35em").text(name);
                return;
            }

            const words = name.split(/\s+/);
            const lines = [];
            let line = "";

            words.forEach(word => {
                const test = line ? `${line} ${word}` : word;
                if (test.length > MAX_CHARS && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = test;
                }
            });
            if (line) lines.push(line);

            const capped = lines.slice(0, MAX_LINES);
            if (lines.length > MAX_LINES) {
                capped[MAX_LINES - 1] = truncate(capped[MAX_LINES - 1], MAX_CHARS);
            }
            capped.forEach((l, i) => {
                capped[i] = truncate(l, MAX_CHARS);
            });

            const startDy = -0.35 * (capped.length - 1);
            capped.forEach((l, i) => {
                text.append("tspan")
                    .attr("x", 0)
                    .attr("dy", i === 0 ? `${startDy}em` : "1em")
                    .text(l);
            });
        });
    }

    const label = svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants().filter(d => d.depth))
        .join("text")
        .attr("class", d => {
            if (d.depth === 1) return "label label--theory";
            if (!d.children) return "label label--book";
            return "label";
        })
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .call(wrapText);

    // Center label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .attr("fill", "var(--color-text-muted)")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .text("Feminist");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.1em")
        .attr("fill", "var(--color-text-muted)")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .text("Thought");

    // ──── Zoom interaction ────
    function clicked(event, p) {
        parent.datum(p.parent || root);

        root.each(d => {
            d.target = {
                x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth)
            };
        });

        const t = svg.transition().duration(750);

        path.transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function(d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
            .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => arc(d.current));

        label.transition(t)
            .filter(function(d) {
                return +this.getAttribute("fill-opacity") || labelVisible(d.target);
            })
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
});
