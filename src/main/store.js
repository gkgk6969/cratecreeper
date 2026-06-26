const Store = require('electron-store');
const path = require('path');
const os = require('os');

const schema = {
  apiKey: { type: 'string', default: '' },
  downloadsPath: {
    type: 'string',
    default: path.join(os.homedir(), 'Downloads'),
  },
  defaultStore: {
    type: 'string',
    enum: ['beatport', 'bandcamp'],
    default: 'beatport',
  },
  xmlOutputPath: {
    type: 'string',
    default: path.join(os.homedir(), 'Music', 'CrateDigger'),
  },
  preferLocalOcr: { type: 'boolean', default: true },
};

const store = new Store({ schema, encryptionKey: 'crate-digger-v1' });

module.exports = {
  getAll: () => ({
    apiKey: store.get('apiKey'),
    downloadsPath: store.get('downloadsPath'),
    defaultStore: store.get('defaultStore'),
    xmlOutputPath: store.get('xmlOutputPath'),
    preferLocalOcr: store.get('preferLocalOcr'),
  }),
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
};
