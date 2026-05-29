# ReadySend

ReadySend is a web app for online sellers who sell through WhatsApp, Instagram, TikTok, Facebook, referrals, and direct messages.

It helps sellers collect buyer order requests, review orders, create confirmation receipts, and confirm buyer details before dispatch.

## Live App

- Website: https://readysend.online
- Backend API: https://api.readysend.online

## What ReadySend Does

- Lets sellers create an account and manage orders from a dashboard.
- Gives each seller a public buyer order link.
- Lets buyers submit order details without seeing the seller dashboard.
- Lets sellers review, edit, approve, or reject buyer requests.
- Creates receipt links sellers can copy into customer DMs.
- Lets buyers confirm receipts before dispatch.
- Tracks pending and confirmed orders.
- Supports subscription plans through Flutterwave.
- Sends contact form messages through Resend.

## Tech Stack

- React
- Vite
- Plain CSS
- Vercel hosting
- ReadySend backend API

## Local Setup

```bash
npm install
npm run dev
```

Create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:4000
```

For production on Vercel:

```env
VITE_API_BASE_URL=https://api.readysend.online
```

## Build

```bash
npm run build
```

## Deployment

This frontend is deployed on Vercel.

Recommended Vercel settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Domain: `readysend.online`

## Related Repository

Backend API:

https://github.com/Maclean-Holdbrook/ReadySend-Backend
