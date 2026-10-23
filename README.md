# BLOOM — Pixel-Themed Productivity Application

**JavaScript Lab Assignment**

## Student Information

| Field | Details |
|---|---|
| Student Name | Prakrati Saxena |
| Roll Number | 0808CL241142 |
| Course / Branch | CSE AIML|
| Subject | JavaScript Lab |
| Submitted To | Mr. Deepak Shukla |
| Academic Year | 2024-28 |

---

## 1. Abstract

Bloom is a pixel-art-inspired productivity web application developed as a JavaScript Lab minor project. It combines time management, task organization, gamification, and interactive garden customization to encourage consistent and focused work habits.

The application connects Pomodoro-style focus sessions with plant growth, experience points, seeds, quests, achievements, and garden progression. It also includes task management, progress analytics, focus worlds, user accounts, social interactions, and weekly competition.

The frontend uses HTML, CSS, and JavaScript, while the backend is developed using Python and FastAPI. Database integration supports user information, tasks, focus sessions, and progress data. The application is designed to demonstrate practical web development concepts through an interactive and visually engaging productivity tool.

## 2. Introduction

Time management and maintaining concentration are important for academic and professional productivity. Traditional timers and task lists can help users organize their work, but they often lack interactive feedback and long-term motivation.

Bloom addresses this by combining a focus timer with a virtual garden. As users complete focus sessions, they can make progress toward plant growth and other in-app rewards. Tasks, quests, achievements, analytics, and social features extend this experience beyond a basic timer.

The application follows a cozy pastel visual theme with pixel-art-inspired elements, creating a consistent interface across its productivity and gamification features.

## 3. Objectives

The primary objectives of Bloom are:

- To apply JavaScript concepts in a practical web application.
- To develop an interactive interface using HTML, CSS, and JavaScript.
- To implement a Pomodoro-style focus timer.
- To create, organize, and complete tasks dynamically.
- To demonstrate client-server communication using REST APIs.
- To implement user registration, authentication, and individual user data.
- To explore database integration and persistent data storage.
- To implement gamification through XP, seeds, levels, quests, and achievements.
- To visualize productivity progress through statistics and a heatmap.
- To understand version control and deployment workflows.
- To explore social functionality through friends, garden visits, and leaderboards.

## 4. Technologies Used

| Technology | Application |
|---|---|
| HTML5 | Web page structure |
| CSS3 | Styling, responsive layouts, and animations |
| JavaScript | Timer logic, DOM manipulation, interactions, and frontend functionality |
| Python | Backend programming |
| FastAPI | REST API development |
| SQLAlchemy | Database models and database operations |
| SQLite | Local development database |
| PostgreSQL | Production database option |
| Git | Version control |
| GitHub | Source code hosting and collaboration |
| Render | Application deployment |

## 5. Complete Feature List

### 5.1 Focus Timer and Productivity

- Pomodoro-style focus timer.
- Focus, short-break, and long-break modes.
- Timer controls and session tracking.
- Sound controls and completion chimes.
- Plant-growth feedback associated with focus activity.
- Local demo mode for using the timer without signing in.
- Server-recorded focus sessions for signed-in users.

### 5.2 Plant Growth and Collection

- Plant growth associated with focused work.
- Multiple plant types and a plant collection.
- Garden shelf and plant progression.
- Plant-related rewards and collection management.
- Visual feedback representing productivity progress.

### 5.3 Task Management

- Create and manage personal tasks.
- Track task completion status.
- Associate tasks with a user's account.
- Integrate task management into the productivity workflow.
- Award rewards for eligible task completion according to the application logic.

### 5.4 Gamification and Rewards

- Experience points (XP).
- Seeds as an in-app reward currency.
- User progression and levels.
- Quests and quest completion tracking.
- Achievements and milestones.
- Rewards associated with focus sessions and eligible activities.
- Server-side reward calculation for signed-in users.

### 5.5 Garden Customization

- Plant collection and garden item shop.
- Garden item purchases using in-app currency.
- Garden decoration placement.
- Basic 8 × 6 garden placement grid.
- Saved decoration placement.
- Garden progression linked to productivity activity.

### 5.6 Focus Worlds

- Focus-world selection.
- World unlocking and progression.
- Saved world selection and preferences.
- Theme variations using matching pastel palettes.
- World descriptions associated with different focus environments.

