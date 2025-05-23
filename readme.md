# PharmaNexus 🌍💊

**PharmaNexus** is an interactive web visualization project exploring the global spatial structure of the pharmaceutical industry. It combines city-level data, network relationships, and resilience metrics to reveal how global pharma operates across regions and cities.


## 🧠 Project Overview

This platform provides multi-level insight into how cities participate in pharmaceutical trade, governance, and resilience. It includes four core visualization modules and supporting introductory content.


## 🌐 Live Demo

> _Coming Soon_ 


## 📊 Modules

| Section                     | Description                                               |
|----------------------------|-----------------------------------------------------------|
| 🌍 **Global Trade**         | Visualizes pharmaceutical trade flow between countries.   |
| 🏙️ **City Functions**       | Shows the role and importance of cities in the pharma network. |
| 🧬 **Pharma Control**       | Maps ownership/control networks among global pharma HQs.  |
| 📊 **Resilience & Comparison** | Compares cities based on resilience and ESG indicators.     |


## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Mapping**: [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- **Charts**: D3.js (bar comparisons), amCharts (global maps)
- **GeoData**: Processed with GeoPandas / QGIS
- **Design**: Tailored to clean, interactive and minimal UX


## 📁 Folder Structure

```bash
.
├── public/                 # Static assets (favicon, meta)
├── src/                   # Source code
│   ├── data/              # GeoJSON datasets
│   ├── img/               # Module icons & screenshots
│   ├── js/                # JavaScript logic (main.js, map logic, UI control)
│   ├── styles/            # CSS / SCSS files
│   └── index.html         # Root HTML file
├── docs/                  # (Optional) Deployment folder
├── py/                    # Data preprocessing or Python utilities
├── .env                   # Environment variables
├── vite.config.js         # Vite config
└── readme.md              # ← You're here!
```

## ✨ Features
- Dual-city comparison with animated bar transitions

- Multi-scale maps (global overview + zoom-in boundary)

- Adaptive design with custom legends and tooltips

- Animated markers & smooth flyTo navigation

- Visual encodings based on resilience clustering

## 👩‍🎓 Authors

**From CASA0003 Group8 – UCL**

## 📜 License
This project is for educational use only under the CASA0003 module.

All third-party assets follow their respective licenses.