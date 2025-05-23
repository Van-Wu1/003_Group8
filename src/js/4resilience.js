console.log("✅ 4resilience.js 加载成功");

let selectedCity = null;
let overlay;
let points;



function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371; // 地球半径，单位：km
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
  center: [-0.1276, 51.5072],  // 英国伦敦
  zoom: 6,
  pitch: 60,                   // 斜视角度
  bearing: 0,
  projection: 'mercator',
  minZoom: 4,   // 最小缩放级别（不能缩太远）
  maxZoom: 7,  // 最大缩放级别（不能缩太近）
  maxBounds: [
    [-180, -85],  // 西南角：最小经度、最小纬度
    [180, 85]     // 东北角：最大经度、最大纬度
  ],
  dragPan: {
    deceleration: 0.9  // 越接近 1，惯性越小（可选）
  }

});

map_re.addControl(new mapboxgl.NavigationControl(), 'top-right');

fetch('./data/clean/City_level_resilience_data_UPDATED_only_revenue_normalized.geojson')
  .then(response => response.json())
  .then(data => {
    points = data.features.map(f => ({
      position: f.geometry.coordinates,
      resilienceIndex: f.properties.resilienceindex,
      cluster: f.properties.cluster,
      city: f.properties.city.trim(),
      MSCIoverall: f.properties.mscioverall,                 // ✅ 新增
      MSCIenvi: f.properties.mscienvi,
      MSCIsocial: f.properties.mscisocial,
      MSCIgovern: f.properties.mscigovern,
      operatingRevenue: f.properties.operatingrevenue,
      functionalDiversity: f.properties.functionaldiversity

    }));



    // 数据加载后先画一个空雷达图
    drawRadarChart();



    const GROUP_DISTANCE_KM = 50;  // 可调：组内最大距离
    const OFFSET_KM = 25;          // 可调：展开半径
    const DEG_PER_KM = 1 / 111;    // 粗略换算：1km ≈ 0.009°

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
    const top5 = points
      .sort((a, b) => b.resilienceIndex - a.resilienceIndex)
      .slice(0, 5);

    const ctx = document.getElementById('rankingChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top5.map(d => d.city),
        datasets: [{
          label: 'Resilience Index',
          data: top5.map(d => d.resilienceIndex),
          backgroundColor: 'rgba(118, 167, 201, 0.8)',
          barThickness: 30
        }]
      },
      options: {
        layout: { padding: { top: 0, bottom: 0 } },
        maintainAspectRatio: false,
        responsive: true,
        interaction: { mode: 'index' },
        scales: {
          x: {
            offset: true,
            border: { color: '#1E0F75', width: 1 },           // ✅ 改为深灰
            grid: { display: false },
            ticks: {
              drawTicks: true,
              color: '#000',                              // ✅ 改为深灰
              font: { size: 10 },
              maxRotation: 0,
              minRotation: 0,
              padding: 5,
              callback: function (value) {
                const label = this.getLabelForValue(value);
                return label.split(' ');
              }
            }
          },
          y: {
            border: { color: '#1E0F75', width: 1 },           // ✅ 改为深灰
            grid: { display: false },
            beginAtZero: true,
            ticks: {
              drawTicks: true,
              color: '#000',                              // ✅ 改为深灰
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
            text: 'Top 5 cities in the resilience index',
            font: { size: 16 },
            color: '#000'
          }
        }
      }
    });

    //✅ 添加灰色基座 Layer
    const baseLayer = new deck.ColumnLayer({
      data: adjustedPoints,  // ✅ 改成 adjustedPoints
      getPosition: d => d.adjustedPosition,  // ✅ 使用偏移后坐标
      getElevation: 5000,
      getFillColor: [220, 220, 220, 180],
      radius: 22000,
      extruded: true,
      elevationScale: 1
    });


    // ✅ 添加原始柱子 Layer




    const mainLayer = new deck.ColumnLayer({
      data: adjustedPoints,
      getPosition: d => d.adjustedPosition,
      getElevation: d => d.resilienceIndex * 5000,
      getFillColor: d => {
        if (d.city === selectedCity) return [255, 179, 71, 255]; // 🔶 选中的城市变黄色
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






    // ✅ 初始化地图
    overlay = new deck.MapboxOverlay({
      layers: [baseLayer, mainLayer]
    });


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
        updateMapLayers();  // 重新渲染图层
      });
    });

    function updateMapLayers() {
      // 只保留选中的cluster
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
      // 更新主图层（重新创建 ColumnLayer）
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

      // 重新设置 overlay 图层（保留 baseLayer）
      overlay.setProps({
        layers: [newBaseLayer, newMainLayer]
      });
    }


    map_re.on('load', () => {
      map_re.addControl(overlay);
      map_re.getCanvas().style.backgroundColor = '#cfd8dc';
    });

    // ✅ 城市下拉菜单
    const dropdown = document.getElementById('cityDropdown');
    const uniqueCities = [...new Set(points.map(p => p.city))].sort();
    uniqueCities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.text = city;
      dropdown.appendChild(option);
    });


    // ✅ 下拉菜单事件
    dropdown.addEventListener('change', (e) => {
      const selected = e.target.value.trim();
      selectedCity = selected;

      const cityData = points.find(p => p.city.trim() === selectedCity);

      if (cityData) {
        drawRadarChart(cityData);

        // ✅ 新增地图飞到该城市
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
        // 🔶 重新创建 mainLayer 并高亮选中柱子
        const filteredData = adjustedPoints.filter(p => filterState[p.cluster]);
        const newMainLayer = new deck.ColumnLayer({
          data: filteredData,
          getPosition: d => d.adjustedPosition,
          getElevation: d => d.resilienceIndex * 5000,
          getFillColor: d => {
            if (d.city === selectedCity) return [255, 179, 71, 255]; // 高亮选中
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

        // ⚠️ 保留原 baseLayer
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

// ✅ 雷达图绘制函数
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
          props.operatingRevenue*5,
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
  document.querySelector('.Section8-Comparison').style.display = 'block';
  initComparison();
});