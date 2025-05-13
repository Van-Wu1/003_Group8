// 1. 全局变量
window.map = null;
window.cityData = {};
window.cityMarkers = [];
window.countryTopCity = {};
window.donutChart = null;
window.colorMap = {
  "R&D": "rgba(131, 211, 250, 0.6)",
  "Manufacturing": "rgba(247, 113, 124, 0.6)",
  "Packaging": "rgba(253, 203, 77, 0.6)",
  "Wholesale": "rgba(89, 214, 183, 0.6)",
  "Retail/Medical": "rgba(255, 159, 64, 0.6)",
  "API": "rgba(134, 145, 189, 0.6)",
  "Support/Other": "rgba(193, 152, 202, 0.6)",
  "Unclassified": "#cccccc" 
};
window.currentSelectedFunctions = [];
window.currentMinCompanyCount = 0;


// 2. 初始化地图
mapboxgl.accessToken = 'pk.eyJ1Ijoid3d3MDYwIiwiYSI6ImNsZWNyZXU0OTAwbWEzb3RlaDF5bzBrcXUifQ.XpmvYQZRVRCNwe1mtcgYVg'; // ← 替换为你的真实 token
window.map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/www060/cmahcpioi00xw01sleyt2edjh',
  center: [0, 30],  // 默认中心点
  zoom: 2.5
});

//城市说明版
// 3. DOM 元素
window.popup = document.getElementById('popup');
window.defaultMessage = document.getElementById('defaultMessage');
window.cityDetails = document.getElementById('cityDetails');
window.backButton = document.getElementById('backButton');

window.showDefaultMessage = function() {
  defaultMessage.style.display = 'block';
  cityDetails.style.display = 'none';
}

window.showCityPanel = function(cityName, functionCategory) {
  const info = cityData[cityName];
  const donutData = prepareDonutData(info);

  defaultMessage.style.display = 'none';
  cityDetails.style.display = 'block';

  document.getElementById('cityHeader').innerText = cityName;
  document.getElementById('functionCategory').innerText = functionCategory;

  // ✅ 使用已有的函数绘图
  showCityCard(cityName, donutData, info);
}

//根据zoom反馈圆圈的半径大小
window.getRadiusByZoomAndValue = function(zoom, value) {
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
  window.currentSelectedFunctions = getSelectedFunctions();
  window.currentMinCompanyCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
  window.currentCityLimit = parseInt(document.getElementById('cityRangeSlider').value, 10) || 10;

  updateTopCitiesByFunctionMulti(currentSelectedFunctions, currentCityLimit, currentMinCompanyCount);
  updateMapWithFilters(currentSelectedFunctions, currentMinCompanyCount);
};

window.updateMapWithFilters = function(selectedFunctions, minCount) {
  const zoom = map.getZoom();
  const updatedGeojson = convertCityDataToGeoJSON(cityData, zoom, selectedFunctions, minCount);
  const source = map.getSource('cities');
  if (source) {
    source.setData(updatedGeojson);
  }
};

