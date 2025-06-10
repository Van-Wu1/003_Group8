mapboxgl.accessToken = 'pk.eyJ1Ijoid3d3MDYwIiwiYSI6ImNsZWNyZXU0OTAwbWEzb3RlaDF5bzBrcXUifQ.XpmvYQZRVRCNwe1mtcgYVg';
const mapboxMap = new mapboxgl.Map({
  container: 'mapbubble',
  style: 'mapbox://styles/www060/cmahcpioi00xw01sleyt2edjh',
  center: [0, 30],
  zoom: 2.5
});

// 1. global variable
let cityData = {};
const cityMarkers = [];

let countryTopCity = {};           // Needs to be reset and assigned a value
let donutChart = null;            // Chart instances, not const
let currentSelectedFunctions = []; // Multiple updates and reads, need to let
let currentMinCompanyCount = 0;    //For multiple assignments
let stackedBarChart = null;
let scatterChart = null;


const colorMap = {
  "R&D": "#1E0F75",
  "Manufacturing": "#1c1dab",
  "Packaging": "#BF8CE1",
  "Wholesale": "#E893C5",
  "Retail/Medical": "#F57F7F",
  "API": "#ADC6E5",
  "Support/Other": "#CBD8E8",
  "Unclassified": "#C4C4C4"
};


//City Description Edition
// 3. DOM elements
const popup = document.getElementById('popup');
const defaultMessage = document.getElementById('defaultMessage');
const cityDetails = document.getElementById('cityDetails');
const backButton = document.getElementById('backButton');

function showDefaultMessage() {
  defaultMessage.style.display = 'block';
  cityDetails.style.display = 'none';
}

function showCityPanel(cityName, functionCategory) {
  const info = cityData[cityName];
  const donutData = prepareDonutData(info);

  defaultMessage.style.display = 'none';
  cityDetails.style.display = 'block';

  document.getElementById('cityHeader').innerText = cityName;

  // Plotting with existing functions
  showCityCard(cityName, donutData, info);
}

//Feedback on the radius size of the circle based on zoom
function getRadiusByZoomAndValue(zoom, value) {
  if (zoom <= 3) {
    if (value <= 0) return 4;
    if (value >= 40) return 10;
    return 2 + (value / 40) * (8 - 2);
  } else if (zoom <= 5) {
    if (value <= 0) return 5;
    if (value >= 40) return 20;
    return 5 + (value / 40) * (20 - 5);
  } else if (zoom <= 7) {
    if (value <= 0) return 10;
    if (value >= 40) return 30;
    return 10 + (value / 40) * (40 - 10);
  } else {
    return 15 + Math.sqrt(value) * 4;
  }
}

function applyFilter() {
  currentSelectedFunctions = getSelectedFunctions();
  currentMinCompanyCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
  updateTopCitiesByFunctionMulti(currentSelectedFunctions, undefined, currentMinCompanyCount);
  updateMapWithFilters(currentSelectedFunctions, currentMinCompanyCount);
};

function updateMapWithFilters(selectedFunctions, minCount) {
  const zoom = mapboxMap.getZoom();
  const updatedGeojson = convertCityDataToGeoJSON(cityData, zoom, selectedFunctions, minCount);
  const source = mapboxMap.getSource('cities');
  if (source) {
    source.setData(updatedGeojson);
  }
};

