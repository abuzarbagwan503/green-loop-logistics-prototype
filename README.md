# Green-Loop Logistics — Front-end prototype

A responsive single-page prototype for localized reverse logistics.

## Run locally
1. Extract the ZIP file.
2. Open `index.html` in a modern browser.
3. For best results, run a local static server (for example, VS Code Live Server).

## Screens
- Landing page
- Vendor dashboard
- Driver dashboard
- Management dashboard

## Simulation flow
1. Open Vendor and select **Log 100kg Waste**.
2. The request appears in the Driver dashboard and all dashboard totals refresh.
3. Open Driver, select the request, and click **Accept pickup**.
4. Click **Confirm waste drop-off** to complete the delivery.
5. Open Management to view updated KPIs and charts.

## Model assumptions
- Green Points: 1 point per kg logged.
- Fertilizer output: 30% of incoming waste weight.
- Fertilizer selling price: ₹18/kg.
- Logistics operating cost: ₹3/kg of incoming waste.

These values are illustrative assumptions for a prototype. Replace them with measured local data before using the model for business or investment decisions.

## Architecture
- `index.html` — app shell, screen markup, Tailwind CDN, Chart.js CDN.
- `styles.css` — custom brand styling and responsive components.
- `app.js` — shared state, localStorage persistence, simulation engine, dashboard rendering and charts.

## Notes
This is a front-end simulation, not a production system. It has no authentication, server database, live GPS, payment gateway, or real driver dispatch. Browser localStorage keeps demo state on the current device.
