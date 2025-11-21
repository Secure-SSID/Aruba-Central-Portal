# Install Background Removal Package

The `@imgly/background-removal` package needs to be installed for the device image upload feature to work.

## Quick Install

Run this command in the `dashboard/frontend` directory:

```bash
npm install
```

This will install all dependencies including `@imgly/background-removal`.

## After Installation

1. Restart your Vite dev server (press Ctrl+C and run `npm run dev` again)
2. The background removal feature will work automatically when uploading device images

## Troubleshooting

If you still see errors after installing:
- Make sure you're in the `dashboard/frontend` directory
- Delete `node_modules` and `package-lock.json`, then run `npm install` again
- Check that the package appears in `node_modules/@imgly/background-removal`

