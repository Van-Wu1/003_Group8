// configure
const MAPBOX_TOKEN = 'pk.eyJ1IjoicWl1eXVlcWl1MjAwMiIsImEiOiJjbWFjejV3OGMwOThiMmtzaGswMWRmam16In0.8one7mciYXQt13wcK5yxHQ';
mapboxgl.accessToken = MAPBOX_TOKEN;

// global variable
let map;                     // Map Objects
let pharmaData = [];         // Original pharmaceutical company data
let uniqueCompanies = [];    // List of unique companies (in order of revenue)
let currentCompany = '';     // Currently selected companies
let minOwnershipFilter = 50;  //  Ownership screening thresholds
let labelsVisible = true;    // Whether the label is visible or not
let isInitialized = false;   // Initialized or not
let citySubsidiaries = {};   // A collection of subsidiaries in each city
let lastCenterPosition = null; // Last map center location
let sideAnalysisPanelVisible = false; // Whether to display the side analysis panel

// Mapping of continent names
const CONTINENT_NAMES = {
  'NA': 'North America',
  'SA': 'South America',
  'EU': 'Europe',
  'AS': 'Asia',
  'AF': 'Africa',
  'OC': 'Oceania'
};

// DOM element references
const dom = {};

// Initializing DOM references
function initDOMReferences() {
  dom.loadingIndicator = document.getElementById('loading-indicator');
  dom.companySelector = document.getElementById('company-selector');
  dom.ownershipSlider = document.getElementById('ownership-slider');
  dom.ownershipValue = document.getElementById('ownership-value');
  dom.totalEntities = document.getElementById('total-entities');
  dom.hqCount = document.getElementById('hq-count');
  dom.subCount = document.getElementById('sub-count');
  dom.avgOwnership = document.getElementById('avg-ownership');
  dom.intlRatio = document.getElementById('intl-ratio');
  dom.totalAssets = document.getElementById('total-assets');
  dom.powerCentersList = document.getElementById('power-centers-list');
  dom.zoomFitBtn = document.getElementById('zoom-fit');
  dom.zoomHqBtn = document.getElementById('zoom-hq');
  dom.toggleLabelsBtn = document.getElementById('toggle-labels');
  dom.panelTabs = document.querySelectorAll('.panel-tab');
  dom.subsidiarySearch = document.getElementById('subsidiary-search');
  dom.continentFilter = document.getElementById('continent-filter');
  dom.sortBtns = document.querySelectorAll('.sort-btn');
  dom.subsidiariesTable = document.getElementById('subsidiaries-table')?.querySelector('tbody');
  dom.hierarchyViz = document.getElementById('hierarchy-viz');
  dom.modalCloseBtn = document.getElementById('modal-close');
  dom.detailModal = document.getElementById('detail-modal');
  dom.subsidiariesContent = document.getElementById('subsidiaries-content');
  dom.analysisContent = document.getElementById('analysis-content');
  dom.panelResizer = document.getElementById('panel-resizer');
  dom.detailsPanel = document.getElementById('details-panel');
  // Added DOM references
  dom.sideAnalysisPanelTrigger = document.getElementById('side-analysis-panel-trigger');
  dom.sideAnalysisPanel = document.getElementById('side-analysis-panel');
  // Adding a new DOM reference
  dom.analysisContent = document.getElementById('analysis-content');
  dom.toggleAnalysisBtn = document.getElementById('toggle-analysis');
  dom.panelContentWrapper = document.querySelector('.panel-content-wrapper');
  // additional
  dom.infoArea = document.getElementById('information_area');
  dom.slidetab = document.getElementById('slide-tab');
}

// initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Initializing DOM references
  console.log("Initializing pharmaceutical network visualization...");
  initDOMReferences();

  // Checking for the presence of necessary DOM elements
  if (!checkRequiredElements()) {
    console.error('Necessary DOM elements are missing');
    return;
  }

  showLoading(true);

  try {
    // Initializing the map
    await initMap();

    // Add a forced resize after map initialization
    if (map) {
      map.resize();
    }

    // Load data
    await loadData();

    // Initialize UI events
    initEventListeners();

    // Updating the initial visualization
    updateVisualization();

    // Initialization success flag
    isInitialized = true;
    console.log("Initialization completed successfully");
  } catch (error) {
    console.error('Initialisation failure:', error);
    alert('Application Load Failure: ' + error.message);
  } finally {
    initUserPreferences();
    showLoading(false);
  }

  initHelpModalEvents();
  ensureHelpButtonWorks();
});

