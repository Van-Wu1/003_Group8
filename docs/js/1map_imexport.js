import mapboxgl from 'mapbox-gl';
import { tradeData } from '../data/clean/trade_data';

// create tooltip
const tooltip = document.createElement('div');
tooltip.className = 'tooltip';
tooltip.style.position = 'absolute';
tooltip.style.background = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = '#fff';
tooltip.style.padding = '5px';
tooltip.style.borderRadius = '3px';
tooltip.style.pointerEvents = 'none';
tooltip.style.opacity = 0;
document.body.appendChild(tooltip);

// mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoidmFuMTEyMDEwMTZ3dSIsImEiOiJjbTd1b2JodnMwMmV1MmpzYTlhcXJxNWJ1In0.PC95-6c3OQtSQoxlvNAWOA';

const map1 = new mapboxgl.Map({
    container: 'map1',
    style: 'mapbox://styles/van11201016wu/cmaicl244001t01s90chs5mfb',
    center: [10, 30],
    zoom: 0.8
});

// map1.setMinZoom(0.78);
// map1.setMaxZoom(3);

// 7-class RdYlGn 色带
const colorStops = ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];
// const colorStops = ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'];


function getColorForValue(value, min, max) {
    if (value === undefined || value === null) return '#ccc';
    const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
    if (ratio < 0.14) return colorStops[0];
    if (ratio < 0.28) return colorStops[1];
    if (ratio < 0.42) return colorStops[2];
    if (ratio < 0.56) return colorStops[3];
    if (ratio < 0.7) return colorStops[4];
    if (ratio < 0.84) return colorStops[5];
    return colorStops[6];
}

map1.on('load', function () {
    // 加载国家矢量切片
    map1.addSource('countries', {
        'type': 'vector',
        'url': 'mapbox://mapbox.country-boundaries-v1'
    });

    map1.addLayer({
        'id': 'country-fills',
        'type': 'fill',
        'source': 'countries',
        'source-layer': 'country_boundaries',
        'paint': {
            'fill-color': '#FFFFFF',
            'fill-opacity': 0.7
        }
    });

    map1.addLayer({
        'id': 'country-borders',
        'type': 'line',
        'source': 'countries',
        'source-layer': 'country_boundaries',
        'paint': {
            'line-color': '#000',
            'line-width': 0.5
        }
    });

    map1.addLayer({
        id: 'country-hover',
        type: 'line',
        source: 'countries',
        'source-layer': 'country_boundaries',
        paint: {
            'line-color': '#ff0000',
            'line-width': 1.5
        },
        filter: ['==', 'iso_3166_1_alpha_3', '']
    });

    map1.once('idle', function() {
    const features = map1.querySourceFeatures('countries', { sourceLayer: 'country_boundaries' });
    features.forEach(feature => {
        const iso = feature.properties.iso_3166_1_alpha_3;
        const name = feature.properties.name_en;
        if (tradeData[iso]) {
            tradeData[iso].name = name;
        }
    });

    // 初始化
    updateMapColors('total');
    updateD3Treemap('total');
    updatePieChart('GLOBAL');

    // 绑定滑条
    const slider = document.getElementById('projectionToggle');
    const labels = document.querySelectorAll('.labels span');
    let selectedCountry = null;

    slider.addEventListener('input', function () {
        const value = parseInt(slider.value);
        labels.forEach((label, index) => {
            label.style.fontWeight = (index === value) ? 'bold' : 'normal';
            label.style.color = (index === value) ? '#333' : '#888';
        });

        let field = 'total';
        if (value === 1) field = 'import';
        if (value === 2) field = 'export';

        updateMapColors(field);
        updateD3Treemap(field);
        updatePieChart(selectedCountry || 'GLOBAL');
    });
});

    // ---------- Hover 刷新轮廓 ----------
    let selectedCountry = null;

    map1.on('mousemove', 'country-fills', function (e) {
        if (!selectedCountry) {
            const isoCode = e.features[0].properties.iso_3166_1_alpha_3;
            map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', isoCode]);
        }
    });

    map1.on('mouseleave', 'country-fills', function () {
        if (!selectedCountry) {
            map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', '']);
        }
    });

    // ---------- 点击锁定国家 ----------
    map1.on('click', 'country-fills', function (e) {
        const isoCode = e.features[0].properties.iso_3166_1_alpha_3;
        selectedCountry = isoCode;
        map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', isoCode]);
        updatePieChart(isoCode);
    });

    // ---------- 点击地图空白处清除锁定 ----------
    map1.on('click', function (e) {
        const features = map1.queryRenderedFeatures(e.point, { layers: ['country-fills'] });
        if (!features.length) {
            selectedCountry = null;
            map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', '']);
            updatePieChart('GLOBAL');
        }
    });
});


// -----Function Section-----
// 热力图的function
function updateMapColors(field) {
    const values = Object.values(tradeData).map(d => d[field]).filter(v => typeof v === 'number');
    if (values.length === 0) return;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[Math.floor(sorted.length * 0.98)]; // 98% 分位数（可以写进方法论）

    const colorMatch = ['match', ['get', 'iso_3166_1_alpha_3']];
    for (const iso in tradeData) {
        const val = tradeData[iso]?.[field];
        colorMatch.push(iso, getColorForValue(val, min, max));
    }
    colorMatch.push('#ccc');
    map1.setPaintProperty('country-fills', 'fill-color', colorMatch);
}

