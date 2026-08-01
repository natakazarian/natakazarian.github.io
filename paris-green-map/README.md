# Paris green-space interactive map

A responsive Leaflet map built from the supplied QGIS/GeoJSON exports and the accompanying analysis.

## What is included

- `index.html` — standalone portfolio page
- `styles.css` — responsive light/dark design
- `map.js` — Leaflet map, layer switching, hover details, popups and story animation
- `data/iris.geojson` — reprojected and web-optimised IRIS layer
- `data/green_features.geojson` — simplified mapped green features
- `data/buffer.geojson` — reprojected 500 m dissolved buffer
- `integration-snippet.html` — example for embedding the map in another portfolio page

The source GeoJSON in EPSG:2154 was converted to EPSG:4326 for Leaflet. Unneeded attributes were removed and geometry was simplified slightly for web performance.

## Test locally

Open the folder in Antigravity/VS Code, right-click `index.html`, and choose **Open with Live Server**.

Do not open `index.html` directly from Finder: browsers commonly block local `fetch()` requests for GeoJSON.

## Publish on GitHub Pages

Upload the complete `paris-green-map` folder to the repository. It can then be opened at a path such as:

`https://USERNAME.github.io/REPOSITORY/paris-green-map/`

## Embed in the existing portfolio

Use the code in `integration-snippet.html`. The `?embed=1` parameter hides the standalone heading, findings and footer while keeping the map controls.

## Easy edits

- Classification breaks and colours: `map.js`
- Page colours, spacing and mobile layout: `styles.css`
- Findings and explanatory text: `index.html`
- Default map mode: change `currentMode = 'green'` in `map.js`

## Data note

The displayed summary figure of 0.68 m²/person follows the accompanying analysis PDF. The uploaded `green_per_iris_final.geojson` appears to be a slightly different export, so recalculating its median may not reproduce exactly the same number.

## External services

- Leaflet 1.9.4 is loaded from unpkg.
- The basemap is provided by CARTO using OpenStreetMap data.
- Required map attribution is displayed automatically.