// Checking for the existence of necessary DOM elements
function checkRequiredElements() {
  const requiredElements = [
    'loading-indicator',
    'company-selector',
    'ownership-slider',
    'total-entities',
    'mapCompany',
    'hierarchy-viz',
    'power-centers-list'
  ];

  let allExist = true;
  requiredElements.forEach(id => {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Missing required element: ${id}`);
      allExist = false;
    }
  });

  return allExist;
}

// Initializing the map
async function initMap() {
  return new Promise((resolve, reject) => {
    try {
      map = new mapboxgl.Map({
        container: 'mapCompany',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 30],
        zoom: 1.8,
        width: '100%',  // Add this
        height: '100%'  // Add this
      });

      map.addControl(new mapboxgl.NavigationControl());

      map.on('load', () => {
        // Adding a Data Source
        map.addSource('entities', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addSource('connections', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Adding a Connection Line Layer
        map.addLayer({
          id: 'connections-layer',
          type: 'line',
          source: 'connections',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2, // Fixed line widths, no more changes based on ownership
            'line-opacity': 0.7
          }
        });

        // Adding a solid node layer

        // Subsidiary Layers
        map.addLayer({
          id: 'subsidiary-layer',
          type: 'circle',
          source: 'entities',
          filter: ['==', ['get', 'type'], 'sub'],
          paint: {
            'circle-radius': [
              'step',
              ['zoom'],
              4,    // Default: zoom < 3
              3, 6, // zoom >= 3 → 6
              5, 10,// zoom >= 5 → 10
              8, 14 // zoom >= 8 → 14f
            ],
            'circle-color': '#3498db',
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white',
            'circle-opacity': 0.85
          }
        });

        // HQ Layer (Late Add → Show at top)
        map.addLayer({
          id: 'hq-layer',
          type: 'circle',
          source: 'entities',
          filter: ['==', ['get', 'type'], 'hq'],
          paint: {
            'circle-radius': [
              'step',
              ['zoom'],
              4,    // Default: zoom < 3
              3, 6, // zoom >= 3 → 6
              5, 10,// zoom >= 5 → 10
              8, 14 // zoom >= 8 → 14f
            ],
            'circle-color': '#e74c3c',
            'circle-stroke-width': 2,
            'circle-stroke-color': 'white',
            'circle-opacity': 0.95
          }
        });

        // entity label
        map.addLayer({
          id: 'entities-labels',
          type: 'symbol',
          source: 'entities',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'visibility': 'visible'
          },
          paint: {
            'text-color': '#0A4DA3',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          },
          minzoom: 3
        });

        // Setting up interactions
        setupMapInteractions();

        resolve();
      });

      map.on('error', (e) => {
        console.error('Map error:', e);
        reject(e);
        setTimeout(() => {
          map.resize();
        }, 100);

        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

//  Load data
async function loadData() {
  try {
    // Sample data paths - need to be replaced in a real environment
    const response = await fetch('data/world_com_top20_by_revenue_eng.json');
    if (!response.ok) {
      // Simulated data for demonstration purposes
      console.warn('Demonstration using modelled data');
      pharmaData = generateMockData();
    } else {
      // Parsing JSON data
      pharmaData = await response.json();
    }

    // Ranking of companies by revenue
    const companyRevenue = {};
    pharmaData.forEach(d => {
      if (d.company) {
        if (!companyRevenue[d.company]) {
          companyRevenue[d.company] = d.Operating_Revenue_1000USD || 0;
        }
      }
    });

    // Sort by income and take the top 20
    uniqueCompanies = Object.keys(companyRevenue)
      .sort((a, b) => companyRevenue[b] - companyRevenue[a])
      .slice(0, 20);

    console.log(`Loaded ${pharmaData.length} data records, filtered ${uniqueCompanies.length} companies.`);

    // Not setting the default selected company 
    // currentCompany = uniqueCompanies[0] || '';

    // Populate Company Selector
    populateCompanySelector();

    // Building an Index of Urban Subsidiaries
    buildCitySubsidiariesIndex();

    return pharmaData;
  } catch (error) {
    console.error('Failed to load data:', error);
    // Use analog data as a backup
    pharmaData = generateMockData();

    // Get the only company
    const companySet = new Set();
    pharmaData.forEach(d => companySet.add(d.company));
    uniqueCompanies = Array.from(companySet).slice(0, 20);

    // No more default selected companies
    // currentCompany = uniqueCompanies[0] || '';

    // Populate Company Selector
    populateCompanySelector();

    // Building an Index of Urban Subsidiaries
    buildCitySubsidiariesIndex();

    return pharmaData;
  }
}

// Build City Subsidiary Index - for improved detail popups
function buildCitySubsidiariesIndex() {
  citySubsidiaries = {};

  pharmaData.forEach(d => {
    if (d.Subsidiary_City_clean && d.Country_sub) {
      const cityKey = `${d.Subsidiary_City_clean}|${d.Country_sub}`;

      if (!citySubsidiaries[cityKey]) {
        citySubsidiaries[cityKey] = [];
      }

      citySubsidiaries[cityKey].push({
        name: d.Subsidiary_Name || 'Unnamed subsidiaries',
        company: d.company,
        ownership: d.Ownership_filled,
        assets: d.sub_Assets_filled,
        employees: d.sub_Employees_final,
        naceCode: d.sub_nace_code,
        naceCategory: d.sub_nace_category
      });
    }
  });
}

// Populate Company Selector
function populateCompanySelector() {
  if (!dom.companySelector) return;

  dom.companySelector.innerHTML = '';

  // Add All Companies Option
  const defaultOption = document.createElement('option');
  defaultOption.value = "";
  defaultOption.textContent = "Please select a company to view";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  dom.companySelector.appendChild(defaultOption);

  // Add All Companies Option
  const allOption = document.createElement('option');
  allOption.value = 'ALL';
  allOption.textContent = 'ALL TOP 20 COMPANIES';
  dom.companySelector.appendChild(allOption);

  // Add company options (sorted by revenue)
  uniqueCompanies.forEach(company => {
    const option = document.createElement('option');
    option.value = company;
    option.textContent = company;
    dom.companySelector.appendChild(option);
  });

  // Setting the default selected company
  dom.companySelector.value = currentCompany;
}

// Formatted Numeric Display
// Modify the formatValue function to display values in English format.
function formatValue(value, isEstimated = false, unit = '') {
  if (value === null || value === undefined || value === 0) {
    return 'No data';
  }

  // Use different units for different sized values
  let formatted;
  let unitLabel = '';

  if (value >= 1000000000) {
    // One billion and above
    formatted = (value / 1000000000).toFixed(2);
    unitLabel = ' B'; // Billion
  } else if (value >= 1000000) {
    // Millions to billions
    formatted = (value / 1000000).toFixed(2);
    unitLabel = ' M'; // Million
  } else if (value >= 1000) {
    // Thousands to millions
    formatted = (value / 1000).toFixed(2);
    unitLabel = ' K'; // Thousand
  } else {
    // less than a thousand
    formatted = value.toFixed(2);
  }

  // Adding the thousandths comma
  formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Add Unit
  if (unit) {
    formatted += unit;
  } else {
    formatted += unitLabel;
  }

  // Add an asterisk if it is an estimate
  if (isEstimated) {
    formatted += '*';
  }

  return formatted;
}

// Preparing network data
function prepareNetworkData() {
  // Filtering current company data
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // Storage nodes and connections
  const entities = [];
  const connections = [];
  const processedCities = new Map();

  // color mapping
  const continentColors = {
    NA: '#E893C5', // North America - Pink
    EU: '#3785D8', // Europe - Blue
    AS: '#ADC6E5', // Asia - Light Blue
    AF: '#BF8CE1', // Africa - Purple
    SA: '#EBB2C3', // South America - Light Pink
    OC: '#CBD8E8',  // Oceania - lightest blue
    'default': '#95a5a6'
  };

  // Process each record, create nodes and connections
  filteredData.forEach(d => {
    // Creating Subsidiary City Nodes
    if (d.Subsidiary_City_clean && d.sub_lat && d.sub_lng) {
      const cityKey = `${d.Subsidiary_City_clean}|${d.Country_sub}`;

      if (!processedCities.has(cityKey)) {
        // Calculate node size (using revenue data)
        const revenue = d.sub_Operating_Revenue_millionUSD || 0;
        const size = Math.min(15, Math.max(5, Math.log10(revenue + 1) * 3));

        entities.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [d.sub_lng, d.sub_lat]
          },
          properties: {
            id: cityKey,
            name: d.Subsidiary_City_clean,
            company: d.company,
            country: d.Country_sub,
            type: 'sub',
            size: size,
            assets: d.sub_Assets_filled,
            revenue: d.sub_Operating_Revenue_millionUSD,
            employees: d.sub_Employees_final,
            ownership: d.Ownership_filled,
            continent: d.continent_sub,
            isEstimated: {
              assets: d.sub_Assets_is_estimated,
              employees: d.sub_Employees_is_estimated,
              ownership: d.Ownership_is_estimated
            }
          }
        });

        processedCities.set(cityKey, true);
      }
    }

    // Creating a headquarters node
    if (d.Parent_City_clean && d.head_lat && d.head_lng) {
      const hqKey = `${d.Parent_City_clean}|${d.Country_head}`;

      if (!processedCities.has(hqKey)) {
        const revenue = d.Operating_Revenue_1000USD || 0;
        const size = Math.min(20, Math.max(8, Math.log10(revenue / 1000 + 1) * 4));

        entities.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [d.head_lng, d.head_lat]
          },
          properties: {
            id: hqKey,
            name: d.Parent_City_clean,
            company: d.company,
            country: d.Country_head,
            type: 'hq',
            size: size,
            assets: d.Total_Assets_1000USD,
            revenue: d.Operating_Revenue_1000USD,
            employees: d.Employees_Count,
            continent: d.continent_head
          }
        });

        processedCities.set(hqKey, true);
      }
    }

    // Create a connection (only if the headquarters and subsidiary are different cities)
    if (d.Parent_City_clean && d.Subsidiary_City_clean &&
      d.head_lat && d.head_lng && d.sub_lat && d.sub_lng &&
      (d.Parent_City_clean !== d.Subsidiary_City_clean || d.Country_head !== d.Country_sub)) {

      connections.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [d.head_lng, d.head_lat],
            [d.sub_lng, d.sub_lat]
          ]
        },
        properties: {
          company: d.company,
          ownership: d.Ownership_filled,
          color: continentColors[d.continent_sub] || continentColors.default,
          control_strength: d.control_strength,
          is_international: d.is_international,
          from: d.Parent_City_clean,
          to: d.Subsidiary_City_clean
        }
      });
    }
  });

  return { entities, connections };
}

// Updated map data
function updateMapData(entities, connections) {
  if (!map || !map.getSource('entities') || !map.getSource('connections')) {
    console.error('Map source not ready');
    return;
  }

  map.getSource('entities').setData({
    type: 'FeatureCollection',
    features: entities
  });

  map.getSource('connections').setData({
    type: 'FeatureCollection',
    features: connections
  });
}

// Setting up map interactions
function setupMapInteractions() {
  // Mouse hover effect
  map.on('mouseenter', 'entities-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'entities-layer', () => {
    map.getCanvas().style.cursor = '';
  });

  // Click on the node to show details
  // Subsidiary node click
  map.on('click', 'subsidiary-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    showEntityDetails(props);
  });

  // Headquarters node click
  map.on('click', 'hq-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    showEntityDetails(props);
  });

  // Change mouse style on hover
  ['subsidiary-layer', 'hq-layer'].forEach(layerId => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// Show Entity Details - Enhanced to show list of city subsidiaries
function showEntityDetails(props) {
  let modalContent = '';

  if (props.type === 'hq') {
    modalContent = `
      <div class="entity-details">
        <div class="entity-header">
          <div class="entity-icon hq-icon">
            <i class="fas fa-building"></i>
          </div>
          <div class="entity-title">
            <h3>${props.company}</h3>
            <div class="entity-subtitle">HQ: ${props.name}, ${props.country}</div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Total Assets</div>
              <div class="detail-value">$${formatNumberToFinancial(props.assets)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Annual Revenue</div>
              <div class="detail-value">$${formatNumberToFinancial(props.revenue)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Employees</div>
              <div class="detail-value">${formatNumber(props.employees)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Continent</div>
              <div class="detail-value">${getContinentName(props.continent)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Subsidiary City Details - shows all subsidiaries in that city
    const cityKey = `${props.name}|${props.country}`;
    const subsidiariesInCity = citySubsidiaries[cityKey] || [];

    let subsidiariesList = '';
    if (subsidiariesInCity.length > 0) {
      subsidiariesList = `
        <div class="city-subsidiaries-list">
          <h4>Subsidiaries in this City (${subsidiariesInCity.length})</h4>
      `;

      subsidiariesInCity.forEach(sub => {
        subsidiariesList += `
          <div class="subsidiary-item">
            <div class="subsidiary-name">${sub.name}</div>
            <div class="subsidiary-details">
              <span>Ownership: ${formatValue(sub.ownership, false, '%')}</span>
              <span>Parent: ${sub.company}</span>
            </div>
            <div class="subsidiary-details">
              <span>Function: ${sub.naceCategory || 'Unclassified'}</span>
              <span>Assets: ${formatValue(sub.assets, false, 'M')}</span>
            </div>
          </div>
        `;
      });

      subsidiariesList += '</div>';
    }

    modalContent = `
      <div class="entity-details">
        <div class="entity-header">
          <div class="entity-icon sub-icon">
            <i class="fas fa-industry"></i>
          </div>
          <div class="entity-title">
            <h3>${props.name}</h3>
            <div class="entity-subtitle">Subsidiary City: ${props.country}</div>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">Continent</div>
              <div class="detail-value">${getContinentName(props.continent)}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Number of Subsidiaries</div>
              <div class="detail-value">${subsidiariesInCity.length}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Average Ownership</div>
              <div class="detail-value">${calculateAvgOwnership(subsidiariesInCity)}%</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Total Assets</div>
              <div class="detail-value">${calculateTotalAssets(subsidiariesInCity)} million USD</div>
            </div>
          </div>
        </div>
        
        ${subsidiariesList}
      </div>
    `;
  }

  // Show Modal Window
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const detailModal = document.getElementById('detail-modal');

  if (modalTitle && modalBody && detailModal) {
    modalTitle.textContent = props.type === 'hq' ? 'HQ Details' : 'Subsidiary City Details';
    modalBody.innerHTML = modalContent;
    detailModal.classList.remove('hidden');
  }
}

// New function dedicated to formatting financial figures
function formatNumberToFinancial(num) {
  if (!num) return "0";

  // Judging the magnitude of values and choosing appropriate units
  let value, unit;

  if (num >= 1000000000000) {
    value = num / 1000000000000;
    unit = " T"; // trillion
  } else if (num >= 1000000000) {
    value = num / 1000000000;
    unit = " B"; // billion
  } else if (num >= 1000000) {
    value = num / 1000000;
    unit = " M"; // million
  } else if (num >= 1000) {
    value = num / 1000;
    unit = " K"; // thousand
  } else {
    value = num;
    unit = "";
  }

  // Formatting to two decimals and adding thousand separators
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + unit;
}

// Calculation of the average holding percentage of city subsidiaries
function calculateAvgOwnership(subsidiaries) {
  if (!subsidiaries || subsidiaries.length === 0) return 0;

  const total = subsidiaries.reduce((sum, sub) => sum + (sub.ownership || 0), 0);
  return (total / subsidiaries.length).toFixed(1);
}

// Calculate total assets of city subsidiaries
// Modify the function that calculates the total assets of city subsidiaries
function calculateTotalAssets(subsidiaries) {
  if (!subsidiaries || subsidiaries.length === 0) return "0";

  const total = subsidiaries.reduce((sum, sub) => sum + (sub.assets || 0), 0);
  return formatNumberToFinancial(total); // Using the new financial number formatting function
}

// Updating network statistics
function updateNetworkStatistics() {
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // statistical computing
  const uniqueHQs = new Set(filteredData.filter(d => d.Parent_City_clean && d.head_lat && d.head_lng).map(d => `${d.Parent_City_clean}|${d.Country_head}`));
  const uniqueSubs = new Set(filteredData.filter(d => d.Subsidiary_City_clean).map(d => `${d.Subsidiary_City_clean}|${d.Country_sub}`));

  const avgOwnership = filteredData.length > 0 ?
    filteredData.reduce((sum, d) => sum + (d.Ownership_filled || 0), 0) / filteredData.length : 0;

  const internationalCount = filteredData.filter(d => d.is_international === 1).length;
  const intlRatio = filteredData.length > 0 ? (internationalCount / filteredData.length) * 100 : 0;

  // Use of income data as a substitute for asset data
  const totalRevenue = filteredData.reduce((sum, d) => sum + (d.sub_Operating_Revenue_millionUSD || 0), 0);
  const directControl = filteredData.filter(d => d.Ownership_filled === 100).length;

  // Updating the DOM
  updateDOMElement('total-entities', uniqueHQs.size + uniqueSubs.size);
  updateDOMElement('hq-count', uniqueHQs.size);
  updateDOMElement('sub-count', uniqueSubs.size);
  updateDOMElement('avg-ownership', avgOwnership.toFixed(1) + '%');
  updateDOMElement('intl-ratio', intlRatio.toFixed(1) + '%');
  updateDOMElement('total-assets', '$' + formatNumber(totalRevenue) + 'M'); // 更改为总收入

  // Updated Hierarchy Icons - Improved Layout
  updateHierarchyDiagram(uniqueHQs.size, uniqueSubs.size, directControl, internationalCount);

  // Updating of the main control center
  updatePowerCenters(filteredData);
}

// Update Subsidiary Forms
// Modifying the asset display section in the updateSubsidiariesTable function
function updateSubsidiariesTable() {
  if (!dom.subsidiariesTable) return;

  dom.subsidiariesTable.innerHTML = '';

  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  filteredData.forEach(sub => {
    if (!sub.Subsidiary_City_clean) return;

    const row = document.createElement('tr');
    row.dataset.continent = sub.continent_sub || '';
    row.dataset.ownership = sub.Ownership_filled || 0;
    row.dataset.assets = sub.sub_Assets_filled || 0;

    // NACE Codes and Categories
    const naceInfo = sub.sub_nace_code ?
      `${sub.sub_nace_code} (${sub.sub_nace_category || 'Other'})` :
      'N/A';

    // Add a title attribute to the name of the subsidiary to make it easier to hover over it to see the full name
    const subsidiaryName = sub.Subsidiary_Name || 'Unnamed Subsidiary';

    row.innerHTML = `
      <td title="${subsidiaryName}">${subsidiaryName}</td>
      <td>${sub.Subsidiary_City_clean}</td>
      <td>${sub.Country_sub}</td>
      <td>${formatValue(sub.Ownership_filled, sub.Ownership_is_estimated, '%')}</td>
      <td>${naceInfo}</td>
      <td>$${formatNumberToFinancial(sub.sub_Assets_filled)}</td>
    `;

    dom.subsidiariesTable.appendChild(row);
  });
}

// Update visualization (main function)
function updateVisualization() {
  if (!isInitialized) return;

  // If no company is selected, a prompt message is displayed
  if (!currentCompany) {
    // Clear data display
    updateDOMElement('total-entities', '0');
    updateDOMElement('hq-count', '0');
    updateDOMElement('sub-count', '0');
    updateDOMElement('avg-ownership', '0%');
    updateDOMElement('intl-ratio', '0%');
    updateDOMElement('total-assets', '$0M');

    // Empty tables and other visualizations
    if (dom.subsidiariesTable) {
      dom.subsidiariesTable.innerHTML = '';
    }

    // Reset map
    if (map && map.getSource('entities') && map.getSource('connections')) {
      map.getSource('entities').setData({
        type: 'FeatureCollection',
        features: []
      });
      map.getSource('connections').setData({
        type: 'FeatureCollection',
        features: []
      });
    }

    return;
  }

  showLoading(true);

  // Save Current Map Center - Resolve an issue where ownership filtering was causing the map to reset
  if (map && currentCompany !== 'ALL') {
    lastCenterPosition = {
      center: map.getCenter(),
      zoom: map.getZoom()
    };
  }

  setTimeout(() => {
    try {
      const { entities, connections } = prepareNetworkData();
      updateMapData(entities, connections);
      updateNetworkStatistics();
      updateSubsidiariesTable();

      // Update Analytics Chart - Modify here to update as long as the status is not collapsed
      if (!dom.analysisContent.classList.contains('collapsed')) {
        initAnalysisCharts();
      }

      // Decide whether to update map locations based on strategy
      if (currentCompany !== 'ALL') {
        // Spotlight on Current Corporate Headquarters Locations
        const hq = pharmaData.find(d => d.company === currentCompany && d.head_lat && d.head_lng);
        if (hq) {
          map.flyTo({
            center: [hq.head_lng, hq.head_lat],
            zoom: 4,
            speed: 0.8,
            curve: 1.2
          });
        }
      } else {
        fitMapToData(); // See all data for all companies
      }
    } catch (error) {
      console.error('更新可视化失败:', error);
    } finally {
      showLoading(false);
    }
  }, 100);
}

// Initializing Analytics Charts
function initAnalysisCharts() {
  // If the analysis panel is collapsed, the chart is not initialized
  if (dom.analysisContent && dom.analysisContent.classList.contains('collapsed')) {
    return;
  }
  // Get Chart Container
  const densityChart = document.getElementById('density-chart');
  const distanceChart = document.getElementById('distance-chart');
  const hubChart = document.getElementById('hub-chart');

  if (!densityChart || !distanceChart || !hubChart) return;

  // Clearing an Existing Chart
  //  Clearing old charts using the destroy method of Chart.js
  const chartInstances = [
    Chart.getChart(densityChart),
    Chart.getChart(distanceChart),
    Chart.getChart(hubChart)
  ];

  chartInstances.forEach(chart => {
    if (chart) {
      chart.destroy();
    }
  });

  // Prepare data
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // 1. Control network density analysis
  createNetworkDensityChart(densityChart, filteredData);

  // 2. Statistics on transnational control pathways
  createControlDistanceChart(distanceChart, filteredData);

  // 3. Power Hub City Analysis
  createPowerHubChart(hubChart, filteredData);
}

// Creating Network Density Graphs
function createNetworkDensityChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // Calculation of control network density per continent
  const continentDensity = {};
  const continentConnections = {};

  data.forEach(d => {
    if (d.continent_head && d.continent_sub) {
      const fromContinent = d.continent_head;
      const toContinent = d.continent_sub;

      // Counting the number of nodes per continent
      continentDensity[fromContinent] = (continentDensity[fromContinent] || 0) + 1;
      continentDensity[toContinent] = (continentDensity[toContinent] || 0) + 1;

      // Counting intercontinental connections
      const key = `${fromContinent}-${toContinent}`;
      continentConnections[key] = (continentConnections[key] || 0) + 1;
    }
  });

  // Preparing chart data
  const continents = Object.keys(CONTINENT_NAMES);
  const densityData = continents.map(code => continentDensity[code] || 0);

  // Creating Charts
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: continents.map(code => CONTINENT_NAMES[code]),
      datasets: [{
        label: 'Number of nodes',
        data: densityData,
        backgroundColor: [
          // Use the Night Sky swatch color: 
          'rgba(232, 147, 197, 0.8)', // Pink - NA
          'rgba(235, 178, 195, 0.8)', // Light Pink - SA
          'rgba(55, 133, 216, 0.8)',  // Blue - EU
          'rgba(173, 198, 229, 0.8)', // Light Blue - AS
          'rgba(191, 140, 225, 0.8)', // Purple - AF
          'rgba(203, 216, 232, 0.8)'  // Lightest Blue - OC
        ],
        borderColor: [
          'rgba(232, 147, 197, 1)', 
          'rgba(235, 178, 195, 1)',
          'rgba(55, 133, 216, 1)',
          'rgba(173, 198, 229, 1)',
          'rgba(191, 140, 225, 1)',
          'rgba(203, 216, 232, 1)' 
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of nodes'
          }
        },
        x: {
          title: {
            display: true,
            text: 'continents'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Density of control networks by continent'
        }
      }
    }
  });
}

// Creating Control Distance Charts
function createControlDistanceChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // Calculation of control distance (geographic distance from headquarters to subsidiaries)
  const distances = [];

  data.forEach(d => {
    if (d.head_lat && d.head_lng && d.sub_lat && d.sub_lng &&
      (d.Parent_City_clean !== d.Subsidiary_City_clean || d.Country_head !== d.Country_sub)) {
      const distance = calculateDistance(d.head_lat, d.head_lng, d.sub_lat, d.sub_lng);
      distances.push({
        distance: distance,
        international: d.is_international === 1,
        ownership: d.Ownership_filled
      });
    }
  });

  // Grouping by distance
  const distanceGroups = [
    { label: '0–1000 km', min: 0, max: 1000, count: 0, international: 0 },
    { label: '1000–3000 km', min: 1000, max: 3000, count: 0, international: 0 },
    { label: '3000–5000 km', min: 3000, max: 5000, count: 0, international: 0 },
    { label: '5000–10000 km', min: 5000, max: 10000, count: 0, international: 0 },
    { label: '>10000 km', min: 10000, max: Infinity, count: 0, international: 0 }
  ];

  distances.forEach(d => {
    const group = distanceGroups.find(g => d.distance >= g.min && d.distance < g.max);
    if (group) {
      group.count++;
      if (d.international) group.international++;
    }
  });

  // Creating Charts
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: distanceGroups.map(g => g.label),
      datasets: [{
        label: 'Total Controls',
        data: distanceGroups.map(g => g.count),
        backgroundColor: 'rgba(55, 133, 216, 0.8)', 
        borderColor: 'rgba(55, 133, 216, 1)', 
        borderWidth: 1
      }, {
        label: 'International Controls',
        data: distanceGroups.map(g => g.international),
        backgroundColor: 'rgba(232, 147, 197, 0.8)', 
        borderColor: 'rgba(232, 147, 197, 1)', 
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Control Links'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Control Distance'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Distribution of Control Distances'
        }
      }
    }
  });
}

