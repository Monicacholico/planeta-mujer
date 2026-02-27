const margin = { top: 30, right: 30, bottom: 50, left: 55 };
const width = 900 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

d3.csv("data/fertility-rate.csv", d3.autoType).then(data => {

    // ──── Layer 1: Scales ────
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.fertility_rate) + 0.5])
        .range([height, 0]);

    // ──── Layer 2: Shape generators (d3.shape!) ────
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.fertility_rate))
        .curve(d3.curveLinear);

    const area = d3.area()
        .x(d => xScale(d.year))
        .y0(height)
        .y1(d => yScale(d.fertility_rate))
        .curve(d3.curveLinear);

    // ──── Layer 3: Render ────
    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Grid lines
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-width)
            .tickFormat("")
        );

    // Area fill
    svg.append("path")
        .datum(data)
        .attr("class", "area")
        .attr("d", area);

    // The line
    svg.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);

    // Replacement level reference (2.1 births per woman)
    const replacementY = yScale(2.1);
    svg.append("line")
        .attr("class", "replacement-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", replacementY)
        .attr("y2", replacementY);

    svg.append("text")
        .attr("class", "replacement-label")
        .attr("x", width - 4)
        .attr("y", replacementY - 6)
        .attr("text-anchor", "end")
        .text("Replacement level (2.1)");

    // X axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale)
            .ticks(10)
            .tickFormat(d3.format("d"))
        );

    // Y axis
    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale)
            .ticks(6)
        );

    // Y axis label
    svg.append("text")
        .attr("class", "replacement-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("Births per woman");

    // ──── Annotations ────
    const events = [
        { year: 1960, text: "The contraceptive pill is approved in the US", side: "right" },
        { year: 1968, text: "UN declares family planning a human right", side: "right" },
        { year: 1974, text: "World Population Conference in Bucharest sets global targets", side: "left" },
        { year: 1979, text: "China introduces one-child policy", side: "right" },
        { year: 1994, text: "UN Cairo Conference redefines reproductive rights", side: "left" },
        { year: 2002, text: "Global rate falls below 2.7 — half of its 1960s peak", side: "right" },
        { year: 2015, text: "China ends one-child policy after 36 years", side: "left" },
    ];

    const annotations = svg.selectAll("g.annotation")
        .data(events)
        .join("g")
        .attr("class", "annotation");

    annotations.append("line")
        .attr("class", "annotation-line")
        .attr("x1", d => xScale(d.year))
        .attr("x2", d => xScale(d.year))
        .attr("y1", d => {
            const rate = data.find(p => p.year === d.year);
            return rate ? yScale(rate.fertility_rate) : 0;
        })
        .attr("y2", d => {
            const rate = data.find(p => p.year === d.year);
            return rate ? yScale(rate.fertility_rate) - 40 : 0;
        });

    annotations.append("circle")
        .attr("class", "annotation-dot")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => {
            const rate = data.find(p => p.year === d.year);
            return rate ? yScale(rate.fertility_rate) : 0;
        })
        .attr("r", 4);

    annotations.append("text")
        .attr("class", "annotation-text")
        .attr("x", d => xScale(d.year))
        .attr("y", d => {
            const rate = data.find(p => p.year === d.year);
            return rate ? yScale(rate.fertility_rate) - 46 : 0;
        })
        .attr("text-anchor", d => d.side === "left" ? "end" : "start")
        .attr("dx", d => d.side === "left" ? -6 : 6)
        .each(function(d) {
            const el = d3.select(this);
            const words = d.text.split(" ");
            const maxChars = 25;
            const lines = [];
            let current = "";

            words.forEach(word => {
                if ((current + " " + word).trim().length > maxChars) {
                    lines.push(current.trim());
                    current = word;
                } else {
                    current += " " + word;
                }
            });
            lines.push(current.trim());

            lines.forEach((lineText, i) => {
                el.append("tspan")
                    .attr("x", xScale(d.year))
                    .attr("dx", d.side === "left" ? -6 : 6)
                    .attr("dy", i === 0 ? 0 : "1.1em")
                    .text(lineText);
            });
        });

    // ──── Hover interaction ────
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip");

    const hoverLine = svg.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0)
        .attr("y2", height)
        .style("opacity", 0);

    const hoverCircle = svg.append("circle")
        .attr("class", "hover-circle")
        .attr("r", 5)
        .style("opacity", 0);

    const bisect = d3.bisector(d => d.year).left;

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mousemove", function(event) {
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
});
