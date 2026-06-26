const { shell } = require('electron');

const URL_TEMPLATES = {
  beatport: 'https://www.beatport.com/search?q={q}',
  bandcamp: 'https://bandcamp.com/search?q={q}&item_type=t',
};

function buildUrl(template, artist, title) {
  const q = encodeURIComponent(`${artist} ${title}`.trim().replace(/\s+/g, ' '));
  return template.replace('{q}', q);
}

async function openStoreLinks(tracks, storeId) {
  const tpl = URL_TEMPLATES[storeId] || URL_TEMPLATES.beatport;
  const list = Array.isArray(tracks) ? tracks : [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t || !t.artist || !t.title) continue;
    const url = buildUrl(tpl, t.artist, t.title);
    shell.openExternal(url).catch((e) => console.error('openExternal failed', e));
    if (i < list.length - 1) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return { opened: list.length, store: storeId };
}

module.exports = { openStoreLinks };
