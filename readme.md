# tego-sheet

`tego-sheet` is an in-progress React and TypeScript spreadsheet library rewrite.

> **Status:** The repository currently provides only the modern package, test, and SSR-safe build foundation. The public React spreadsheet API is still being implemented, so this package is not release-ready and does not yet expose runtime component behavior.

## Peer requirements

Consumers will need compatible React peers:

- `react` `^19.2.7`
- `react-dom` `^19.2.7`

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

The library build produces ESM, CommonJS, and TypeScript declarations. Importing the current entry is safe in server-side environments and does not evaluate browser globals.

## Design

The rewrite architecture and implementation sequence are documented in:

- [`docs/superpowers/specs/2026-07-13-tego-sheet-react-rewrite-design.md`](docs/superpowers/specs/2026-07-13-tego-sheet-react-rewrite-design.md)
- [`docs/superpowers/plans/2026-07-14-tego-sheet-react-rewrite.md`](docs/superpowers/plans/2026-07-14-tego-sheet-react-rewrite.md)

## License

MIT
