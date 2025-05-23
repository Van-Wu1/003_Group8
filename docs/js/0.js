const originalSection8HTML = document.getElementById('section8-container').innerHTML;


window.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('section8-new-comparison');
    if (!section) return;

    mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

    let geojsonData = null;
    let mapLeft, mapRight;
    let leftCity = '', rightCity = '';

    fetch('/data/clean/City_level_resilience_data_UPDATED_only_revenue_normalized.geojson')
        .then(res => res.json())
        .then(data => {
            geojsonData = data;

            const features = data.features.map(f => ({
                city: f.properties.city.trim(),
                value: {
                    resilienceIndex: f.properties.resilienceindex,
                    MSCIoverall: f.properties.mscioverall,
                    MSCIenvi: f.properties.mscienvi,
                    MSCIsocial: f.properties.mscisocial,
                    MSCIgovern: f.properties.mscigovern,
                    operatingRevenue: f.properties.operatingrevenue,
                    functionalDiversity: f.properties.functionaldiversity
                },
                geometry: f.geometry
            }));

            const cities = [...new Set(features.map(d => d.city))].sort();
            const leftSelect = document.getElementById('citySelectorLeft');
            const rightSelect = document.getElementById('citySelectorRight');
            cities.forEach(city => {
                [leftSelect, rightSelect].forEach(select => {
                    const opt = document.createElement('option');
                    opt.value = city;
                    opt.innerText = city;
                    select.appendChild(opt);
                });
            });

            mapLeft = initMap('mapLeft');
            mapRight = initMap('mapRight');
            initOverviewMaps();


            mapLeft.on('load', () => {
                mapLeft.addSource('city-boundary', {
                    type: 'geojson',
                    data: './data/clean/city_highlight.geojson'
                });
                mapLeft.addLayer({
                    id: 'city-boundary-fill',
                    type: 'fill',
                    source: 'city-boundary',
                    paint: {
                        'fill-color': [
                            'case',
                            ['<', ['get', 'resilienceindex'], 1.5], '#f3a6a1',
                            ['<', ['get', 'resilienceindex'], 2.5], '#a692e8',
                            '#3785D8'
                        ],
                        'fill-opacity': 0.6
                    },
                    filter: ['==', 'city', '']
                });
            });

            mapRight.on('load', () => {
                mapRight.addSource('city-boundary', {
                    type: 'geojson',
                    data: './data/clean/city_highlight.geojson'
                });
                mapRight.addLayer({
                    id: 'city-boundary-fill',
                    type: 'fill',
                    source: 'city-boundary',
                    paint: {
                        'fill-color': [
                            'case',
                            ['<', ['get', 'resilienceindex'], 1.5], '#f3a6a1',
                            ['<', ['get', 'resilienceindex'], 2.5], '#a692e8',
                            '#3785D8'  // >2.5
                        ],
                        'fill-opacity': 0.6
                    },
                    filter: ['==', 'city', '']
                });
            });

            leftSelect.addEventListener('change', () => {
                leftCity = leftSelect.value;
                const selected = features.find(f => f.city === leftCity);
                if (selected && mapLeft) {
                    mapLeft.flyTo({ center: selected.geometry.coordinates, zoom: 8 });
                    mapLeft.setFilter('city-boundary-fill', ['==', 'city', leftCity]);
                }
                updateBars(features);

                if (mapLeftOverview) {
                    mapLeftOverview.flyTo({
                        center: selected.geometry.coordinates,
                        zoom: 2.5,
                        speed: 1.2,
                        curve: 1.2
                    });

                    if (markerLeft) markerLeft.remove();

                    const dotLeft = document.createElement('div');
                    dotLeft.className = 'map-dot';
                    markerLeft = new mapboxgl.Marker(dotLeft)
                        .setLngLat(selected.geometry.coordinates)
                        .addTo(mapLeftOverview);
                }

            });

            rightSelect.addEventListener('change', () => {
                rightCity = rightSelect.value;
                const selected = features.find(f => f.city === rightCity);
                if (selected && mapRight) {
                    mapRight.flyTo({ center: selected.geometry.coordinates, zoom: 8 });
                    mapRight.setFilter('city-boundary-fill', ['==', 'city', rightCity]);
                }
                updateBars(features);

                if (mapRightOverview) {
                    mapRightOverview.flyTo({
                        center: selected.geometry.coordinates,
                        zoom: 2.5,
                        speed: 1.2,
                        curve: 1.2
                    });

                    if (markerRight) markerRight.remove();

                    const dotRight = document.createElement('div');
                    dotRight.className = 'map-dot';

                    markerRight = new mapboxgl.Marker(dotRight)
                        .setLngLat(selected.geometry.coordinates)
                        .addTo(mapRightOverview);
                }
            });

            updateBars(features); // Initial Display Bar
        });

    function initMap(containerId) {
        return new mapboxgl.Map({
            container: containerId,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-0.1276, 51.5072],
            zoom: 5.5
        });
    }

    let mapLeftOverview, mapRightOverview, markerLeft, markerRight;

    function initOverviewMaps() {
        mapLeftOverview = new mapboxgl.Map({
            container: 'mapleftoverview',
            style: 'mapbox://styles/mapbox/light-v11',
            center: [0, 0],
            zoom: 1.5,
            dragPan: false,
            scrollZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            dragRotate: false,
            keyboard: false,
            touchZoomRotate: false

        });

        mapRightOverview = new mapboxgl.Map({
            container: 'maprightoverview',
            style: 'mapbox://styles/mapbox/light-v11',
            center: [0, 0],
            zoom: 1.5,
            dragPan: false,
            scrollZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            dragRotate: false,
            keyboard: false,
            touchZoomRotate: false

        });
    }


    function updateBars(features) {
        const cityA = document.getElementById('citySelectorLeft').value;
        const cityB = document.getElementById('citySelectorRight').value;

        const a = features.find(d => d.city === cityA) || { value: {}, city: cityA || "City A" };
        const b = features.find(d => d.city === cityB) || { value: {}, city: cityB || "City B" };

        const container = document.getElementById('comparisonBars');
        container.innerHTML = '';

        const metrics = [
            'resilienceIndex',
            'MSCIoverall',
            'MSCIenvi',
            'MSCIsocial',
            'MSCIgovern',
            'operatingRevenue',
            'functionalDiversity'
        ];

        metrics.forEach(key => {
            const aVal = a?.value[key] || 0;
            const bVal = b?.value[key] || 0;
            const total = aVal + bVal;
            const aWidth = total === 0 ? 50 : (aVal / total) * 100;
            const bWidth = 100 - aWidth;

            const row = document.createElement('div');
            row.className = 'bar-row-enhanced';

            const label = document.createElement('div');
            label.className = 'bar-label';
            label.innerText = key;
            row.appendChild(label);

            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-wrapper';

            const leftVal = document.createElement('div');
            leftVal.className = 'bar-value bar-value-left';
            leftVal.innerText = aVal.toFixed(2);

            const rightVal = document.createElement('div');
            rightVal.className = 'bar-value bar-value-right';
            rightVal.innerText = bVal.toFixed(2);

            const bar = document.createElement('div');
            bar.className = 'bar-inner';

            const left = document.createElement('div');
            left.className = 'bar-left';

            const right = document.createElement('div');
            right.className = 'bar-right';

            left.style.width = `${aWidth}%`;
            right.style.width = `${bWidth}%`;

            bar.appendChild(left);
            bar.appendChild(right);

            barWrapper.appendChild(leftVal);
            barWrapper.appendChild(bar);
            barWrapper.appendChild(rightVal);

            row.appendChild(barWrapper);
            container.appendChild(row);
        });
    }
});

document.getElementById('backToSingleMap').addEventListener('click', () => {
    // 1. 隐藏当前页面
    document.getElementById('section8-new-comparison').style.display = 'none';

    // 2. 还原原始HTML内容
    const container = document.getElementById('section8-container');
    container.innerHTML = originalSection8HTML;

    // 3. 重新加载 map 和 deck.gl 的逻辑
    const script = document.createElement('script');
    script.src = 'js/4resilience.js';
    script.type = 'module';
    document.body.appendChild(script);

    // 4. 滚动到视图顶部
    setTimeout(() => {
        document.getElementById('section8').scrollIntoView({ behavior: 'instant' });
    }, 300);
});
