
let currentIndex = 0;
let citybData = {};
let currentSimulation = null;

// Data Extraction and Processing
const funcMap = {
    'rd': 'R&D',
    'raw': 'API',
    'manu': 'Manufacturing',
    'pack': 'Packaging',
    'wholesale': 'Wholesale',
    'retail': 'Retail/Medical',
    'support': 'Support/Other'
};
// Extracting Urban Bubble Information for Targeted Functions
function extractFunctionBubbles(data, targetFunction, topN = 30) {
    const bubbles = [];

    for (const [city, info] of Object.entries(data)) {
        let count = 0;
        let lat = null, lng = null;

        for (const hq of info.hq_companies || []) {
            if (hq.function === targetFunction) {
                count++;
                lat = hq.lat;
                lng = hq.lng;
            }
        }

        for (const sub of info.subsidiaries || []) {
            if (sub.function === targetFunction) {
                count++;
                lat = sub.lat;
                lng = sub.lng;
            }
        }

        if (count > 0) {
            const totalCompanies = info.hq_count + info.subsidiary_count;
            const funcCount = info.sub_function_stats?.[targetFunction] || 0;
            const dominanceRatio = totalCompanies > 0 ? (funcCount / totalCompanies).toFixed(2) : '–';
            const isDominant = totalCompanies > 0 && funcCount / totalCompanies >= 0.5;

            bubbles.push({
                city,
                value: count,
                dominant: isDominant,
                dominanceRatio,
                lat,
                lng,
                rawInfo: info,
                x: Math.random() * 800,
                y: -Math.random() * 300 - 100,
                vx: 0,
                vy: 0
            });
        }
    }

    return bubbles.sort((a, b) => b.value - a.value).slice(0, topN);
}

// Calculate the statistical value of the functional structure of a city
function getFunctionStats(info) {
    const rolesRaw = info.sub_function_stats || {};
    const roles = Object.fromEntries(Object.entries(rolesRaw).filter(([k]) => k !== "Unclassified"));
    const total = Object.values(roles).reduce((a, b) => a + b, 0);
    if (total === 0) return null;

    const sorted = Object.entries(roles).sort((a, b) => b[1] - a[1]);
    const dominantRole = sorted[0][0];
    const dominantCount = sorted[0][1];
    const roleCount = sorted.length;
    const dominanceRatio = (dominantCount / total).toFixed(2);
    const entropy = -sorted.reduce((sum, [_, count]) => {
        const p = count / total;
        return sum + p * Math.log2(p);
    }, 0).toFixed(2);

    let classification = "Unclassified";
    if (roleCount === 1) classification = "Single-function City";
    else if (entropy < 1) classification = "Weakly Diversified";
    else classification = "Multi-functional City";

    return { dominantRole, roleCount, entropy, dominanceRatio, classification, total };
}

// Return to Functional Classification according to Functional Structure
function getFunctionCategory(info) {
    const stats = getFunctionStats(info);
    if (!stats) return "Unclassified";
    const { roleCount, dominanceRatio, entropy } = stats;
    if (roleCount === 1 || dominanceRatio >= 0.8) return "Single-function";
    if (roleCount >= 3 && entropy >= 1.0 && dominanceRatio <= 0.6) return "Multi-functional";
    return "Weakly Diversified";
}

