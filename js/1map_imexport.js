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
    style: 'mapbox://styles/van11201016wu/cmabq2dt000lb01sd50i8cp8x',
    center: [0, 0],
    zoom: 0.78
});

map1.setMinZoom(0.78);
map1.setMaxZoom(3);

// 7-class RdYlGn 色带
const colorStops = ['#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'];

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

    // 轮廓高光
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

    // Tooltip
    const slider = document.getElementById('projectionToggle');
    const labels = document.querySelectorAll('.labels span');

    slider.addEventListener('input', function() {
        const value = parseInt(slider.value);
        labels.forEach((label, index) => {
            label.style.fontWeight = (index === value) ? 'bold' : 'normal';
            label.style.color = (index === value) ? '#333' : '#888';
        });
        let field = 'total';
        if (value === 1) field = 'import';
        if (value === 2) field = 'export';

        // function挂载
        updateMapColors(field);
        updateBarChart(field);
        updatePieChart(isoCode);

    });

    // 初始化先拉一次
    updateMapColors('total');
    updateBarChart('total');
    updatePieChart('GLOBAL');

    // -----hover刷新轮廓-----
    map1.on('mousemove', 'country-fills', function (e) {
        if (!selectedCountry) {
            map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', e.features[0].properties.iso_3166_1_alpha_3]);
        }
    });

    map1.on('mouseleave', 'country-fills', function () {
        if (!selectedCountry) {
            map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', '']);
        }
    });

    // -----点击锁死轮廓-----
    let selectedCountry = null;

    map1.on('click', 'country-fills', function (e) {
        const isoCode = e.features[0].properties.iso_3166_1_alpha_3;
        selectedCountry = isoCode;
    
        map1.setFilter('country-hover', ['==', 'iso_3166_1_alpha_3', isoCode]);
    
        updatePieChart(isoCode);
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
function updateBarChart(field) {
    const barContainer = document.querySelector('.barcontent');
    if (!barContainer) return;

    barContainer.innerHTML = '';

    // 提取数据并排序
    const sortedData = Object.entries(tradeData)
        .map(([iso, data]) => ({
            iso,
            name: data.name || iso,
            value: typeof data[field] === 'number' ? data[field] : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // 前10名

    // 最大值
    const maxValue = sortedData[0]?.value || 1;

    // 创建柱状图元素（先把css放在这里了，后续要拿出来;好的拿出来了）
    sortedData.forEach(item => {
        const barRow = document.createElement('div');
        barRow.className = 'bar-row';
    
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = item.name;
    
        const bar = document.createElement('div');
        bar.className = 'bar-bar';
        bar.style.width = `${(item.value / maxValue) * 100}%`;
    
        const value = document.createElement('div');
        value.className = 'bar-value';
        value.textContent = (item.value / 1e8).toFixed(2);
    
        barRow.appendChild(label);
        barRow.appendChild(bar);
        barRow.appendChild(value);
        barContainer.appendChild(barRow);
    });    
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

    // 清空
    pieContainer.innerHTML = '<canvas id="pieChart"></canvas>';
    const ctx = document.getElementById('pieChart').getContext('2d');

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

    const chartData = {
        labels: [`Import ${importPercent}%`, `Export ${exportPercent}%`],
        datasets: [{
            data: [importValue, exportValue],
            backgroundColor: ['rgb(95, 191, 255)', 'rgb(34, 0, 255)']
        }]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom'
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const value = (context.raw / 1e8).toFixed(2);
                        return `${context.label}: ${value}`;
                    }
                }
            },
            title: {
                display: true,
                text: `${label} Import / Export`
            }
        }
    };

    if (pieChartInstance) {
        pieChartInstance.destroy();
    }
    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: chartOptions
    });
}
