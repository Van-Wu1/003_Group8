// Imports
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { tradeData } from "../data/trade_data";

let pieChartInstance = null;
let globalSummary = null;
let polygonSeries = null;

window.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("projectionToggle");
    const { root, polygonSeries: ps } = initAmMap();
    polygonSeries = ps;

    // initialization
    document.querySelectorAll('.labels span')[0].classList.add('active');
    updateAmMapField(polygonSeries, "total");
    updateD3Treemap("total");
    updatePieChart("GLOBAL");

    slider.addEventListener("input", function () {
        const value = parseInt(slider.value);
        let field = "total";
        if (value === 1) field = "import";
        if (value === 2) field = "export";

        updateAmMapField(polygonSeries, field);
        updateD3Treemap(field);
        updatePieChart("GLOBAL");

        const labelSpans = document.querySelectorAll('.labels span');
        labelSpans.forEach((span, idx) => {
            if (idx === value) {
                span.classList.add('active');
            } else {
                span.classList.remove('active');
            }
        });
    });
});

function initAmMap() {
    const root = am5.Root.new("map1");
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
        am5map.MapChart.new(root, {
            projection: am5map.geoNaturalEarth1(),
            background: am5.Rectangle.new(root, {
                fill: am5.color(0xF7F9FB),
                fillOpacity: 1
            })
        })
    );

    chart.series.unshift(am5map.GraticuleSeries.new(root, { step: 10 })).mapLines.template.setAll({ strokeOpacity: 0.05 });

    const ps = chart.series.push(am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_worldLow,
        valueField: "value",
        calculateAggregates: true,
        exclude: ["AQ"]
    }));

    ps.set("heatRules", [
        {
            target: ps.mapPolygons.template,
            dataField: "value",
            min: am5.color(0xc6dbef),
            max: am5.color(0x08306b),
            key: "fill"
        }
    ]);

    ps.mapPolygons.template.setAll({
        tooltipText: "{name}: {value}",
        fill: am5.color(0xe0e0e0),
        stroke: am5.color(0xffffff)
    });

    ps.mapPolygons.template.adapters.add("tooltipText", function (text, target) {
        const dataItem = target.dataItem;
        const val = dataItem && dataItem.dataContext ? dataItem.dataContext.value : null;
        if (val != null) {
            const formatted = (val / 1e9).toFixed(2);
            return `{name}: ${formatted} billion`;
        } else {
            return `{name}: No Data`;
        }
    });

    ps.mapPolygons.template.events.on("click", function (ev) {
        const iso2 = ev.target.dataItem.dataContext.id;
        const iso3 = iso2to3(iso2);

        if (iso3) {
            updatePieChart(iso3);
        } else {
            updatePieChart("GLOBAL");
        }
    });

    const heatLegend = chart.children.push(am5.HeatLegend.new(root, {
        orientation: "horizontal",
        startColor: am5.color(0xc6dbef),
        endColor: am5.color(0x08306b),
        stepCount: 10,
        startText: "Low",
        endText: "High",
        y: am5.percent(80),
        x: am5.percent(50),
        centerX: am5.percent(50)
    }));


    ps.mapPolygons.template.events.on("pointerover", function (ev) {
        heatLegend.showValue(ev.target.dataItem.get("value"));
    });

    ps.events.on("datavalidated", function () {
        heatLegend.set("startValue", ps.getPrivate("valueLow"));
        heatLegend.set("endValue", ps.getPrivate("valueHigh"));

        chart.zoomToGeoPoint({ longitude: 0, latitude: 0 }, 1.2);
    });

    return { root, polygonSeries: ps };
}