function convertCityDataToGeoJSON(cityData, zoom, selectedFunctions = [], minCount = 1) {
  if (!Array.isArray(selectedFunctions)) selectedFunctions = [];

  const features = Object.entries(cityData).map(([cityKey, info]) => {
    const allCompanies = [...(info.hq_companies || []), ...(info.subsidiaries || [])];
    if (allCompanies.length === 0) return null;

    const company = allCompanies.find(c => (c.lat || c.latitude) && (c.lng || c.longitude));
    if (!company) return null;

    const lat = Number(company.lat || company.latitude);
    const lng = Number(company.lng || company.longitude);
    const total = (info.hq_count || 0) + (info.subsidiary_count || 0);

    //[Layer 1] Filter constraints (most critical)
    if (total < minCount) return null;

    const functionStats = info.sub_function_stats || {};
    const filteredStats = Object.entries(functionStats).filter(([k]) => k !== "Unclassified");
    if (filteredStats.length === 0) return null;

    const hasSelectedFunction = selectedFunctions.length === 0 ||
      filteredStats.some(([k]) => selectedFunctions.includes(k));
    if (!hasSelectedFunction) return null;

    //[Layer 2] zoom <= 3 restriction, keep only top city
    if (zoom <= 3 && !isTopCityInCountry(cityKey)) return null;

    //[Layer 3] zoom only affects style (circle size), not display eligibility
    const mainFunc = filteredStats.sort((a, b) => b[1] - a[1])[0][0];
    const category = getFunctionCategory(info);
    const radius = getRadiusByZoomAndValue(zoom, total); // Style Changes

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      },
      properties: {
        city: cityKey,
        total,
        mainFunc,
        radius,
        fillColor: colorMap[mainFunc] || "#ccc",
        borderColor: category === "Single-function" ? "#2980b9" :
          category === "Multi-functional" ? "#ffffff" : "transparent",
        borderWidth: (category === "Single-function" || category === "Multi-functional") ? 2 : 0
      }
    };
  }).filter(f => f !== null);

  return {
    type: "FeatureCollection",
    features
  };
}



