# ExamFlow — Online Exam Portal

A full-stack web application for creating and taking online exams. Admins (tutors) can build exams with multiple-choice questions and review student results. Students can take timed exams and see a detailed per-question breakdown of their performance.

![ExamFlow](https://img.shields.io/badge/ExamFlow-Online%20Exam%20Portal-1a56db?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?style=flat-square&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

---

## Features

**For Students**
- Register and log in with email or username
- Browse available exams with duration and question count
- Take timed exams with a question navigation panel
- Review all answers before final submission
- See score, percentage, and pass/fail result instantly
- View a full per-question breakdown — what you answered vs. what was correct
- Edit profile with personal and academic details

**For Admins / Tutors**
- Create, edit, and delete exams
- Add, edit, and delete multiple-choice questions
- View all student results per exam with scores and pass/fail status
- Edit profile with professional details (designation, department, subjects handled)

**Platform**
- Clean, professional light UI built for exam environments
- Fully server-side score calculation — answers are never exposed to the client
- JWT-based authentication with role separation (student / admin)
- Auto-creates all database tables on first run

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19, React Router 7, Vite 8    |
| Backend   | Node.js, Express 5                  |
| Database  | PostgreSQL (via pg)                 |
| Auth      | JWT (jsonwebtoken), bcryptjs        |
| Styling   | Plain CSS with custom design system |

---

## Project Structure

```
Online Exam Portal/
├── backend/
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT auth + admin role guard
│   ├── routes/
│   │   ├── student.js          # Auth, profile, exams, results
│   │   └── tutor.js            # Admin-only exam/question management
│   ├── db.js                   # PostgreSQL pool + auto table creation
│   ├── index.js                # Express app entry point
│   └── .env                    # Environment variables (see setup)
│
└── frontend/
    └── src/
        ├── components/
        │   ├── Navbar.jsx
        │   └── Logo.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── StudentDashboard.jsx
        │   ├── AdminDashboard.jsx
        │   ├── ExamInterface.jsx
        │   └── Profile.jsx
        ├── App.jsx
        └── index.css
```

---

## Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/download/) 14 or higher
- npm (comes with Node.js)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/examflow.git
cd examflow
```

### 2. Configure the backend environment

Create a `.env` file inside the `backend/` folder:

```bash
cd backend
```

Create a file named `.env` with the following content:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=online_exam_portal
JWT_SECRET=your_secret_key_here
# Optional: DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

> **Note:** Replace `your_postgres_password` with your actual PostgreSQL password.  
> You can also provide a `DATABASE_URL` connection string instead of individual `DB_*` variables.  
> `JWT_SECRET` can be any long random string — keep it secret.

### 3. Install backend dependencies

```bash
# inside the backend/ folder
npm install
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5. Start the backend server

```bash
# inside the backend/ folder
node index.js
```

Or with auto-reload on file changes:

```bash
npx nodemon index.js
```

The server starts on **http://localhost:5000**.  
On first run it automatically creates the `online_exam_portal` database and all required tables — no manual SQL needed.

### 6. Start the frontend dev server

Open a new terminal:

```bash
# inside the frontend/ folder
npm run dev
```

The app opens at **http://localhost:5173**.

---

## Creating the First Admin Account

Public registration only creates student accounts. To create an admin account, insert one directly into the database:

```sql
-- First register normally through the UI, then promote the user:
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Or insert directly:

```sql
-- Password below is bcrypt hash of "admin123" — change it after first login
INSERT INTO users (name, username, email, password, role)
VALUES (
  'Admin User',
  'admin',
  'admin@examflow.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHG',
  'admin'
);
```

Then log in with `admin@examflow.com` / `admin123` and change your password from the Profile page.

---

## API Reference

### Authentication (no token required)

| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | `/api/student/register`     | Register a new student   |
| POST   | `/api/student/login`        | Login, returns JWT token |

### Student Routes (JWT required)

| Method | Endpoint                              | Description                        |
|--------|---------------------------------------|------------------------------------|
| PUT    | `/api/student/profile`                | Update profile / change password   |
| GET    | `/api/student/exams`                  | List all exams with question count |
| GET    | `/api/student/exams/:id`              | Get a single exam                  |
| GET    | `/api/student/questions/exam/:examId` | Get questions for an exam          |
| POST   | `/api/student/results`                | Submit exam answers (server-scored)|
| GET    | `/api/student/results/student`        | Get current user's results         |
| GET    | `/api/student/results/:id/detail`     | Get per-question result breakdown  |

### Admin Routes (JWT + admin role required)

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | `/api/tutor/exams`                | Create an exam                 |
| PUT    | `/api/tutor/exams/:id`            | Edit an exam                   |
| DELETE | `/api/tutor/exams/:id`            | Delete an exam                 |
| POST   | `/api/tutor/questions`            | Add a question to an exam      |
| PUT    | `/api/tutor/questions/:id`        | Edit a question                |
| DELETE | `/api/tutor/questions/:id`        | Delete a question              |
| GET    | `/api/tutor/results/exam/:examId` | Get all student results for an exam |

---

## Database Schema

The database is created automatically. Here's an overview of the tables:

```
users           — id, name, username, email, password, role, profile_picture,
                  mobile_number, dob, gender, register_number, department,
                  year_of_study, section, college_name, last_login_at, created_at

exams           — id, title, description, duration_minutes, created_by, created_at

questions       — id, exam_id, question_text, option_a, option_b, option_c,
                  option_d, correct_option

results         — id, user_id, exam_id, score, total_questions, submitted_at

answers         — id, result_id, question_id, selected_option, is_correct
```

---

## Environment Variables

| Variable      | Description                              | Example                    |
|---------------|------------------------------------------|----------------------------|
| `PORT`        | Port the backend server listens on       | `5000`                     |
| `DB_HOST`      | PostgreSQL host                          | `localhost`                                             |
| `DB_PORT`      | PostgreSQL port                          | `5432`                                                  |
| `DB_USER`      | PostgreSQL username                      | `postgres`                                              |
| `DB_PASSWORD`  | PostgreSQL password                      | `yourpassword`                                          |
| `DB_NAME`      | Database name (auto-created if missing)  | `online_exam_portal`                                    |
| `DATABASE_URL` | (Optional) Full connection string        | `postgresql://user:pass@host:5432/db?sslmode=require`   |
| `JWT_SECRET`   | Secret key for signing JWT tokens        | `a_long_random_string`                                  |

---

## Available Scripts

### Backend

```bash
node index.js          # Start the server
npx nodemon index.js   # Start with auto-reload (development)
```

### Frontend

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Build for production (output in dist/)
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
```

---

## Security Notes

- Passwords are hashed with **bcryptjs** (salt rounds: 10) — never stored in plain text
- Exam scores are calculated **server-side** — correct answers are never sent to the browser
- JWT tokens expire after **1 day**
- Admin role cannot be self-assigned through registration — requires direct DB update
- CORS is currently open (`*`) — restrict `origin` in `backend/index.js` before deploying to production

---

## License

MIT — free to use, modify, and distribute.
