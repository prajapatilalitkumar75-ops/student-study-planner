# StudySpace — Student Task & Study Planner

A beginner-friendly full-stack website using HTML, CSS, JavaScript, Python Flask, and MySQL.

## Features

- Dashboard totals for all, pending, and completed tasks
- Add a task with subject, priority, and due date
- Edit tasks
- Mark tasks complete/incomplete
- Delete tasks with confirmation
- Filter all, pending, and completed tasks
- Responsive layout for desktop and mobile
- Weekly study timetable: add and delete sessions by day and time
- MySQL persistence for tasks and study sessions through a Flask JSON API

## 1. Install prerequisites

Install:
- Python 3.10 or newer
- MySQL Server (MySQL Workbench is optional)
- A code editor such as Visual Studio Code

During MySQL installation, remember your MySQL username and password. Make sure the MySQL server is running.

## 2. Create the database

Open MySQL Workbench or a MySQL command line and run all statements in `schema.sql`.

Command-line alternative, from this project folder:

```bash
mysql -u root -p < schema.sql
```

Enter your MySQL password when prompted. This creates the `study_planner` database and `tasks` table.

## 3. Create and activate a Python virtual environment

Open a terminal in the `student_study_planner` folder.

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use Command Prompt instead:

```bat
py -m venv .venv
.venv\Scripts\activate.bat
```

### macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 4. Install Python dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 5. Configure MySQL credentials

Copy `.env.example` to a new file named `.env` in the project root.

Example `.env`:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=put_your_actual_mysql_password_here
DB_NAME=study_planner
```

Replace the example password with your own MySQL password. If your MySQL root account has no password, leave `DB_PASSWORD=` empty. Do not share or upload your `.env` file.

## 6. Start the website

Make sure your virtual environment is active and MySQL is running, then run:

```bash
python app.py
```

Open this URL in your browser:

http://127.0.0.1:5000

Do not open `static/index.html` directly as a file. Visit it through Flask so the API requests work correctly.

To stop the development server, press `Ctrl+C` in the terminal.

## 7. Test the backend

Open this in your browser:

http://127.0.0.1:5000/api/health

A successful response looks like:

```json
{
  "ok": true,
  "message": "Flask and MySQL are connected."
}
```

If it returns an error, confirm MySQL is running and that the `.env` credentials match your MySQL setup.

## 8. API routes

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/health` | Check database connection |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/1` | Update task with ID 1 |
| DELETE | `/api/tasks/1` | Delete task with ID 1 |
| GET | `/api/study-sessions` | List weekly study sessions |
| POST | `/api/study-sessions` | Create a study session |
| DELETE | `/api/study-sessions/1` | Delete study session with ID 1 |

Example create request body:

```json
{
  "title": "Revise probability",
  "subject": "Mathematics",
  "priority": "High",
  "due_date": "2026-10-20",
  "completed": false
}
```

You can also test the API with a tool such as Postman, or use the website form.

## 9. Project folder structure

```text
student_study_planner/
├── app.py
├── schema.sql
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
└── static/
    ├── index.html
    ├── style.css
    └── app.js
```

## 10. Troubleshooting

### `Access denied for user`
Check `DB_USER` and `DB_PASSWORD` in `.env`.

### `Unknown database 'study_planner'`
Run `schema.sql` against your MySQL server.

### `Can't connect to MySQL server`
Start the MySQL service and check `DB_HOST` and `DB_PORT`.

### `ModuleNotFoundError`
Activate the virtual environment and run `pip install -r requirements.txt`.

### Port 5000 is already in use
Close the other program using port 5000, or change the port in the final `app.run(...)` line of `app.py` and use that port in your browser.

### Google Fonts do not load
The page still works using fallback fonts; an internet connection is only needed for the optional web font.

## Important notes

- This is a learning project for local development, not a production-ready public service.
- The example runs Flask in debug mode. Never expose this debug server to the public internet.
- There is no user login or account separation in this starter version. Anyone who can access it can see and change its tasks. Add authentication and authorization before using it for multiple users.
- Keep `.env` private. Use a dedicated, least-privilege MySQL account for a real deployment.