window.convertCityDataToGeoJSON = function(cityData, zoom, selectedFunctions = [], minCount = 1) {
  if (!Array.isArray(selectedFunctions)) selectedFunctions = [];

  const features = Object.entries(cityData).map(([cityKey, info]) => {
    const allCompanies = [...(info.hq_companies || []), ...(info.subsidiaries || [])];
    if (allCompanies.length === 0) return null;

    const company = allCompanies.find(c => (c.lat || c.latitude) && (c.lng || c.longitude));
    if (!company) return null;

    const lat = Number(company.lat || company.latitude);
    const lng = Number(company.lng || company.longitude);
    const total = (info.hq_count || 0) + (info.subsidiary_count || 0);

    // ✅ Step 1: 用户设置的 minCount 是最基本的过滤逻辑
    if (total < minCount) return null;

    // ✅ Step 2: 缩放特定附加过滤（保留 total < 8 限制）
    if (zoom <= 3 && !isTopCityInCountry(cityKey)) return null;
    if (zoom > 3 && zoom <= 5 && total < 8) return null;

    // ✅ Step 3: 功能类型筛选
    const functionStats = info.sub_function_stats || {};
    const filteredStats = Object.entries(functionStats).filter(([k]) => k !== "Unclassified");
    if (filteredStats.length === 0) return null;

    const hasSelectedFunction = selectedFunctions.length === 0 ||
      filteredStats.some(([k]) => selectedFunctions.includes(k));
    if (!hasSelectedFunction) return null;

    const mainFunc = filteredStats.sort((a, b) => b[1] - a[1])[0][0];
    const category = getFunctionCategory(info);
    const radius = getRadiusByZoomAndValue(zoom, total);

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
};

// ✅ 统一写一个函数专门绘制条形图：可重复调用，无需 destroy
window.drawStackedBarChart= function({ labels, datasets }) {
  const canvas = document.getElementById('stackedBarChart');
  if (!canvas) {
    console.error('❌ Canvas element not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  if (window.stackedBarChart instanceof Chart) {
    window.stackedBarChart.destroy();
  }

  window.stackedBarChart = new Chart(ctx, {
  type: 'bar',
  data: { labels, datasets },
  options: {
    responsive: true,
    backgroundColor: 'transparent',
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    layout: {
      padding: {
        top: 20,
        right: 50,
        bottom: 20,
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
        title: {
          display: true,
          text: `Showing Top ${labels.length} cities`
        },
        ticks: {
          maxRotation: 30,
          minRotation: 30
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

//定义城市功能
 window.getFunctionStats = function(info) {
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

  // 计算香农熵
 const entropy = -sortedRoles.reduce((sum, [_, count]) => {
    const p = count / total;
    return sum + p * Math.log2(p);
  }, 0).toFixed(2);

  // 分类
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

//给每个城市功能划分
window.getFunctionCategory =function (info) {
  const stats = getFunctionStats(info);
  if (!stats) return "Unclassified";

  const { roleCount, dominanceRatio, entropy } = stats;

  if (roleCount === 1 || dominanceRatio >= 0.8) return "Single-function"; //单一功能  
  if (roleCount >= 3 && entropy >= 1.0 && dominanceRatio <= 0.6) return "Multi-functional"; //多重功能
  return "Weakly Diversified";
}

// donut picture
window.prepareDonutData = function(info) {
  const stats = info.sub_function_stats || {};
  const labels = Object.keys(stats);
  const values = Object.values(stats);
  const colors = labels.map(l => colorMap[l] || "#ccc");
  return { labels, values, colors };
}


window.renderFunctionLegend = function(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "<strong>Function Type Legend</strong>";
  for (const [label, color] of Object.entries(colorMap)) {
    const row = document.createElement("div");
    row.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;background:${color};margin-right:5px;"></span> ${label}
    `;
    container.appendChild(row);
  }
}


window.isTopCityInCountry = function(cityKey) {
  const country = cityKey.split(",")[1]?.trim();
  return countryTopCity[country]?.city === cityKey;
}

window.buildCountryTopCity =function(selectedFunctions) {
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

window.showCityCard = function(cityKey, data, infoFromMapbox) {
  const info = cityData[cityKey] || infoFromMapbox;
  document.getElementById("popup").style.display = "block";

  // 1. 标题
  const [cityName, countryCode] = cityKey.split(",");
  document.getElementById("cityHeader").innerHTML = `
    <h3>${cityName.trim()}, ${countryCode.trim()}</h3>
  `;

  // 2. 统计数据
  const hqCount = info.hq_count || 0;
  const subCount = info.subsidiary_count || 0;
  const allCompanies = hqCount + subCount;

  const avgEmployees = Math.round(
    (info.hq_companies?.reduce((sum, c) => sum + (c.employees || 0), 0) || 0) / hqCount
  ) || "–";

  const avgESG = (
    (info.hq_companies?.reduce((sum, c) => sum + (c.esg_score || 0), 0) || 0) / hqCount
  ).toFixed(1) || "–";

  // 3. 职能结构信息
  const funcStats = getFunctionStats(info);
  const functionProfileHTML = funcStats ? `
    <hr>
    <p><strong>Dominant Function:</strong> ${funcStats.dominantRole}</p>
    <p><strong>Number of Functions:</strong> ${funcStats.roleCount}</p>
    <p><strong>Function Diversity (Entropy):</strong> ${funcStats.entropy}</p>
    <p><strong>Dominance Ratio:</strong> ${funcStats.dominanceRatio}</p>
    <p><strong>Classification:</strong> ${getFunctionCategory(info)}</p>
  ` : `
    <hr>
    <h4>Function Profile</h4>
    <p>No function data available.</p>
  `;

  document.getElementById("cityStats").innerHTML = `
    <p><strong>Total Companies:</strong> ${allCompanies} (HQs: ${hqCount} / Subsidiaries: ${subCount})</p>
     ${functionProfileHTML}
  `;
//<p><strong>Average Employees per HQ:</strong> ${avgEmployees}</p>
  //  <p><strong>Average ESG Score per HQ:</strong> ${avgESG}</p>

  // 3. 绘制甜甜圈
  const ctx = document.getElementById("donutChart")?.getContext("2d");
if (!ctx) {
  console.error("Canvas #donutChart not found");
  return;
}

if (window.donutChart instanceof Chart) window.donutChart.destroy();

window.donutChart = new Chart(ctx, {
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

window.buildScatterData = function() {
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


window.drawScatterPlot = function(scatterData) {
  const canvas = document.getElementById('scatterCanvas');
  if (!canvas) {
    console.error("❌ scatterCanvas not found in DOM.");
    return;
  }
  const ctx = canvas.getContext('2d');

  if (window.scatterChart instanceof Chart) {
    window.scatterChart.destroy();
  }

  window.scatterChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Cities',
        data: scatterData.map(d => ({
         x: d.dominanceRatio,        // 🔄 改为公司数量
          y: d.entropy,
          city: d.city,
          category: d.category,
          backgroundColor:
            d.category === 'Single-function' ? 'rgba(41, 128, 185, 0.6)' :
            d.category === 'Multi-functional' ? 'rgba(46, 204, 113, 0.6)' :
            'rgba(149, 165, 166, 0.5)'
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
            label: function(context) {
              const d = context.raw;
              return `${d.city}\nEntropy: ${d.y}\nCompany Count: ${d.x}`; // 🔄
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Company Count' }, // 🔄
          type: 'linear',
          beginAtZero: true
          // 可以根据你的数据范围设置 min / max
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
            map.flyTo({ center: coords, zoom: 7 });
          }
        }
      }
    }
  });
}

window.getCityCoordinates = function(info) {
  const allCompanies = [...(info.hq_companies || []), ...(info.subsidiaries || [])];
  const company = allCompanies.find(c => (c.lat || c.latitude) && (c.lng || c.longitude));
  if (!company) return null;
  return [Number(company.lng || company.longitude), Number(company.lat || company.latitude)];
}

//初始化展示
backButton.addEventListener('click', showDefaultMessage);
showDefaultMessage();//这里结束

