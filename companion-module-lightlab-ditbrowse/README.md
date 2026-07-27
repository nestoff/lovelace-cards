# companion-module-lightlab-ditbrowse

Bitfocus Companion connection module for the DIT Browse macOS app.

The module connects to DIT Browse over a loopback-only WebSocket, focuses cameras by positive integer number, publishes live state to Companion, and controls the app's persistent-grid expansion mode.

See [HELP.md](./companion/HELP.md) for operator instructions.

## Development

Requirements:

- Node.js 22.20 or newer within the Node 22 release line
- Yarn 4
- DIT Browse for live integration testing

Install and verify:

```bash
yarn install
yarn test
yarn lint
yarn typecheck
yarn build
yarn companion-module-check
```

Build an installable Companion archive:

```bash
yarn package
```

For live development, point Companion's Developer Modules directory at this package and run:

```bash
yarn dev
```

The default endpoint is `ws://127.0.0.1:52780/api/ws`. The host is fixed to loopback, and the module intentionally has no token or other authentication setting.
