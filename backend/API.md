# API Documentation

## Prediction
- `POST /api/predict-risk`: Compute landslide risk prediction

## Zones
- `GET /api/zones`: List monitoring zones
- `GET /api/zones/{zone_id}`: Get zone details
- `GET /api/emergency-contacts`: Get emergency contacts

## Alerts
- `GET /api/alerts`: List active alerts
- `POST /api/alerts`: Create a new alert
- `PATCH /api/alerts/{alert_id}/acknowledge`: Acknowledge an alert

## Field Reports
- `POST /api/field-reports`: Create a field report with optional media
- `GET /api/field-reports`: List field reports
- `GET /api/field-reports/{report_id}`: Get report details

## Sync
- `POST /api/sync-reports`: Idempotent batch upload for offline reports

## Chat
- `POST /api/chat`: AI emergency assistant
