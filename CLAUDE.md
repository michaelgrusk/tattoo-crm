# Tatflow — Tattoo Studio Management

## Project overview
A CRM SaaS for tattoo artists and small studios. Helps manage new client intake, appointments, invoices, and analytics.

## Tech stack
- Next.js (App Router)
- Tailwind CSS
- shadcn/ui
- Supabase (database + auth)
- Vercel (deployment)

## Design
- Light cyan/blue color palette
- Clean, minimal UI
- Primary color: #7C3AED
- Background: #13131A
- Sidebar: white with #2E2E3D borders

## Pages
1. **Board** — intake queue (new requests, quote sent, deposit paid) + upcoming appointments list
2. **Contacts** — searchable client list with detail panel (notes, skin notes, tattoo history, total spent)
3. **Calendar** — weekly view showing appointments by day and time
4. **Invoices** — invoice table with paid/pending/deposit status + summary cards
5. **Analytics** — revenue chart, top clients, busiest hours, popular styles

## Database (Supabase)
- `clients` — id, created_at, name, email, phone, notes, skin_notes
- `tattoo_requests` — id, created_at, client_id, client_name, client_email, description, style, status, reference_image_url
- `appointments` — id, created_at, client_id, artist_name, date, time, type, status
- `invoices` — id, created_at, client_id, amount, status, type, date

## Key flows
- New client fills out intake form → lands in tattoo_requests
- Artist reviews on Board → quotes, books, converts to clients record
- Appointment completed → invoice created
- Analytics pulls from invoices + appointments tables

## Environment variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY