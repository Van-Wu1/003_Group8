// 1. 数据加载
fetch('data/clean/city_function.json')
  .then(res => res.json())
  .then(data => {
    window.cityData = data;

    // 图例初始化
    renderFunctionLegend("function-legend");

    // 构建 zoom ≤ 3 用的国家代表城市
    buildCountryTopCity(Object.keys(colorMap).filter(f => f !== "Unclassified"));

    map.on('load', () => {
      const zoom = map.getZoom();
      const selectedFunctions = getSelectedFunctions();
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
      const geojson = convertCityDataToGeoJSON(cityData, zoom, selectedFunctions, minCount);

      map.addSource('cities', { type: 'geojson', data: geojson });

      map.addLayer({
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
          'circle-opacity': 0.9
        }
      });

      // 鼠标交互 tooltip
      const tooltip = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'city-tooltip'
      });

      map.on('mouseenter', 'city-circles', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const props = e.features[0].properties;
        const typeLabel =
          props.borderColor === "#2980b9" ? " (Single-function)" :
          props.borderColor === "#ffffff" ? " (Multi-functional)" : "";

        const html = `
          <strong>${props.city}</strong><br>
          ${props.mainFunc}${typeLabel}<br>
          ${props.total} companies
        `;

        tooltip.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on('mouseleave', 'city-circles', () => {
        map.getCanvas().style.cursor = '';
        tooltip.remove();
      });

    map.on('click', 'city-circles', (e) => {
        const props = e.features[0].properties;
        const cityName = props.city;
        const info = cityData[cityName];
        if (!info) return;

       if (map.getZoom() <= 3) {
        map.flyTo({
          center: e.lngLat,
          zoom: 6.0,
          speed: 1.2,
          curve: 1.42,
          easing: t => t
        });
      }
        if (window.scatterChart) {
        const pointIndex = window.scatterChart.data.datasets[0].data.findIndex(p => p.city === cityName);
        if (pointIndex !== -1) {
          window.scatterChart.setActiveElements([{
            datasetIndex: 0,
            index: pointIndex
          }]);
          window.scatterChart.tooltip.setActiveElements([{
            datasetIndex: 0,
            index: pointIndex
          }], { x: 0, y: 0 });
          window.scatterChart.update();
        }
      }


      const donutData = prepareDonutData(info);
      showCityCard(cityName, donutData, info);

      const functionCategory = getFunctionCategory(info);
      showCityPanel(cityName, functionCategory);
    });
    const scatterData = buildScatterData();
    drawScatterPlot(scatterData);
    applyFilter();
    });

    map.on('zoomend', () => {
      updateMapWithFilters(window.currentSelectedFunctions, window.currentMinCompanyCount);
    });

    window.rangeSlider = document.getElementById("cityRangeSlider");

    rangeSlider.addEventListener("input", () => {
      const selected = getSelectedFunctions();
      const limit = parseInt(rangeSlider.value);
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

      updateTopCitiesByFunctionMulti(selected, limit, minCount); // ✅ 加入 minCount

      const geojson = convertCityDataToGeoJSON(cityData, map.getZoom(), selected, minCount); // ✅ 同步地图
      const source = map.getSource('cities');
      if (source) source.setData(geojson);
    });

// ✅ 加在这两个之后
    document.getElementById('minCompanyCount').addEventListener('change', () => {
      const selected = getSelectedFunctions();
      const limit = parseInt(rangeSlider.value);
      const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

      updateTopCitiesByFunctionMulti(selected, limit, minCount);
      const geojson = convertCityDataToGeoJSON(cityData, map.getZoom(), selected, minCount);
      const source = map.getSource('cities');
      if (source) source.setData(geojson);
    });


    // 图表首次绘制
    const selectedFunctions = Object.keys(colorMap).filter(f => f !== "Unclassified");
    const limit = parseInt(rangeSlider.value) || 10;
    const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;
    updateTopCitiesByFunctionMulti(selectedFunctions, limit, minCount);

    // 绑定筛选器与滑动条
    document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        const selected = getSelectedFunctions();
        const limit = parseInt(rangeSlider.value) || 10;
        const minCount = parseInt(document.getElementById('minCompanyCount').value, 10) || 0;

        updateTopCitiesByFunctionMulti(selected, limit, minCount); // ✅ 加入 minCount

        const geojson = convertCityDataToGeoJSON(cityData, map.getZoom(), selected, minCount); // ✅ 加入 minCount
        const source = map.getSource('cities');
        if (source) source.setData(geojson);
      });
    });
  });


// 工具函数：筛选器状态
function getSelectedFunctions() {
  return Array.from(
    document.querySelectorAll('#filter-panel input[type="checkbox"]:checked')
  ).map(cb => cb.value);
}

// 条形图更新逻辑
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


