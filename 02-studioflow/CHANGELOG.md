# Changelog

All meaningful changes to this project are documented here.

---

## [1.5.0] — 2026-04-18

### Fixed

**Header logo hidden on all mobile devices**

The subtitle "Through Hardik's Eye" was wrapped in a `hidden sm:inline-block` Tailwind class. On Tailwind's default breakpoint scale, `sm` kicks in at 640px — which means every phone (375–430px wide) saw only "THE" in the header, with the studio name completely invisible. Changed the layout to a vertical stack (`flex-col`) so both "THE" and "Through Hardik's Eye" are always visible, stacked cleanly on mobile.

Files changed: `src/components/layout/header.tsx`

---

## [1.4.0] — 2026-04-17

### Fixed

**Portfolio gallery always empty after uploading photos from mobile**

This was the most significant data bug in the entire project. Photos were uploading successfully to ImageKit and being saved to Postgres correctly — but the gallery pages were showing "This gallery is empty for now." on every single section.

Root cause: a case-sensitivity mismatch at three separate layers of the stack.

- Photos are stored in Postgres with their display name: `section = "Portrait"`
- Portfolio URLs use lowercase kebab slugs: `/portfolio/portrait`
- The Prisma `WHERE` clause was doing a case-sensitive match: `WHERE section = 'portrait'` → zero results
- The client-side filter in `data-provider.tsx` was doing strict `===` equality: `"Portrait" === "portrait"` → false
- The homepage cover image picker had the same strict equality check

Fixed all three:
1. Prisma query now uses `mode: 'insensitive'` for case-insensitive Postgres matches
2. `usePhotographs()` hook now normalises both the stored section name and the URL slug before comparing
3. Homepage cover picker uses the same slug-aware normalisation

**Cross-device sync: mobile uploads not appearing on desktop**

`DataProvider` was fetching data exactly once when the app first loaded. If you uploaded a photo on your phone, the desktop would never see it unless you manually refreshed the page. Added a 30-second polling interval via `setInterval` so all open sessions automatically pull fresh data — photos uploaded from mobile appear on desktop within 30 seconds.

Files changed:
- `src/lib/data-provider.tsx`
- `src/app/api/photographs/route.ts`
- `src/app/page.tsx`

---

## [1.3.0] — 2026-04-16

### Fixed

**Mobile browser switching to "desktop mode" when interacting with testimonials or menu**

This was caused by the Embla carousel's prev/next arrow buttons. They're styled with `-left-12` and `-right-12` positioning, which places them 48px outside the carousel container on each side. On desktop this looks great. On a 375px phone, those 96px of invisible content extend the page width beyond the viewport, and mobile browsers automatically zoom out to "desktop scale" to fit everything.

Fixed by hiding the arrow buttons on screens below `md` breakpoint (`hidden md:flex`). Mobile users can swipe the carousel natively. Also added `overflow-x: hidden` to the `<body>` tag as a global safety net to prevent any future element from triggering this zoom-out behaviour.

**ImageKit upload crashing the Vercel build**

The `ImageKit` class was being instantiated at module scope: `const imagekit = new ImageKit({ publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, ... })`. During the Next.js static build on Vercel, environment variables aren't available at import time, so `publicKey` was `undefined`, throwing "Missing publicKey during ImageKit initialization" and failing the entire build.

Fixed by moving `new ImageKit(...)` inside the request handler function, where environment variables are always available at runtime. Used `||""` fallbacks instead of `!` non-null assertions.

**Admin upload form: validation errors appearing in wrong location**

When a user tried to upload without filling in the title or section, the error appeared as a floating toast notification in the top-right corner of the screen. On desktop this is easy to miss. On mobile the toast overlapped the header.

Removed the toast for these validation cases entirely. Instead, the error now renders as a red-bordered inline box directly inside the "Upload New Photo" card, right above the upload button.

**"Mark as Featured" checkbox unreliable on mobile**

