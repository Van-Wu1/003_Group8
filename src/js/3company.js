// 配置
const MAPBOX_TOKEN = 'pk.eyJ1IjoicWl1eXVlcWl1MjAwMiIsImEiOiJjbWFjejV3OGMwOThiMmtzaGswMWRmam16In0.8one7mciYXQt13wcK5yxHQ';
mapboxgl.accessToken = MAPBOX_TOKEN;

// 全局变量
let map;                     // 地图对象
let pharmaData = [];         // 原始制药公司数据
let uniqueCompanies = [];    // 唯一公司列表（按收入排序）
let currentCompany = '';     // 当前选中的公司
let minOwnershipFilter = 50;  // 所有权筛选阈值
let labelsVisible = true;    // 标签是否可见
let isInitialized = false;   // 是否已初始化
let citySubsidiaries = {};   // 每个城市的子公司集合
let lastCenterPosition = null; // 上次地图中心位置
let sideAnalysisPanelVisible = false; // 是否显示侧边分析面板

// 大洲名称映射
const CONTINENT_NAMES = {
  'NA': 'North America',
  'SA': 'South America',
  'EU': 'Europe',
  'AS': 'Asia',
  'AF': 'Africa',
  'OC': 'Oceania'
};

// DOM元素引用
const dom = {};

