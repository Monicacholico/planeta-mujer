// ── Name corrections: TopoJSON (Natural Earth) → WBL CSV (World Bank) ──
const topoNameToWblName = {
    "United States of America": "United States",
    "South Korea": "Korea, Rep.",
    "North Korea": "Korea, Dem. People's Rep.",
    "Russia": "Russian Federation",
    "Czech Republic": "Czechia",
    "Ivory Coast": "Côte d'Ivoire",
    "Republic of the Congo": "Congo, Rep.",
    "Democratic Republic of the Congo": "Congo, Dem. Rep.",
    "Tanzania": "Tanzania",
    "The Bahamas": "Bahamas, The",
    "Guinea Bissau": "Guinea-Bissau",
    "Equatorial Guinea": "Equatorial Guinea",
    "eSwatini": "Eswatini",
    "Republic of Serbia": "Serbia",
    "Macedonia": "North Macedonia",
    "East Timor": "Timor-Leste",
    "Myanmar": "Myanmar",
    "Laos": "Lao PDR",
    "Vietnam": "Vietnam",
    "Egypt": "Egypt, Arab Rep.",
    "Iran": "Iran, Islamic Rep.",
    "Syria": "Syrian Arab Republic",
    "Venezuela": "Venezuela, RB",
    "Yemen": "Yemen, Rep.",
    "Gambia": "Gambia, The",
    "Kyrgyzstan": "Kyrgyz Republic",
    "Slovakia": "Slovak Republic",
    "Brunei": "Brunei Darussalam",
    "Micronesia": "Micronesia, Fed. Sts.",
    "Bosnia and Herzegovina": "Bosnia and Herzegovina",
    "Dominican Republic": "Dominican Republic",
    "Trinidad and Tobago": "Trinidad and Tobago",
    "Solomon Islands": "Solomon Islands",
    "Puerto Rico": "Puerto Rico",
    "Western Sahara": "Western Sahara",
};


// ── Region assignment: assigns each country to a continent using its geographic centroid ──
function assignRegion(feature) {
    const [lng, lat] = d3.geoCentroid(feature);
    if (lng < -25) return "americas";
    if (lat > 35 && lng < 60) return "europe";
    if (lat <= 35 && lng < 60) return "africa";
    // Split Asia: South/Southeast vs East/Oceania
    if (lng >= 60 && lng < 120 && lat > -15) return "south-asia";
    return "east-asia";
}

const WIDTH = 960;
const HEIGHT = 520;