// Create power hub city charts
function createPowerHubChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // Counting the number of subsidiaries and companies controlled by each city
  const cityData = {};

  data.forEach(d => {
    if (d.Subsidiary_City_clean && d.Country_sub) {
      const key = `${d.Subsidiary_City_clean}, ${d.Country_sub}`;

      if (!cityData[key]) {
        cityData[key] = {
          city: d.Subsidiary_City_clean,
          country: d.Country_sub,
          count: 0,
          companies: new Set(),
          assets: 0
        };
      }

      cityData[key].count++;
      cityData[key].companies.add(d.company);
      cityData[key].assets += d.sub_Assets_filled || 0;
    }
  });

  // Sort and take the top 10
  const topCities = Object.values(cityData)
    .sort((a, b) => b.companies.size - a.companies.size)
    .slice(0, 10);

  // Creating Charts
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCities.map(c => `${c.city}, ${c.country}`),
      datasets: [{
        label: 'Number of Controlling Companies',
        data: topCities.map(c => c.companies.size),
        backgroundColor: 'rgba(173, 198, 229, 0.8)', 
        borderColor: 'rgba(173, 198, 229, 1)', 
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Controlling Companies'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Strategic Hub Cities Controlling Multiple Companies'
        }
      }
    }
  });
}

