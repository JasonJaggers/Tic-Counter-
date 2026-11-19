(() => {
 'use strict';

 const storageKey = 'sterling-shift-trends-v1';
 const metric = document.getElementById('trend-metric');
 const plot = document.getElementById('trend-plot');
 const status = document.getElementById('trend-status');
 const files = document.getElementById('trend-file');
 const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
 const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
 });

 function csvRows(text) {
  // Match whole fields so quoted notes may contain commas, quotes and line breaks.
  const rows = [[]];
  const fields = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/gy;
  while (fields.lastIndex < text.length) {
   const field = fields.exec(text);
   if (!field) throw Error('This file contains invalid CSV.');
   const [, quoted, plain, separator] = field;
   rows.at(-1).push(quoted === undefined ? plain : quoted.replaceAll('""', '"'));
   if (separator && separator !== ',') rows.push([]);
   if (separator === ',' && fields.lastIndex === text.length) rows.at(-1).push('');
  }
  return rows;
 }

 function reading(value) {
  const text = value?.trim() ?? '';
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
 }

 function shiftReports(text) {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const headers = ['Date', 'Feed (GPM)', 'Belt Speed', 'TBHP', 'SS', 'Dryer Temperatures'];
  const headerIndex = rows.findIndex(row => headers.every(name => row.includes(name)));
  if (headerIndex < 0) throw Error('Choose the CSV exported from Shift Log History.');
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
 try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  if (Array.isArray(saved)) reports = saved;
 } catch {
  // The trend remains available for a fresh import.
 }

 function render() {
  plot.replaceChildren();
  const index = Number(metric.value);
  const points = reports.map(report => ({...report, value: report.values[index]}));
  const measured = points.filter(point => Number.isFinite(point.value));
  if (!measured.length) {
   status.textContent = reports.length ? 'No readings for this measurement.' : 'Import a Shift Log History CSV to see your trends.';
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
 files.addEventListener('change', async () => {
  const file = files.files[0];
  if (!file) return;
  const message = document.getElementById('trend-import-message');
  try {
   if (file.size > 5_000_000) throw Error('Choose a CSV under 5 MB.');
   const next = shiftReports(await file.text());
   if (!next.length) throw Error('No dated readings were found in this CSV.');
   localStorage.setItem(storageKey, JSON.stringify(next));
   reports = next;
   message.textContent = '';
   render();
  } catch (error) {
   message.textContent = error.name === 'QuotaExceededError' ? 'There is not enough device storage for this import.' : error.message;
  } finally {
   files.value = '';
  }
 });

 render();
})();
