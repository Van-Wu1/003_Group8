let selectedCity = null;
let overlay;
let points;


mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

const map_re = new mapboxgl.Map({
    container: 'map_re',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-1.5, 52.5],
    zoom: 3.5,
    pitch: 55,
    bearing: 0,
    projection: 'mercator'
});

map_re.addControl(new mapboxgl.NavigationControl(), 'top-right');

fetch('./data/clean/City_level_resilience_data_FINAL_FIXED.geojson')
    .then(response => response.json())
    .then(data => {
        points = data.features.map(f => ({
            position: f.geometry.coordinates,
            resilienceIndex: f.properties.resilienceIndex,
            cluster: f.properties.Cluster,
            city: f.properties.City.trim(),
            MSCIoverall: f.properties.MSCIoverall,                 // ✅ 新增
            MSCIenvi: f.properties.MSCIenvi,
            MSCIsocial: f.properties.MSCIsocial,
            MSCIgovern: f.properties.MSCIgovern,
            operatingRevenue: f.properties["Operating revenue"],
            functionalDiversity: f.properties.functionalDiversity
        }));
        // 数据加载后先画一个空雷达图
drawRadarChart();

//top 5
        const top5 = points
            .sort((a, b) => b.resilienceIndex - a.resilienceIndex)
            .slice(0, 5);

        const ctx = document.getElementById('rankingChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top5.map(d => d.city),
                datasets: [{
                    label: 'Resilience Index',
                    data: top5.map(d => d.resilienceIndex),
                    backgroundColor: 'rgba(118, 167, 201, 0.8)',
                    barThickness: 30
                }]
            },
            options: {
                layout: { padding: { top: 0, bottom: 0 }},
                maintainAspectRatio: false,
                responsive: true,
                interaction: { mode: 'index' },
                scales: {
    x: {
        offset: true,
        border: { color: '#666', width: 1 },           // ✅ 改为深灰
        grid: { display: false },
        ticks: {
            drawTicks: true,
            color: '#333',                              // ✅ 改为深灰
            font: { family: 'Times New Roman', size: 10 },
            maxRotation: 0,
            minRotation: 0,
            padding: 5,
            callback: function(value) {
                const label = this.getLabelForValue(value);
                return label.split(' ');
            }
        }
    },
    y: {
        border: { color: '#666', width: 1 },           // ✅ 改为深灰
        grid: { display: false },
        beginAtZero: true,
        ticks: {
            drawTicks: true,
            color: '#666',                              // ✅ 改为深灰
            font: { family: 'Times New Roman', size: 10 },
            padding: 5
        }
    }
},
                plugins: {
                    legend: { position: 'bottom',
                        color: '#666',
                        labels: { padding: 0, font: { family: 'Times New Roman', size: 10 }}
                    },
                    title: {
                        display: true,
                        text: 'Top 5 cities in the resilience index',
                        font: { family: 'Times New Roman', size: 16 }
                    }
                }
            }
        });

        // ✅ 添加灰色基座 Layer
        const baseLayer = new deck.ColumnLayer({
            data: points,
            getPosition: d => d.position,
            getElevation: 5000,                          // ✅ 矮小基座
            getFillColor: [220, 220, 220, 180],         // ✅ 浅灰色
            radius: 22000,
            extruded: true,
            elevationScale: 1
        });

        // ✅ 添加原始柱子 Layer
        const mainLayer = new deck.ColumnLayer({
            data: points,
            getPosition: d => d.position,
            getElevation: d => d.resilienceIndex * 5000,
            getFillColor: d => {
                if (d.cluster === 2) return [158, 193, 207,180];
                if (d.cluster === 1) return [168, 213, 186,180];
                if (d.cluster === 0) return [203, 170, 203,180];
                return [200, 200, 200];
            },
            radius: 21000,
            extruded: true,
            elevationScale: 10
        });

        // ✅ 初始化地图
        overlay = new deck.MapboxOverlay({
            layers: [baseLayer, mainLayer]    // ✅ 先画基座，再画柱子
        });
        map_re.on('load', () => {
    map_re.addControl(overlay);
});

        // ✅ 城市下拉菜单
        const dropdown = document.getElementById('cityDropdown');
        const uniqueCities = [...new Set(points.map(p => p.city))].sort();
        uniqueCities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.text = city;
            dropdown.appendChild(option);
        });
        

        // ✅ 下拉菜单事件
        dropdown.addEventListener('change', (e) => {
            const selected = e.target.value.trim();
            selectedCity = selected;

            const cityData = points.find(p => p.city.trim() === selectedCity);
            if (cityData) {
                drawRadarChart(cityData);

                // ✅ 新增地图飞到该城市
                map_re.flyTo({
                    center: cityData.position,
                    zoom: 6,
                    speed: 1.2,
                    curve: 1.5,
                    easing: t => t
                });
            }
        });
    });

// ✅ 雷达图绘制函数
let radarChart;
function drawRadarChart(props) {
    props = props || {
        city: 'none',
        resilienceIndex: 0,
        MSCIoverall: 0,
        MSCIenvi: 0,
        MSCIsocial: 0,
        MSCIgovern: 0,
        operatingRevenue: 0,
        functionalDiversity: 0
    };


    const ctx = document.getElementById('radarChart').getContext('2d');
    if (!ctx) return;
    if (radarChart) radarChart.destroy();

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['ESG-overall',  'ESG-environmental','ESG-Social','ESG-governance','Operating Revenue', 'Functional Diversity'],
            datasets: [{
                label: props.city,
                data: [
                    props.MSCIoverall,
                    props.MSCIenvi,
                    props.MSCIsocial,
                    props.MSCIgovern,
                    props["operatingRevenue"] / 1500000,
                    props.functionalDiversity
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgb(124, 189, 232)',
                borderWidth: 2
            }]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            plugins: {legend: { display: false },
        title: {
        display: true,
        text: [`City: ${props.city}`, `Resilience Index: ${props.resilienceIndex.toFixed(2)}`],
        font: { family: 'Times New Roman', size: 18}
    }},
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 5 ,   // ✅ 你可以根据实际数据范围调整
                    pointLabels: {
                        font: { family: 'Times New Roman', size: 13 },
                        padding: 0},
                    ticks: {
                font: { family: 'Times New Roman'}
            }
                }
            }
        }
    });
}


document.getElementById('gotoComparison').addEventListener('click', () => {
    document.querySelector('.Section8').style.display = 'none';
    document.querySelector('.Section8-Comparison').style.display = 'block';
    initComparison(); 
});