// Calculating geographic distances (using Haversine's formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius (kilometers)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initializing event listeners
function initEventListeners() {

  // Company Selection
  if (dom.companySelector) {
    dom.companySelector.addEventListener('change', (e) => {
      if (e.target.value) { // Make sure a valid value is selected
        currentCompany = e.target.value;
        updateVisualization();
      }
    });
  }

  // Ownership Screening
  if (dom.ownershipSlider) {
    dom.ownershipSlider.addEventListener('input', (e) => {
      minOwnershipFilter = parseInt(e.target.value);
      if (dom.ownershipValue) {
        dom.ownershipValue.textContent = minOwnershipFilter;
      }
    });

    dom.ownershipSlider.addEventListener('change', () => {
      updateVisualization();
    });
  }

  // Map Controls
  if (dom.zoomFitBtn) {
    dom.zoomFitBtn.addEventListener('click', fitMapToData);
  }

  if (dom.zoomHqBtn) {
    dom.zoomHqBtn.addEventListener('click', zoomToHeadquarters);
  }

  if (dom.toggleLabelsBtn) {
    dom.toggleLabelsBtn.addEventListener('click', toggleLabels);
  }

  // Panel tab switching
  if (dom.panelTabs) {
    dom.panelTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        switchPanelTab(e.target);
      });
    });
  }

  // Subsidiary Search
  if (dom.subsidiarySearch) {
    dom.subsidiarySearch.addEventListener('input', filterSubsidiaries);
  }

  // Continent Screening
  if (dom.continentFilter) {
    dom.continentFilter.addEventListener('change', filterSubsidiaries);
  }

  // Sort Buttons
  if (dom.sortBtns) {
    dom.sortBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        sortSubsidiaries(e.target);
      });
    });
  }

  // Modal window closes
  if (dom.modalCloseBtn) {
    dom.modalCloseBtn.addEventListener('click', () => {
      if (dom.detailModal) {
        dom.detailModal.classList.add('hidden');
      }
    });
  }

  // Click outside the modal box to close it
  if (dom.detailModal) {
    dom.detailModal.addEventListener('click', (e) => {
      if (e.target === dom.detailModal) {
        dom.detailModal.classList.add('hidden');
      }
    });
  }

  // Details panel resizing
  if (dom.panelResizer && dom.detailsPanel) {
    let startY, startHeight;

    dom.panelResizer.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startHeight = parseInt(document.defaultView.getComputedStyle(dom.detailsPanel).height, 10);
      document.documentElement.addEventListener('mousemove', doDrag, false);
      document.documentElement.addEventListener('mouseup', stopDrag, false);
    });

    function doDrag(e) {
      const newHeight = startHeight - (e.clientY - startY);
      if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
        dom.detailsPanel.style.height = `${newHeight}px`;
        map.resize();
      }
    }

    function stopDrag() {
      document.documentElement.removeEventListener('mousemove', doDrag, false);
      document.documentElement.removeEventListener('mouseup', stopDrag, false);
    }
  }

  // Side-by-side analysis panel triggers (hover display)
  if (dom.sideAnalysisPanelTrigger && dom.sideAnalysisPanel) {
    // Show side panel when hovering over a trigger
    dom.sideAnalysisPanelTrigger.addEventListener('mouseenter', () => {
      showSideAnalysisPanel(true);
    });

    // Hidden on mouse over side panel
    dom.sideAnalysisPanel.addEventListener('mouseleave', () => {
      showSideAnalysisPanel(false);
    });
  }

  // Add event listener for the Analyze panel toggle button
  if (dom.toggleAnalysisBtn) {
    dom.toggleAnalysisBtn.addEventListener('click', toggleAnalysisPanel);
  }

  // Adding a help button click event
  if (document.getElementById('help-btn')) {
    document.getElementById('help-btn').addEventListener('click', showHelpModal);
  }

  // Add help modal box close button event
  if (document.getElementById('help-modal-close')) {
    document.getElementById('help-modal-close').addEventListener('click', () => {
      document.getElementById('help-modal').classList.add('hidden');
    });
  }

  // Click outside the modal box to close it
  if (document.getElementById('help-modal')) {
    document.getElementById('help-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('help-modal')) {
        document.getElementById('help-modal').classList.add('hidden');
      }
    });
  }

  window.addEventListener('resize', function () {
    if (map) {
      setTimeout(() => {
        map.resize();
      }, 100);
    }
  });


  if (dom.toggleAnalysisBtn) {
    dom.toggleAnalysisBtn.addEventListener('click', () => {
      // Determine if the chart is currently displayed
      const isChartVisible = dom.analysisContent.classList.contains('active');

      // Switch class
      if (isChartVisible) {
        dom.analysisContent.classList.remove('active');
        dom.subsidiariesContent.classList.add('active');
      } else {
        dom.analysisContent.classList.add('active');
        dom.subsidiariesContent.classList.remove('active');


      }
    });
  }

  // Modification of the right hover function
  let hoverTimeout;

  if (dom.infoArea && dom.slidetab) {
    const expandPanel = () => {
      clearTimeout(hoverTimeout);
      dom.infoArea.classList.add('expanded');
    };

    const collapsePanel = () => {
      hoverTimeout = setTimeout(() => {
        dom.infoArea.classList.remove('expanded');
      }, 150);
    };

    dom.slidetab.addEventListener('mouseenter', expandPanel);
    dom.infoArea.addEventListener('mouseenter', expandPanel);

    dom.slidetab.addEventListener('mouseleave', collapsePanel);
    dom.infoArea.addEventListener('mouseleave', collapsePanel);
  }

  const closeBtn = document.getElementById('help-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHelpModal);
  }

  // Click outside the modal box to close it
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  // ESC key to close the modal box
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelpModal();
    }
  });

  ensureHelpButtonWorks();

}

