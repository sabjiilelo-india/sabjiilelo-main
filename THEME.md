# Sabjii Le Lo – Theme & UI Assets

_As of 2026-11-01_

## Overview

The site uses six brand color tokens on a cream background, Poppins for text and Caveat for handwritten accents. Tokens live in `app/globals.css` and are exposed to Tailwind through `@theme inline`, so they work as classes like `bg-primary` and `text-accent`. The browser theme color is `#0e5a32`, set in `app/layout.tsx`.

## Brand color tokens

These six tokens are the official palette; use them before adding any new hex value.

| Token (Tailwind class) | Hex       | Used for                                       |
| ---------------------- | --------- | ---------------------------------------------- |
| `primary`              | `#0e5a32` | Main brand green, buttons, browser theme color |
| `dark-green`           | `#064420` | Splash background, Mission/Vision gradient     |
| `light-green`          | `#d9f2e0` | Pills, the App button in the header            |
| `beige`                | `#f5ebd7` | Warm surfaces                                  |
| `cream`                | `#fbf6ea` | Page background                                |
| `accent`               | `#ff8a3d` | Orange highlights                              |

## Hardcoded colors

These values are written directly into components as `bg-[#...]` or SVG fills and are not tokens yet. The first two are used often enough to deserve tokens.

| Hex                                        | Used for                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `#4caf3d`                                  | Leaf green: heading accent words, nav underline, bullet dots, gradient end |
| `#0b1a10`                                  | Heading text                                                               |
| `#1c2a20`                                  | Body text                                                                  |
| `#eef6e6`                                  | Middle of section gradients (How It Works, /app page)                      |
| `#032a14`                                  | Deepest green in the Mission/Vision gradient                               |
| `#17803f`                                  | Center of the splash radial gradient                                       |
| `#7ed957`                                  | Splash progress bar, shimmer text                                          |
| `#9be36f`                                  | Coming-soon progress bar                                                   |
| `#25d366`                                  | WhatsApp button                                                            |
| `#d9822b`, `#f2a53a`, `#e8b48a`, `#e9f7e1` | Fills inside the inline SVG icons (farmer, leaf)                           |
| `#00d3ff`, `#00f076`, `#ff3a44`, `#ffd400` | Google Play logo                                                           |

## Typography

Both fonts load through `next/font/google` in `app/layout.tsx`.

| Font    | Weights            | Tailwind class | Role                      |
| ------- | ------------------ | -------------- | ------------------------- |
| Poppins | 400, 500, 600, 700 | `font-sans`    | All body and heading text |
| Caveat  | 600, 700           | `font-script`  | Handwritten accent text   |

## Images and icons in use

The site uses 5 images, 9 optimized 3D icons and 12 inline SVG icons. All raster assets are `.webp`.

### Images (`public/images/`)

| File                    | Where it appears               |
| ----------------------- | ------------------------------ |
| `logo-full.webp`        | Header, Footer, Splash         |
| `hero-banner.webp`      | Hero section, coming-soon page |
| `farmer-banner-v2.webp` | CTA section                    |
| `mint-panel-clear.webp` | About section                  |
| `app-preview.webp`      | /app page                      |

### 3D icons (`public/icons/`)

Rendered with the `AppIcon` component (`app/components/AppIcon.tsx`) by name.

| Icon name    | Times used |
| ------------ | ---------- |
| `leaf`       | 10         |
| `farmer`     | 3          |
| `house`      | 2          |
| `truck`      | 2          |
| `heart`      | 1          |
| `heart-leaf` | 1          |
| `phone`      | 1          |
| `basket`     | 1          |

`brand-truck.webp` is used separately as the animated truck on the splash screen and the road strip. The original PNG versions of the icons sit beside the `.webp` files in the same folder.

### Inline SVG icons

Defined in `app/components/Icons.tsx`: Leaf, Farmer, House, Truck, Heart, Target, Eye, Phone, Arrow, PlayLogo, AppleLogo, Social.

The favicon is `app/icon.png`.

## Animations

All animation classes live in `app/globals.css`, and each one turns off when the device asks for reduced motion.

| Group                  | Classes                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Scroll and entrance    | `reveal` (fade-up, slide or zoom), `hero-in`, `pop`, `kenburns`                                   |
| Ambient motion         | `leaf-float`, `badge-bounce`, `nudge`, `wiggle`, `blob`, `rise`                                   |
| Buttons and highlights | `shine`, `shimmer`, `wa-pulse`                                                                    |
| Truck and How It Works | `truck-drive`, `truck-bounce`, `road-dash`, `travel`, `flow-chev`                                 |
| Splash screen          | `splash`, `splash-logo`, `splash-ring`, `splash-word`, `splash-tag`, `splash-bar`, `splash-truck` |

## Unused files and next steps

Fourteen files in the repo are not referenced by any code.

| Location         | Files                                                                                                                                         | Likely status                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Repo root        | `appicon.png`, Fresh Farm Produce Banner.png, Minimal Mint Panel with Leaf Icon.png, Smiling Farmer with Fresh Harvest (1).png, two WhatsApp JPEGs | Source files for the optimized `.webp` versions |
| `public/images/` | `logo.png`, `logo-full-dark.webp`, `farmer-banner.webp`                                                                                       | Older or alternate versions                    |
| `public/`        | `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`                                                                               | Default Next.js starter files                  |

- [ ] Add `#4caf3d` (leaf) and `#0b1a10` (ink) as tokens in `globals.css`
- [ ] Move the root-level source images into a `design/` folder or delete them
- [ ] Delete the default Next.js SVGs from `public/`
