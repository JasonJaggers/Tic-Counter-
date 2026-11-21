// Run only on the original Sterling site, in the browser profile holding its data.
// Reads five known keys and downloads a local file. Sends nothing over the network.
(() => {
  if (location.origin !== 'https://jasonjaggers.github.io' || !location.pathname.startsWith('/Tic-Counter-/')) {
    throw new Error('Open the original Sterling site before exporting.');
  }
  const keys = [
    'tank-counter-v1', 'sterling-line1-levels-v1', 'sterling-v2-archives',
    'sterling-specialty-bbs-selected-v1', 'sterling-specialty-report-selected-v1'
  ];
  const values = Object.fromEntries(keys.flatMap(key => {
    const value = localStorage.getItem(key);
    return value === null ? [] : [[key, value]];
  }));
  if (!Object.keys(values).length) throw new Error('No Sterling records were found in this browser profile.');
  const data = new Blob([JSON.stringify({format: 'sterling-web-backup-v1', values})], {type: 'application/json'});
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sterling-web-backup.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
})();
