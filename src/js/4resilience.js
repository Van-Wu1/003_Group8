let selectedCity = null;
let overlay;
let points;
let barChart;


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


mapboxgl.accessToken = 'pk.eyJ1IjoieGlueXVlMjMiLCJhIjoiY203amU4bzlrMDR1ZzJvcXR2bW42Y2lmeCJ9.ctzNnLvN8LSMRuOQsa1ktg';

const map_re = new mapboxgl.Map({
  container: 'map_re',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-0.1276, 51.5072],  // London, England
  zoom: 3,
  pitch: 60,
  bearing: 0,
  projection: 'mercator',
  minZoom: 4,
  maxZoom: 7,
  maxBounds: [
    [-180, -85],
    [180, 85]
  ],
  dragPan: {
    deceleration: 0.9  // The closer to 1, the lower the inertia
  }

});

map_re.addControl(new mapboxgl.NavigationControl(), 'top-right');

fetch('/data/clean/City_level_resilience_data_UPDATED_only_revenue_normalized.geojson')
  .then(response => response.json())
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



    // After the data is loaded first draw an empty radar map
    drawRadarChart();

    drawRankingChart(points, 'resilienceIndex');

    // listener
    const rankingSelect = document.getElementById('rankingSelect');
    if (rankingSelect) {
      rankingSelect.addEventListener('change', (e) => {
        const metric = e.target.value;
        drawRankingChart(points, metric);
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
    //top 5
    function metricDisplayName(metric) {
      return {
        resilienceIndex: 'Resilience Index',
        MSCIoverall: 'ESG Index',
        functionalDiversity: 'Functional Diversity',
        operatingRevenue: 'Operating Revenue'
      }[metric] || metric;
    }

    function drawRankingChart(data, metric = 'resilienceIndex') {
      const top5 = [...data]
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, 5);

      const ctx = document.getElementById('rankingChart').getContext('2d');
      if (barChart) barChart.destroy();

      barChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top5.map(d => d.city),
          datasets: [{
            label: metricDisplayName(metric),
            data: top5.map(d => d[metric]),
            backgroundColor: 'rgba(118, 167, 201, 0.8)',
            barThickness: 30
          }]
        },
        options: {
          animation: {
            duration: 1000,
            easing: 'easeOutQuart',
            animateScale: true,
            animateRotate: false
          },

          responsive: true,
          layout: { padding: { top: 0, bottom: 0 } },
          maintainAspectRatio: false,
          responsive: true,
          interaction: { mode: 'index' },
          scales: {
            x: {
              offset: true,
              border: { color: '#1E0F75', width: 1 },
              grid: { display: false },
              ticks: {
                color: '#000',
                font: { size: 10 },
                maxRotation: 0,
                minRotation: 0,
                padding: 5,
                callback: function (value) {
                  const label = this.getLabelForValue(value);
                  return label.length > 8
                    ? label.match(/.{1,8}/g)
                    : label;
                }
              }
            },
            y: {
              border: { color: '#1E0F75', width: 1 },
              grid: { display: false },
              beginAtZero: true,
              ticks: {
                color: '#000',
                font: { size: 10 },
                padding: 5
              }
            }
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#000', padding: 0, font: { size: 10 } }
            },
            title: {
              display: true,
              text: `Top 5 cities by ${metricDisplayName(metric)}`,
              font: { size: 16 },
              color: '#000'
            }
          }
        }
      });
    }


    // Gray Base Layer
    const baseLayer = new deck.ColumnLayer({
      data: adjustedPoints,
      getPosition: d => d.adjustedPosition,
      getElevation: 5000,
      getFillColor: [220, 220, 220, 180],
      radius: 22000,
      extruded: true,
      elevationScale: 1
    });


    //  Add Original Column Layer
    const mainLayer = new deck.ColumnLayer({
      data: adjustedPoints,
      getPosition: d => d.adjustedPosition,
      getElevation: d => d.resilienceIndex * 5000,
      getFillColor: d => {
        if (d.city === selectedCity) return [255, 179, 71, 255];
        if (d.cluster === 2) return [55, 133, 216, 180];
        if (d.cluster === 1) return [166, 146, 232, 180];
        if (d.cluster === 0) return [243, 166, 161, 180];
        return [200, 200, 200];
      },
      getLineColor: d => d.city === selectedCity ? [255, 255, 255] : [0, 0, 0, 0],
      lineWidthMinPixels: 1,
      radius: 21000,
      extruded: true,
      elevationScale: 10
    });


    //  Initializing the map
    overlay = new deck.MapboxOverlay({
      layers: [baseLayer, mainLayer]
    });

    window.overlay = overlay;
    window.map_re = map_re; // 如果你也想在 0.js 中操作 map_re


    //legend listener
    const filterState = {
      0: true,
      1: true,
      2: true
    };

    document.querySelectorAll('#legend input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const cluster = parseInt(checkbox.dataset.cluster);
        filterState[cluster] = checkbox.checked;
        updateMapLayers();  // Re-rendering layers
      });
    });

    function updateMapLayers() {
      // Keep only the selected clusters
      const filteredData = adjustedPoints.filter(p => filterState[p.cluster]);

      //update baselayer
      const newBaseLayer = new deck.ColumnLayer({
        data: filteredData,
        getPosition: d => d.adjustedPosition,
        getElevation: 5000,
        getFillColor: [220, 220, 220, 180],
        radius: 22000,
        extruded: true,
        elevationScale: 1
      });
      // Updating the main layer (recreating the ColumnLayer)
      const newMainLayer = new deck.ColumnLayer({
        data: filteredData,
        getPosition: d => d.adjustedPosition,
        getElevation: d => d.resilienceIndex * 5000,
        getFillColor: d => {
          if (d.cluster === 2) return [55, 133, 216, 180];
          if (d.cluster === 1) return [166, 146, 232, 180];
          if (d.cluster === 0) return [243, 166, 161, 180];
          return [200, 200, 200];
        },
        radius: 21000,
        extruded: true,
        elevationScale: 10
      });

      // Reset the overlay layer (keep the baseLayer)
      overlay.setProps({
        layers: [newBaseLayer, newMainLayer]
      });
    }


    map_re.on('load', () => {
      map_re.addControl(overlay);
      map_re.getCanvas().style.backgroundColor = '#cfd8dc';
    });

    // City drop-down menu
    const dropdown = document.getElementById('cityDropdown');
    const uniqueCities = [...new Set(points.map(p => p.city))].sort();
    uniqueCities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.text = city;
      dropdown.appendChild(option);
    });


    // Drop-down menu events
    dropdown.addEventListener('change', (e) => {
      const selected = e.target.value.trim();
      selectedCity = selected;

      const cityData = points.find(p => p.city.trim() === selectedCity);

      if (cityData) {
        drawRadarChart(cityData);

        // Add map to fly to the city
        map_re.flyTo({
          center: cityData.position,
          zoom: 6,
          speed: 1.2,
          curve: 1.5,
          easing: t => t
        });
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
        // Recreate the mainLayer and highlight the columns.
        const filteredData = adjustedPoints.filter(p => filterState[p.cluster]);
        const newMainLayer = new deck.ColumnLayer({
          data: filteredData,
          getPosition: d => d.adjustedPosition,
          getElevation: d => d.resilienceIndex * 5000,
          getFillColor: d => {
            if (d.city === selectedCity) return [255, 179, 71, 255]; // Highlighted
            if (d.cluster === 2) return [55, 133, 216, 180];
            if (d.cluster === 1) return [166, 146, 232, 180];
            if (d.cluster === 0) return [243, 166, 161, 180];
            return [200, 200, 200];
          },
          getLineColor: d => d.city === selectedCity ? [255, 255, 255] : [0, 0, 0, 0],
          lineWidthMinPixels: 1,
          radius: 21000,
          extruded: true,
          elevationScale: 10
        });

        // Retain the original baseLayer
        const newBaseLayer = new deck.ColumnLayer({
          data: filteredData,
          getPosition: d => d.adjustedPosition,
          getElevation: 5000,
          getFillColor: [220, 220, 220, 180],
          radius: 22000,
          extruded: true,
          elevationScale: 1
        });

        overlay.setProps({
          layers: [newBaseLayer, newMainLayer]
        });
      }
    });
  });

