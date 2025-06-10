import { initResilience } from './4resilience.js';

const originalSection8HTML = document.getElementById('section8-container').innerHTML;

let geojsonData = null;
let mapLeft, mapRight;
let mapLeftOverview, mapRightOverview, markerLeft, markerRight;

window.addEventListener('DOMContentLoaded', () => {
  fetch('/data/City_level_resilience_data_UPDATED_only_revenue_normalized.geojson')
    .then(res => res.json())
    .then(data => {
      geojsonData = data;
    });
});


document.getElementById('gotoComparison').addEventListener('click', () => {
  document.querySelector('.Section8').style.display = 'none';
  document.getElementById('section8-new-comparison').style.display = 'block';

  setTimeout(() => {
    initComparison(); 
  }, 100);
});


document.getElementById('backToSingleMap').addEventListener('click', () => {
  document.getElementById('section8-new-comparison').style.display = 'none';

  const container = document.getElementById('section8-container');
  container.innerHTML = originalSection8HTML;

  setTimeout(() => {
    initResilience();
    document.getElementById('section8').scrollIntoView({ behavior: 'instant' });
  }, 100);
});


function initComparison() {
  if (!geojsonData) return;

  mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

  const features = geojsonData.features.map(f => ({
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

  const leftSelect = document.getElementById('citySelectorLeft');
  const rightSelect = document.getElementById('citySelectorRight');
  leftSelect.innerHTML = '<option value="">Select City A</option>';
  rightSelect.innerHTML = '<option value="">Select City B</option>';

  const cities = [...new Set(features.map(d => d.city))].sort();
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
      data: './data/city_highlight.geojson'
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
      data: './data/city_highlight.geojson'
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
          '#3785D8'
        ],
        'fill-opacity': 0.6
      },
      filter: ['==', 'city', '']
    });
  });

  leftSelect.addEventListener('change', () => {
    const selected = features.find(f => f.city === leftSelect.value);
    if (selected && mapLeft) {
      mapLeft.flyTo({ center: selected.geometry.coordinates, zoom: 8 });
      mapLeft.setFilter('city-boundary-fill', ['==', 'city', selected.city]);
    }
    updateBars(features);
    updateOverview(selected, true);
  });

  rightSelect.addEventListener('change', () => {
    const selected = features.find(f => f.city === rightSelect.value);
    if (selected && mapRight) {
      mapRight.flyTo({ center: selected.geometry.coordinates, zoom: 8 });
      mapRight.setFilter('city-boundary-fill', ['==', 'city', selected.city]);
    }
    updateBars(features);
    updateOverview(selected, false);
  });

  updateBars(features);
}

function initMap(containerId) {
  return new mapboxgl.Map({
    container: containerId,
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-0.1276, 51.5072],
    zoom: 5.5
  });
}

function initOverviewMaps() {
  mapLeftOverview = new mapboxgl.Map({
    container: 'mapleftoverview',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 0],
    zoom: 1.5
  });

  mapRightOverview = new mapboxgl.Map({
    container: 'maprightoverview',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 0],
    zoom: 1.5
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
    left.style.width = `${aWidth}%`;

    const right = document.createElement('div');
    right.className = 'bar-right';
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

function updateOverview(selected, isLeft) {
  const overview = isLeft ? mapLeftOverview : mapRightOverview;
  const marker = isLeft ? markerLeft : markerRight;

  if (overview && selected?.geometry?.coordinates) {
    overview.flyTo({
      center: selected.geometry.coordinates,
      zoom: 2.5
    });

    if (marker) marker.remove();
    const dot = document.createElement('div');
    dot.className = 'map-dot';

    const newMarker = new mapboxgl.Marker(dot)
      .setLngLat(selected.geometry.coordinates)
      .addTo(overview);

    if (isLeft) markerLeft = newMarker;
    else markerRight = newMarker;
  }
}


