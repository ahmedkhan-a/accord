# Accord - Digital Agreement Platform

A full-stack web app for freelancers and small businesses to create, share, sign and track agreements.

## Features
- User registration, login and logout (Django session auth)
- Create, edit, delete and search agreements (private to each user)
- Agreement status workflow: Draft, Sent, Viewed, Awaiting Signature, Partially Signed, Signed, Rejected, Expired
- Private share links using secure random tokens
- Counterparty page: review, accept, reject or sign without an account
- Typed-name electronic signatures (prototype, not legal advice)
- Audit history of every action
- PDF download generated on the backend (ReportLab)
- Dashboard with stats, search, status filter and sorting

## Tech Stack
- **Backend:** Python, Django, SQLite, ReportLab
- **Frontend:** React, Vite, JavaScript, CSS

## Run Locally

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install django reportlab
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Tests
```bash
cd backend
python manage.py test agreements
```

## Security
- Every private endpoint checks ownership (other users get 404)
- Share links use `secrets.token_urlsafe(32)`
- Input validation on all fields
- CORS limited to the local frontend

## Author
Mohammed Ahmed Khan