//  Uniformly write a function dedicated to drawing bar graphs: repeatable calls without destroy
function drawStackedBarChart({ labels, datasets }) {
  const canvas = document.getElementById('stackedBarChart');
  if (!canvas) {
    console.error('❌ Canvas element not found');
    return;
  }
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');

  if (stackedBarChart instanceof Chart) {
    stackedBarChart.destroy();
  }

  stackedBarChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: {
          top: 10,
          right: 20,
          bottom: 10,
          left: 10
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          position: 'nearest'
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
            callback: function (value, index) {
              return index % 2 === 0 ? this.getLabelForValue(value) : ''; // 只显示一半标签
            }
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grace: '5%',
          title: {
            display: true,
            text: 'Company Count'
          },
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

//Defining Urban Functions
function getFunctionStats(info) {
  const rolesRaw = info.sub_function_stats || {};
  const roles = Object.fromEntries(
    Object.entries(rolesRaw).filter(([k, _]) => k !== "Unclassified")
  );
  // { R&D: 10, Manufacturing: 5, Sales: 2, ... }
  const total = Object.values(roles).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const sortedRoles = Object.entries(roles).sort((a, b) => b[1] - a[1]);
  const dominantRole = sortedRoles[0][0];
  const dominantCount = sortedRoles[0][1];
  const roleCount = sortedRoles.length;
  const dominanceRatio = (dominantCount / total).toFixed(2);

  // Calculate the Shannon entropy
  const entropy = -sortedRoles.reduce((sum, [_, count]) => {
    const p = count / total;
    return sum + p * Math.log2(p);
  }, 0).toFixed(2);

  // categorization
  let classification = "Unclassified";
  if (roleCount === 1) classification = "Single-function City";
  else if (entropy < 1) classification = "Weakly Diversified";
  else classification = "Multi-functional City";

  return {
    dominantRole,
    roleCount,
    entropy,
    dominanceRatio,
    classification,
    total
  };
}

//Give each city a functional division
function getFunctionCategory(info) {
  const stats = getFunctionStats(info);
  if (!stats) return "Unclassified";

  const { roleCount, dominanceRatio, entropy } = stats;

  if (roleCount === 1 || dominanceRatio >= 0.8) return "Single-function"; //单一功能  
  if (roleCount >= 3 && entropy >= 1.0 && dominanceRatio <= 0.6) return "Multi-functional"; //多重功能
  return "Weakly Diversified";
}

// donut picture
function prepareDonutData(info) {
  const stats = info.sub_function_stats || {};
  const labels = Object.keys(stats);
  const values = Object.values(stats);
  const colors = labels.map(l => colorMap[l] || "#ccc");
  return { labels, values, colors };
}



function isTopCityInCountry(cityKey) {
  const country = cityKey.split(",")[1]?.trim();
  return countryTopCity[country]?.city === cityKey;
}

function buildCountryTopCity(selectedFunctions) {
  countryTopCity = {};
  Object.entries(cityData).forEach(([cityKey, info]) => {
    const country = cityKey.split(",")[1]?.trim();
    const stats = info.sub_function_stats || {};
    const total = selectedFunctions.reduce((sum, f) => sum + (stats[f] || 0), 0);
    if (total === 0) return;
    if (!countryTopCity[country] || total > countryTopCity[country].total) {
      countryTopCity[country] = { city: cityKey, total };
    }
  });
}

function showCityCard(cityKey, donutData, infoFromMapbox) {
  const info = cityData[cityKey] || infoFromMapbox;
  document.getElementById("infoPanel").style.display = "block";

  const [cityName, countryCode] = cityKey.split(",");
  document.getElementById("cityHeader").innerHTML = `
    <h3>${cityName.trim()}, ${countryCode.trim()}</h3>
  `;

  // 2. statistical data
  const hqCount = info.hq_count || 0;
  const subCount = info.subsidiary_count || 0;
  const allCompanies = hqCount + subCount;

  const avgEmployees = hqCount > 0
    ? Math.round(info.hq_companies?.reduce((sum, c) => sum + (c.employees || 0), 0) / hqCount)
    : '–';

  const avgESG = hqCount > 0
    ? (info.hq_companies?.reduce((sum, c) => sum + (c.esg_score || 0), 0) / hqCount).toFixed(1)
    : '–';

  // Functional structure information card
  const grid = document.getElementById('cityInfoGrid');
  grid.innerHTML = ''; // Emptying old content

  const functionCategory = getFunctionCategory(info);
  const companyCount = hqCount + subCount;
  const stats = getFunctionStats(info);

  const infoHTML = `
  <div class="info-item"><strong>Function Category</strong><div>${functionCategory}</div></div>
  <div class="info-item"><strong>Company Count</strong><div>${companyCount}</div></div>
  <div class="info-item"><strong>HQs / Subsidiaries</strong><div>${hqCount} / ${subCount}</div></div>
  <div class="info-item"><strong>Dominant Function</strong><div>${stats?.dominantRole ?? '–'}</div></div>
  <div class="info-item"><strong>Entropy</strong><div>${stats?.entropy ?? '–'}</div></div>
  <div class="info-item"><strong>Dominance Ratio</strong><div>${stats?.dominanceRatio ?? '–'}</div></div>
`;
  grid.insertAdjacentHTML('beforeend', infoHTML);

  drawDonutChart(donutData, cityName);
}

// 3. Drawing Donuts
// Used to save Chart instances
function drawDonutChart(data, cityName) {
  const canvas = document.getElementById("donutChart");
  const ctx = canvas?.getContext("2d");

  if (!ctx) {
    console.error("Canvas #donutChart not found");
    return;
  }

  // 设置 canvas 尺寸（你可以更改为 80 或 100）
  canvas.width = 150;
  canvas.height = 150;

  // 销毁旧图
  if (donutChart instanceof Chart) {
    donutChart.destroy();
  }

  // 创建新图
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: data.colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        title: {
          display: true,
          text: `Function Distribution: ${cityName.trim()}`
        },
        legend: {
          display: false
        }
      }
    }
  });
}


