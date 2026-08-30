# Rentweb

Owner portal for a building: occupancy board, tenant hisab, monthly bills, and rent collection.

**Repo:** [SIDHIMUSIC/Rtggggvbbvb](https://github.com/SIDHIMUSIC/Rtggggvbbvb)

**Live:** [rtggggvbbvb.vercel.app](https://rtggggvbbvb.vercel.app)

## Owner login

- Create an owner account with email + password, or continue with Google / X
- Each owner’s rooms, tenants, and ledger stay on their account

## Building

- Add a whole floor of rooms in one step
- Add, edit, or delete a single room
- Occupancy board grouped floor by floor

## Tenants

- Add, edit, or remove a tenant
- Name, phone, deposit, start date
- Months generate themselves from the day they moved in

## Payments

- **UPI** — QR on your UPI ID, record the UTR
- **Cash** — mark received, optional receipt number
- **Card** — record a POS swipe (last 4 digits only)
- **Dummy** — test the ledger without moving money
- Extra rupees roll forward to later months
- Print a bill and a receipt with building letterhead

This app is TanStack Start (Vite), not Next.js. Vercel deploys with the `tanstack-start` framework preset.
