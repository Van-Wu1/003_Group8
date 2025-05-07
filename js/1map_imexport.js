// js/map.js

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
    zoom: 1.15
});

map1.setMinZoom(1.15);
map1.setMaxZoom(3);

map1.on('load', function () {
    // shp
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
            'fill-opacity': 0.3
        }
    });

    // line
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

    const colorScale = [
        '#ffffcc',
        '#c7e9b4',
        '#7fcdbb',
        '#41b6c4',
        '#1d91c0',
        '#225ea8', 
        '#0c2c84'
    ];
    
    // 分位数阈值？
    const thresholds = [89000000, 250000000, 690000000, 1900000000, 5500000000, 15000000000];
    
    const colorMatch = ['match', ['get', 'iso_3166_1_alpha_3']];
    
    for (const iso in tradeData) {
        const val = tradeData[iso]?.total;
        if (typeof val === 'number') {
            let idx = 0;
            while (idx < thresholds.length && val > thresholds[idx]) {
                idx++;
            }
            colorMatch.push(iso, colorScale[idx]);
        }
    }
    
    colorMatch.push('#ccc');
    
    // 设置颜色
    map1.setPaintProperty('country-fills', 'fill-color', colorMatch);
    
    
    // 监听
    map1.on('mousemove', 'country-fills', function (e) {
        const isoCode = e.features[0].properties.iso_3166_1_alpha_3;
        const countryName = e.features[0].properties.name_en;
        const trade = tradeData[isoCode] || { import: 'N/A', export: 'N/A' };
    
        // Convert it into units of "billion"
        const TotalValue = (typeof trade.total === 'number') ? (trade.total / 1e8).toFixed(2): 'N/A';
        const importValue = (typeof trade.import === 'number') ? (trade.import / 1e8).toFixed(2): 'N/A';
        const exportValue = (typeof trade.export === 'number') ? (trade.export / 1e8).toFixed(2): 'N/A';
    
        tooltip.style.opacity = 1;
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="country-name">${countryName} (${isoCode})</span>
            </div>
    
            <div class="tooltip-body-row">
                <div class="trade-block">
                    <div class="gdp-number">${TotalValue}</div>
                    <div class="label">Total Trade</div>
                </div>
                <div class="middle-block">
                    <div class="data-block">
                        <div class="number">${importValue}</div>
                        <div class="label">Import</div>
                    </div>
                    <div class="divider"></div>
                    <div class="data-block">
                        <div class="number">${exportValue}</div>
                        <div class="label">Export</div>
                    </div>
                </div>
            </div>

            <div class="tooltip-unit" style="margin-top:5px; font-size:10px; color:#ccc;">Unit: 100 million</div>
            `;
        tooltip.style.left = (e.originalEvent.pageX + 10) + 'px';
        tooltip.style.top = (e.originalEvent.pageY - 28) + 'px';
    });
    
    map1.on('mouseleave', 'country-fills', function () {
        tooltip.style.opacity = 0;
    });
    
    // projection switch
    const toggle = document.getElementById('projectionToggle');

    // toggle.addEventListener('change', (e) => {
    //     if (e.target.checked) {
    //         map1.setProjection('globe');
    //     } else {
    //         map1.setProjection('equirectangular');
    //     }
    // });
});


//legend
// 创建一个映射关系（isoCode -> totalValue）
const totalValueStops = Object.keys(tradeData).map(iso => {
    const value = tradeData[iso]?.total;
    // 正常化一下，避免 null/undefined
    return [iso, value ?? 0];
});

// 计算颜色分段 (你可以改色值)
const colors = [
    '#f2f0f7',
    '#cbc9e2',
    '#9e9ac8',
    '#756bb1',
    '#54278f'
];

const getColor = (value) => {
    if (value > 1000000000) return colors[4]; // > 10亿
    if (value > 500000000) return colors[3];  // 5-10亿
    if (value > 100000000) return colors[2];  // 1-5亿
    if (value > 10000000) return colors[1];   // 1000万-1亿
    return colors[0];                         // < 1000万
};

// 生成 match 表达式
const colorMatch = ['match', ['get', 'iso_3166_1_alpha_3']];
totalValueStops.forEach(([iso, val]) => {
    colorMatch.push(iso, getColor(val));
});
colorMatch.push('#eee'); // 默认色

// 更新填充图层颜色
map1.setPaintProperty('country-fills', 'fill-color', colorMatch);