function buildScatterData() {
  const scatterData = [];
  Object.entries(cityData).forEach(([cityKey, info]) => {
    const stats = getFunctionStats(info);
    if (!stats) return;

    scatterData.push({
      city: cityKey,
      companyCount: stats.total,        // ✅ 使用 stats.total
      dominanceRatio: parseFloat(stats.dominanceRatio),
      entropy: parseFloat(stats.entropy),
      category: getFunctionCategory(info)
    });
  });
  return scatterData;
}


function drawScatterPlot(scatterData) {
  const canvas = document.getElementById('scatterCanvas');
  if (!canvas) {
    console.error("❌ scatterPlot not found in DOM.");
    return;
  }

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');

  if (scatterChart instanceof Chart) {
    scatterChart.destroy();
  }

  scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Cities',
        data: scatterData.map(d => ({
          x: d.dominanceRatio,
          y: d.entropy,
          city: d.city,
          category: d.category,
          backgroundColor:
            d.category === 'Single-function' ? 'rgba(30, 15, 117, 0.6)' :
              d.category === 'Multi-functional' ? 'rgba(191, 140, 225, 0.6)' :
                'rgba(205, 222, 232, 0.5)'
        })),
        parsing: false,
        pointBackgroundColor: ctx => ctx.raw.backgroundColor
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: {
        padding: 10
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const d = context.raw;
              return `${d.city}\nEntropy: ${d.y}\nDominance Ratio: ${d.x}`; 
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Dominance Ratio' }, 
          type: 'linear',
          beginAtZero: true

        },
        y: {
          title: { display: true, text: 'Entropy' },
          min: 0, max: 3
        }
      },
      backgroundColor: 'transparent',
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const d = elements[0].element.$context.raw;
          const city = d.city;
          const info = cityData[city];
          if (!info) return;

          const donutData = prepareDonutData(info);
          showCityCard(city, donutData, info);
          showCityPanel(city, getFunctionCategory(info));

          const coords = getCityCoordinates(info);
          if (coords) {
            mapboxMap.flyTo({ center: coords, zoom: 7 });
          }
        }
      }
    }
  });
}

function getCityCoordinates(info) {
  const allCompanies = [...(info.hq_companies || []), ...(info.subsidiaries || [])];
  const company = allCompanies.find(c => (c.lat || c.latitude) && (c.lng || c.longitude));
  if (!company) return null;
  return [Number(company.lng || company.longitude), Number(company.lat || company.latitude)];
}

// Bar chart update logic
function updateTopCitiesByFunctionMulti(selectedFunctions, limit = 10, minCount = 0) {
  const cityStats = [];

  Object.entries(cityData).forEach(([cityKey, info]) => {
    const functionStats = info.sub_function_stats || {};
    const functionCounts = selectedFunctions.map(func => functionStats[func] || 0);
    const totalCount = functionCounts.reduce((sum, val) => sum + val, 0);

    if (totalCount >= minCount) {  // ✅ 现在 minCount 有定义了
      cityStats.push({
        city: cityKey,
        total: totalCount,
        functionCounts
      });
    }
  });

  const topCities = cityStats.sort((a, b) => b.total - a.total).slice(0, limit);

  const labels = topCities.map(d => d.city);
  const datasets = selectedFunctions.map((func, i) => ({
    label: func,
    data: topCities.map(c => c.functionCounts[i]),
    backgroundColor: colorMap[func] || "#ccc",
    stack: 'stack1'
  }));

  drawStackedBarChart({ labels, datasets });
}

// Utility Function: Filter State
function getSelectedFunctions() {
  return Array.from(
    document.querySelectorAll('#functionFilters input[type="checkbox"]:checked')
  ).map(cb => cb.value);
}


const slider = document.getElementById("topCityLimit");
const valueDisplay = document.getElementById("topCityValue");

function updateSliderUI() {
  const value = parseInt(slider.value, 10);
  const min = parseInt(slider.min, 10);
  const max = parseInt(slider.max, 10);
  const percent = ((value - min) / (max - min)) * 100;

  valueDisplay.textContent = value;
  slider.style.backgroundSize = `${percent}% 100%`;
}

