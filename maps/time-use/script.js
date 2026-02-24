const WIDTH = 500;
const HEIGHT = 360;
const HG_WIDTH = 120;
const HG_HEIGHT = 280;
const GAP = 80;

const CATEGORIES = ["unpaid_work", "paid_work", "personal_care", "leisure", "other"];

function hourglassPath(w, h) {
    const hw = w / 2;
    const hh = h / 2;
    const neck = w * 0.08;
    const cp = h * 0.35;
    return `
        M ${-hw} ${-hh}
        L ${hw} ${-hh}
        C ${hw} ${-hh + cp}, ${neck} ${-neck}, ${neck} 0
        C ${neck} ${neck}, ${hw} ${hh - cp}, ${hw} ${hh}
        L ${-hw} ${hh}
        C ${-hw} ${hh - cp}, ${-neck} ${neck}, ${-neck} 0
        C ${-neck} ${-neck}, ${-hw} ${-hh + cp}, ${-hw} ${-hh}
        Z
    `;
}

let fillScale;
const centerYOffset = HEIGHT / 2 + 10;

function fillY(minutes) {
    const frac = fillScale(minutes);
    return centerYOffset + HG_HEIGHT / 2 - frac * HG_HEIGHT;
}

function fillH(minutes) {
    const frac = fillScale(minutes);
    return frac * HG_HEIGHT;
}


d3.csv("data/time-use.csv", d3.autoType).then(data => {
    const byCountry = new Map();
    data.forEach(d => {
        if (!byCountry.has(d.country)) byCountry.set(d.country, {});
        byCountry.get(d.country)[d.gender] = d;
    });

    const countries = Array.from(byCountry.keys()).sort();

    const averages = {};
    ["men", "women"].forEach(gender => {
        const rows = data.filter(d => d.gender === gender);
        averages[gender] = {};
        CATEGORIES.forEach(cat => {
            averages[gender][cat] = d3.mean(rows, d => d[cat]);
        });
    });

    const maxMinutes = d3.max(CATEGORIES.map(cat =>
        d3.max(data, d => d[cat])
    ));

    fillScale = d3.scaleLinear()
        .domain([0, maxMinutes])
        .range([0, 1])
        .clamp(true);

    const outline = hourglassPath(HG_WIDTH, HG_HEIGHT);

    CATEGORIES.forEach((category, catIdx) => {
        const section = d3.select(`.category-section[data-category="${category}"]`);
        const list = section.select(".country-list");

        list.append("div")
            .attr("class", "country-item is-active")
            .attr("data-country", "__average__")
            .text("All Countries")
            .on("mouseenter", function () {
                updateSection(section, category, null);
            });

        countries.forEach(country => {
            list.append("div")
                .attr("class", "country-item")
                .attr("data-country", country)
                .text(country)
                .on("mouseenter", function () {
                    updateSection(section, category, country);
                });
        });

        const container = section.select(".hourglass-container");
        const svg = container.append("svg")
            .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const womenX = WIDTH / 2 - GAP / 2 - HG_WIDTH / 2;
        const menX = WIDTH / 2 + GAP / 2 + HG_WIDTH / 2;
        const centerY = HEIGHT / 2 + 10;

        const maskIdW = `mask-w-${catIdx}`;
        const maskIdM = `mask-m-${catIdx}`;

        const defs = svg.append("defs");
        defs.append("mask")
            .attr("id", maskIdW)
            .append("path")
            .attr("d", outline)
            .attr("fill", "white")
            .attr("transform", `translate(${womenX}, ${centerY})`);
        defs.append("mask")
            .attr("id", maskIdM)
            .append("path")
            .attr("d", outline)
            .attr("fill", "white")
            .attr("transform", `translate(${menX}, ${centerY})`);

        // Women fill — masked by hourglass shape
        svg.append("rect")
            .attr("class", "hourglass-fill hourglass-fill-women")
            .attr("mask", `url(#${maskIdW})`)
            .attr("x", womenX - HG_WIDTH / 2)
            .attr("width", HG_WIDTH)
            .attr("y", centerY + HG_HEIGHT / 2)
            .attr("height", 0);

        // Men fill — masked by hourglass shape
        svg.append("rect")
            .attr("class", "hourglass-fill hourglass-fill-men")
            .attr("mask", `url(#${maskIdM})`)
            .attr("x", menX - HG_WIDTH / 2)
            .attr("width", HG_WIDTH)
            .attr("y", centerY + HG_HEIGHT / 2)
            .attr("height", 0);

        // Women hourglass group — outline and label
        const gWomen = svg.append("g")
            .attr("class", "hourglass-group-women")
            .attr("transform", `translate(${womenX}, ${centerY})`);

        gWomen.append("path")
            .attr("class", "hourglass-outline")
            .attr("d", outline);

        gWomen.append("text")
            .attr("class", "hourglass-label")
            .attr("y", HG_HEIGHT / 2 + 24)
            .text("Women");

        // Men hourglass group — outline and label
        const gMen = svg.append("g")
            .attr("class", "hourglass-group-men")
            .attr("transform", `translate(${menX}, ${centerY})`);

        gMen.append("path")
            .attr("class", "hourglass-outline")
            .attr("d", outline);

        gMen.append("text")
            .attr("class", "hourglass-label")
            .attr("y", HG_HEIGHT / 2 + 24)
            .text("Men");

        // Set initial fill with the same function used for hover
        updateSection(section, category, null, false);
    });

    function updateSection(section, category, country, animate = true) {
        let wVal, mVal, label;

        if (!country) {
            wVal = averages.women[category];
            mVal = averages.men[category];
            label = "All Countries Average";
        } else {
            const cd = byCountry.get(country);
            wVal = cd.women[category];
            mVal = cd.men[category];
            label = country;
        }

        section.selectAll(".country-item").classed("is-active", false);
        const key = country || "__average__";
        section.select(`.country-item[data-country="${key}"]`).classed("is-active", true);

        const wY = fillY(wVal);
        const wH = fillH(wVal);
        const mY = fillY(mVal);
        const mH = fillH(mVal);

        const dur = animate ? 600 : 0;

        section.select(".hourglass-fill-women")
            .transition().duration(dur).ease(d3.easeCubicInOut)
            .attr("y", wY)
            .attr("height", wH);

        section.select(".hourglass-fill-men")
            .transition().duration(dur).ease(d3.easeCubicInOut)
            .attr("y", mY)
            .attr("height", mH);

        section.select(".val-women").text(Math.round(wVal));
        section.select(".val-men").text(Math.round(mVal));
        section.select(".country-name-display").text(label);
    }

    // Intersection Observer for section activation
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            entry.target.classList.toggle("is-active", entry.isIntersecting);
        });
    }, { threshold: 0.3 });

    document.querySelectorAll(".category-section").forEach(section => {
        observer.observe(section);
    });
});