const iso3to2 = {
    ABW: "AW", AFG: "AF", AGO: "AO", AIA: "AI", ALA: "AX",
    ALB: "AL", AND: "AD", ARE: "AE", ARG: "AR", ARM: "AM",
    ASM: "AS", ATA: "AQ", ATF: "TF", ATG: "AG", AUS: "AU",
    AUT: "AT", AZE: "AZ", BDI: "BI", BEL: "BE", BEN: "BJ",
    BES: "BQ", BFA: "BF", BGD: "BD", BGR: "BG", BHR: "BH",
    BHS: "BS", BIH: "BA", BLM: "BL", BLR: "BY", BLZ: "BZ",
    BMU: "BM", BOL: "BO", BRA: "BR", BRB: "BB", BRN: "BN",
    BTN: "BT", BVT: "BV", BWA: "BW", CAF: "CF", CAN: "CA",
    CCK: "CC", CHE: "CH", CHL: "CL", CHN: "CN", CIV: "CI",
    CMR: "CM", COD: "CD", COG: "CG", COK: "CK", COL: "CO",
    COM: "KM", CPV: "CV", CRI: "CR", CUB: "CU", CUW: "CW",
    CXR: "CX", CYM: "KY", CYP: "CY", CZE: "CZ", DEU: "DE",
    DJI: "DJ", DMA: "DM", DNK: "DK", DOM: "DO", DZA: "DZ",
    ECU: "EC", EGY: "EG", ERI: "ER", ESH: "EH", ESP: "ES",
    EST: "EE", ETH: "ET", FIN: "FI", FJI: "FJ", FLK: "FK",
    FRA: "FR", FRO: "FO", FSM: "FM", GAB: "GA", GBR: "GB",
    GEO: "GE", GGY: "GG", GHA: "GH", GIB: "GI", GIN: "GN",
    GLP: "GP", GMB: "GM", GNB: "GW", GNQ: "GQ", GRC: "GR",
    GRD: "GD", GRL: "GL", GTM: "GT", GUF: "GF", GUM: "GU",
    GUY: "GY", HKG: "HK", HMD: "HM", HND: "HN", HRV: "HR",
    HTI: "HT", HUN: "HU", IDN: "ID", IMN: "IM", IND: "IN",
    IOT: "IO", IRL: "IE", IRN: "IR", IRQ: "IQ", ISL: "IS",
    ISR: "IL", ITA: "IT", JAM: "JM", JEY: "JE", JOR: "JO",
    JPN: "JP", KAZ: "KZ", KEN: "KE", KGZ: "KG", KHM: "KH",
    KIR: "KI", KNA: "KN", KOR: "KR", KWT: "KW", LAO: "LA",
    LBN: "LB", LBR: "LR", LBY: "LY", LCA: "LC", LIE: "LI",
    LKA: "LK", LSO: "LS", LTU: "LT", LUX: "LU", LVA: "LV",
    MAC: "MO", MAF: "MF", MAR: "MA", MCO: "MC", MDA: "MD",
    MDG: "MG", MDV: "MV", MEX: "MX", MHL: "MH", MKD: "MK",
    MLI: "ML", MLT: "MT", MMR: "MM", MNE: "ME", MNG: "MN",
    MNP: "MP", MOZ: "MZ", MRT: "MR", MSR: "MS", MTQ: "MQ",
    MUS: "MU", MWI: "MW", MYS: "MY", MYT: "YT", NAM: "NA",
    NCL: "NC", NER: "NE", NFK: "NF", NGA: "NG", NIC: "NI",
    NIU: "NU", NLD: "NL", NOR: "NO", NPL: "NP", NRU: "NR",
    NZL: "NZ", OMN: "OM", PAK: "PK", PAN: "PA", PCN: "PN",
    PER: "PE", PHL: "PH", PLW: "PW", PNG: "PG", POL: "PL",
    PRI: "PR", PRK: "KP", PRT: "PT", PRY: "PY", PSE: "PS",
    PYF: "PF", QAT: "QA", REU: "RE", ROU: "RO", RUS: "RU",
    RWA: "RW", SAU: "SA", SDN: "SD", SEN: "SN", SGP: "SG",
    SGS: "GS", SHN: "SH", SJM: "SJ", SLB: "SB", SLE: "SL",
    SLV: "SV", SMR: "SM", SOM: "SO", SPM: "PM", SRB: "RS",
    SSD: "SS", STP: "ST", SUR: "SR", SVK: "SK", SVN: "SI",
    SWE: "SE", SWZ: "SZ", SXM: "SX", SYC: "SC", SYR: "SY",
    TCA: "TC", TCD: "TD", TGO: "TG", THA: "TH", TJK: "TJ",
    TKL: "TK", TKM: "TM", TLS: "TL", TON: "TO", TTO: "TT",
    TUN: "TN", TUR: "TR", TUV: "TV", TWN: "TW", TZA: "TZ",
    UGA: "UG", UKR: "UA", UMI: "UM", URY: "UY", USA: "US",
    UZB: "UZ", VAT: "VA", VCT: "VC", VEN: "VE", VGB: "VG",
    VIR: "VI", VNM: "VN", VUT: "VU", WLF: "WF", WSM: "WS",
    YEM: "YE", ZAF: "ZA", ZMB: "ZM", ZWE: "ZW"
};