// 初始化DOM引用
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
  // 新增的DOM引用
  dom.sideAnalysisPanelTrigger = document.getElementById('side-analysis-panel-trigger');
  dom.sideAnalysisPanel = document.getElementById('side-analysis-panel');
  // 添加新的DOM引用
  dom.analysisContent = document.getElementById('analysis-content');
  dom.toggleAnalysisBtn = document.getElementById('toggle-analysis');
  dom.panelContentWrapper = document.querySelector('.panel-content-wrapper');
  // 新增
  dom.infoArea = document.getElementById('information_area');
  dom.slidetab = document.getElementById('slide-tab');
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化DOM引用
  console.log("Initializing pharmaceutical network visualization...");
  initDOMReferences();

  // 检查必要的DOM元素是否存在
  if (!checkRequiredElements()) {
    console.error('Necessary DOM elements are missing');
    return;
  }

  showLoading(true);

  try {
    // 初始化地图
    await initMap();

    // Add a forced resize after map initialization
    if (map) {
      map.resize();
    }

    // 加载数据
    await loadData();

    // 初始化UI事件
    initEventListeners();

    // 更新初始可视化
    updateVisualization();

    // 初始化成功标记
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

// 检查必要DOM元素是否存在
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

// 初始化地图
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
        // 添加数据源
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

        // 添加连接线图层
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
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'ownership'],
              0, 1,
              50, 2,
              100, 4
            ],
            'line-opacity': 0.7
          }
        });

        // 添加实体节点图层

        // 子公司图层
        map.addLayer({
          id: 'subsidiary-layer',
          type: 'circle',
          source: 'entities',
          filter: ['==', ['get', 'type'], 'sub'],
          paint: {
            'circle-radius': [
              'step',
              ['zoom'],
              4,    // 默认值：zoom < 3
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

        // 总部图层（晚添加 → 显示在最上层）
        map.addLayer({
          id: 'hq-layer',
          type: 'circle',
          source: 'entities',
          filter: ['==', ['get', 'type'], 'hq'],
          paint: {
            'circle-radius': [
              'step',
              ['zoom'],
              4,    // 默认值：zoom < 3
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

        // 实体标签
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

        // 设置交互
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

// 加载数据
async function loadData() {
  try {
    // 示例数据路径 - 在真实环境中需要替换
    const response = await fetch('data/clean/world_com_top20_by_revenue_eng.json');
    if (!response.ok) {
      // 模拟数据用于演示
      console.warn('Demonstration using modelled data');
      pharmaData = generateMockData();
    } else {
      // 解析JSON数据
      pharmaData = await response.json();
    }

    // 按收入计算公司排名
    const companyRevenue = {};
    pharmaData.forEach(d => {
      if (d.company) {
        if (!companyRevenue[d.company]) {
          companyRevenue[d.company] = d.Operating_Revenue_1000USD || 0;
        }
      }
    });

    // 按照收入排序并取前20
    uniqueCompanies = Object.keys(companyRevenue)
      .sort((a, b) => companyRevenue[b] - companyRevenue[a])
      .slice(0, 20);

    console.log(`Loaded ${pharmaData.length} data records, filtered ${uniqueCompanies.length} companies.`);

    // 不在设置默认选中的公司
    // currentCompany = uniqueCompanies[0] || '';

    // 填充公司选择器
    populateCompanySelector();

    // 构建城市子公司索引
    buildCitySubsidiariesIndex();

    return pharmaData;
  } catch (error) {
    console.error('Failed to load data:', error);
    // 使用模拟数据作为备用
    pharmaData = generateMockData();

    // 获取唯一公司
    const companySet = new Set();
    pharmaData.forEach(d => companySet.add(d.company));
    uniqueCompanies = Array.from(companySet).slice(0, 20);

    // 不再设置默认选中的公司
    // currentCompany = uniqueCompanies[0] || '';

    // 填充公司选择器
    populateCompanySelector();

    // 构建城市子公司索引
    buildCitySubsidiariesIndex();

    return pharmaData;
  }
}

// 构建城市子公司索引 - 用于改进详情弹窗
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

// 填充公司选择器
function populateCompanySelector() {
  if (!dom.companySelector) return;

  dom.companySelector.innerHTML = '';

  // 添加所有公司选项
  const defaultOption = document.createElement('option');
  defaultOption.value = "";
  defaultOption.textContent = "Please select a company to view";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  dom.companySelector.appendChild(defaultOption);

  // 添加所有公司选项
  const allOption = document.createElement('option');
  allOption.value = 'ALL';
  allOption.textContent = 'ALL TOP 20 COMPANIES';
  dom.companySelector.appendChild(allOption);

  // 添加公司选项（按收入排序）
  uniqueCompanies.forEach(company => {
    const option = document.createElement('option');
    option.value = company;
    option.textContent = company;
    dom.companySelector.appendChild(option);
  });

  // 设置默认选中的公司
  dom.companySelector.value = currentCompany;
}

// 格式化数值显示
// 修改formatValue函数，使用英文格式显示数值
function formatValue(value, isEstimated = false, unit = '') {
  if (value === null || value === undefined || value === 0) {
    return 'No data';
  }

  // 针对不同大小的数值使用不同单位
  let formatted;
  let unitLabel = '';

  if (value >= 1000000000) {
    // 十亿及以上
    formatted = (value / 1000000000).toFixed(2);
    unitLabel = ' B'; // Billion
  } else if (value >= 1000000) {
    // 百万到十亿
    formatted = (value / 1000000).toFixed(2);
    unitLabel = ' M'; // Million
  } else if (value >= 1000) {
    // 千到百万
    formatted = (value / 1000).toFixed(2);
    unitLabel = ' K'; // Thousand
  } else {
    // 小于千
    formatted = value.toFixed(2);
  }

  // 添加千分位逗号
  formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // 添加单位
  if (unit) {
    formatted += unit;
  } else {
    formatted += unitLabel;
  }

  // 如果是估计值，添加星号
  if (isEstimated) {
    formatted += '*';
  }

  return formatted;
}

// 准备网络数据
function prepareNetworkData() {
  // 筛选当前公司的数据
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // 存储节点和连接
  const entities = [];
  const connections = [];
  const processedCities = new Map();

  // 颜色映射
  const continentColors = {
    NA: '#E893C5', // 北美 - 粉色
    EU: '#3785D8', // 欧洲 - 蓝色
    AS: '#ADC6E5', // 亚洲 - 浅蓝色
    AF: '#BF8CE1', // 非洲 - 紫色
    SA: '#EBB2C3', // 南美 - 浅粉色
    OC: '#CBD8E8',  // 大洋洲 - 最浅蓝色
    'default': '#95a5a6'
  };

  // 处理每条记录，创建节点和连接
  filteredData.forEach(d => {
    // 创建子公司城市节点
    if (d.Subsidiary_City_clean && d.sub_lat && d.sub_lng) {
      const cityKey = `${d.Subsidiary_City_clean}|${d.Country_sub}`;

      if (!processedCities.has(cityKey)) {
        // 计算节点大小（使用收入数据）
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

    // 创建总部节点
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

    // 创建连接（仅当总部和子公司是不同城市时）
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

// 更新地图数据
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

// 设置地图交互
function setupMapInteractions() {
  // 鼠标悬停效果
  map.on('mouseenter', 'entities-layer', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'entities-layer', () => {
    map.getCanvas().style.cursor = '';
  });

  // 点击节点显示详情
  // 子公司节点点击
  map.on('click', 'subsidiary-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    showEntityDetails(props);
  });

  // 总部节点点击
  map.on('click', 'hq-layer', (e) => {
    if (!e.features || e.features.length === 0) return;
    const props = e.features[0].properties;
    showEntityDetails(props);
  });

  // 悬停时改变鼠标样式
  ['subsidiary-layer', 'hq-layer'].forEach(layerId => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// 显示实体详情 - 增强版显示城市子公司列表
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
    // 子公司城市详情 - 显示该城市所有子公司
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

  // 显示模态窗口
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const detailModal = document.getElementById('detail-modal');

  if (modalTitle && modalBody && detailModal) {
    modalTitle.textContent = props.type === 'hq' ? 'HQ Details' : 'Subsidiary City Details';
    modalBody.innerHTML = modalContent;
    detailModal.classList.remove('hidden');
  }
}

// 新增专门用于格式化财务数字的函数
function formatNumberToFinancial(num) {
  if (!num) return "0";

  // 判断数值大小，选择适当的单位
  let value, unit;

  if (num >= 1000000000000) {
    value = num / 1000000000000;
    unit = " T"; // 万亿/trillion
  } else if (num >= 1000000000) {
    value = num / 1000000000;
    unit = " B"; // 十亿/billion
  } else if (num >= 1000000) {
    value = num / 1000000;
    unit = " M"; // 百万/million
  } else if (num >= 1000) {
    value = num / 1000;
    unit = " K"; // 千/thousand
  } else {
    value = num;
    unit = "";
  }

  // 格式化为两位小数并添加千分位分隔符
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + unit;
}

// 计算城市子公司的平均控股比例
function calculateAvgOwnership(subsidiaries) {
  if (!subsidiaries || subsidiaries.length === 0) return 0;

  const total = subsidiaries.reduce((sum, sub) => sum + (sub.ownership || 0), 0);
  return (total / subsidiaries.length).toFixed(1);
}

// 计算城市子公司的总资产
// 修改计算城市子公司总资产的函数
function calculateTotalAssets(subsidiaries) {
  if (!subsidiaries || subsidiaries.length === 0) return "0";

  const total = subsidiaries.reduce((sum, sub) => sum + (sub.assets || 0), 0);
  return formatNumberToFinancial(total); // 使用新的财务数字格式化函数
}

// 更新网络统计
function updateNetworkStatistics() {
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // 统计计算
  const uniqueHQs = new Set(filteredData.filter(d => d.Parent_City_clean && d.head_lat && d.head_lng).map(d => `${d.Parent_City_clean}|${d.Country_head}`));
  const uniqueSubs = new Set(filteredData.filter(d => d.Subsidiary_City_clean).map(d => `${d.Subsidiary_City_clean}|${d.Country_sub}`));

  const avgOwnership = filteredData.length > 0 ?
    filteredData.reduce((sum, d) => sum + (d.Ownership_filled || 0), 0) / filteredData.length : 0;

  const internationalCount = filteredData.filter(d => d.is_international === 1).length;
  const intlRatio = filteredData.length > 0 ? (internationalCount / filteredData.length) * 100 : 0;

  // 使用收入数据替代资产数据
  const totalRevenue = filteredData.reduce((sum, d) => sum + (d.sub_Operating_Revenue_millionUSD || 0), 0);
  const directControl = filteredData.filter(d => d.Ownership_filled === 100).length;

  // 更新DOM
  updateDOMElement('total-entities', uniqueHQs.size + uniqueSubs.size);
  updateDOMElement('hq-count', uniqueHQs.size);
  updateDOMElement('sub-count', uniqueSubs.size);
  updateDOMElement('avg-ownership', avgOwnership.toFixed(1) + '%');
  updateDOMElement('intl-ratio', intlRatio.toFixed(1) + '%');
  updateDOMElement('total-assets', '$' + formatNumber(totalRevenue) + 'M'); // 更改为总收入

  // 更新层级图示 - 改进布局
  updateHierarchyDiagram(uniqueHQs.size, uniqueSubs.size, directControl, internationalCount);

  // 更新主要控制中心
  updatePowerCenters(filteredData);
}

// 更新子公司表格
// 在updateSubsidiariesTable函数中修改资产显示部分
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

    // NACE代码和类别
    const naceInfo = sub.sub_nace_code ?
      `${sub.sub_nace_code} (${sub.sub_nace_category || 'Other'})` :
      'N/A';

    // 为子公司名称添加title属性，便于鼠标悬停查看完整名称
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

// 更新可视化（主函数）
function updateVisualization() {
  if (!isInitialized) return;

  // 如果没有选择公司，显示提示信息
  if (!currentCompany) {
    // 清空数据显示
    updateDOMElement('total-entities', '0');
    updateDOMElement('hq-count', '0');
    updateDOMElement('sub-count', '0');
    updateDOMElement('avg-ownership', '0%');
    updateDOMElement('intl-ratio', '0%');
    updateDOMElement('total-assets', '$0M');

    // 清空表格和其他可视化
    if (dom.subsidiariesTable) {
      dom.subsidiariesTable.innerHTML = '';
    }

    // 重置地图
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

  // 保存当前地图中心 - 解决所有权筛选导致地图重置的问题
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

      // 更新分析图表 - 修改这里，只要不是collapsed状态就更新
      if (!dom.analysisContent.classList.contains('collapsed')) {
        initAnalysisCharts();
      }

      // 根据策略决定是否更新地图位置
      if (currentCompany !== 'ALL') {
        // 聚焦当前公司总部位置
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
        fitMapToData(); // 查看全部公司则适应所有数据
      }
    } catch (error) {
      console.error('更新可视化失败:', error);
    } finally {
      showLoading(false);
    }
  }, 100);
}

// 初始化分析图表
function initAnalysisCharts() {
  console.log("这个函数至少被调用到了");
  // 如果分析面板已折叠，则不初始化图表
  if (dom.analysisContent && dom.analysisContent.classList.contains('collapsed')) {
    return;
  }
  console.log("你看到这个信息就是没被拦截");
  // 获取图表容器
  const densityChart = document.getElementById('density-chart');
  const distanceChart = document.getElementById('distance-chart');
  const hubChart = document.getElementById('hub-chart');

  if (!densityChart || !distanceChart || !hubChart) return;

  // 清除现有图表
  // 使用Chart.js的destroy方法清除旧图表
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

  // 准备数据
  const filteredData = currentCompany === 'ALL' ?
    pharmaData.filter(d => d.Ownership_filled >= minOwnershipFilter) :
    pharmaData.filter(d => d.company === currentCompany && d.Ownership_filled >= minOwnershipFilter);

  // 1. 控制网络密度分析
  createNetworkDensityChart(densityChart, filteredData);

  // 2. 跨国控制路径统计
  createControlDistanceChart(distanceChart, filteredData);

  // 3. 权力枢纽城市分析
  createPowerHubChart(hubChart, filteredData);
}

// 创建网络密度图表
function createNetworkDensityChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // 计算每个大洲的控制网络密度
  const continentDensity = {};
  const continentConnections = {};

  data.forEach(d => {
    if (d.continent_head && d.continent_sub) {
      const fromContinent = d.continent_head;
      const toContinent = d.continent_sub;

      // 统计每个大洲的节点数
      continentDensity[fromContinent] = (continentDensity[fromContinent] || 0) + 1;
      continentDensity[toContinent] = (continentDensity[toContinent] || 0) + 1;

      // 统计大洲间的连接数
      const key = `${fromContinent}-${toContinent}`;
      continentConnections[key] = (continentConnections[key] || 0) + 1;
    }
  });

  // 准备图表数据
  const continents = Object.keys(CONTINENT_NAMES);
  const densityData = continents.map(code => continentDensity[code] || 0);

  // 创建图表
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: continents.map(code => CONTINENT_NAMES[code]),
      datasets: [{
        label: 'Number of nodes',
        data: densityData,
        backgroundColor: [
          // 使用夜空色卡颜色:
          'rgba(232, 147, 197, 0.8)', // 粉色 - NA
          'rgba(235, 178, 195, 0.8)', // 浅粉色 - SA
          'rgba(55, 133, 216, 0.8)',  // 蓝色 - EU
          'rgba(173, 198, 229, 0.8)', // 浅蓝色 - AS
          'rgba(191, 140, 225, 0.8)', // 紫色 - AF
          'rgba(203, 216, 232, 0.8)'  // 最浅蓝色 - OC
        ],
        borderColor: [
          'rgba(232, 147, 197, 1)', // 粉色
          'rgba(235, 178, 195, 1)', // 浅粉色
          'rgba(55, 133, 216, 1)',  // 蓝色
          'rgba(173, 198, 229, 1)', // 浅蓝色
          'rgba(191, 140, 225, 1)', // 紫色
          'rgba(203, 216, 232, 1)'  // 最浅蓝色
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

// 创建控制距离图表
function createControlDistanceChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // 计算控制距离（总部到子公司的地理距离）
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

  // 按距离分组
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

  // 创建图表
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: distanceGroups.map(g => g.label),
      datasets: [{
        label: 'Total Controls',
        data: distanceGroups.map(g => g.count),
        backgroundColor: 'rgba(55, 133, 216, 0.8)', // 蓝色
        borderColor: 'rgba(55, 133, 216, 1)', // 蓝色
        borderWidth: 1
      }, {
        label: 'International Controls',
        data: distanceGroups.map(g => g.international),
        backgroundColor: 'rgba(232, 147, 197, 0.8)', // 粉色
        borderColor: 'rgba(232, 147, 197, 1)', // 粉色
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

// 创建权力枢纽城市图表
function createPowerHubChart(canvas, data) {
  const ctx = canvas.getContext('2d');

  // 统计每个城市控制的子公司数量和公司数
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

  // 排序并取前10
  const topCities = Object.values(cityData)
    .sort((a, b) => b.companies.size - a.companies.size)
    .slice(0, 10);

  // 创建图表
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCities.map(c => `${c.city}, ${c.country}`),
      datasets: [{
        label: 'Number of Controlling Companies',
        data: topCities.map(c => c.companies.size),
        backgroundColor: 'rgba(173, 198, 229, 0.8)', // 浅蓝色
        borderColor: 'rgba(173, 198, 229, 1)', // 浅蓝色
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

// 计算地理距离（使用Haversine公式）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 初始化事件监听器
function initEventListeners() {

  // 公司选择
  if (dom.companySelector) {
    dom.companySelector.addEventListener('change', (e) => {
      if (e.target.value) { // 确保选择了有效的值
        currentCompany = e.target.value;
        updateVisualization();
      }
    });
  }

  // 所有权筛选
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

  // 地图控件
  if (dom.zoomFitBtn) {
    dom.zoomFitBtn.addEventListener('click', fitMapToData);
  }

  if (dom.zoomHqBtn) {
    dom.zoomHqBtn.addEventListener('click', zoomToHeadquarters);
  }

  if (dom.toggleLabelsBtn) {
    dom.toggleLabelsBtn.addEventListener('click', toggleLabels);
  }

  // 面板标签切换
  if (dom.panelTabs) {
    dom.panelTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        switchPanelTab(e.target);
      });
    });
  }

  // 子公司搜索
  if (dom.subsidiarySearch) {
    dom.subsidiarySearch.addEventListener('input', filterSubsidiaries);
  }

  // 大洲筛选
  if (dom.continentFilter) {
    dom.continentFilter.addEventListener('change', filterSubsidiaries);
  }

  // 排序按钮
  if (dom.sortBtns) {
    dom.sortBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        sortSubsidiaries(e.target);
      });
    });
  }

  // 模态窗口关闭
  if (dom.modalCloseBtn) {
    dom.modalCloseBtn.addEventListener('click', () => {
      if (dom.detailModal) {
        dom.detailModal.classList.add('hidden');
      }
    });
  }

  // 点击模态框外部关闭
  if (dom.detailModal) {
    dom.detailModal.addEventListener('click', (e) => {
      if (e.target === dom.detailModal) {
        dom.detailModal.classList.add('hidden');
      }
    });
  }

  // 详情面板大小调整
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

  // 侧边分析面板触发器（悬停显示）
  if (dom.sideAnalysisPanelTrigger && dom.sideAnalysisPanel) {
    // 鼠标悬停在触发器上时显示侧边面板
    dom.sideAnalysisPanelTrigger.addEventListener('mouseenter', () => {
      showSideAnalysisPanel(true);
    });

    // 鼠标移出侧边面板时隐藏
    dom.sideAnalysisPanel.addEventListener('mouseleave', () => {
      showSideAnalysisPanel(false);
    });
  }

  // 添加分析面板切换按钮的事件监听
  if (dom.toggleAnalysisBtn) {
    dom.toggleAnalysisBtn.addEventListener('click', toggleAnalysisPanel);
  }

  // 添加帮助按钮点击事件
  if (document.getElementById('help-btn')) {
    document.getElementById('help-btn').addEventListener('click', showHelpModal);
  }

  // 添加帮助模态框关闭按钮事件
  if (document.getElementById('help-modal-close')) {
    document.getElementById('help-modal-close').addEventListener('click', () => {
      document.getElementById('help-modal').classList.add('hidden');
    });
  }

  // 点击模态框外部关闭
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
      // 判断当前是否图表处于显示状态
      const isChartVisible = dom.analysisContent.classList.contains('active');

      // 切换 class
      if (isChartVisible) {
        dom.analysisContent.classList.remove('active');
        dom.subsidiariesContent.classList.add('active');
      } else {
        dom.analysisContent.classList.add('active');
        dom.subsidiariesContent.classList.remove('active');


      }
    });
  }

  // 右侧悬浮功能修改
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

  // 点击模态框外部关闭
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  // ESC键关闭模态框
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelpModal();
    }
  });

  ensureHelpButtonWorks();

}

// 显示帮助模态框函数
function showHelpModal() {
  console.log("帮助按钮被点击，正在打开模态框");
  const helpModalBody = document.getElementById('help-modal-body');
  const helpModal = document.getElementById('help-modal');

  if (!helpModalBody || !helpModal) return;

  // 帮助内容HTML - 重新组织内容避免重叠
  const helpContent = `
    <div class="help-content">
      <!-- 功能概述 -->
      <section class="help-section" id="overview">
        <h3>功能概述</h3>
        <p>本可视化工具展示了全球主要制药公司的空间分布模式和控制关系，帮助您了解企业总部与子公司之间的所有权结构。</p>
        <ul>
          <li>直观查看跨国制药公司的总部与子公司分布</li>
          <li>了解企业之间的所有权关系和空间层级</li>
          <li>探索不同区域和城市的控制力量</li>
          <li>分析国际化程度与控制强度</li>
        </ul>
      </section>

      <!-- 控制面板 -->
      <section class="help-section" id="controls">
        <h3>控制面板</h3>
        <h4>筛选与控制</h4>
        <ul>
          <li><strong>公司选择器</strong>：从下拉菜单中选择单个制药公司或查看全部前20家公司</li>
          <li><strong>所有权滑块</strong>：调整最低所有权比例阈值，筛选不同控制强度的关系</li>
        </ul>
        
        <h4>数据展示面板</h4>
        <p>点击面板标题可展开或折叠相应的信息板块：</p>
        <ul>
          <li><strong>网络概览</strong>：显示实体数量、总部城市、子公司城市、平均所有权等关键统计数据</li>
          <li><strong>控制层次结构</strong>：直观呈现总部与子公司之间的层级关系和完全控制比例</li>
          <li><strong>权力枢纽城市</strong>：排名最具影响力的城市及其控制公司数量</li>
        </ul>
      </section>
      
      <!-- 地图视图 -->
      <section class="help-section" id="map">
        <h3>地图视图</h3>
        <h4>图例说明</h4>
        <ul>
          <li><strong>红色节点</strong>：总部城市，表示公司决策中心</li>
          <li><strong>蓝色节点</strong>：子公司城市，表示被控制实体所在地</li>
          <li><strong>连接线强度</strong>：
            <ul>
              <li>粗线 - 完全控制 (100%所有权)</li>
              <li>中等线 - 多数控制 (51-99%所有权)</li>
              <li>细线 - 少数控制 (≤50%所有权)</li>
            </ul>
          </li>
        </ul>
        
        <h4>地图控制按钮</h4>
        <ul>
          <li><strong>适应数据</strong>：调整视图显示所有数据点</li>
          <li><strong>聚焦总部</strong>：快速定位到公司总部</li>
          <li><strong>切换标签</strong>：显示/隐藏城市名称标签</li>
          <li><strong>显示帮助</strong>：打开本帮助面板</li>
        </ul>
        
        <h4>右侧详情栏</h4>
        <p>将鼠标悬停在右侧标签上可展开详情面板，查看更多分析：</p>
        <ul>
          <li><strong>网络密度分析</strong>：展示不同大洲的节点分布</li>
          <li><strong>跨国控制路径</strong>：分析控制距离与国际化程度</li>
          <li><strong>权力枢纽城市</strong>：显示最具战略重要性的城市</li>
          <li><strong>子公司表格</strong>：提供详细的子公司清单与筛选功能</li>
        </ul>
      </section>
      
      <!-- 操作指南 -->
      <section class="help-section" id="operations">
        <h3>操作指南</h3>
        
        <h4>查看节点详情</h4>
        <ol>
          <li>点击地图上的任意总部（红色）或子公司（蓝色）节点</li>
          <li>弹出窗口将显示该节点的详细信息</li>
          <li>对于总部城市，您将看到公司概览</li>
          <li>对于子公司城市，您将看到该城市中所有子公司的列表</li>
        </ol>
        
        <h4>筛选控制关系</h4>
        <ol>
          <li>拖动所有权滑块调整最低阈值</li>
          <li>点击滑块外部区域或释放滑块以应用筛选</li>
          <li>观察地图和数据如何随着筛选条件变化</li>
          <li>调低阈值可查看更多间接和少数控股关系</li>
        </ol>
        
        <h4>使用子公司表格</h4>
        <ol>
          <li>将鼠标悬停在右侧"Hover me"标签上</li>
          <li>点击表格/图表切换按钮（图表图标）</li>
          <li>使用搜索框查找特定子公司</li>
          <li>通过下拉菜单筛选大洲</li>
          <li>点击排序按钮按所有权或资产排序</li>
        </ol>
      </section>
      
      <!-- 数据说明 -->
      <section class="help-section" id="data">
        <h3>数据说明</h3>
        <p>本可视化使用的数据基于全球前20大制药公司的企业结构、所有权关系和地理分布信息。</p>
        
        <h4>数据来源</h4>
        <ul>
          <li>公司年报与财务披露文件</li>
          <li>商业数据库与企业注册信息</li>
          <li>行业分析报告与专业数据集</li>
        </ul>
        <p><em>注：标有*号的数值为估计值，基于可用信息和行业均值计算得出。</em></p>
        
        <h4>颜色编码</h4>
        <p>地图上不同大洲使用不同颜色标记：</p>
        <ul>
          <li>北美洲：粉色 (#E893C5)</li>
          <li>欧洲：蓝色 (#3785D8)</li>
          <li>亚洲：浅蓝色 (#ADC6E5)</li>
          <li>非洲：紫色 (#BF8CE1)</li>
          <li>南美洲：浅粉色 (#EBB2C3)</li>
          <li>大洋洲：极浅蓝色 (#CBD8E8)</li>
        </ul>
      </section>
    </div>
  `;

  // 填充帮助内容
  helpModalBody.innerHTML = helpContent;

  // 显示模态框
  helpModal.classList.remove('hidden');

  // 设置导航功能
  setupHelpNavigation();
}

// 关闭帮助模态框
function closeHelpModal() {
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.classList.add('hidden');
  }
}

// 在页面加载完成后初始化帮助模态框事件
function initHelpModalEvents() {
  // 关闭按钮点击事件
  const closeBtn = document.getElementById('help-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeHelpModal);
  }

  // 点击模态框外部关闭
  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (event) => {
      if (event.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  // ESC键关闭模态框
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHelpModal();
    }
  });

  // 帮助按钮点击事件
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', showHelpModal);
  }
}


// 设置帮助导航功能
function setupHelpNavigation() {
  // 获取所有导航项和帮助区块
  const navItems = document.querySelectorAll('.help-nav .nav-item');
  const helpSections = document.querySelectorAll('.help-section');
  const helpModalBody = document.getElementById('help-modal-body');

  // 导航项点击事件
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // 移除所有激活状态
      navItems.forEach(nav => nav.classList.remove('active'));

      // 添加当前项激活状态
      item.classList.add('active');

      // 滚动到目标区块
      const targetId = item.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);

      if (targetSection && helpModalBody) {
        // 计算正确的滚动位置，考虑导航栏高度
        const navHeight = document.querySelector('.help-nav').offsetHeight;
        const offsetPosition = targetSection.offsetTop - navHeight - 15; // 15px额外间距

        helpModalBody.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // 监听滚动事件以更新活动导航项
  if (helpModalBody) {
    helpModalBody.addEventListener('scroll', () => {
      // 获取当前滚动位置
      const scrollPosition = helpModalBody.scrollTop;
      const navHeight = document.querySelector('.help-nav').offsetHeight;

      // 查找当前可见的部分
      let currentSectionId = '';

      helpSections.forEach(section => {
        // 考虑导航栏高度和偏移量
        const sectionTop = section.offsetTop - navHeight - 20;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          currentSectionId = section.id;
        }
      });

      // 更新导航项激活状态
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

// 确保帮助按钮工作正常
function ensureHelpButtonWorks() {
  const helpBtn = document.getElementById('help-btn');
  if (helpBtn) {
    // 通过克隆节点移除任何现有的事件监听器
    const newHelpBtn = helpBtn.cloneNode(true);
    helpBtn.parentNode.replaceChild(newHelpBtn, helpBtn);

    // 添加事件监听器
    newHelpBtn.addEventListener('click', showHelpModal);
    console.log("帮助按钮事件监听器已附加");
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
    console.log("Help button event listener attached");
  }
}

// 切换面板标签
function switchPanelTab(clickedTab) {
  // 移除所有活跃状态
  dom.panelTabs.forEach(tab => tab.classList.remove('active'));
  clickedTab.classList.add('active');

  // 获取目标面板
  const tabType = clickedTab.dataset.tab;

  // 切换面板内容
  if (tabType === 'subsidiaries') {
    dom.subsidiariesContent.classList.remove('hidden');
    dom.analysisContent.classList.add('hidden');
  } else if (tabType === 'analysis') {
    dom.subsidiariesContent.classList.add('hidden');
    dom.analysisContent.classList.remove('hidden');
  }
}

// 切换分析面板显示/隐藏
function toggleAnalysisPanel() {
  if (!dom.analysisContent) return;

  // 切换分析面板的折叠状态
  dom.analysisContent.classList.toggle('collapsed');

  // 更新按钮状态
  if (dom.toggleAnalysisBtn) {
    if (dom.analysisContent.classList.contains('collapsed')) {
      dom.toggleAnalysisBtn.classList.remove('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-table"></i>'; // 图表图标
    } else {
      dom.toggleAnalysisBtn.classList.add('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-table"></i>'; // 表格图标
    }
  }

  // 保存用户偏好
  localStorage.setItem('analysisPanel', dom.analysisContent.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

// 在初始化完成后调用此函数
function initUserPreferences() {
  initAnalysisCharts();
}

// 其他辅助函数...
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

// 改进的层级图示更新函数
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

  // 统计每个城市控制的子公司数量
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

  // 排序并取前5 - 优先显示不同公司控制的城市
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

    // 保存这个位置作为参考点
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
  // 更新活跃状态
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

  // 重新添加排序后的行
  dom.subsidiariesTable.innerHTML = '';
  rows.forEach(row => dom.subsidiariesTable.appendChild(row));
}

// 生成模拟数据 - 用于开发和测试
function generateMockData() {
  console.log('生成模拟数据用于演示');

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

  // 生成每个公司的总部和子公司
  companies.forEach((company, idx) => {
    // 决定总部所在大洲
    const hqContinent = idx % 3 === 0 ? 'NA' : (idx % 3 === 1 ? 'EU' : 'AS');
    const hqCityIdx = idx % cities[hqContinent].length;
    const hqCity = cities[hqContinent][hqCityIdx];

    // 公司基本信息
    const revenue = 1000000 + Math.random() * 90000000;
    const assets = revenue * (1 + Math.random());
    const employees = 1000 + Math.floor(Math.random() * 100000);

    // 生成5-15个子公司
    const subCount = 5 + Math.floor(Math.random() * 10);

    for (let i = 0; i < subCount; i++) {
      // 选择子公司所在大洲和城市
      let subContinent;
      if (i % 5 === 0) {
        // 20%的子公司和总部在同一大洲
        subContinent = hqContinent;
      } else {
        // 80%的子公司分布在其他大洲
        const continents = Object.keys(cities);
        subContinent = continents[Math.floor(Math.random() * continents.length)];
      }

      const subCityIdx = Math.floor(Math.random() * cities[subContinent].length);
      const subCity = cities[subContinent][subCityIdx];

      // 子公司功能分类
      const naceIdx = Math.floor(Math.random() * naceCategories.length);
      const nace = naceCategories[naceIdx];

      // 所有权比例: 30%完全控股(100%), 50%多数控股(51-99%), 20%少数控股(10-50%)
      let ownership;
      const r = Math.random();
      if (r < 0.3) {
        ownership = 100;
      } else if (r < 0.8) {
        ownership = 51 + Math.floor(Math.random() * 49);
      } else {
        ownership = 10 + Math.floor(Math.random() * 41);
      }

      // 子公司规模
      const subRevenue = revenue * 0.01 * Math.random() * 2;
      const subAssets = subRevenue * (0.5 + Math.random());
      const subEmployees = 10 + Math.floor(Math.random() * 2000);

      // 是否国际子公司
      const isInternational = hqCity.country !== subCity.country ? 1 : 0;

      // 生成记录
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

      // 如果是总部城市，添加一个总部记录
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
    if (btn.textContent.trim() === "Control Hierarchy") {
      btn.classList.add("active");
      panel.style.maxHeight = panel.scrollHeight + "px";
      panel.style.overflow = "auto";
    } else {
      panel.style.maxHeight = "0";
    }

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