// Show help modal box function
function showHelpModal() {
  console.log("Help button clicked, opening help modal");
  const helpModalBody = document.getElementById('help-modal-body');
  const helpModal = document.getElementById('help-modal');

  if (!helpModalBody || !helpModal) return;

  // Help content HTML – reorganized to avoid overlap
  const helpContent = `
    <div class="help-content">
      <!-- Overview -->
      <section class="help-section" id="overview">
        <h3>Overview</h3>
        <p>This visualization tool shows spatial distribution patterns and ownership control relationships of top 20 global pharmaceutical companies, helping you understand headquarters and subsidiary structures.</p>
        <ul>
          <li>Visualize headquarters and subsidiary locations of multinational pharma companies</li>
          <li>Explore ownership relationships and hierarchical control</li>
          <li>Analyze control strength across regions and cities</li>
          <li>Assess international reach and control intensity</li>
        </ul>
      </section>

      <!-- Control Panel -->
      <section class="help-section" id="controls">
        <h3>Control Panel</h3>
        <h4>Filters & Controls</h4>
        <ul>
          <li><strong>Company Selector</strong>: Choose a single pharmaceutical company or view the top 20 list</li>
          <li><strong>Ownership Slider</strong>: Adjust the minimum ownership threshold to filter relationships by control strength</li>
        </ul>
        
        <h4>Data Display Panels</h4>
        <p>Click a panel header to expand or collapse its content:</p>
        <ul>
          <li><strong>Network Overview</strong>: Key statistics such as entity count, HQ cities, subsidiary cities, and average ownership</li>
          <li><strong>Control Hierarchy</strong>: Hierarchical view of headquarters and subsidiaries with full-control ratios</li>
          <li><strong>Power Hub Cities</strong>: Rank of most influential cities and number of companies they control</li>
        </ul>
      </section>
      
      <!-- Map View -->
      <section class="help-section" id="map">
        <h3>Map View</h3>
        <h4>Legend</h4>
        <ul>
          <li><strong>Red Nodes</strong>: Headquarters cities (decision centers)</li>
          <li><strong>Blue Nodes</strong>: Subsidiary cities (controlled entities)</li>
          <li><strong>Connection Lines</strong>: Show control relationships between headquarters and subsidiaries</li>
        </ul>
        
        <h4>Map Controls</h4>
        <ul>
          <li><strong>Fit Data</strong>: Adjust map to show all data points</li>
          <li><strong>Focus HQ</strong>: Center map on the headquarters</li>
          <li><strong>Toggle Labels</strong>: Show/hide city name labels</li>
          <li><strong>Show Help</strong>: Open this help panel</li>
        </ul>
        
        <h4>Right-Side Details</h4>
        <p>Hover over the right-side tab to expand the details panel for more analysis:</p>
        <ul>
          <li><strong>Network Density</strong>: Displays node distribution by continent</li>
          <li><strong>Cross-Border Paths</strong>: Analyzes control distance and international reach</li>
          <li><strong>Power Hub Cities</strong>: Highlights strategically important cities</li>
          <li><strong>Subsidiary Table</strong>: Detailed subsidiary list with filtering</li>
        </ul>
      </section>
      
      <!-- Usage Guide -->
      <section class="help-section" id="operations">
        <h3>Usage Guide</h3>
        
        <p>!!choose a pharm company first</p>
        <h4>View Node Details</h4>
        <ol>
          <li>Click any HQ (red) or subsidiary (blue) node on the map</li>
          <li>A popup will show detailed information for that node</li>
          <li>For HQ cities, an overview of the company will appear</li>
          <li>For subsidiary cities, a list of all subsidiaries in that city will appear</li>
        </ol>
        
        <h4>Filter Ownership Relationships</h4>
        <ol>
          <li>Drag the ownership slider to set the minimum threshold</li>
          <li>Release the slider or click outside to apply the filter</li>
          <li>Watch how the map and data update based on your selection</li>
          <li>Lower thresholds reveal more indirect and minority holdings</li>
        </ol>
        
        <h4>Use the Subsidiary Table</h4>
        <ol>
          <li>Hover over the “Hover me” tab on the right</li>
          <li>Click the table/chart toggle button</li>
          <li>Use the search box to find a specific subsidiary</li>
          <li>Filter by continent using the dropdown</li>
          <li>Sort by ownership or assets using the buttons</li>
        </ol>
      </section>
      
      <!-- Data Details -->
      <section class="help-section" id="data">
        <h3>Data Details</h3>
        <p>The data behind this visualization is based on corporate structures, ownership relationships, and geographic information for the top 20 global pharmaceutical companies.</p>
        
        <h4>Data Sources</h4>
        <ul>
          <li>Orbis Commercial databases and corporate registries</li>
        </ul>
        <p><em>Note: Values marked with * are estimates based on available information and industry averages.</em></p>
        
        <h4>Color Coding</h4>
        <p>Different continents are color-coded on the map:</p>
        <ul>
          <li>North America: Pink (#E893C5)</li>
          <li>Europe: Blue (#3785D8)</li>
          <li>Asia: Light Blue (#ADC6E5)</li>
          <li>Africa: Purple (#BF8CE1)</li>
          <li>South America: Light Pink (#EBB2C3)</li>
          <li>Oceania: Pale Blue (#CBD8E8)</li>
        </ul>
      </section>
    </div>
  `;

  // Inject help content
  helpModalBody.innerHTML = helpContent;

  // Show the modal
  helpModal.classList.remove('hidden');

  // Initialize help navigation links
  setupHelpNavigation();
}

