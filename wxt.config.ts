import { defineConfig } from 'wxt';

const GECKO_EXTENSION_ID = 'docode@linux.do';
const GECKO_MINIMUM_VERSION = '128.0';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'DOCode',
    description: "Do not try Ctrl+S here, it's not effective.",
    permissions: ['storage'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
      },
      default_title: 'DOCode',
    },
    web_accessible_resources: [
      {
        matches: ['https://linux.do/*'],
        resources: ['docode.webmanifest'],
      },
    ],
    commands: {
      'toggle-docode': {
        description: 'Toggle DOCode workbench on Linux DO',
        suggested_key: {
          default: 'Alt+Shift+D',
          mac: 'MacCtrl+Shift+D',
        },
      },
    },
    // Firefox needs a stable add-on id to install an unsigned XPI, and the
    // MAIN-world reply bridge only exists from Firefox 128 onwards.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              data_collection_permissions: { required: ['none'] },
              id: GECKO_EXTENSION_ID,
              strict_min_version: GECKO_MINIMUM_VERSION,
            },
          },
        }
      : {}),
  }),
  vite: () => ({ build: { sourcemap: false } }),
});
