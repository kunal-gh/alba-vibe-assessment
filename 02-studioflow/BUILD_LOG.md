# Build Log: StudioFlow

## Goal and scope decision

- Adapted an existing visual portfolio foundation into a focused creative-asset dashboard rather than building a generic expense tracker.
- Made `/studio` the default deployment destination so the reviewer reaches the assessment feature immediately.
- Kept the data model intentionally small: projects and assets are enough to demonstrate relationships, secure CRUD, analytics, and realtime behavior in the time-box.

## Stack and tooling

- Next.js 15, React, TypeScript, Tailwind CSS, and the inherited component system for the interface.
- Supabase Auth, Postgres, RLS, and Realtime for the actual backend.
- `@supabase/ssr` browser client for the authenticated data boundary.
- Recharts for the project-distribution and upload-cadence visualizations.

## Key decisions and trade-offs

- Used Supabase because the brief explicitly rewards auth and RLS and its relational Postgres model maps directly to projects -> assets.
- Created a fresh `/studio` route instead of trying to retrofit every legacy photography route. This keeps the assessment surface coherent while preserving the imported design foundation transparently.
- Used URL assets instead of file upload to leave time for the stronger advanced combination: auth, RLS, and realtime. Storage is documented as a next step.
- Chose server-side SQL policies over filtering client-side. The client may ask only for its records, but Postgres enforces the boundary even if a request is altered.

## Hard parts and resolution

- Legacy routes required Prisma generation during build even though StudioFlow uses Supabase. Restored `prisma generate` in the build script without invoking the old local database seed.
- Static build encountered missing Supabase variables. The Supabase helper uses a safe placeholder for compilation while the UI gives an explicit configuration state at runtime.
- The original root was a portfolio page. Redirected it to `/studio` so a deployed reviewer does not need hidden navigation instructions.
- Added the Supabase project URL to the linked Vercel project in all three environments. Kept the publishable key and service-role key out of the repository and documented the remaining dashboard setup.

## How I verified it works

- Ran `npm run build` successfully after the StudioFlow route, Supabase client, and dependencies were added.
- Inspected the schema for ownership policies on every CRUD operation and subscription publication for both tables.
- Prepared a reproducible seed script and manual two-user RLS/realtime verification script in the README.

## Known limitations

- End-to-end Supabase verification requires the publishable key, schema migration, and demo seed to be configured in the deployer's Supabase project.
- Assets are URL records, not uploaded files.
- The legacy portfolio code remains in the repository but is not part of `/studio`.

## Time spent

- Existing-project audit and scope selection: 35 minutes.
- StudioFlow dashboard, Supabase schema, RLS, realtime, and charts: 135 minutes.
- Build repair, seed setup, and documentation: 65 minutes.