// Close the help modal box
function closeHelpModal() {
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.classList.add('hidden');
  }
}

// Initialize help modal box event after page load is complete
function initHelpModalEvents() {
  // Close button click event
  const closeBtn = document.getElementById('help-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHelpModal);
  }

  // Click outside the modal box to close it
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  // ESC key to close the modal box
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelpModal();
    }
  });

  // Help button click event
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', showHelpModal);
  }
}


// Setting up the help navigation function
function setupHelpNavigation() {
  // Get all navigation items and help blocks
  const navItems = document.querySelectorAll('.help-nav .nav-item');
  const helpSections = document.querySelectorAll('.help-section');
  const helpModalBody = document.getElementById('help-modal-body');

  // Navigation item click event
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove all activations
      navItems.forEach(nav => nav.classList.remove('active'));

      // Add current item activation status
      item.classList.add('active');

      // Scroll to target block
      const targetId = item.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);

      if (targetSection && helpModalBody) {
        // Calculate the correct scroll position, taking into account the height of the navigation bar
        const navHeight = document.querySelector('.help-nav').offsetHeight;
        const offsetPosition = targetSection.offsetTop - navHeight - 15; // 15px

        helpModalBody.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Listen to scroll events to update active navigation items
  if (helpModalBody) {
    helpModalBody.addEventListener('scroll', () => {
      // Get current scroll position
      const scrollPosition = helpModalBody.scrollTop;
      const navHeight = document.querySelector('.help-nav').offsetHeight;

      // Find the currently visible part
      let currentSectionId = '';

      helpSections.forEach(section => {
        // Consider navigation bar height and offset
        const sectionTop = section.offsetTop - navHeight - 20;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          currentSectionId = section.id;
        }
      });

      // Update navigation item activation status
      if (currentSectionId) {
        navItems.forEach(item => {
          const targetId = item.getAttribute('data-target');
          if (targetId === currentSectionId) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      }
    });
  }
}

// Make sure the event listener for the help button is set up correctly
function ensureHelpButtonWorks() {
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    // Remove any existing event listeners by cloning the node
    const newHelpBtn = helpBtn.cloneNode(true);
    helpBtn.parentNode.replaceChild(newHelpBtn, helpBtn);

    // Add the event listener
    newHelpBtn.addEventListener('click', showHelpModal);
  }
}

// Toggle Panel Tabs
function switchPanelTab(clickedTab) {
  // Remove all active statuses
  dom.panelTabs.forEach(tab => tab.classList.remove('active'));
  clickedTab.classList.add('active');

  // Get target panel
  const tabType = clickedTab.dataset.tab;

  // Toggle panel content
  if (tabType === 'subsidiaries') {
    dom.subsidiariesContent.classList.remove('hidden');
    dom.analysisContent.classList.add('hidden');
  } else if (tabType === 'analysis') {
    dom.subsidiariesContent.classList.add('hidden');
    dom.analysisContent.classList.remove('hidden');
  }
}

