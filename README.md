# Rentweb

Owner portal for a building: occupancy board, tenant hisab, monthly bills, and rent collection.

**Live:** [rentweb-owner.vercel.app](https://rentweb-owner.vercel.app)

## Owner login

- Google, X, or email + password
- Each owner’s rooms, tenants, and ledger stay on their account

## Hisab

- Monthly bills generated from each tenant’s start date
- Extra charges (electricity, water, repairs) on any month
- Running collections list per tenant

## Payments

- **UPI** — QR on your UPI ID, record the UTR
- **Cash** — mark received, optional receipt number
- **Card** — record a POS swipe (last 4 digits only)
- **Dummy** — test the ledger without moving money
- Extra rupees roll forward to later months
- Print a bill and a receipt with building letterhead

This app is TanStack Start (Vite), not Next.js. Vercel deploys with the `tanstack-start` framework preset.