// Visualization: Force Oriented Mapping
function drawForceGraph(bubbles) {
    const svg = d3.select("#bubbleChart");
    svg.selectAll("*").remove();

    const width = parseInt(svg.style("width"));
    const height = parseInt(svg.style("height"));

    // Add in-figure caption
    svg.append("text")
        .attr("x", 20)
        .attr("y", 26)
        .attr("fill", "#222")
        .attr("font-size", "0.95rem")
        .attr("font-weight", 600)

    if (window.currentSimulation) {
        window.currentSimulation.stop();
    }

    const cleanBubbles = bubbles.map(d => {
        const stats = getFunctionStats(d.rawInfo);
        return {
            ...d,
            r: Math.sqrt(d.value) * 4 + 5,
            functionStats: stats,
            functionCategory: getFunctionCategory(d.rawInfo),
            dominanceRatio: stats ? +stats.dominanceRatio : 0
        };
    });

    const cssVars = getComputedStyle(document.querySelector("#bubble_summary"));
    const colorStops = [
        cssVars.getPropertyValue('--deep-blue').trim(),
        cssVars.getPropertyValue('--mid-blue').trim(),
        cssVars.getPropertyValue('--light-blue').trim(),
        cssVars.getPropertyValue('--sky-blue').trim(),
        cssVars.getPropertyValue('--violet').trim(),
        cssVars.getPropertyValue('--pink').trim(),
        cssVars.getPropertyValue('--rose').trim()
    ];
    const colorScale = d3.scaleLinear()
        .domain(d3.range(0, 1.001, 1 / (colorStops.length - 1)))
        .range(colorStops)
        .clamp(true);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "8px")
        .style("font-size", "13px")
        .style("pointer-events", "none")
        .style("display", "none")
        .style("box-shadow", "0 4px 10px rgba(0,0,0,0.1)");

    const nodeGroup = svg.selectAll(".node")
        .data(cleanBubbles, d => d.city)
        .join("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }))
        .on("mouseover", (event, d) => {
            const stats = d.functionStats;
            tooltip.html(`
<strong>${d.city}</strong><br/>
Companies: ${d.value}<br/>
Dominant: ${stats?.dominantRole || '–'}<br/>
Classification: ${d.functionCategory}<br/>
Entropy: ${stats?.entropy}<br/>
Dominance Ratio: ${stats?.dominanceRatio}
`)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY + 12 + "px")
                .style("display", "block");
        })
        .on("mouseout", () => tooltip.style("display", "none"));

    nodeGroup.selectAll("path").data(d => [d])
        .join("path")
        .attr("d", d => {
            const r = d.r;
            const symbol = d3.symbol().size(r * r * 5);
            if (d.functionCategory === "Single-function") {
                symbol.type(d3.symbolTriangle);
            } else if (d.functionCategory === "Multi-functional") {
                symbol.type(d3.symbolCircle);
            } else if (d.functionCategory === "Weakly Diversified") {
                symbol.type(d3.symbolSquare);
            } else {
                symbol.type(d3.symbolDiamond);
            }
            return symbol();
        })
        .attr("fill", d => colorScale(+d.dominanceRatio))
        .attr("fill-opacity", 0.9)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);

    const simulation = d3.forceSimulation(cleanBubbles)
        .alpha(1)
        .alphaDecay(0.02)
        .velocityDecay(0.2) // Increased Damping
        .force("gravity", d3.forceY(height * 0.9).strength(0.008)) // Reducing the falling pull
        .force("x", d3.forceX(width / 2).strength(0.01))
        .force("collide", d3.forceCollide().radius(d => d.r + 1.5).iterations(2))
        .on("tick", () => {
            nodeGroup.attr("transform", d => {
                d.vy *= 0.98; // Manual friction resistance
                d.x = Math.max(d.r, Math.min(width - d.r, d.x));
                if (d.y + d.r > height) {
                    d.vy *= -0.3;
                    d.y = height - d.r;
                }
                return `translate(${d.x},${d.y})`;
            });
        });
    window.currentSimulation = simulation;
}