// Toggle analyzer panel show/hide
function toggleAnalysisPanel() {
  if (!dom.analysisContent) return;

  // Toggles the collapsed state of the analysis panel
  dom.analysisContent.classList.toggle('collapsed');

  // Update button status
  if (dom.toggleAnalysisBtn) {
    if (dom.analysisContent.classList.contains('collapsed')) {
      dom.toggleAnalysisBtn.classList.remove('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-table"></i>'; // Chart Icons
    } else {
      dom.toggleAnalysisBtn.classList.add('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-table"></i>'; // Table Icons
    }
  }

  // Saving user preferences
  localStorage.setItem('analysisPanel', dom.analysisContent.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

// Call this function after initialization is complete
function initUserPreferences() {
  initAnalysisCharts();
}

// Other auxiliary functions...
function showLoading(show) {
  if (dom.loadingIndicator) {
    dom.loadingIndicator.style.display = show ? 'flex' : 'none';
  }
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getContinentName(code) {
  return CONTINENT_NAMES[code] || 'uncharted';
}

function updateDOMElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

// Improved Hierarchical Icon Update Functions
function updateHierarchyDiagram(hqCount, subCount, directControl, internationalCount) {
  const hierarchyViz = document.getElementById('hierarchy-viz');
  if (!hierarchyViz) return;

  hierarchyViz.innerHTML = `
        <div class="hierarchy-node hq-node">${hqCount} HQ Cities</div>
        <div class="hierarchy-connections">
          <div class="connection-line center"></div>
        </div>
        <div class="hierarchy-level">
          <div class="hierarchy-node sub-node">${subCount} Subsidiary Cities</div>
        </div>
        <div class="hierarchy-stats">
          <div class="hierarchy-stat">
            <div class="stat-label">Fully Controlled</div>
            <div class="stat-value">${directControl}</div>
          </div>
          <div class="hierarchy-stat">
            <div class="stat-label">Cross-border Controls</div>
            <div class="stat-value">${internationalCount}</div>
          </div>
        </div>
      `;
}


function updatePowerCenters(filteredData) {
  const powerCentersList = document.getElementById('power-centers-list');
  if (!powerCentersList) return;

  // Counting the number of subsidiaries controlled by each city
  const cityControl = {};

  filteredData.forEach(d => {
    if (d.Subsidiary_City_clean && d.Country_sub) {
      const key = `${d.Subsidiary_City_clean}, ${d.Country_sub}`;
      if (!cityControl[key]) {
        cityControl[key] = {
          city: d.Subsidiary_City_clean,
          country: d.Country_sub,
          count: 0,
          companies: new Set()
        };
      }
      cityControl[key].count++;
      cityControl[key].companies.add(d.company);
    }
  });

  // Sort and take the top 5 - prioritize cities controlled by different companies
  const sortedCenters = Object.values(cityControl)
    .sort((a, b) => b.companies.size - a.companies.size || b.count - a.count)
    .slice(0, 5);

  powerCentersList.innerHTML = '';

  if (sortedCenters.length === 0) {
    powerCentersList.innerHTML = '<p class="no-data">暂无数据</p>';
    return;
  }

  sortedCenters.forEach(center => {
    const item = document.createElement('div');
    item.className = 'power-center-item';
    item.innerHTML = `
          <div class="center-info">
            <div class="center-name">${center.city}</div>
            <div class="center-country">${center.country}</div>
          </div>
          <div class="center-bar">
            <div class="bar-fill hq-bar" style="width: ${(center.companies.size / sortedCenters[0].companies.size) * 100}%;"></div>
          </div>
          <div class="center-value">${center.companies.size}</div>
        `;
    powerCentersList.appendChild(item);
  });
}

function fitMapToData() {
  if (!map || !map.getSource('entities')) return;

  const features = map.getSource('entities')._data.features;

  if (!features || features.length === 0) return;

  const bounds = new mapboxgl.LngLatBounds();

  features.forEach(feature => {
    bounds.extend(feature.geometry.coordinates);
  });

  map.fitBounds(bounds, {
    padding: 50,
    maxZoom: 7
  });
}

function zoomToHeadquarters() {
  if (currentCompany === 'ALL') {
    fitMapToData();
    return;
  }

  const hqData = pharmaData.find(d => d.company === currentCompany && d.head_lat && d.head_lng);
  if (hqData) {
    map.flyTo({
      center: [hqData.head_lng, hqData.head_lat],
      zoom: 6
    });

    // Save this location as a reference point
    lastCenterPosition = {
      center: map.getCenter(),
      zoom: map.getZoom()
    };
  }
}

function toggleLabels() {
  labelsVisible = !labelsVisible;
  map.setLayoutProperty('entities-labels', 'visibility', labelsVisible ? 'visible' : 'none');
}

function filterSubsidiaries() {
  const searchTerm = dom.subsidiarySearch.value.toLowerCase();
  const continentFilter = dom.continentFilter.value;

  const rows = Array.from(dom.subsidiariesTable.querySelectorAll('tr'));

  rows.forEach(row => {
    const nameMatch = row.textContent.toLowerCase().includes(searchTerm);
    const continentMatch = continentFilter === 'all' || row.dataset.continent === continentFilter;

    row.style.display = nameMatch && continentMatch ? '' : 'none';
  });
}

function sortSubsidiaries(clickedBtn) {
  // Update Active Status
  dom.sortBtns.forEach(btn => btn.classList.remove('active'));
  clickedBtn.classList.add('active');

  const sortType = clickedBtn.dataset.sort;
  const rows = Array.from(dom.subsidiariesTable.querySelectorAll('tr'));

  rows.sort((a, b) => {
    if (sortType === 'ownership') {
      return parseFloat(b.dataset.ownership || 0) - parseFloat(a.dataset.ownership || 0);
    } else if (sortType === 'assets') {
      return parseFloat(b.dataset.assets || 0) - parseFloat(a.dataset.assets || 0);
    }
    return 0;
  });

  // Re-add sorted rows
  dom.subsidiariesTable.innerHTML = '';
  rows.forEach(row => dom.subsidiariesTable.appendChild(row));
}

// Generate simulation data - for development and testing
function generateMockData() {
  console.log('Generate simulation data for demonstration');

  const companies = [
    'JOHNSON & JOHNSON', 'PFIZER', 'ROCHE', 'NOVARTIS', 'MERCK',
    'SANOFI', 'GLAXOSMITHKLINE', 'ABBVIE', 'TAKEDA', 'ASTRAZENECA',
    'BAYER', 'BRISTOL-MYERS SQUIBB', 'AMGEN', 'GILEAD SCIENCES', 'ELI LILLY',
    'BOEHRINGER INGELHEIM', 'NOVO NORDISK', 'BIOGEN', 'REGENERON', 'TEVA'
  ];

  const cities = {
    'NA': [
      { city: 'NEW YORK', country: 'US', lat: 40.7128, lng: -74.0060, pop: 8000000 },
      { city: 'BOSTON', country: 'US', lat: 42.3601, lng: -71.0589, pop: 694000 },
      { city: 'SAN FRANCISCO', country: 'US', lat: 37.7749, lng: -122.4194, pop: 870000 },
      { city: 'CHICAGO', country: 'US', lat: 41.8781, lng: -87.6298, pop: 2700000 },
      { city: 'TORONTO', country: 'CA', lat: 43.6532, lng: -79.3832, pop: 2900000 }
    ],
    'EU': [
      { city: 'LONDON', country: 'GB', lat: 51.5074, lng: -0.1278, pop: 8900000 },
      { city: 'PARIS', country: 'FR', lat: 48.8566, lng: 2.3522, pop: 2100000 },
      { city: 'BASEL', country: 'CH', lat: 47.5596, lng: 7.5886, pop: 170000 },
      { city: 'FRANKFURT', country: 'DE', lat: 50.1109, lng: 8.6821, pop: 750000 },
      { city: 'COPENHAGEN', country: 'DK', lat: 55.6761, lng: 12.5683, pop: 620000 }
    ],
    'AS': [
      { city: 'TOKYO', country: 'JP', lat: 35.6762, lng: 139.6503, pop: 13900000 },
      { city: 'SINGAPORE', country: 'SG', lat: 1.3521, lng: 103.8198, pop: 5600000 },
      { city: 'SHANGHAI', country: 'CN', lat: 31.2304, lng: 121.4737, pop: 24000000 },
      { city: 'MUMBAI', country: 'IN', lat: 19.0760, lng: 72.8777, pop: 12400000 },
      { city: 'SEOUL', country: 'KR', lat: 37.5665, lng: 126.9780, pop: 9700000 }
    ]
  };

  const naceCategories = [
    { code: '2120', category: 'Pharmaceutical Manufacturing' },
    { code: '7211', category: 'Research and Development' },
    { code: '4646', category: 'Pharmaceutical Sales' },
    { code: '7010', category: 'Corporate Management' }
  ];

  const mockData = [];

  // Generate headquarters and subsidiaries for each company
  companies.forEach((company, idx) => {
    // Decide on the continent where the headquarters will be located
    const hqContinent = idx % 3 === 0 ? 'NA' : (idx % 3 === 1 ? 'EU' : 'AS');
    const hqCityIdx = idx % cities[hqContinent].length;
    const hqCity = cities[hqContinent][hqCityIdx];

    // Basic Company Information
    const revenue = 1000000 + Math.random() * 90000000;
    const assets = revenue * (1 + Math.random());
    const employees = 1000 + Math.floor(Math.random() * 100000);

    // Generation of 5-15 subsidiaries
    const subCount = 5 + Math.floor(Math.random() * 10);

    for (let i = 0; i < subCount; i++) {
      // Select the continent and city of the subsidiary
      let subContinent;
      if (i % 5 === 0) {
        // 20% of subsidiaries and headquarters on the same continent
        subContinent = hqContinent;
      } else {
        // 80% of subsidiaries on other continents
        const continents = Object.keys(cities);
        subContinent = continents[Math.floor(Math.random() * continents.length)];
      }

      const subCityIdx = Math.floor(Math.random() * cities[subContinent].length);
      const subCity = cities[subContinent][subCityIdx];

      // Functional classification of subsidiaries
      const naceIdx = Math.floor(Math.random() * naceCategories.length);
      const nace = naceCategories[naceIdx];

      // Ownership: 30% fully owned (100%), 50% majority owned (51-99%), 20% minority owned (10-50%)
      let ownership;
      const r = Math.random();
      if (r < 0.3) {
        ownership = 100;
      } else if (r < 0.8) {
        ownership = 51 + Math.floor(Math.random() * 49);
      } else {
        ownership = 10 + Math.floor(Math.random() * 41);
      }

      // Subsidiary size
      const subRevenue = revenue * 0.01 * Math.random() * 2;
      const subAssets = subRevenue * (0.5 + Math.random());
      const subEmployees = 10 + Math.floor(Math.random() * 2000);

      // Whether international subsidiaries
      const isInternational = hqCity.country !== subCity.country ? 1 : 0;

      // Generating records
      mockData.push({
        company: company,
        Parent_City_clean: hqCity.city,
        Country_head: hqCity.country,
        NACE_Core_Code: 2120,
        Operating_Revenue_1000USD: revenue,
        Employees_Count: employees,
        Total_Assets_1000USD: assets,
        Profit_Margin: 10 + Math.random() * 20,
        ESG_Score: 1 + Math.random() * 4,
        Subsidiary_Name: `${company} ${subCity.country} ${subCity.city}`.substring(0, 20),
        Subsidiary_City_clean: subCity.city,
        Country_sub: subCity.country,
        Direct_Ownership: ownership.toString(),
        Total_Ownership: ownership.toString(),
        Ownership_combined: ownership,
        Ownership_filled: ownership,
        Ownership_is_estimated: 0,
        sub_Assets_millionUSD: subAssets / 1000,
        sub_Operating_Revenue_millionUSD: subRevenue / 1000,
        sub_Employees_Count: subEmployees,
        sub_Employees_estimated: subEmployees,
        sub_Employees_is_estimated: 0,
        sub_Employees_final: subEmployees,
        is_international: isInternational,
        continent_head: hqContinent,
        continent_sub: subContinent,
        control_strength: ownership === 100 ? 'Strong Control' : (ownership >= 51 ? 'Moderate Control' : 'Weak Control'),
        sub_nace_code: nace.code,
        sub_nace_category: nace.category,
        sub_Assets_filled: subAssets / 1000,
        sub_Assets_is_estimated: 0,
        head_lat: hqCity.lat,
        head_lng: hqCity.lng,
        head_city_pop: hqCity.pop,
        sub_lat: subCity.lat,
        sub_lng: subCity.lng,
        sub_city_pop: subCity.pop,
        is_direct_control: 1,
        node_type: hqCity.city === subCity.city && hqCity.country === subCity.country ? 'mixed' : 'sub'
      });

      // If it is a headquarters city, add a headquarters record
      if (i === 0) {
        mockData.push({
          company: company,
          Parent_City_clean: hqCity.city,
          Country_head: hqCity.country,
          NACE_Core_Code: 2120,
          Operating_Revenue_1000USD: revenue,
          Employees_Count: employees,
          Total_Assets_1000USD: assets,
          Profit_Margin: 10 + Math.random() * 20,
          ESG_Score: 1 + Math.random() * 4,
          Subsidiary_Name: `${company} HQ`,
          Subsidiary_City_clean: hqCity.city,
          Country_sub: hqCity.country,
          Direct_Ownership: "100",
          Total_Ownership: "100",
          Ownership_combined: 100,
          Ownership_filled: 100,
          Ownership_is_estimated: 0,
          sub_Assets_millionUSD: assets / 1000,
          sub_Operating_Revenue_millionUSD: revenue / 1000,
          sub_Employees_Count: employees,
          sub_Employees_estimated: employees,
          sub_Employees_is_estimated: 0,
          sub_Employees_final: employees,
          is_international: 0,
          continent_head: hqContinent,
          continent_sub: hqContinent,
          control_strength: 'Strong Control',
          sub_nace_code: '7010',
          sub_nace_category: 'Management Headquarters',
          sub_Assets_filled: assets / 1000,
          sub_Assets_is_estimated: 0,
          head_lat: hqCity.lat,
          head_lng: hqCity.lng,
          head_city_pop: hqCity.pop,
          sub_lat: hqCity.lat,
          sub_lng: hqCity.lng,
          sub_city_pop: hqCity.pop,
          is_direct_control: 1,
          node_type: 'hq'
        });
      }
    }
  });

  return mockData;
}

document.addEventListener("DOMContentLoaded", function () {
  const toggleButtons = document.querySelectorAll(".panel-toggle-btn");

  toggleButtons.forEach((btn) => {
    const panel = btn.nextElementSibling;

    if (!panel || !panel.classList.contains("panel-section2")) {
      console.warn("No matching .panel-section2 after button:", btn.textContent);
      return;
    }

    // Initialize panels - Control Hierarchy panel should be open by default
    panel.style.overflow = "hidden";
    panel.style.transition = "max-height 0.3s ease";

    // Special handling for Control Hierarchy panel - make it open by default
    // if (btn.textContent.trim() === "Control Hierarchy") {
    //   btn.classList.add("active");
    //   panel.style.maxHeight = panel.scrollHeight + "px";
    //   panel.style.overflow = "auto";
    // } else {
    //   panel.style.maxHeight = "0";
    // }


    panel.style.maxHeight = "0";
    btn.classList.remove("active");


    btn.addEventListener("click", () => {
      // Toggle active class on button
      btn.classList.toggle("active");

      // Check if currently expanded
      const expanded = panel.style.maxHeight !== "0px" && panel.style.maxHeight !== "";

      if (expanded) {
        // Collapse panel
        panel.style.maxHeight = "0";
        panel.style.overflow = "hidden";
      } else {
        // Expand panel
        // Use scrollHeight to determine the actual height needed
        panel.style.maxHeight = panel.scrollHeight + "px";

        // Add a small delay to switch to auto overflow once animation completes
        setTimeout(() => {
          panel.style.overflow = "auto";
        }, 300);
      }
    });
  });
});