// Initial update
updateSliderUI();

// Listen to Slide
slider.addEventListener("input", updateSliderUI);

//Initialization Demonstration
backButton.addEventListener('click', showDefaultMessage);
showDefaultMessage();//It ends here.

fetch('/data/city_function.json')
  .then(res => res.json())
  .then(data => {
    cityData = data;

    // // Legend Initialization
    // renderFunctionLegend("functionFilters");

    // Construction of zoom ≤ 3 national representative cities
    buildCountryTopCity(Object.keys(colorMap).filter(f => f !== "Unclassified"));

    mapboxMap.on('load', () => {
      const zoom = mapboxMap.getZoom();
      const selectedFunctions = getSelectedFunctions();
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
      const geojson = convertCityDataToGeoJSON(cityData, zoom, selectedFunctions, minCount);

      mapboxMap.addSource('cities', { type: 'geojson', data: geojson });

      mapboxMap.addLayer({
        id: 'city-circles',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['interpolate', ['linear'], ['get', 'total'], 0, 4, 40, 10],
            4, ['interpolate', ['linear'], ['get', 'total'], 0, 5, 40, 20],
            6, ['interpolate', ['linear'], ['get', 'total'], 0, 10, 40, 30],
            8, ['+', 15, ['*', ['sqrt', ['get', 'total']], 4]]
          ],
          'circle-color': ['get', 'fillColor'],
          'circle-stroke-color': ['get', 'borderColor'],
          'circle-stroke-width': ['get', 'borderWidth'],
          'circle-opacity': 0.7
        }
      });

      mapboxMap.addSource('highlight-city', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      mapboxMap.addLayer({
        id: 'highlight-city-layer',
        type: 'circle',
        source: 'highlight-city',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            2, ['interpolate', ['linear'], ['get', 'total'], 0, 4, 40, 10],
            4, ['interpolate', ['linear'], ['get', 'total'], 0, 5, 40, 20],
            6, ['interpolate', ['linear'], ['get', 'total'], 0, 10, 40, 30],
            8, ['+', 15, ['*', ['sqrt', ['get', 'total']], 4]]
          ],
          'circle-color': 'rgba(255, 255, 0, 0.2)',
          'circle-stroke-color': 'rgba(255, 215, 0, 0.5)',
          'circle-stroke-width': 8,
          'circle-blur': 0.4,
          'circle-opacity': 1.0

        }
      });


      // Mouse interaction tooltip
      const tooltip = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'city-tooltip'
      });

      mapboxMap.on('mouseenter', 'city-circles', (e) => {
        mapboxMap.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        const typeLabel =
          props.borderColor === "#2980b9" ? " (Single-function)" :
            props.borderColor === "#ffffff" ? " (Multi-functional)" : "";

        const html = `
          <strong>${props.city}</strong><br>
          ${props.mainFunc}${typeLabel}<br>
          ${props.total} companies
        `;

        tooltip.setLngLat(e.lngLat).setHTML(html).addTo(mapboxMap);
      });

      mapboxMap.on('mouseleave', 'city-circles', () => {
        mapboxMap.getCanvas().style.cursor = '';
        tooltip.remove();
      });

      mapboxMap.on('click', 'city-circles', (e) => {
        const props = e.features[0].properties;
        const cityName = props.city;
        const info = cityData[cityName];
        if (!info) return;

        if (mapboxMap.getZoom() <= 3) {
          mapboxMap.flyTo({
            center: e.lngLat,
            zoom: 6.0,
            speed: 1.2,
            curve: 1.42,
            easing: t => t
          });
        }
        if (scatterChart) {
          const pointIndex = scatterChart.data.datasets[0].data.findIndex(p => p.city === cityName);
          if (pointIndex !== -1) {
            scatterChart.setActiveElements([{
              datasetIndex: 0,
              index: pointIndex
            }]);
            scatterChart.tooltip.setActiveElements([{
              datasetIndex: 0,
              index: pointIndex
            }], { x: 0, y: 0 });
            scatterChart.update();
          }
        }

        const clickedFeature = e.features[0];

        mapboxMap.getSource('highlight-city').setData({
          type: 'FeatureCollection',
          features: [clickedFeature] // Highlight the clicked feature directly as highlighted data
        });

        const donutData = prepareDonutData(info);
        showCityCard(cityName, donutData, info);

        const functionCategory = getFunctionCategory(info);
        showCityPanel(cityName, functionCategory);
      });
      const scatterData = buildScatterData();
      drawScatterPlot(scatterData);
      applyFilter();
    });

    mapboxMap.on('zoomend', () => {
      const selected = getSelectedFunctions();
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

      const geojson = convertCityDataToGeoJSON(cityData, mapboxMap.getZoom(), selected, minCount);
      const source = mapboxMap.getSource('cities');
      if (source) source.setData(geojson);
    });


    const rangeSlider = document.getElementById("topCityLimit");

    rangeSlider.addEventListener("input", () => {
      const selected = getSelectedFunctions();
      const limit = parseInt(rangeSlider.value, 10) || 10;
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

      // Updated top city charts
      updateTopCitiesByFunctionMulti(selected, limit, minCount);

      // Synchronization of map data
      const geojson = convertCityDataToGeoJSON(cityData, mapboxMap.getZoom(), selected, minCount);
      const source = mapboxMap.getSource('cities');
      if (source) source.setData(geojson);
    });


    // Add after these two
    document.getElementById('minCompanyCount').addEventListener('change', () => {
      const selected = getSelectedFunctions();
      const limit = parseInt(rangeSlider.value);
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

      updateTopCitiesByFunctionMulti(selected, limit, minCount);
      const geojson = convertCityDataToGeoJSON(cityData, mapboxMap.getZoom(), selected, minCount);
      const source = mapboxMap.getSource('cities');
      if (source) source.setData(geojson);
    });


    // Charting for the first time
    const selectedFunctions = Object.keys(colorMap).filter(f => f !== "Unclassified");
    const limit = parseInt(rangeSlider.value) || 10;
    const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
    updateTopCitiesByFunctionMulti(selectedFunctions, limit, minCount);

    // Binding filters and sliders
    document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        const selected = getSelectedFunctions();
        const limit = parseInt(rangeSlider.value) || 10;
        const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

        updateTopCitiesByFunctionMulti(selected, limit, minCount); // minCount

        const geojson = convertCityDataToGeoJSON(cityData, mapboxMap.getZoom(), selected, minCount); 
        const source = mapboxMap.getSource('cities');
        if (source) source.setData(geojson);
      });
    });
  });

//table
document.getElementById('toggleChartsBtn').addEventListener('click', () => {
  const bg = document.getElementById('chartsBackground');
  const charts = document.getElementById('chartsSection');
  const btn = document.getElementById('toggleChartsBtn');
  const wrapper = document.getElementById('dashboardWrapper');

  const isExpanded = bg.classList.toggle('expanded');

  if (isExpanded) {
    charts.classList.add('expanded');
    charts.classList.remove('collapsed');  // Key: remove collapsed
  } else {
    charts.classList.remove('expanded');
    charts.classList.add('collapsed');     // Add back collapsed when put away
  }

  if (wrapper) {
    wrapper.classList.toggle('scrollable', isExpanded);
  }

  btn.innerText = isExpanded ? '▼ Hide Charts' : '▲ Show Charts';
});

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(eventName => {
  document.addEventListener(eventName, () => {
    console.log('Fullscreen event detected!');
    const wrapper = document.getElementById('dashboardWrapper');
    const isFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (isFullscreen) {
      wrapper.classList.add('fullscreen');
    } else {
      wrapper.classList.remove('fullscreen');
    }
  });
});







