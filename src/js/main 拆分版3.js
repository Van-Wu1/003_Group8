// 全球制药公司控制网络可视化 - JavaScript (改进版)

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
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化DOM引用
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

    // 加载数据
    await loadData();

    // 初始化UI事件
    initEventListeners();

    // 更新初始可视化
    updateVisualization();

    // 初始化成功标记
    isInitialized = true;
  } catch (error) {
    console.error('Initialisation failure:', error);
    alert('Application Load Failure: ' + error.message);
  } finally {
    initUserPreferences();
    showLoading(false);
  }
});

// 检查必要DOM元素是否存在
function checkRequiredElements() {
  const requiredElements = [
    'loading-indicator',
    'company-selector',
    'ownership-slider',
    'total-entities',
    'map',
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
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 30],
        zoom: 1.8
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
    const response = await fetch('src/data/clean/world_com_top20_by_revenue_eng.json');
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
  allOption.textContent = 'All top 20 companies';
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
    'NA': '#e73cb9', // 北美 - 红色
    'SA': '#f39c12', // 南美 - 橙色
    'EU': '#3498db', // 欧洲 - 蓝色
    'AS': '#2ecc71', // 亚洲 - 绿色
    'AF': '#9b59b6', // 非洲 - 紫色
    'OC': '#f1c40f', // 大洋洲 - 黄色
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
  // 如果分析面板已折叠，则不初始化图表
  if (dom.analysisContent && dom.analysisContent.classList.contains('collapsed')) {
    return;
  }

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
          'rgba(231, 76, 60, 0.8)',  // NA - 北美洲
          'rgba(243, 156, 18, 0.8)', // SA - 南美洲
          'rgba(52, 152, 219, 0.8)', // EU - 欧洲
          'rgba(46, 204, 113, 0.8)', // AS - 亚洲
          'rgba(155, 89, 182, 0.8)', // AF - 非洲
          'rgba(241, 196, 15, 0.8)'  // OC - 大洋洲
        ],
        borderColor: [
          'rgba(231, 76, 60, 1)',
          'rgba(243, 156, 18, 1)',
          'rgba(52, 152, 219, 1)',
          'rgba(46, 204, 113, 1)',
          'rgba(155, 89, 182, 1)',
          'rgba(241, 196, 15, 1)'
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
        backgroundColor: 'rgba(52, 152, 219, 0.8)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 1
      }, {
        label: 'International Controls',
        data: distanceGroups.map(g => g.international),
        backgroundColor: 'rgba(231, 76, 60, 0.8)',
        borderColor: 'rgba(231, 76, 60, 1)',
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
        backgroundColor: 'rgba(46, 204, 113, 0.8)',
        borderColor: 'rgba(46, 204, 113, 1)',
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

        // 如果侧边分析面板可见，也更新分析图表和表格
        if (sideAnalysisPanelVisible) {
          initAnalysisCharts();
        }
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
}

