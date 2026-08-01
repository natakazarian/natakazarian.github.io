(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') === '1') {
    document.body.classList.add('embed');
  }

  const root = document.documentElement;
  const themeButton = document.getElementById('themeButton');
  const loadingPanel = document.getElementById('loadingPanel');
  const infoPanel = document.getElementById('infoPanel');
  const legendPanel = document.getElementById('legendPanel');
  const greenToggle = document.getElementById('greenToggle');
  const legendToggleButton = document.getElementById('legendToggleButton');
  const modeButtons = [...document.querySelectorAll('.mode-button')];

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let darkTheme = params.get('theme') === 'dark' || (params.get('theme') !== 'light' && prefersDark);
  let currentMode = 'green';
  let irisLayer = null;
  let greenLayer = null;
  let bufferLayer = null;

  const map = L.map('map', {
    zoomControl: true,
    preferCanvas: false,
    minZoom: 10,
    maxZoom: 18,
    zoomSnap: 0.25
  }).setView([48.8566, 2.3522], 11.7);

  const greenCanvas = L.canvas({ padding: 0.5 });

  const tileUrls = {
    light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  };

  let tileLayer = L.tileLayer(tileUrls.light, {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

  const greenBreaks = [3.3, 12.2, 29, 61];
  const incomeBreaks = [24426, 30042, 34016, 39040];
  const ramp = ['#d73027', '#fc8d59', '#fee08b', '#91bfdb', '#4575b4'];
  const missingColor = '#b9c0c2';

  const modes = {
    green: {
      title: 'Green space per resident (m²/person)',
      note: 'Values above 93.5 are shown in the highest display class.',
      labels: ['0–3.3', '3.3–12.2', '12.2–29', '29–61', '61+'],
      value: props => props.green_per_cap,
      format: value => value == null ? 'No data' : `${formatNumber(value, 2)} m²/person`
    },
    income: {
      title: 'Median disposable income (€/year)',
      note: '2021 INSEE neighbourhood-level indicator.',
      labels: ['€14,900–24,426', '€24,426–30,042', '€30,042–34,016', '€34,016–39,040', '€39,040–65,140'],
      value: props => props.income,
      format: value => value == null ? 'No data' : formatCurrency(value)
    },
    access: {
      title: '500 m straight-line accessibility zone',
      note: 'Euclidean buffer, not a pedestrian-route catchment.',
      labels: ['500 m accessibility zone', 'Mapped green features'],
      value: () => null,
      format: () => 'Within mapped 500 m buffer'
    }
  };

  function formatNumber(value, maxDigits = 1) {
    return new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: maxDigits
    }).format(value);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function classIndex(value, breaks) {
    if (value == null || Number.isNaN(Number(value))) return -1;
    const number = Number(value);
    for (let index = 0; index < breaks.length; index += 1) {
      if (number < breaks[index]) return index;
    }
    return breaks.length;
  }

  function irisStyle(feature) {
    const props = feature.properties || {};

    if (currentMode === 'access') {
      return {
        color: darkTheme ? '#9da9a1' : '#59655e',
        weight: 0.45,
        opacity: 0.35,
        fillColor: 'transparent',
        fillOpacity: 0
      };
    }

    const value = modes[currentMode].value(props);
    const index = classIndex(value, currentMode === 'green' ? greenBreaks : incomeBreaks);

    return {
      color: darkTheme ? '#202825' : '#ffffff',
      weight: 0.7,
      opacity: 0.8,
      fillColor: index < 0 ? missingColor : ramp[index],
      fillOpacity: index < 0 ? 0.38 : 0.76
    };
  }

  function greenStyle(feature) {
    const area = Number(feature.properties?.area_m2 || 0);
    return {
      renderer: greenCanvas,
      color: darkTheme ? '#9fda90' : '#1d5e2b',
      weight: area > 50000 ? 1.2 : 0.65,
      opacity: 0.9,
      fillColor: darkTheme ? '#3fae5a' : '#19a447',
      fillOpacity: area > 5000 ? 0.78 : 0.58
    };
  }

  function bufferStyle() {
    return {
      color: darkTheme ? '#d8c98d' : '#7e7249',
      weight: 1.2,
      opacity: 0.9,
      fillColor: darkTheme ? '#c7b978' : '#d7cc9f',
      fillOpacity: darkTheme ? 0.28 : 0.42
    };
  }

  function popupHtml(props) {
    const greenValue = props.green_per_cap == null ? 'No data' : `${formatNumber(props.green_per_cap, 2)} m²/person`;
    const incomeValue = props.income == null ? 'No data' : formatCurrency(props.income);
    const populationValue = props.population == null ? 'No data' : formatNumber(props.population, 0);

    return `
      <div class="popup-title"><strong>${escapeHtml(props.name || 'IRIS zone')}</strong></div>
      <div class="popup-subtitle">${escapeHtml(props.arrondissement || '')}</div>
      <div class="popup-grid">
        <span>Green space</span><strong>${greenValue}</strong>
        <span>Median income</span><strong>${incomeValue}</strong>
        <span>Population</span><strong>${populationValue}</strong>
        <span>IRIS code</span><strong>${escapeHtml(props.code || '—')}</strong>
      </div>
    `;
  }

  function featurePopupHtml(props) {
    const area = props.area_m2 == null ? 'Not reported' : `${formatNumber(props.area_m2, 0)} m²`;
    return `
      <div class="popup-title"><strong>${escapeHtml(props.name || 'Mapped green feature')}</strong></div>
      <div class="popup-subtitle">${escapeHtml(props.category || props.type || '')}</div>
      <div class="popup-grid">
        <span>Type</span><strong>${escapeHtml(props.type || '—')}</strong>
        <span>Area</span><strong>${area}</strong>
        <span>Address</span><strong>${escapeHtml(props.address || '—')}</strong>
      </div>
    `;
  }

  function updateInfo(props = null) {
    if (!props) {
      infoPanel.innerHTML = `
        <span class="info-kicker">Hover over an IRIS zone</span>
        <strong>Paris neighbourhoods</strong>
        <span>Click a zone to see all indicators.</span>
      `;
      return;
    }

    const value = modes[currentMode].format(modes[currentMode].value(props));
    infoPanel.innerHTML = `
      <span class="info-kicker">${escapeHtml(modes[currentMode].title)}</span>
      <strong>${escapeHtml(props.name || 'IRIS zone')}</strong>
      <span>${escapeHtml(props.arrondissement || '')} · ${escapeHtml(value)}</span>
    `;
  }

  function onEachIris(feature, layer) {
    const props = feature.properties || {};
    layer.bindPopup(popupHtml(props), { maxWidth: 330 });

    layer.on({
      mouseover: event => {
        event.target.setStyle({
          weight: 2.2,
          color: darkTheme ? '#ffffff' : '#102c43',
          opacity: 1,
          fillOpacity: currentMode === 'access' ? 0.08 : 0.92
        });
        event.target.bringToFront();
        updateInfo(props);
      },
      mouseout: event => {
        irisLayer.resetStyle(event.target);
        updateInfo();
      },
      focus: () => updateInfo(props),
      blur: () => updateInfo()
    });
  }

  function onEachGreen(feature, layer) {
    layer.bindPopup(featurePopupHtml(feature.properties || {}), { maxWidth: 330 });
  }

  function legendHtml() {
    const mode = modes[currentMode];

    if (currentMode === 'access') {
      return `
        <span class="legend-title">${mode.title}</span>
        <span class="legend-row"><i class="legend-swatch" style="background:#d7cc9f"></i><span>${mode.labels[0]}</span></span>
        <span class="legend-row"><i class="legend-swatch" style="background:#19a447"></i><span>${mode.labels[1]}</span></span>
        <span class="legend-note">${mode.note}</span>
      `;
    }

    const rows = mode.labels.map((label, index) => `
      <span class="legend-row"><i class="legend-swatch" style="background:${ramp[index]}"></i><span>${label}</span></span>
    `).join('');

    return `
      <span class="legend-title">${mode.title}</span>
      ${rows}
      <span class="legend-row"><i class="legend-swatch" style="background:${missingColor}"></i><span>No data</span></span>
      <span class="legend-note">${mode.note}</span>
    `;
  }

  function updateLegend() {
    legendPanel.innerHTML = legendHtml();
  }

  function ensureLayer(layer, visible) {
    if (!layer) return;
    if (visible && !map.hasLayer(layer)) layer.addTo(map);
    if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
  }

  function setMode(mode) {
    if (!modes[mode]) return;
    currentMode = mode;

    modeButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    ensureLayer(bufferLayer, mode === 'access');
    ensureLayer(greenLayer, greenToggle.checked);

    if (irisLayer) irisLayer.setStyle(irisStyle);
    if (greenLayer) greenLayer.setStyle(greenStyle);
    if (bufferLayer) bufferLayer.setStyle(bufferStyle);

    if (mode === 'access' && bufferLayer) bufferLayer.bringToBack();
    if (irisLayer) irisLayer.bringToFront();
    if (greenLayer) greenLayer.bringToFront();

    updateLegend();
    updateInfo();
  }

  function setTheme(nextDark) {
    darkTheme = nextDark;
    root.dataset.theme = darkTheme ? 'dark' : 'light';
    themeButton?.setAttribute('aria-pressed', String(darkTheme));
    if (themeButton) {
      themeButton.lastElementChild.textContent = darkTheme ? 'Light map' : 'Dark map';
    }

    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(darkTheme ? tileUrls.dark : tileUrls.light, {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    tileLayer.bringToBack();

    if (irisLayer) irisLayer.setStyle(irisStyle);
    if (greenLayer) greenLayer.setStyle(greenStyle);
    if (bufferLayer) bufferLayer.setStyle(bufferStyle);
  }



  async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  }

  async function initialise() {
    try {
      const [irisData, greenData, bufferData] = await Promise.all([
        loadJson('./data/iris.geojson'),
        loadJson('./data/green_features.geojson'),
        loadJson('./data/buffer.geojson')
      ]);

      bufferLayer = L.geoJSON(bufferData, {
        style: bufferStyle,
        interactive: false
      });

      irisLayer = L.geoJSON(irisData, {
        style: irisStyle,
        onEachFeature: onEachIris
      }).addTo(map);

      greenLayer = L.geoJSON(greenData, {
        renderer: greenCanvas,
        style: greenStyle,
        onEachFeature: onEachGreen
      }).addTo(map);

      map.fitBounds(irisLayer.getBounds(), {
        padding: [18, 18],
        animate: true,
        duration: 0.8
      });

      updateLegend();
      loadingPanel.classList.add('is-hidden');
    } catch (error) {
      console.error(error);
      loadingPanel.innerHTML = `
        <strong>Map data could not be loaded.</strong>
        <span>Open the folder through Live Server or GitHub Pages rather than as a local file.</span>
      `;
    }
  }

  modeButtons.forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  greenToggle.addEventListener('change', () => {
    ensureLayer(greenLayer, greenToggle.checked);
  });

  if (legendToggleButton && legendPanel) {
    legendToggleButton.addEventListener('click', () => {
      const isHidden = legendPanel.classList.toggle('is-hidden');
      legendToggleButton.classList.toggle('is-active', !isHidden);
      legendToggleButton.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  themeButton?.addEventListener('click', () => setTheme(!darkTheme));

  setTheme(darkTheme);
  initialise();
})();