// 滑块移动--rank的柱状图的function
// function updateBarChart(field) {
//     const barContainer = document.querySelector('.barcontent');
//     if (!barContainer) return;

//     barContainer.innerHTML = '';

//     // 提取数据并排序
//     const sortedData = Object.entries(tradeData)
//         .map(([iso, data]) => ({
//             iso,
//            name: data.name || iso,
//            value: typeof data[field] === 'number' ? data[field] : 0
//        }))
//         .sort((a, b) => b.value - a.value)
//         .slice(0, 10); // 前10名

//     // 最大值
//     const maxValue = sortedData[0]?.value || 1;

//     // 创建柱状图元素
//     sortedData.forEach(item => {
//         const barRow = document.createElement('div');
//         barRow.className = 'bar-row';
    
//         const label = document.createElement('div');
//         label.className = 'bar-label';
//         label.textContent = item.name;
    
//         const bar = document.createElement('div');
//         bar.className = 'bar-bar';
//         bar.style.width = `${(item.value / maxValue) * 100}%`;
    
//         const value = document.createElement('div');
//         value.className = 'bar-value';
//         value.textContent = (item.value / 1e8).toFixed(2);
    
//         bar.appendChild(value);
    
//         barRow.appendChild(label);
//         barRow.appendChild(bar);
//         barContainer.appendChild(barRow);
//     });    
// }

// 矩形树图
function updateD3Treemap(field) {
    const data = Object.entries(tradeData)
        .map(([iso, d]) => ({
            iso,
            name: d.name || iso,  // 用全称（来自 Mapbox），没有就用 ISO
            value: typeof d[field] === 'number' ? d[field] : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const container = document.querySelector('.treecontent');
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select("#d3-treemap")
        .attr("width", width)
        .attr("height", height);

    svg.selectAll("*").remove();  // 清空旧图形

    const root = d3.hierarchy({ children: data })
        .sum(d => d.value);

    d3.treemap()
        .size([width, height])
        .padding(2)(root);

    const color = d3.scaleSequential([0, d3.max(data, d => d.value)], d3.interpolateBlues);

    const nodes = svg.selectAll("g")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodes.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => color(d.value));

    nodes.append("text")
        .attr("x", 4)
        .attr("y", 14)
        .text(d => d.data.name)
        .attr("font-size", "10px")
        .attr("fill", "white");

    nodes.append("text")
        .attr("x", 4)
        .attr("y", 28)
        .text(d => (d.data.value / 1e8).toFixed(2))
        .attr("font-size", "10px")
        .attr("fill", "white");

    nodes.append("title")
        .text(d => `${d.data.name}: ${(d.data.value / 1e8).toFixed(2)}`);
}


//饼图的function
let pieChartInstance = null;
let globalSummary = null;

function computeGlobalSummary() {
    let totalImport = 0;
    let totalExport = 0;
    Object.values(tradeData).forEach(d => {
        if (typeof d.import === 'number') totalImport += d.import;
        if (typeof d.export === 'number') totalExport += d.export;
    });
    return { import: totalImport, export: totalExport };
}

function initGlobalSummary() {
    if (!globalSummary) {
        globalSummary = computeGlobalSummary();
    }
}

function updatePieChart(isoCode = 'GLOBAL') {
    const pieContainer = document.querySelector('.piecontent');
    if (!pieContainer) return;

    pieContainer.innerHTML = `
        <canvas id="pieChart" width="160" height="160" style="max-width: 100%;"></canvas>
        <p class="pie-label"></p>
    `;
    const ctx = document.getElementById('pieChart').getContext('2d');
    const labelEl = pieContainer.querySelector('.pie-label');

    let importValue, exportValue;
    let label = 'Global';

    if (isoCode === 'GLOBAL') {
        initGlobalSummary();
        importValue = globalSummary.import;
        exportValue = globalSummary.export;
    } else {
        const countryData = tradeData[isoCode] || { import: 0, export: 0 };
        importValue = countryData.import || 0;
        exportValue = countryData.export || 0;
        label = countryData.name || isoCode;
    }

    const total = importValue + exportValue;
    const importPercent = total ? ((importValue / total) * 100).toFixed(1) : 0;
    const exportPercent = total ? ((exportValue / total) * 100).toFixed(1) : 0;

    labelEl.textContent = `Import ${importPercent}% · Export ${exportPercent}%`;

    const chartData = {
        labels: ['Import', 'Export'],
        datasets: [{
            data: [importValue, exportValue],
            backgroundColor: ['rgb(95, 191, 255)', 'rgb(34, 0, 255)']
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: {
                display: false  // 不在图中显示文字
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const value = (context.raw / 1e8).toFixed(2);
                        const percent = total ? ((context.raw / total) * 100).toFixed(1) : 0;
                        return `${context.label}: ${value} (${percent}%)`;
                    }
                }
            },
            title: {
                display: true,
                text: `${label} Import / Export`,
                font: {
                    size: 16
                },
                padding: {
                    top: 5,
                    bottom: 8
                },
                align: 'center'
            }
        }
    };

    if (pieChartInstance) {
        pieChartInstance.destroy();
    }
    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: chartOptions,
        plugins: [ChartDataLabels]
    });
}
