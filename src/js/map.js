import propertyData from "./data/property.js";
import uniData from "./data/uni.js";

export let map;

export function initMap() {
  mapboxgl.accessToken = 'pk.eyJ1IjoidmFuMTEyMDEwMTZ3dSIsImEiOiJjbTd1b2JodnMwMmV1MmpzYTlhcXJxNWJ1In0.PC95-6c3OQtSQoxlvNAWOA';
  
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-0.1340, 51.5246], // UCL
    zoom: 10
  });

  map.addControl(new mapboxgl.NavigationControl());

  // 自定义图标路径
  const propertyIcon = "https://th.bing.com/th/id/OIP.AT6UEeXnF53ptxaJBcHYHAAAAA?rs=1&pid=ImgDetMain";
  const universityIcon = "https://cdn.pixabay.com/photo/2020/08/04/08/16/blue-5462087_1280.png";

  // US
  propertyData.forEach(property => {
      new mapboxgl.Marker({
          element: createCustomMarker(propertyIcon)
      })
      .setLngLat([property.longitude, property.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="text-align: center;">
              <h3 style="color: #ffcc00;">🏠 ${property.name}</h3>
              <p><strong>Type:</strong> Accommodation</p>
          </div>`
      ))
      .addTo(map);
  });

  // Uni
  uniData.forEach(university => {
      new mapboxgl.Marker({
          element: createCustomMarker(universityIcon)
      })
      .setLngLat([university.longitude, university.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="text-align: center;">
              <h3 style="color: #008CBA;">🎓 ${university.name}</h3>
              <p><strong>Type:</strong> University</p>
          </div>`
      ))
      .addTo(map);
  });

  console.log("Map loaded with custom markers.");
}

// 自定义 Marker
function createCustomMarker(iconUrl) {
  const marker = document.createElement('div');
  marker.style.backgroundImage = `url(${iconUrl})`;
  marker.style.width = "30px";
  marker.style.height = "30px";
  marker.style.backgroundSize = "cover";
  marker.style.borderRadius = "50%"; 
  marker.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.3)"; 
  return marker;
}