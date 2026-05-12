# TaskFlow — Team Task Manager

A full-stack web application for team task management with role-based access control, project management, and Kanban-style task tracking.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Features

- **Authentication** — Secure signup/login with JWT tokens
- **Role-Based Access Control** — Admin and Member roles with granular permissions
- **Project Management** — Create, update, delete projects; manage team members
- **Kanban Task Board** — Drag-and-drop task management across To Do / In Progress / Done
- **Dashboard** — Real-time stats, overdue alerts, project progress tracking
- **Task Assignment** — Assign tasks to team members with priority and due dates
- **Responsive Design** — Works on desktop, tablet, and mobile

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | MongoDB (Atlas) |
| Auth | JWT, bcrypt |
| Frontend | Vanilla HTML/CSS/JS |
| Deployment | Railway |

## 📁 Project Structure

```
├── server.js              # Express entry point
├── config/db.js           # MongoDB connection
├── middleware/
│   ├── auth.js            # JWT authentication
│   └── role.js            # Role-based access
├── models/
│   ├── User.js            # User schema
│   ├── Project.js         # Project schema
│   └── Task.js            # Task schema
├── routes/
│   ├── auth.js            # Auth endpoints
│   ├── projects.js        # Project CRUD + members
│   ├── tasks.js           # Task CRUD + status
│   └── dashboard.js       # Dashboard stats
└── public/                # Frontend
    ├── index.html         # Auth page
    ├── dashboard.html     # Dashboard
    ├── projects.html      # Projects
    ├── tasks.html         # Kanban board
    ├── css/style.css      # Design system
    └── js/                # Frontend logic
```

## 🔧 Setup & Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Team-task-manager.git
   cd Team-task-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment** — Create `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/team-task-manager
   JWT_SECRET=your-secret-key
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` in your browser

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Profile |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create (Admin) |
| PUT | `/api/projects/:id` | Update (Owner) |
| DELETE | `/api/projects/:id` | Delete (Owner) |
| POST | `/api/projects/:id/members` | Add member |
| DELETE | `/api/projects/:id/members/:uid` | Remove member |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List (with filters) |
| POST | `/api/tasks` | Create |
| PUT | `/api/tasks/:id` | Update |
| PATCH | `/api/tasks/:id/status` | Update status |
| DELETE | `/api/tasks/:id` | Delete |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Aggregated stats |

## 🔐 Role Permissions

| Action | Admin | Member |
|--------|-------|--------|
| Create projects | ✅ | ❌ |
| Manage members | ✅ (owner) | ❌ |
| Create tasks | ✅ | ✅ |
| Update own tasks | ✅ | ✅ |
| Update any task | ✅ | ❌ |
| Drag-drop status | ✅ | ✅ (assigned) |

## 🌐 Deployment (Railway)

1. Push to GitHub
2. Connect repo on [Railway](https://railway.app)
3. Set environment variables: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`
4. Deploy — Railway auto-detects Node.js

## 📄 License

MIT