Native `<input type="checkbox">` elements can be difficult to tap on mobile — particularly when they're small and the touch target is not large enough. On some Android browsers the change event doesn't fire reliably.

Replaced with a fully custom toggle button: a div with a border that turns white and shows a checkmark icon when active. The entire row is the tap target, making it easy to toggle on any screen size.

**Admin tab bar cutting off "Reviews" on mobile**

The tab container used `overflow-hidden` which prevented scrolling, meaning the rightmost tab was physically cut off by the screen edge. Changed to `overflow-x-auto` with padding-right so all tabs are reachable by swiping.

**Section dropdown not refreshing after adding a new section**

Sections were only fetched once when the component first mounted. If you created a new section in the "Sections" tab and then switched back to "Gallery", the dropdown still showed the old list. Changed the `useEffect` dependency to re-fetch sections when `activeTab` changes to `"gallery"` or `"sections"`.

Files changed:
- `src/components/ui/carousel.tsx`
- `src/app/layout.tsx`
- `src/components/layout/mobile-menu.tsx`
- `src/app/api/imagekit/auth/route.ts`
- `src/app/api/photographs/[id]/route.ts`
- `src/app/admin/dashboard/page.tsx`

---

## [1.2.0] — 2026-04-15

### Fixed

**All API routes returning stale/cached data after content updates**

Next.js 14's App Router will by default statically cache GET responses from API routes when the build is created on Vercel. This meant that even though the database was accepting new photos, testimonials, and contact messages correctly, the frontend would always see the same frozen snapshot from the moment of the last deployment.

Fixed by adding `export const dynamic = 'force-dynamic'` to the top of every API route file. This tells the Next.js build system to treat the route as fully dynamic — always executing fresh on every request rather than serving the build-time cached version.

Files changed:
- `src/app/api/photographs/route.ts`
- `src/app/api/testimonials/route.ts`
- `src/app/api/contacts/route.ts`
- `src/app/api/settings/route.ts`
- `src/app/api/sections/route.ts`
- `src/app/api/imagekit/auth/route.ts`

---

## [1.1.0] — 2026-04-14

### Fixed

**Mobile menu stuck or triggering desktop behaviour**

The full-screen mobile overlay was rendered as a child inside the `<Header>` component. Because `<Header>` uses `transform: translateY()` for show/hide animations, and CSS transforms create a new containing block, `position: fixed` children inside a transformed ancestor no longer respect the viewport — they position relative to the transformed parent instead. This caused the menu to clip, shift, or refuse to cover the full screen.

Fixed by removing the overlay from `<Header>` entirely and rendering it as a direct sibling in `<ClientLayout>`. At this level there are no CSS transforms in the ancestor chain, so `position: fixed; inset: 0` works correctly.

Also replaced earlier React `createPortal()` approach (which had its own issues with CSS variable cascade failures in the portal context on mobile Chrome) with this simpler, more reliable direct DOM placement.

**Header invisible on mobile until scroll**

The header used a combination of scroll position and mouse position to decide when to show itself. On touch devices there are no mouse events, so the header would stay hidden until the user scrolled down — creating a confusing blank header on first load. Added a screen-width check that always forces the header visible on screens narrower than 768px.

Files changed:
- `src/components/layout/client-layout.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/mobile-menu.tsx`

---

## [1.0.0] — Initial release

- Full-stack photography portfolio with Next.js 14 App Router
- Admin dashboard with photo upload (local file + Google Drive), section management, contact inbox, testimonials, site settings
- ImageKit CDN integration for image delivery
- NextAuth credentials auth with middleware-level route protection
- Editorial portfolio grid with algorithmic mosaic layout engine
- PretextHeading with staggered word-by-word reveal animation
- Focal-pull hero animation system (blur + scale cinematic effect)
- Embla testimonials carousel
- Contact form with Postgres persistence
- Fully responsive — tested on real Android and iPhone devices
