window.initComparison = initComparison;

let selectedCityA = null, selectedCityB = null;
let overlayA, overlayB;

let comparisonInitialized = false;
function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}



function initComparison() {
    if (comparisonInitialized) return;
    comparisonInitialized = true;
    mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';



    const mapA = new mapboxgl.Map({
        container: 'map11',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-1.5, 52.5],
        zoom: 5.5,
        pitch: 60,
        bearing: 0,
        projection: 'mercator',
        minZoom: 4,   
        maxZoom: 7
    });

    const mapB = new mapboxgl.Map({
        container: 'map22',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-1.5, 52.5],
        zoom: 5.5,
        pitch: 60,
        bearing: 0,
        projection: 'mercator',
        minZoom: 4,
        maxZoom: 7
    });

    let radarChartA = null, radarChartB = null;
    let points = [];

    fetch('./data/clean/City_level_resilience_data_UPDATED_only_revenue_normalized.geojson')
        .then(res => res.json())
        .then(data => {
            points = data.features.map(f => ({
                position: f.geometry.coordinates,
                resilienceIndex: f.properties.resilienceindex,
                cluster: f.properties.cluster,
                city: f.properties.city.trim(),
                MSCIoverall: f.properties.mscioverall,
                MSCIenvi: f.properties.mscienvi,
                MSCIsocial: f.properties.mscisocial,
                MSCIgovern: f.properties.mscigovern,
                operatingRevenue: f.properties.operatingrevenue,
                functionalDiversity: f.properties.functionaldiversity
            }));

function getFillColor(city, selectedCity) {
  if (city === selectedCity) return [255, 179, 71, 255]; 
  return null; 
}

function createMainLayer(data, selectedCity) {
  return new deck.ColumnLayer({
    data,
    getPosition: d => d.adjustedPosition,
    getElevation: d => d.resilienceIndex * 5000,
    getFillColor: d => {
      const highlight = getFillColor(d.city, selectedCity);
      if (highlight) return highlight;
      if (d.cluster === 2) return [55, 133, 216, 180];
      if (d.cluster === 1) return [166, 146, 232, 180];
      if (d.cluster === 0) return [243, 166, 161, 180];
      return [200, 200, 200];
    },
    radius: 21000,
    extruded: true,
    elevationScale: 10
  });
}



            const GROUP_DISTANCE_KM = 50;
            const OFFSET_KM = 25;
            const DEG_PER_KM = 1 / 111;

            const groups = [];
            const used = new Set();

            for (let i = 0; i < points.length; i++) {
                if (used.has(i)) continue;

                const group = [points[i]];
                used.add(i);

                for (let j = i + 1; j < points.length; j++) {
                    if (used.has(j)) continue;

                    const p1 = points[i].position;
                    const p2 = points[j].position;
                    const dist = haversineDistance(p1[1], p1[0], p2[1], p2[0]);

                    if (dist <= GROUP_DISTANCE_KM) {
                        group.push(points[j]);
                        used.add(j);
                    }
                }

                groups.push(group);
            }

            const adjustedPoints = [];

            for (const group of groups) {
                const [lonBase, latBase] = group[0].position;

                group.forEach((d, i) => {
                    if (group.length === 1) {
                        d.adjustedPosition = d.position;
                    } else {
                        const angle = (i / group.length) * 2 * Math.PI;
                        const dx = Math.cos(angle) * OFFSET_KM * DEG_PER_KM;
                        const dy = Math.sin(angle) * OFFSET_KM * DEG_PER_KM;
                        d.adjustedPosition = [lonBase + dx, latBase + dy];
                    }

                    adjustedPoints.push(d);
                });
            }


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
                getPosition: d => d.adjustedPosition,
                getElevation: 5000,
                getFillColor: [220, 220, 220, 180],
                radius: 22000,
                extruded: true,
                elevationScale: 1
            });

            const mainA = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.adjustedPosition,
                getElevation: d => d.resilienceIndex * 5000,

                radius: 21000, getFillColor: d => d.cluster === 2 ? [55, 133, 216, 180] : d.cluster === 1 ? [166, 146, 232, 180] : d.cluster === 0 ? [243, 166, 161, 180] : [200, 200, 200],
                extruded: true,
                elevationScale: 10
            });

            const baseB = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: 5000,
                getFillColor: [220, 220, 220, 180],
                radius: 22000,
                extruded: true,
                elevationScale: 1
            });

            const mainB = new deck.ColumnLayer({
                data: points,
                getPosition: d => d.position,
                getElevation: d => d.resilienceIndex * 5000,
                getFillColor: d => d.cluster === 2 ? [55, 133, 216, 180] : d.cluster === 1 ? [166, 146, 232, 180] : d.cluster === 0 ? [243, 166, 161, 180] : [200, 200, 200],
                radius: 21000,
                extruded: true,
                elevationScale: 10
            });

            overlayA = new deck.MapboxOverlay({ layers: [baseA, mainA] });