// Radar plotting function
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
      labels: ['ESG-O', 'ESG-E', 'ESG-S', 'ESG-G', 'OR', 'FD'],
      datasets: [{
        label: props.city,
        data: [
          props.MSCIoverall,
          props.MSCIenvi,
          props.MSCIsocial,
          props.MSCIgovern,
          props.operatingRevenue * 5,
          props.functionalDiversity
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: ' #1E0F75',
        borderWidth: 2
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: [`City: ${props.city}`, `Resilience Index: ${props.resilienceIndex.toFixed(2)}`],
          font: { size: 18 },
          color: '#000'
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
            padding: 0
          },
          ticks: {
            color: '#000',

            backdropColor: 'transparent'
          },

          grid: {
            color: '#555555'
          }
        }

      }
    }
  });
}

document.getElementById('gotoComparison').addEventListener('click', () => {
  document.querySelector('.Section8').style.display = 'none';
  document.querySelector('#section8-new-comparison').style.display = 'block';
});

window.restoreResilienceOverlay = function () {
  if (map_re && overlay) {
    try {
      map_re.removeControl(overlay);
    } catch (e) {
      console.log("overlay 已经被移除或未定义");
    }
    map_re.addControl(overlay);
    map_re.getCanvas().style.backgroundColor = '#cfd8dc'; // 补一下背景色
  }
};
