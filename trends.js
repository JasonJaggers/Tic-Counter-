(() => {
 'use strict';

 const storageKey = 'sterling-shift-trends-v1';
 const metric = document.getElementById('trend-metric');
 const plot = document.getElementById('trend-plot');
 const status = document.getElementById('trend-status');
 const load = document.getElementById('trend-load');
 const message = document.getElementById('trend-load-message');
 const connection = document.getElementById('trend-connection');
 const clientField = document.getElementById('trend-client-id');
 const clientKey = 'sterling-google-trends-client-v1';
 const scope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
 const sourceUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + window.Sterling.SHEET_ID +
  '/values/' + encodeURIComponent("'Shift Log History'!B7:H1005") + '?valueRenderOption=FORMATTED_VALUE';
 const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
 const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
 });

 function reading(value) {
  const text = value?.trim() ?? '';
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
 }

 function shiftReports(rows) {
  const headers = ['Date', 'Feed (GPM)', 'Belt Speed', 'TBHP', 'SS', 'Dryer Temperatures'];
  const headerIndex = rows.findIndex(row => headers.every(name => row.includes(name)));
  if (headerIndex < 0) throw Error('The Shift Log History columns have changed.');
  const [dateCol, feedCol, beltCol, tbhpCol, ssCol, dryerCol] =
   headers.map(name => rows[headerIndex].indexOf(name));
  const reports = rows.slice(headerIndex + 1).flatMap(row => {
   const label = row[dateCol]?.trim();
   if (!label) return [];
   const date = Date.parse(label.replace(/\s*\(.*\)\s*$/, '') + ' UTC');
   if (!Number.isFinite(date)) return [];
   const dryer = (row[dryerCol] ?? '').split('/');
   const values = [feedCol, beltCol, tbhpCol, ssCol].map(col => reading(row[col]));
   for (let zone = 0; zone < 4; zone++) values.push(reading(dryer[zone]));
   return values.some(value => value !== null) ? [{date, label, values}] : [];
  });
  // Rows on the same date are listed in their original report order.
  return reports.sort((a, b) => a.date - b.date).slice(-30);
 }

 function svgElement(tag, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
 }

 let reports = [];
 let clientId = '';
 try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (Array.isArray(saved)) reports = saved;
  clientId = localStorage.getItem(clientKey) ?? '';
  clientField.value = clientId;
 } catch {
  // The trend remains available for a fresh load.
 }

 function render() {
  plot.replaceChildren();
  const index = Number(metric.value);
  const points = reports.map(report => ({...report, value: report.values[index]}));
  const measured = points.filter(point => Number.isFinite(point.value));
  if (!measured.length) {
   status.textContent = reports.length ? 'No readings for this measurement.' : 'Tap Load to retrieve the latest shift reports.';
   return;
  }

  const values = measured.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.12, 0.5);
  const low = min - padding;
  const high = max + padding;
  const x = i => points.length === 1 ? 174 : 48 + 252 * i / (points.length - 1);
  const y = value => 112 - 99 * (value - low) / (high - low);
  const svg = svgElement('svg', {viewBox: '0 0 320 136', role: 'img', 'aria-label': metric.selectedOptions[0].text + ' by report'});
  for (const value of [low, (low + high) / 2, high]) {
   svg.append(
    svgElement('line', {x1: 48, x2: 300, y1: y(value), y2: y(value), class: 'trend-gridline'}),
    svgElement('text', {x: 42, y: y(value) + 4, 'text-anchor': 'end'}, numberFormat.format(value))
   );
  }
  let path = '';
  let connect = false;
  points.forEach((point, i) => {
   if (!Number.isFinite(point.value)) {
    connect = false;
    return;
   }
   path += (connect ? ' L ' : ' M ') + x(i) + ' ' + y(point.value);
   connect = true;
  });
  svg.append(svgElement('path', {d: path, class: 'trend-line'}));
  points.forEach((point, i) => {
   if (!Number.isFinite(point.value)) return;
   const dot = svgElement('circle', {cx: x(i), cy: y(point.value), r: 3, class: 'trend-dot'});
   dot.append(svgElement('title', {}, point.label + ' · ' + numberFormat.format(point.value)));
   svg.append(dot);
  });

  plot.append(svg);
  const latest = measured.at(-1);
  status.textContent = dateFormat.format(points[0].date) + ' to ' + dateFormat.format(points.at(-1).date) +
   ' · Latest reading ' + numberFormat.format(latest.value) + ' (' + dateFormat.format(latest.date) + ')';
 }

 metric.addEventListener('change', render);
 document.getElementById('trend-connection-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = clientField.value.trim();
  if (!/^[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(value)) {
   message.textContent = 'Enter a Google OAuth web client ID.';
   return;
  }
  try {
   localStorage.setItem(clientKey, value);
   clientId = value;
   connection.open = false;
   message.textContent = 'Connection saved. Tap Load to authorize Google Sheets.';
  } catch {
   message.textContent = 'Could not save the connection on this device.';
  }
 });

 function finish(text) {
  message.textContent = text;
  load.disabled = false;
 }

 async function fetchReports(token) {
  try {
   const response = await fetch(sourceUrl, {
    headers: {Authorization: 'Bearer ' + token},
    cache: 'no-store',
    signal: AbortSignal.timeout(15000)
   });
   if (!response.ok) {
    if (response.status === 403) throw Error('Google denied access. Check your sheet access and that the Google Sheets API is enabled.');
    throw Error('Google Sheets could not load the reports. Try Load again.');
   }
   const result = await response.json();
   const next = shiftReports(result.values ?? []);
   if (!next.length) throw Error('No dated readings were found in Shift Log History.');
   reports = next;
   render();
   try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    finish('');
   } catch {
    finish('Readings loaded, but this device could not save them for next time.');
   }
  } catch (error) {
   finish(error.message);
  }
 }

 load.addEventListener('click', () => {
  if (!navigator.onLine) {
   finish('Connect to the internet to load the latest reports.');
   return;
  }
  if (!clientId) {
   connection.open = true;
   clientField.focus();
   finish('Set up the Google Sheets connection before loading reports.');
   return;
  }
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) {
   finish('Google sign-in is unavailable. Reload the page and try again.');
   return;
  }
  load.disabled = true;
  message.textContent = 'Connecting to Google Sheets…';
  try {
   oauth.initTokenClient({
    client_id: clientId,
    scope,
    include_granted_scopes: false,
    callback: result => {
     if (!result.access_token) {
      finish('Google did not authorize access to the sheet.');
      return;
     }
     fetchReports(result.access_token);
    },
    error_callback: () => finish('Google sign-in did not complete. Tap Load to try again.')
   }).requestAccessToken({prompt: ''});
  } catch {
   finish('Google sign-in could not start. Check the connection settings.');
  }
 });

 render();
})();