// Visualization: scatterplot (local/global ratio)
function drawFunctionCityScatter(data, targetFunction) {
    const container = d3.select(".pharma-matrix-area");
    container.selectAll("*").remove();

    const cityPoints = [];
    let globalTotal = 0;

    for (const [city, info] of Object.entries(data)) {
        const stats = info.sub_function_stats || {};
        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        const count = stats[targetFunction] || 0;
        if (count > 0 && total > 0) {
            globalTotal += count;
            cityPoints.push({
                city,
                count,
                localRatio: count / total,
                rawInfo: info
            });
        }
    }

    cityPoints.forEach(d => {
        d.globalRatio = d.count / globalTotal;
    });

    const width = 840;
    const height = 260;
    const margin = { top: 40, right: 40, bottom: 50, left: 60 };

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")  // center alignment
        .style("width", "100%")
        .style("height", "100%");


    const xScale = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([0, d3.max(cityPoints, d => d.globalRatio) * 1.1]).range([height - margin.bottom, margin.top]);
    const sizeScale = d3.scaleSqrt().domain([0, d3.max(cityPoints, d => d.count)]).range([4, 18]);

    const cssVars = getComputedStyle(document.querySelector("#bubble_summary"));
    const colorStops = [
        cssVars.getPropertyValue('--mid-blue').trim(),
        cssVars.getPropertyValue('--light-blue').trim(),
        cssVars.getPropertyValue('--sky-blue').trim(),
        cssVars.getPropertyValue('--violet').trim(),
        cssVars.getPropertyValue('--pink').trim(),
        cssVars.getPropertyValue('--rose').trim()
    ];
    const customInterpolator = d3.interpolateRgbBasis(colorStops);
    const colorScale = d3.scaleLinear()
        .domain([0, d3.max(cityPoints, d => d.globalRatio)])
        .range([0, 1])
        .clamp(true);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("display", "none");

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format(".0%")));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat(d3.format(".1%")));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .text("Local Dependency");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .text("Global Contribution");

    svg.selectAll("circle")
        .data(cityPoints)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.localRatio))
        .attr("cy", d => yScale(d.globalRatio))
        .attr("r", 0)
        .attr("fill", d => customInterpolator(colorScale(d.globalRatio)))
        .attr("opacity", 0.8)
        .on("mouseover", (event, d) => {
            tooltip.html(`
<strong>${d.city}</strong><br/>
Companies: ${d.count}<br/>
Local: ${(d.localRatio * 100).toFixed(1)}%<br/>
Global: ${(d.globalRatio * 100).toFixed(1)}%
`)
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY + 12 + "px")
                .style("display", "block");
        })
        .on("mouseout", () => tooltip.style("display", "none"))
        .transition()
        .duration(800)
        .attr("r", d => sizeScale(d.count));
}

let hasInteracted = false;

function updateWheel(highlight = true) {
    const container = document.querySelector('.wheel-container');
    const items = document.querySelectorAll('.wheel-item');

    // sliding effect
    const offset = -currentIndex * 100;
    container.style.transform = `translateY(${offset}px)`;

    items.forEach(item => item.classList.remove('highlight'));
    const currentItem = items[currentIndex];
    if (highlight && currentItem) {
        currentItem.classList.add('highlight');

        const func = currentItem.dataset.function;
        const fullFuncName = funcMap[func];
        if (fullFuncName) {
            const bubbles = extractFunctionBubbles(citybData, fullFuncName, 40);
            drawForceGraph(bubbles);
            drawFunctionCityScatter(citybData, fullFuncName);
        }
    }
}

function initControlledWheel() {
    const items = document.querySelectorAll('.wheel-item');
    const maxIndex = items.length - 1;

    // Disable default scrolling
    const wrapper = document.querySelector('.wheel-wrapper');
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.deltaY > 0 && currentIndex < maxIndex) {
            currentIndex++;
        } else if (e.deltaY < 0 && currentIndex > 0) {
            currentIndex--;
        }
        updateWheel();
    });

    // Click on an item to select it directly
    items.forEach((item, idx) => {
        item.addEventListener('click', () => {
            currentIndex = idx;
            updateWheel();
        });
    });

}

window.addEventListener('DOMContentLoaded', () => {

    fetch('data/city_function.json')
        .then(res => res.json())
        .then(json => {
            citybData = json;
            initControlledWheel();
            const defaultFunc = 'Manufacturing';
            const defaultBubbles = extractFunctionBubbles(citybData, defaultFunc, 40);
            drawForceGraph(defaultBubbles);
            drawFunctionCityScatter(citybData, defaultFunc);

            const funcMap = {
                'rd': 'R&D',
                'raw': 'API',
                'manu': 'Manufacturing',
                'pack': 'Packaging',
                'wholesale': 'Wholesale',
                'retail': 'Retail/Medical',
                'support': 'Support/Other'
            };

            document.querySelectorAll('.pharma-function-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const func = btn.dataset.function;
                    const fullFuncName = funcMap[func];
                    const bubbles = extractFunctionBubbles(citybData, fullFuncName, 40);
                    drawForceGraph(bubbles);
                    drawFunctionCityScatter(citybData, fullFuncName);

                    // Make the wheel-container automatically scroll to the corresponding item.
                    const targetItem = document.querySelector(`.wheel-item[data-function="${func}"]`);
                    if (targetItem) {
                        const container = document.querySelector('.wheel-container');
                        const scrollTarget = targetItem.offsetTop - container.clientHeight / 2 + targetItem.clientHeight / 2;
                        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });

                        setTimeout(() => {
                            highlightCenterItem(false);
                        }, 300); // Waiting for scrolling to complete to update highlight
                    }
                });
            });
        });
});