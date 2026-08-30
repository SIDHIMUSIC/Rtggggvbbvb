# Rentweb

Owner portal for a building: occupancy board, tenant files, and rent collection (cash or UPI QR).

**Live:** [rentweb-owner.vercel.app](https://rentweb-owner.vercel.app)

## Owner login

- Google, X, or email + password
- Each owner’s rooms, tenants, and ledger stay on their account

## Payments

- Set your UPI ID in **Building settings**
- Collect rent with a QR the tenant can scan
- Record the UTR when the money lands, or mark cash received
- Extra rupees roll forward to later months
- Print a receipt with building name, room, month, and txn id

This app is TanStack Start (Vite), not Next.js. Vercel deploys with the `tanstack-start` framework preset.