// 显示帮助模态框
function showHelpModal() {
  const helpModalBody = document.getElementById('help-modal-body');
  const helpModal = document.getElementById('help-modal');

  if (!helpModalBody || !helpModal) return;

  // 帮助内容HTML
  const helpContent = `
    <div class="help-content">
      <section class="help-section">
        <h3>全球制药公司控制网络可视化</h3>
        <p>本可视化工具展示了全球主要制药公司的控制网络和空间分布格局，帮助用户了解制药行业的空间控制权关系和全球分布情况。</p>
      </section>
      
      <section class="help-section">
        <h3>主要功能区域</h3>
        <div class="help-subsection">
          <h4>1. 控制面板（左侧）</h4>
          <ul>
            <li><strong>公司选择器</strong>：选择要查看的制药公司，或选择"全部前20大公司"查看整体情况</li>
            <li><strong>所有权筛选</strong>：通过滑块调整所有权百分比阈值（默认为50%），只显示超过该阈值的控制关系</li>
            <li><strong>网络统计概览</strong>：展示当前选择的公司/公司集合的核心统计数据，包括节点数量、总部和子公司城市数量、平均控股比例等</li>
            <li><strong>控制层级结构</strong>：以简化形式展示控制关系层级</li>
            <li><strong>权力枢纽城市</strong>：列出主要的控制中心城市</li>
          </ul>
        </div>
        
        <div class="help-subsection">
          <h4>2. 地图视图（中央）</h4>
          <ul>
            <li><strong>节点说明</strong>：
              <ul>
                <li><span style="color: #e74c3c;">●</span> <strong>红色节点</strong>：总部城市</li>
                <li><span style="color: #3498db;">●</span> <strong>蓝色节点</strong>：子公司城市</li>
              </ul>
            </li>
            <li><strong>连线说明</strong>：
              <ul>
                <li><strong>粗线</strong>：完全控股 (100%)</li>
                <li><strong>中等线</strong>：多数控股 (51-99%)</li>
                <li><strong>细线</strong>：少数控股 (≤50%)</li>
              </ul>
            </li>
            <li><strong>地图控件</strong>：
              <ul>
                <li><i class="fas fa-expand"></i> 适应所有数据</li>
                <li><i class="fas fa-building"></i> 聚焦总部</li>
                <li><i class="fas fa-tag"></i> 切换标签显示</li>
              </ul>
            </li>
          </ul>
        </div>
        
        <div class="help-subsection">
          <h4>3. 详情面板（底部）</h4>
          <ul>
            <li><strong>子公司列表</strong>：展示所选公司的所有子公司详细信息</li>
            <li><strong>筛选与排序</strong>：可通过搜索框搜索、按大洲筛选和按控股比例/资产规模排序</li>
            <li><strong>分析图表</strong>：提供控制网络密度、跨国控制路径和权力枢纽城市的分析图表</li>
          </ul>
        </div>
      </section>
      
      <section class="help-section">
        <h3>基本操作说明</h3>
        <div class="help-subsection">
          <h4>如何查看特定公司的控制网络</h4>
          <ol>
            <li>在左侧控制面板的"选择制药公司"下拉菜单中选择一家公司</li>
            <li>地图将自动聚焦到该公司的总部位置</li>
            <li>底部详情面板将显示该公司的所有子公司列表</li>
          </ol>
        </div>
        
        <div class="help-subsection">
          <h4>如何筛选控制关系</h4>
          <ol>
            <li>通过左侧控制面板的"所有权筛选"滑块调整所有权百分比阈值</li>
            <li>只有控股比例超过所设阈值的控制关系会被显示</li>
          </ol>
        </div>
        
        <div class="help-subsection">
          <h4>如何查看节点详情</h4>
          <ol>
            <li>点击地图上的任意节点（红色总部或蓝色子公司）</li>
            <li>将弹出详情窗口，显示该城市的详细信息</li>
            <li>对于子公司城市，还会显示该城市内所有子公司的列表</li>
          </ol>
        </div>
        
        <div class="help-subsection">
          <h4>如何使用详情面板</h4>
          <ol>
            <li>可以使用搜索框搜索特定的子公司</li>
            <li>可以使用"所有大洲"下拉菜单按大洲筛选子公司</li>
            <li>可以点击"控股比例"或"资产规模"按钮对子公司进行排序</li>
            <li>点击<i class="fas fa-chart-bar"></i>按钮可以切换显示/隐藏分析图表区域</li>
          </ol>
        </div>
        
        <div class="help-subsection">
          <h4>如何调整面板大小</h4>
          <ol>
            <li>通过拖动详情面板顶部的灰色小条，可以调整详情面板的高度</li>
          </ol>
        </div>
      </section>
      
      <section class="help-section">
        <h3>数据说明</h3>
        <div class="help-subsection">
          <p>本可视化基于全球前20大制药公司的控制关系数据，包含以下信息：</p>
          <ul>
            <li>公司总部位置与基本信息（资产、收入、员工数等）</li>
            <li>子公司地理位置分布</li>
            <li>控制关系类型与控股比例</li>
            <li>子公司功能分类（基于NACE代码）</li>
          </ul>
          <p>数据中带有星号(*)的值表示为估计值。</p>
        </div>
      </section>
      
      <section class="help-section">
        <h3>分析图表解读</h3>
        <div class="help-subsection">
          <h4>1. 控制网络密度分析</h4>
          <p>该图表展示了各大洲的控制网络节点数量，反映了制药公司全球空间分布的密度特征。</p>
        </div>
        
        <div class="help-subsection">
          <h4>2. 跨国控制路径统计</h4>
          <p>该图表按照控制距离（总部到子公司的地理距离）分组，展示了不同距离级别的控制关系数量，并区分了跨国控制与国内控制。</p>
        </div>
        
        <div class="help-subsection">
          <h4>3. 权力枢纽城市分析</h4>
          <p>该图表展示了被多家公司控制的主要城市，这些城市往往是全球制药产业的战略枢纽。</p>
        </div>
      </section>
      
      <section class="help-section">
        <h3>提示与技巧</h3>
        <ul>
          <li>双击地图可以快速放大特定区域</li>
          <li>鼠标滚轮可以缩放地图</li>
          <li>点击并拖动可以平移地图</li>
          <li>悬停在子公司名称上可以查看完整的名称（如果名称过长被截断）</li>
          <li>图例位于地图的右下角，解释了各种颜色和线型的含义</li>
        </ul>
      </section>
    </div>
  `;

  // 填充帮助内容
  helpModalBody.innerHTML = helpContent;

  // 显示模态框
  helpModal.classList.remove('hidden');
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
    initAnalysisCharts();
  }
}

