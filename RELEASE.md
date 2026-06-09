# IntelliDocs V4

Release label: **IntelliDocs V4** (`4.0.0`)

## Highlights

- Role permission enforcement (API + UI) with admin-configurable policies
- Registrar dashboard, students, and sections scoped to active enrollment school year
- Live admin reports and functional system settings (email, OTP, permissions)
- AI-assisted document verification, physical docs checklist, and registrar workflows
- Student portal: enrollment, application status, notifications, and secure document preview

## Deploy notes

1. Run database migrations in `database_setup.sql` and any `database_migration_*.sql` not yet applied.
2. Copy `env.example` to `env` and configure mail/DB credentials.
3. Build frontend: `cd frontend && npm install && npm run build`
4. Serve `public/` as the web root (XAMPP: `htdocs/IntelliDocs/public/`).