*Note: Fully unique animated backgrounds and dedicated audio packs are potential future enhancements.*

### 5.7 Statistics and Analytics

- Daily productivity statistics.
- Focus-session history.
- Focus-time tracking.
- Progress heatmap.
- Achievement tracking.
- Weekly leaderboard.
- Visual indicators of user progression.

### 5.8 User Accounts and Authentication

- User registration.
- Sign-in and authenticated API access.
- Password hashing using PBKDF2.
- Signed bearer tokens.
- Individual user data for tasks, sessions, and progression.
- Configurable token lifetime.
- User profile and privacy settings.

### 5.9 Social Features

- Friend requests.
- Accepting friend requests.
- Removing connections.
- Blocking users.
- Visiting friends' gardens.
- Friend-related privacy controls.
- Weekly competition through the leaderboard.

*Note: Real-time shared focus rooms, live chat, and group challenges are planned extensions rather than completed features.*

### 5.10 Responsive Interface

- Pastel visual design.
- Pixel-art-inspired plant visuals.
- Responsive navigation.
- Sidebar navigation on desktop.
- Bottom navigation on mobile layouts.
- Dedicated feature screens.
- Matching styles for newly added features while preserving the original home dashboard.

### 5.11 Backend and Database

- FastAPI backend.
- REST API endpoints.
- SQLAlchemy database integration.
- SQLite fallback for local development.
- PostgreSQL support for deployment.
- Persistent storage for account and application data when correctly configured.
- Server-side handling of focus rewards.
- Environment-based configuration.

## 6. JavaScript Concepts Demonstrated

The project provides practical experience with the following JavaScript concepts:

1. Variables, constants, and data types.
2. Functions and reusable code.
3. Conditional statements and loops.
4. Arrays and objects.
5. DOM selection and manipulation.
6. Event listeners and event handling.
7. Dynamic rendering of HTML elements.
8. Timers and asynchronous operations.
9. Browser storage using `localStorage`.
10. JSON data handling.
11. Fetch API and REST API communication.
12. Form handling and validation.
13. Modular JavaScript file organization.
14. Client-side state and interface updates.
15. Responsive interface interactions.

## 7. System Architecture

Bloom follows a client-server architecture.

### Frontend

The frontend presents the interface and handles user interactions, timer controls, task views, navigation, and visual updates.

### Backend

The FastAPI backend exposes REST endpoints for account authentication, tasks, focus sessions, rewards, quests, garden features, and social interactions.

### Database

SQLAlchemy provides the database integration layer. SQLite is used for local development when no database URL is configured. PostgreSQL can be configured for hosted deployment.

### Data Flow

1. A user interacts with the frontend.
2. JavaScript processes the interaction.
3. Authenticated requests are sent to the backend API when required.
4. The backend validates the request and applies application logic.
5. Data is stored or retrieved from the configured database.
6. The frontend updates the interface using the response.

## 8. Project Directory Structure

```text
Bloom-Pixel-JS/
├── app/
│   ├── __init__.py
│   └── main.py
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── app-shell.css
│   └── js/
│       ├── script.js
│       └── app-shell.js
├── requirements.txt
├── render.yaml
├── .gitignore
└── README.md
```

### File Descriptions

| File | Purpose |
|---|---|
| `app/main.py` | FastAPI application, backend endpoints, and database operations |
| `app/__init__.py` | Python package initialization |
| `public/index.html` | Main application HTML |
| `public/css/style.css` | Original Bloom styling |
| `public/css/app-shell.css` | Styling for navigation and additional feature screens |
| `public/js/script.js` | Timer behavior, original interactions, and local browser functionality |
| `public/js/app-shell.js` | Feature navigation and API integration |
| `requirements.txt` | Python package dependencies |
| `render.yaml` | Render deployment configuration |
| `.gitignore` | Files excluded from version control |
| `README.md` | Project documentation |

## 9. Installation and Execution

### Prerequisites

- Python 3.11 or later, as recommended by the project.
- pip package manager.
- Git.
- A modern web browser.

### Step 1: Clone the repository

```bash
git clone https://github.com/prakratis/Bloom-Pixel-JS.git
cd Bloom-Pixel-JS
```

### Step 2: Create a virtual environment

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

