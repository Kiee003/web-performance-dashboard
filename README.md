# Web Performance Dashboard
### Using Google Lighthouse with DeepSeek AI

![Tech Stack](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Tech Stack](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Tech Stack](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Tech Stack](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)
![Tech Stack](https://img.shields.io/badge/DeepSeek_AI-blue?style=flat)

A full-stack web application that makes website performance analysis
accessible to users of all technical backgrounds by combining automated
Google Lighthouse auditing with AI-powered plain-language analysis and
actionable recommendations.

---

## Features

- Automated Lighthouse audits for any URL
- AI-generated plain-language analysis powered by DeepSeek API
- Colour-coded performance metrics (LCP, FCP, TTFB, CLS, TBT)
- Audit history with performance trend charts
- Export results in JSON, CSV and PDF formats
- Side-by-side website comparison
- URL crawler for link analysis
- Role-based authentication (Normal / Moderator / Admin)
- Admin panel for user management

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Chart.js, CSS |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| AI | DeepSeek API (OpenAI-compatible SDK) |
| Auditing | Google Lighthouse, chrome-launcher |
| Auth | JWT, bcryptjs |

---

## Screenshots

![Dashboard](screenshots/C1.jpg)
![AI Analysis](screenshots/C4_2.jpg)
![Comparison](screenshots/F1-F2.jpg)

---

## Installation

### Prerequisites
- Node.js v18 or higher
- Google Chrome installed
- DeepSeek API key from https://www.deepseek.com

### Setup

1. Clone the repository
   git clone https://github.com/yourusername/web-performance-dashboard.git
   cd web-performance-dashboard

2. Install backend dependencies
   cd server
   npm install

3. Install frontend dependencies
   cd ../client
   npm install

4. Configure environment variables
   cd ../server
   cp .env.example .env
   # Edit .env and add your DeepSeek API key and JWT secret

5. Start the backend
   cd server
   node server.js

6. Start the frontend (new terminal)
   cd client
   npm start

7. Open http://localhost:3000

---

## Usage

1. Register an account (first account gets Admin role automatically)
2. Enter any website URL and click Run Audit
3. View the performance score, metrics and AI analysis
4. Check the Audit History for trend charts
5. Use Compare Performance to compare two websites
6. Export results as JSON, CSV or PDF

---

## Project Structure

web-performance-dashboard/
├── client/                 # React.js frontend
│   └── src/
│       └── components/     # Dashboard, Sidebar, AIInsights etc.
├── server/                 # Node.js backend
│   ├── routes/             # API route handlers
│   ├── lighthouseService.js
│   ├── deepseekService.js
│   ├── auditQueue.js
│   ├── authMiddleware.js
│   └── server.js
└── README.md

---

## Author

Muhammad Alif Marzuki Bin Rizuan
Final Year Project — Bachelor of Computer Science (Hons.) Computer Networks
Universiti Teknologi MARA Cawangan Melaka Kampus Jasin
Supervisor: Shahadan Bin Saad