// ── Load data ──
Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    d3.csv("data/wbl-scores.csv", d3.autoType),
]).then(([world, data]) => {
    console.log("data", data)
    const countries = topojson.feature(world, world.objects.countries);
    console.log("world", world)
    console.log("countries", countries)
    const dataByName = new Map(data.map(d => [d.economy, d]));

    // Assign a region to every GeoJSON feature
    const featureRegion = new Map();
    countries.features.forEach(f => {
        featureRegion.set(f, assignRegion(f));
    });

    // ── Projection + path generator ──
    const projection = d3.geoNaturalEarth1()
        .fitSize([WIDTH, HEIGHT], countries);
    const path = d3.geoPath(projection);

    // ── SVG setup ──
    const svg = d3.select("#map-container")
        .append("svg")
        .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

    // All visual elements go inside a group so zoom transforms apply to everything
    const mapGroup = svg.append("g").attr("class", "map-group");

    // Draw country outlines
    mapGroup.selectAll("path.country")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path);

    // ── D3 Scales ──
    const sizeScale = d3.scaleSqrt()
        .domain([0, 100])
        .range([1, 12]);

    const colorScale = d3.scaleLinear()
        .domain([25, 60, 100])
        .range(["#e05555", "#f0c040", "#4ecb71"]);

    // ── Match features to WBL data → create bubble data ──
    const bubbles = countries.features
        .map(feature => {
            const topoName = feature.properties.name;
            const wblName = topoNameToWblName[topoName] || topoName;
            const row = dataByName.get(wblName);
            if (!row) return null;
            const [cx, cy] = path.centroid(feature);
            return { cx, cy, row, feature };
        })
        .filter(d => d && !isNaN(d.cx));

    bubbles.sort((a, b) => b.row.wbl_index - a.row.wbl_index);

    // Draw bubbles
    mapGroup.append("g")
        .attr("class", "bubbles-layer")
        .selectAll("circle")
        .data(bubbles)
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("cx", d => d.cx)
        .attr("cy", d => d.cy)
        .attr("r", d => sizeScale(d.row.wbl_index))
        .attr("fill", d => colorScale(d.row.wbl_index))
        .attr("opacity", 0.8)
        .on("mouseenter", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);

    // ── zoomToRegion: computes a bounding box for the region, then transforms the map group ──
    function zoomToRegion(regionName) {
        const features = regionName === "world"
            ? countries.features
            : countries.features.filter(f => featureRegion.get(f) === regionName);

        // Compute bounding box of the target features in projected (pixel) coordinates
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        features.forEach(f => {
            const [[fx0, fy0], [fx1, fy1]] = path.bounds(f);
            x0 = Math.min(x0, fx0);
            y0 = Math.min(y0, fy0);
            x1 = Math.max(x1, fx1);
            y1 = Math.max(y1, fy1);
        });

        const dx = x1 - x0;
        const dy = y1 - y0;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const padding = 1.3;
        const scale = padding * Math.min(WIDTH / dx, HEIGHT / dy);
        const tx = WIDTH / 2 - cx * scale;
        const ty = HEIGHT / 2 - cy * scale;

        mapGroup.transition()
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .attr("transform", `translate(${tx}, ${ty}) scale(${scale})`);

        mapGroup.selectAll(".bubble").transition()
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .attr("r", d => sizeScale(d.row.wbl_index) / scale)
            .attr("stroke-width", 0.4 / scale);

        mapGroup.selectAll(".country").transition()
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .attr("stroke-width", 0.4 / scale);
    }

    // ── Compute region stats and inject into step cards ──
    const regionBubbles = {
        world: bubbles,
        americas: bubbles.filter(d => featureRegion.get(d.feature) === "americas"),
        europe: bubbles.filter(d => featureRegion.get(d.feature) === "europe"),
        africa: bubbles.filter(d => featureRegion.get(d.feature) === "africa"),
        "south-asia": bubbles.filter(d => featureRegion.get(d.feature) === "south-asia"),
        "east-asia": bubbles.filter(d => featureRegion.get(d.feature) === "east-asia"),
    };

    Object.entries(regionBubbles).forEach(([region, rBubbles]) => {
        if (rBubbles.length === 0) return;
        const scores = rBubbles.map(d => d.row.wbl_index);
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        const best = rBubbles.reduce((a, b) => a.row.wbl_index > b.row.wbl_index ? a : b);
        const worst = rBubbles.reduce((a, b) => a.row.wbl_index < b.row.wbl_index ? a : b);

        const statsEl = document.querySelector(`.step[data-region="${region}"] .step-stats`);
        if (statsEl) {
            statsEl.innerHTML = `
                <div><span class="stat-label">Countries:</span> ${rBubbles.length}</div>
                <div><span class="stat-label">Avg score:</span> <span class="stat-value">${avg}</span></div>
                <div><span class="stat-label">Highest:</span> <span class="stat-best">${best.row.economy} (${best.row.wbl_index})</span></div>
                <div><span class="stat-label">Lowest:</span> <span class="stat-worst">${worst.row.economy} (${worst.row.wbl_index})</span></div>
            `;
        }
    });

    // ── Scrollama ──
    const scroller = scrollama();

    scroller
        .setup({
            step: ".step",
            offset: 0.5,
        })
        .onStepEnter((response) => {
            const region = response.element.dataset.region;

            // Highlight active step, dim others
            d3.selectAll(".step").classed("is-active", false);
            d3.select(response.element).classed("is-active", true);

            // Zoom map to the region
            zoomToRegion(region);
        });

    // Handle window resize: Scrollama needs to recalculate positions
    window.addEventListener("resize", scroller.resize);

    // ── Tooltip ──
    const tooltip = d3.select("#tooltip");

    function showTooltip(event, d) {
        const r = d.row;
        tooltip
            .html(`
                <div class="country-name">${r.economy}</div>
                <div>WBL Index: <span class="score">${r.wbl_index}</span></div>
                <div>Region: ${r.region}</div>
            `)
            .style("opacity", 1);
    }

    function moveTooltip(event) {
        tooltip
            .style("left", (event.clientX + 14) + "px")
            .style("top", (event.clientY - 10) + "px");
    }

    function hideTooltip() {
        tooltip.style("opacity", 0);
    }
});