// 显示/隐藏侧边分析面板
function showSideAnalysisPanel(show) {
  if (!dom.sideAnalysisPanel) return;

  if (show) {
    dom.sideAnalysisPanel.classList.add('visible');
    sideAnalysisPanelVisible = true;
    // 初始化分析图表
    initAnalysisCharts();
  } else {
    dom.sideAnalysisPanel.classList.remove('visible');
    sideAnalysisPanelVisible = false;
  }
}

// 切换分析面板显示/隐藏
// 彻底重写 toggleAnalysisPanel 函数
function toggleAnalysisPanel() {
  if (!dom.analysisContent) return;

  // 切换分析面板的折叠状态
  dom.analysisContent.classList.toggle('collapsed');

  // 更新按钮状态
  if (dom.toggleAnalysisBtn) {
    if (dom.analysisContent.classList.contains('collapsed')) {
      dom.toggleAnalysisBtn.classList.remove('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-chart-bar"></i>'; // 图表图标
    } else {
      dom.toggleAnalysisBtn.classList.add('active');
      dom.toggleAnalysisBtn.innerHTML = '<i class="fas fa-table"></i>'; // 表格图标

      // 当展开时重新初始化图表
      setTimeout(() => {
        initAnalysisCharts();
      }, 300);
    }
  }

  // 调整容器和子公司内容区域
  if (dom.subsidiariesContent) {
    if (dom.analysisContent.classList.contains('collapsed')) {
      // 图表折叠时，子公司列表占满全宽
      dom.subsidiariesContent.style.width = "100%";
    } else {
      // 图表展开时，恢复正常宽度
      dom.subsidiariesContent.style.width = "60%";
    }
  }

  // 调整地图大小以适应新布局
  if (map) {
    setTimeout(() => map.resize(), 300);
  }

  // 保存用户偏好
  localStorage.setItem('analysisPanel', dom.analysisContent.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

// 在初始化完成后调用此函数
function initUserPreferences() {
  // 恢复分析面板状态
  const analysisPanelState = localStorage.getItem('analysisPanel');
  if (analysisPanelState === 'collapsed') {
    // 如果用户之前折叠了分析面板，则保持折叠状态
    if (dom.analysisContent) {
      dom.analysisContent.classList.add('collapsed');
    }
    if (dom.toggleAnalysisBtn) {
      dom.toggleAnalysisBtn.classList.remove('active');
    }
  } else {
    // 默认展开状态
    if (dom.toggleAnalysisBtn) {
      dom.toggleAnalysisBtn.classList.add('active');
    }
    // 初始化分析图表
    initAnalysisCharts();
  }
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