### Step 3: Install dependencies

```bash
python -m pip install -r requirements.txt
```

### Step 4: Start the application

```bash
uvicorn app.main:app --reload
```

### Step 5: Open the application

Open the following URL in a browser:

http://127.0.0.1:8000

The FastAPI interactive API documentation is available at:

http://127.0.0.1:8000/docs

## 10. Configuration

The application supports environment-based configuration.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Configures the database connection |
| `BLOOM_SECRET_KEY` | Secret used for signing authentication tokens |
| `BLOOM_TOKEN_TTL_DAYS` | Configures bearer-token lifetime; the documented default is 14 days |

For local development, the application uses a SQLite database when `DATABASE_URL` is not set. Production deployment should use a managed PostgreSQL database and a securely generated secret key.

## 11. Deployment

The project includes a `render.yaml` Blueprint configuration intended to support deployment through Render.

General deployment procedure:

1. Push the project to GitHub.
2. Open the Render Dashboard.
3. Create a new Blueprint using the repository.
4. Review the resources described in `render.yaml`.
5. Configure a persistent PostgreSQL database.
6. Confirm that `DATABASE_URL` points to the production database.
7. Generate and configure `BLOOM_SECRET_KEY`.
8. Deploy the application.
9. Test the deployed frontend, API, registration, login, task creation, and focus-session workflows.

The actual service and database configuration should be checked against Render's current deployment options before production use.

## 12. Testing and Verification

The following checks are recommended during project evaluation:

- Verify that the home page loads correctly.
- Check timer controls and break modes.
- Test task creation and completion.
- Test account registration and sign-in.
- Verify authenticated API requests.
- Test focus-session recording and reward eligibility.
- Check XP, seeds, quests, and achievements.
- Test garden item purchases and placement.
- Verify progress and leaderboard views.
- Test friend requests and privacy-related operations.
- Confirm that user progress persists after restarting the hosted application.

These are recommended verification steps; results should be recorded after the corresponding tests have actually been performed.

## 13. Limitations and Future Scope

The current application is a productivity-focused portfolio and academic project. The following improvements can be considered:

- Email verification and password recovery.
- API rate limiting and additional security hardening.
- Database migrations using Alembic.
- Automated unit and integration tests.
- Database backup and recovery procedures.
- Richer analytics and productivity reports.
- Unique animated environments for each focus world.
- Dedicated audio and ambience packs.
- Real-time shared focus rooms.
- Group focus challenges and collaborative quests.
- Improved moderation and reporting for social features.
- Additional plant varieties, decorations, and customization options.

The server-side reward system is designed for application functionality and is not an anti-cheat system for high-stakes rewards.

## 14. Learning Outcomes

The development of Bloom demonstrates how frontend and backend technologies can be combined to create an interactive web application.

The project provides practical exposure to:

- JavaScript programming and DOM manipulation.
- Responsive web design.
- Event-driven programming.
- API development and client-server communication.
- User authentication and access control.
- Database integration and persistence.
- Version control using Git and GitHub.
- Deployment configuration and environment variables.
- Feature organization and modular code structure.
- Gamification concepts applied to productivity software.

## 15. Conclusion

Bloom demonstrates the practical use of JavaScript and modern web development technologies in a productivity-oriented application. By combining a focus timer, task management, plant growth, gamification, analytics, and social features, the project illustrates how interactive web technologies can be used to develop a feature-rich application.

The project also introduces backend development, REST APIs, authentication, database integration, and deployment configuration. It provides a foundation for further improvements in usability, security, testing, and collaborative productivity features.

## References

- JavaScript Documentation: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- HTML Documentation: https://developer.mozilla.org/en-US/docs/Web/HTML
- CSS Documentation: https://developer.mozilla.org/en-US/docs/Web/CSS
- FastAPI Documentation: https://fastapi.tiangolo.com/
- SQLAlchemy Documentation: https://docs.sqlalchemy.org/
- Git Documentation: https://git-scm.com/doc
- Render Documentation: https://render.com/docs

---

**Project Title:** Bloom — Pixel-Themed Productivity Application  
**Subject:** JavaScript Lab  
**Project Type:** Minor Project / Lab Assignment  
**Repository:** https://github.com/prakratis/Bloom-Pixel-JS
