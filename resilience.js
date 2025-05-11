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
            backgroundColor: 'rgba(31, 119, 180, 0.8)'
        }]
    },
    
    options: {
        indexAxis: 'y', 
        responsive: false,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});

        const hexagonLayer = new deck.ColumnLayer({
    data: points,
    getPosition: d => d.position,
    getElevation: d => d.resilienceIndex * 50000,
    getFillColor: d => {
        const cluster = d.cluster;
        if (cluster === 0) return [31, 119, 180];
        if (cluster === 1) return [44, 160, 44];
        if (cluster === 2) return [214, 39, 40];
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
