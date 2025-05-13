// js/comparison.js

let comparisonInitialized = false;

function initComparison() {
    if (comparisonInitialized) return;
    comparisonInitialized = true;
    mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

    

    const mapA = new mapboxgl.Map({
        container: 'map11',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-1.5, 52.5],
        zoom: 3.5,
        pitch: 55,
        bearing: 0,
        projection: 'mercator'
    });

    const mapB = new mapboxgl.Map({
        container: 'map22',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-1.5, 52.5],
        zoom: 3.5,
        pitch: 55,
        bearing: 0,
        projection: 'mercator'
    });

    let radarChartA = null, radarChartB = null;
    let points = [];

    fetch('./data/clean/City_level_resilience_data_FINAL_FIXED.geojson')
        .then(res => res.json())
        .then(data => {
            points = data.features.map(f => ({
                position: f.geometry.coordinates,
                resilienceIndex: f.properties.resilienceIndex,
                cluster: f.properties.Cluster,
                city: f.properties.City.trim(),
                MSCIoverall: f.properties.MSCIoverall,
                MSCIenvi: f.properties.MSCIenvi,
                MSCIsocial: f.properties.MSCIsocial,
                MSCIgovern: f.properties.MSCIgovern,
                operatingRevenue: f.properties.operatingRevenue,
                functionalDiversity: f.properties.functionalDiversity
            }));

            const cities = [...new Set(points.map(p => p.city))].sort();
            const dropdownA = document.getElementById('cityDropdownA');
            const dropdownB = document.getElementById('cityDropdownB');

            cities.forEach(city => {
                const optA = document.createElement('option');
                optA.value = city;
                optA.text = city;
                dropdownA.appendChild(optA);

                const optB = document.createElement('option');
                optB.value = city;
                optB.text = city;
                dropdownB.appendChild(optB);
            });

            const baseA = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: 5000,
                getFillColor: [220,220,220,180],
                radius: 22000,
                extruded: true,
                elevationScale: 1
            });

            const mainA = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: d => d.resilienceIndex*5000,
                getFillColor: d => d.cluster===2?[158,193,207,180]:d.cluster===1?[168,213,186,180]:d.cluster===0?[203,170,203,180]:[200,200,200],
                radius: 21000,
                extruded: true,
                elevationScale: 10
            });

            const baseB = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: 5000,
                getFillColor: [220,220,220,180],
                radius: 22000,
                extruded: true,
                elevationScale: 1
            });

            const mainB = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: d => d.resilienceIndex*5000,
                getFillColor: d => d.cluster===2?[158,193,207,180]:d.cluster===1?[168,213,186,180]:d.cluster===0?[203,170,203,180]:[200,200,200],
                radius: 21000,
                extruded: true,
                elevationScale: 10
            });

            mapA.addControl(new deck.MapboxOverlay({ layers: [baseA, mainA] }));
            mapB.addControl(new deck.MapboxOverlay({ layers: [baseB, mainB] }));

            function drawRadarChart(canvasId, chartRef, props) {
                const canvas = document.getElementById(canvasId);
                canvas.style.display = 'block';
                const ctx = canvas.getContext('2d');
                if (chartRef) chartRef.destroy();
                return new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: ['MSCI Overall','MSCI E','MSCI S','MSCI G','Operating Revenue','Functional Diversity'],
                        datasets: [{
                            label: '',
                            data: [props.MSCIoverall,props.MSCIenvi,props.MSCIsocial,props.MSCIgovern,props.operatingRevenue/1000000,props.functionalDiversity],
                            backgroundColor:'rgba(54,162,235,0.2)',
                            borderColor:'rgba(54,162,235,1)',
                            borderWidth:2
                        }]
                    },
                    options: {
                        layout: { padding: 20 },
                        maintainAspectRatio: false,
                        responsive: false,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display:true,
                                text:[`City: ${props.city}`,`Resilience Index: ${props.resilienceIndex.toFixed(2)}`],
                                font: { family:'Times New Roman', size:14 }
                            }
                        },
                        scales: {
                            r: {
                                angleLines:{ display:true },
                                suggestedMin:0,
                                suggestedMax:5,
                                pointLabels:{ font:{ family:'Times New Roman', size:12 }, padding:5 },
                                ticks:{ font:{ family:'Times New Roman', size:10 } }
                            }
                        }
                    }
                });
            }

            dropdownA.addEventListener('change', e => {
                const city = points.find(p => p.city === e.target.value);
                if (city) {
                    mapA.flyTo({ center: city.position, zoom: 6, speed: 1.2, curve: 1.5, easing: t => t });
                    radarChartA = drawRadarChart('radarChartA', radarChartA, city);
                }
            });

            dropdownB.addEventListener('change', e => {
                const city = points.find(p => p.city === e.target.value);
                if (city) {
                    mapB.flyTo({ center: city.position, zoom: 6, speed: 1.2, curve: 1.5, easing: t => t });
                    radarChartB = drawRadarChart('radarChartB', radarChartB, city);
                }
            });

        });

    document.getElementById('backButton').addEventListener('click', () => {
        document.querySelector('.Section8-Comparison').style.display = 'none';
        document.querySelector('.Section8').style.display = 'block';
        document.querySelector('.Section8').style.display = 'flex'; 
        ocument.querySelector('.Section8').scrollIntoView({ behavior: 'instant', block: 'start' });
    });
}