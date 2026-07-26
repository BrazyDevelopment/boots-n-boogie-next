# Boots N Boogie — Next.js redesign

Production-ready redesign of [bootsnboogielinedancing.co.uk](https://www.bootsnboogielinedancing.co.uk) built with Next.js (static export), Tailwind CSS v4, and Framer Motion.

## Stack

- Next.js 16 (App Router, `output: "export"`)
- React 19 + TypeScript
- Tailwind CSS v4
- Framer Motion
- Lucide icons

## Develop

```bash
npm install
npm run dev
```

## Build static site

```bash
npm run build
```

Output is written to `out/` for static hosting (e.g. here.now).

## Notes

- Class booking and shop checkout deep-link to the live Wix booking/store flows.
- Contact form opens a `mailto:` draft (no backend).