function mapTradeDataToAmFormat(field = "total") {
    return Object.entries(tradeData)
        .map(([iso3, entry]) => {
            const iso2 = iso3to2[iso3];
            if (!iso2) return null;
            return {
                id: iso2,
                value: entry[field] ?? 0
            };
        })
        .filter(Boolean);
}

function updateAmMapField(polygonSeries, field) {
    polygonSeries.set("valueField", "value");
    polygonSeries.data.setAll(mapTradeDataToAmFormat(field));
}

function iso2to3(iso2) {
    for (const [iso3, iso2value] of Object.entries(iso3to2)) {
        if (iso2value === iso2) return iso3;
    }
    return null;
}



// rectangular tree diagram
function updateD3Treemap(field) {
    const data = Object.entries(tradeData)
        .map(([iso, d]) => ({ iso, name: d.name || iso, value: typeof d[field] === 'number' ? d[field] : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const container = document.querySelector('.treecontent');
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select("#d3-treemap")
        .attr("width", width)
        .attr("height", height);

    const root = d3.hierarchy({ children: data }).sum(d => d.value);
    d3.treemap().size([width, height]).padding(2)(root);

    const color = d3.scaleSequential([0, d3.max(data, d => d.value)], d3.interpolateBlues);
    const t = d3.transition().duration(800).ease(d3.easeCubicInOut);

    const nodes = svg.selectAll("g")
        .data(root.leaves(), d => d.data.iso);

    // Update Position and Size
    nodes.transition(t)
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    nodes.select("rect").transition(t)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => color(d.value));

    // Update Position and Size
    const enter = nodes.enter().append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`);

    enter.append("rect")
        .attr("width", 0)
        .attr("height", 0)
        .attr("fill", d => color(d.value))
        .transition(t)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0);

    enter.append("text")
        .attr("x", 4)
        .attr("y", 14)
        .text(d => d.data.name)
        .attr("font-size", "10px")
        .attr("fill", "white");

    enter.append("text")
        .attr("x", 4)
        .attr("y", 28)
        .text(d => (d.data.value / 1e9).toFixed(2))
        .attr("font-size", "10px")
        .attr("fill", "white");

    nodes.exit().remove();

    document.querySelector('.rank p').textContent = `Ranking (${field.charAt(0).toUpperCase() + field.slice(1)})`;
}


function computeGlobalSummary() {
    let totalImport = 0;
    let totalExport = 0;
    Object.values(tradeData).forEach(d => {
        if (typeof d.import === 'number') totalImport += d.import;
        if (typeof d.export === 'number') totalExport += d.export;
    });
    return { import: totalImport, export: totalExport };
}

function initGlobalSummary() {
    if (!globalSummary) {
        globalSummary = computeGlobalSummary();
    }
}

// pie chart
function updatePieChart(isoCode = 'GLOBAL') {
    const pieContainer = document.querySelector('.piecontent');
    if (!pieContainer) return;

    pieContainer.innerHTML = `
    <canvas id="pieChart" width="160" height="160" style="max-width: 100%;"></canvas>
    <p class="pie-label"></p>
  `;

    const ctx = document.getElementById('pieChart').getContext('2d');

    let importValue, exportValue;
    let label = 'Global';

    if (isoCode === 'GLOBAL') {
        initGlobalSummary();
        importValue = globalSummary.import;
        exportValue = globalSummary.export;
    } else {
        const countryData = tradeData[isoCode] || { import: 0, export: 0 };
        importValue = countryData.import || 0;
        exportValue = countryData.export || 0;
        label = countryData.name || isoCode;
    }

    document.querySelector('.pie-chart-title').textContent = `${label} Import / Export`;

    const total = importValue + exportValue;
    const chartData = {
        labels: ['Import', 'Export'],
        datasets: [{
            data: [importValue, exportValue],
            backgroundColor: ['rgb(95, 191, 255)', '#1E0F75']
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: {
                displayColors: false,
                callbacks: {
                    label: function (context) {
                        const value = (context.raw / 1e9).toFixed(2);
                        const percent = total ? ((context.raw / total) * 100).toFixed(1) : 0;
                        return [`Value: ${value} (100 million)`, `Percent: ${percent}%`];
                    }
                }
            },
            title: { display: false }
        }
    };

    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: chartOptions,
        plugins: [ChartDataLabels]
    });
}