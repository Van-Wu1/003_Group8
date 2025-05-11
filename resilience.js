mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 20],
    zoom: 2,
    pitch: 30,
    bearing: 0,
    projection: 'mercator'
});
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

let selectedCity = null;

fetch('./City_level_resilience_data_FINAL_FIXED.geojson')
    .then(response => response.json())
    .then(data => {
        // ✅ 把geojson转换成 deck.gl需要的数据格式
        const points = data.features.map(f => ({
            position: f.geometry.coordinates,
            resilienceIndex: f.properties.resilienceIndex,
            cluster: f.properties.Cluster,
            city: f.properties.City
        }));
        //select city
const dropdown = document.getElementById('cityDropdown');
const uniqueCities = [...new Set(data.features.map(f => f.properties.City))].sort();
uniqueCities.forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.text = city;
    dropdown.appendChild(option);
});
dropdown.addEventListener('change', (e) => {
    const selectedCity = e.target.value;
    if (selectedCity) {
        const cityFeature = data.features.find(f => f.properties.City === selectedCity);
        if (cityFeature) {
            drawRadarChart(cityFeature.properties); // ⬅️ 这个是后面要加的雷达图函数
            highlightColumn(cityFeature);          // ⬅️ 这个是 deck.gl 高亮函数
        }
    }
});

//rader chart
let radarChart;
function drawRadarChart(props) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (radarChart) radarChart.destroy(); // 清除旧图

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['MSCI E', 'MSCI S', 'MSCI G', 'Functional Diversity', 'Employees'],
            datasets: [{
                label: props.City,
                data: [
                    props.MSCIenvi,
                    props.MSCIsocial,
                    props.MSCIgovern,
                    props.functionalDiversity,
                    props.numberOfEmployees
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            maintainAspectRatio: false,       // ✅ 禁止自动铺满
    responsive: false, 
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 5
                }
            }
        }
    });
}
//highlight selected city
function highlightColumn(feature) {
    deckgl.setProps({
        layers: [
            new deck.ColumnLayer({
                id: 'column-layer',
                data: data.features,
                getPosition: d => d.geometry.coordinates,
                getElevation: d => d.properties.resilienceIndex * 5000,
                getFillColor: d => {
                    if (d.properties.City === feature.properties.City) return [255, 215, 0]; // 高亮为金色
                    const cluster = d.properties.Cluster;
                    if (cluster === 0) return [31, 119, 180];
                    if (cluster === 1) return [44, 160, 44];
                    if (cluster === 2) return [214, 39, 40];
                    return [200, 200, 200];
                },
                radius: 20000,
                elevationScale: 1,
                extruded: true,
                opacity: 0.9,
                pickable: true
            })
        ]
    });
}

        //添加排名
        // ✅ 新增：绘制Top5 Ranking Chart
const top5 = points
    .sort((a, b) => b.resilienceIndex - a.resilienceIndex)
    .slice(0, 5);
console.log(top5)

const labels = top5.map(d => d.city);
const dataValues = top5.map(d => d.resilienceIndex);
console.log(labels, dataValues);

const ctx = document.getElementById('rankingChart').getContext('2d');

new Chart(ctx, {
    type: 'bar',
    data: {
        labels: labels,
        datasets: [{
            label: 'Resilience Index',
            data: dataValues,
            backgroundColor: 'rgba(31, 119, 180, 0.8)',
            barThickness: 30
        }]
    },
    
    options: {
        layout: {
    padding: {
        top: 0,     // 减少顶部空隙
        bottom: 0    // 如果需要可以再减少
    }
},

        maintainAspectRatio: false, 
        font: { family: 'Times New Roman' },
        responsive: false,
        interaction: {
        mode: 'index'},
        scales: {
    x: {
        offset: true,  
        grid: { display: false },
        ticks: {
    font: { family: 'Times New Roman',size: 10},  // ✅ 缩小字体
    maxRotation: 0,      // ✅ 不允许旋转
    minRotation: 0,
    padding: 5,
    callback: function(value, index, ticks) {
    const label = this.getLabelForValue(value);
    return label.split(' ');  // ✅ 按空格换行
}

}

    },
    y: {
        grid: { display: false },
        beginAtZero: true,
        ticks: {
            font: { family: 'Times New Roman',size: 10 }   
        }
    }
},
    plugins: {
    legend: { position: 'bottom' ,
        labels: {
            padding: 0,
            font: { family: 'Times New Roman',size: 10 }    
        }
    },
    
    title: {
    display: true,
    text: 'Top 5 cities in the resilience index',
    font: { family: 'Times New Roman', size: 16 }
}
},



       
    }
});

        const hexagonLayer = new deck.ColumnLayer({
    data: points,
    getPosition: d => d.position,
    getElevation: d => d.resilienceIndex * 50000,
    getFillColor: d => {
    if (selectedCity && d.city === selectedCity) {
        return [255, 0, 0, 255];  // 高亮色：红色
    }
    if (d.cluster === 0) return [31, 119, 180];
    if (d.cluster === 1) return [44, 160, 44];
    if (d.cluster === 2) return [214, 39, 40];
    return [200, 200, 200];
},
    radius: 21000,
    extruded: true,
    elevationScale: 10  
})



        const overlay = new deck.MapboxOverlay({
            layers: [hexagonLayer]
        });

        map.addControl(overlay);
    });
