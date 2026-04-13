# Retail Book - Fabric & Tailoring Management System
## Narwana Agencies, Ambala City | GSTIN: 06ADMPG9353K1Z4

## Architecture
- **Backend**: FastAPI + MongoDB + ReportLab + OpenPyXL
- **Frontend**: React 19 + Tailwind CSS + Phosphor Icons + Recharts + html5-qrcode

## All Implemented Features (15 pages)
1. Dashboard | 2. New Bill (enter nav, scanner, PDF after save) | 3. Tailoring Orders (split fabric, assign) | 4. Add-ons | 5. Job Work (sort, karigar dialog, embroidery charges dialog) | 6. Settlements (by customer/order, pro-rata) | 7. Daybook (collapsible, sortable) | 8. Labour Payments | 9. Manage Orders (collapsed refs, edit/delete) | 10. Search (advanced filters) | 11. Reports (charts, customer ranking) | 12. Data Manager (Excel import/export, backup/restore) | 13. Settings (article types, rates, payment modes, firm info, GST)

## Key Business Logic
- GST 5% on fabric (inclusive, shown in PDF)
- Tailoring rates per article type (configurable in Settings)
- Fabric split into multiple garments with individual tracking
- Embroidery: Karigar assignment + labour charges + customer charges
- Pro-rata payment distribution across categories
- Daybook tally/untally reconciliation

## Testing: 42/42 backend tests passed (100%)

## Backlog
- Customer profiles with contact info
- Multi-user authentication
- WhatsApp bill sharing
- Dark mode