overlayB = new deck.MapboxOverlay({ layers: [baseB, mainB] });
mapA.addControl(overlayA);
mapB.addControl(overlayB);


            let radarChart = null;

            function drawComparisonRadarChart(cityA, cityB) {
                const canvas = document.getElementById('comparisonRadarChart');
                const ctx = canvas.getContext('2d');
                if (radarChart) radarChart.destroy();

                const labels = ['ESG-O', 'ESG-E', 'ESG-S', 'ESG-G', 'OR', 'FD'];

                const datasets = [];

                if (cityA) {
                    datasets.push({
                        label: `City A: ${cityA.city}`,
                        data: [
                            cityA.MSCIoverall,
                            cityA.MSCIenvi,
                            cityA.MSCIsocial,
                            cityA.MSCIgovern,
                            cityA.operatingRevenue * 5,
                            cityA.functionalDiversity
                        ],
                        backgroundColor: 'rgba(30, 15, 117, 0.2)',
                        borderColor: '#1E0F75',
                        pointBackgroundColor: '#1E0F75',
                        borderWidth: 2
                    });
                }

                if (cityB) {
                    datasets.push({
                        label: `City B: ${cityB.city}`,
                        data: [
                            cityB.MSCIoverall,
                            cityB.MSCIenvi,
                            cityB.MSCIsocial,
                            cityB.MSCIgovern,
                            cityB.operatingRevenue * 5,
                            cityB.functionalDiversity
                        ],
                        backgroundColor: 'rgba(56, 133, 216, 0.2)',
                        borderColor: '#3785D8',
                        pointBackgroundColor: '#3785D8',
                        borderWidth: 2
                    });
                }

                // If both are empty, also provide a blank graphic
                if (datasets.length === 0) {
                    datasets.push({
                        label: 'No City Selected',
                        data: [0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(200, 200, 200, 0.05)',
                        borderColor: 'rgba(200, 200, 200, 0.3)',
                        borderWidth: 1,
                        borderDash: [4, 2],
                        pointRadius: 0
                    });
                }

                radarChart = new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                            legend: {
                                color: '#000', position: 'bottom',
                                align: 'start',
                                labels: {
                                    textAlign: 'left',
                                    boxWidth: 20,
                                    padding: 10
                                }
                            },
                            title: {
                                color: '#000',
                                display: true,
                                text: 'Comparison of City A and B',
                                font: { size: 16 }
                            }
                        },
                        scales: {
                            r: {
                                angleLines: { color: '#555555', display: true },
                                suggestedMin: -1,
                                suggestedMax: 6,

                                pointLabels: {
                                    color: '#000',
                                    font: { size: 13 },
                                    padding: 5
                                },
                                ticks: {
                                    backdropColor: 'transparent', color: '#000',

                                },
                                grid: {
                                    color: '#555555'
                                }
                            }
                        }
                    }
                });
            }



            let selectedCityA = null;
            let selectedCityB = null;

            dropdownA.addEventListener('change', e => {
    selectedCityA = points.find(p => p.city === e.target.value);
    if (selectedCityA) {
        mapA.flyTo({ center: selectedCityA.position, zoom: 6 });

        const mainLayerA = createMainLayer(points, selectedCityA.city);
        const baseLayerA = new deck.ColumnLayer({
            data: points,
            getPosition: d => d.adjustedPosition,
            getElevation: 5000,
            getFillColor: [220, 220, 220, 180],
            radius: 22000,
            extruded: true,
            elevationScale: 1
        });
        overlayA.setProps({ layers: [baseLayerA, mainLayerA] });
    }
    drawComparisonRadarChart(selectedCityA, selectedCityB);
});

dropdownB.addEventListener('change', e => {
    selectedCityB = points.find(p => p.city === e.target.value);
    if (selectedCityB) {
        mapB.flyTo({ center: selectedCityB.position, zoom: 6 });

        const mainLayerB = createMainLayer(points, selectedCityB.city);
        const baseLayerB = new deck.ColumnLayer({
            data: points,
            getPosition: d => d.position,
            getElevation: 5000,
            getFillColor: [220, 220, 220, 180],
            radius: 22000,
            extruded: true,
            elevationScale: 1
        });
        overlayB.setProps({ layers: [baseLayerB, mainLayerB] });
    }
    drawComparisonRadarChart(selectedCityA, selectedCityB);
});


            drawComparisonRadarChart(null, null);


        });

    document.getElementById('backButtonHu').addEventListener('click', () => {
        document.querySelector('.Section8-Comparison').style.display = 'none';
        document.querySelector('.Section8').style.display = 'block';
        document.querySelector('.Section8').style.display = 'flex';
        document.querySelector('.Section8').scrollIntoView({ behavior: 'instant', block: 'start' });
    });
}