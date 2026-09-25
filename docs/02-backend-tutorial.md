# Part 2: Building the Noise Reporter back end

This is the second of three tutorials that rebuild the Noise Reporter from scratch:

1. [Front end](01-frontend-tutorial.md): the React pages the customer clicks through
2. **Back end** (this document): the Express server that stores each report
3. [Cypress tests](03-cypress-tutorial.md): end-to-end tests for the whole thing

At the end of Part 1, the Your details page POSTs the customer's report to `/api/submitCase` and gets an error back, because nothing is listening. In this part you'll build the small server that receives that report, gives it a case reference, saves it to a file and replies. Then you'll connect the two, so one command runs the whole app.

> **Convention:** a heading like 📄 **`server/index.ts`** followed by a code block means *create this file with exactly this content*. Short snippets without that heading are for explanation only.

---

## 0. What the back end must do

Start with the **contract**: the agreement between the front end and the back end about what gets sent and what comes back. Part 1 already defines the front end's side, so the server has to match it:

**Request** sent by the Your details page:

```http
POST /api/submitCase
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@example.com",
  "noiseType": "music",
  "howLong": "weeks",
  "description": "Bass music from the flat above, every night after 11pm"
}
```

**Response** the page expects when it works:

```http
HTTP/1.1 201 Created
Content-Type: application/json

{ "caseReference": "NR-1A2B3C4D" }
```

Any non-2xx status is treated as a failure, and the page shows its error message.

We'll also add one extra endpoint that the front end doesn't use:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Returns `{ "status": "ok" }`. Lets scripts (and the Cypress runner in Part 3) check that the server is up |
| `POST` | `/api/submitCase` | Stores a report and returns its case reference |

**Where reports are stored:** a JSON file, `server/reports.json`, holding an array of every report. It's the simplest storage that survives a restart, and you can open it in your editor and see exactly what was saved. Section 8 covers when and how to move to a real database.

---

## 1. Install the server packages

From the project root (the same folder as Part 1):

```bash
npm install express
npm install -D @types/express @types/node tsx concurrently
```

| Package | Why |
|---|---|
| `express` | The web framework: routing, JSON parsing, responses |
| `@types/express`, `@types/node` | TypeScript types for Express and for Node built-ins like `fs` |
| `tsx` | Runs a `.ts` file directly with Node, with no build step. `tsx watch` restarts on save |
| `concurrently` | Runs the front end and back end from one command (section 6) |

The server lives in the same repo as the front end, in its own `server/` folder:

```bash
mkdir server
```

---

## 2. The smallest possible server

Build the server in small steps and check each one works. First, a server that answers the health check:

```ts
import express from 'express';

const app = express();

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
```

Save that as `server/index.ts` and run it:

```bash
npx tsx watch server/index.ts
```

In a second terminal:

```bash
curl http://localhost:3001/api/health
```

You should get `{"status":"ok"}`.

- `app.get(path, handler)` registers a handler for `GET` requests to that path.
- The handler receives the request (`req`) and the response (`res`). The leading `_` in `_req` tells TypeScript and ESLint "I know this is unused".
- `res.json(...)` sets `Content-Type: application/json`, turns the object into a JSON string and sends it. The status defaults to 200.
- Port **3001** keeps the server clear of Vite's 5173.

---

## 3. Accept a report

Next, the `POST` route. Update `server/index.ts`:

```ts
import express from 'express';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/submitCase', (req, res) => {
    const { firstName, lastName, email, noiseType, howLong, description } = req.body;
    const caseReference = `NR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const report = { caseReference, firstName, lastName, email, noiseType, howLong, description, submittedAt: new Date().toISOString() };

    console.log('New report received:', report);

    res.status(201).json({ caseReference });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
```

What's new:

- **`app.use(express.json())`** is *middleware*: it runs before every route. For requests with `Content-Type: application/json` it parses the body into `req.body`. Without it, `req.body` is `undefined`. It's the most common Express mistake.
- **Pick fields explicitly.** Destructuring the six expected fields (instead of saving `req.body` as-is) means extra fields sent by a buggy or malicious client aren't stored.
- **Case reference.** `randomUUID()` gives something like `1a2b3c4d-5e6f-...`. We take the first 8 hex characters and upper-case them, giving `NR-1A2B3C4D`. That's short enough to read over the phone, and collisions are extremely unlikely at this scale (8 hex characters is about 4.3 billion values).
- **`submittedAt`** is added by the *server*. Never trust the client's clock for timestamps.
- **`201 Created`** is the correct status for "a new thing was created". The front end treats any 2xx as success.

`tsx watch` restarted the server when you saved. Test it:

```bash
curl -i -X POST http://localhost:3001/api/submitCase \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","noiseType":"music","howLong":"days","description":"Loud bass"}'
```

`-i` prints the status line, so you should see `HTTP/1.1 201 Created` and a case reference. The server terminal logs the full report.

---

## 4. Save reports to a file

At the moment each report is logged and then forgotten. Now store it. This is the finished server:

📄 **`server/index.ts`**

```ts
import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve } from 'path';

const app = express();
app.use(express.json());

const DB_PATH = resolve(process.env.REPORTS_DB_PATH ?? 'server/reports.json');

function loadReports(): object[] {
    if (!existsSync(DB_PATH)) return [];
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
}

function saveReports(reports: object[]) {
    writeFileSync(DB_PATH, JSON.stringify(reports, null, 2));
}

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/submitCase', (req, res) => {
    const { firstName, lastName, email, noiseType, howLong, description } = req.body;
    const caseReference = `NR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const report = { caseReference, firstName, lastName, email, noiseType, howLong, description, submittedAt: new Date().toISOString() };

    console.log('New report received:', report);

    const reports = loadReports();
    reports.push(report);
    saveReports(reports);

    res.status(201).json({ caseReference });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
```

How the storage works:

- **`loadReports`** reads the file and parses it into an array. If the file doesn't exist yet (first run), it returns an empty array instead of crashing.
- **`saveReports`** writes the whole array back. `JSON.stringify(reports, null, 2)` indents with 2 spaces so the file is easy to read.
- **Read, add, write.** Each new report loads the current list, appends, and saves. The file is created automatically on the first report.
- **`DB_PATH` comes from an environment variable** if one is set, otherwise `server/reports.json`. Part 3 uses this to send test reports to a separate file (`server/reports.e2e.json`) so tests never touch real data. `resolve(...)` turns the relative path into an absolute one based on the folder you started the server from, which is the project root.

Send the `curl` request from section 3 a couple of times, then open `server/reports.json`:

```json
[
  {
    "caseReference": "NR-592B2F94",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "noiseType": "music",
    "howLong": "days",
    "description": "Loud bass",
    "submittedAt": "2026-06-22T19:34:21.353Z"
  }
]
```

Stop the server (Ctrl+C), start it again and send another report. The earlier reports are still there. That's the point of storing them in a file.

> 🔒 **Personal data:** this file holds customers' names and emails. Don't commit real reports to a public repository. Add `server/reports.json` to `.gitignore` once you start using the app with real people.

---

## 5. Connect the front end: the Vite proxy

The front end is served from `http://localhost:5173` and the API from `http://localhost:3001`. Those are different **origins** (the port counts), so a browser `fetch('http://localhost:3001/...')` from the page would be blocked by **CORS** unless the server opted in.

Instead of fetching a different origin, the front end calls a *relative* URL (`/api/submitCase`) on its own origin, and the Vite dev server forwards it:

```
Browser ──POST /api/submitCase──▶ Vite :5173 ──proxy──▶ Express :3001
        ◀───── 201 {caseReference} ───────────────────┘
```

📄 **`vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
```

Any request whose path starts with `/api` is forwarded to Express, and everything else is served by Vite as usual. The browser only ever talks to one origin, so there's no CORS to deal with, and the front-end code doesn't hard-code a server address.

Restart `npm run dev` after changing `vite.config.ts`.

---

## 6. One command for both servers

Running two terminals every time gets tedious. In `package.json`, replace the `"dev"` script and add two helpers:

```json
"scripts": {
  "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
  "dev:client": "vite",
  "dev:server": "tsx watch server/index.ts",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

Keep `build`, `lint` and `preview` as the template created them.

| Script | Runs |
|---|---|
| `npm run dev` | Both servers together, with output prefixed `[0]` (Vite) and `[1]` (Express) |
| `npm run dev:client` | Only the front end |
| `npm run dev:server` | Only the API, restarting on save |

Stop any servers you started by hand, then:

```bash
npm run dev
```

---

## 7. Test the whole app by hand

1. Open http://localhost:5173 and go through all five pages.
2. The confirmation page should now show a case reference like `NR-1A2B3C4D`.
3. The `[1]` lines in the terminal show `New report received: { ... }` with all six fields.
4. `server/reports.json` has a new entry with the same case reference.
5. **Test the failure path:** stop the server, run only `npm run dev:client` and submit again. The proxy can't reach Express, so it returns an error status and the page shows its "Something went wrong" message. Start the server again, click **Submit** once more, and it goes through.

Finally, run the same checks as Part 1:

```bash
npm run lint
npm run build
```

---

## 8. Limitations, and what a production version would change

This server is intentionally small. Know its limits before you build on it:

| Limitation | Why it matters | Production fix |
|---|---|---|
| **No validation** | `curl -d '{}'` stores an empty report and returns 201. The front end validates, but anyone can call the API directly | Validate `req.body` on the server and return `400` with the problems. Reuse the Zod schema from `src/schemas/` so both sides share the same rules |
| **Whole-file rewrite on every report** | Slows down as the file grows, and a crash mid-write could corrupt it | A database: SQLite for a single machine, or PostgreSQL |
| **Synchronous file I/O** (`readFileSync`) | Blocks the server while reading or writing, so other requests wait | `fs/promises`, or a database client (which is async anyway) |
| **Hard-coded port 3001** | Hosting platforms usually tell you which port to use | `const PORT = Number(process.env.PORT ?? 3001)` |
| **No way to read reports back** | Staff can only open the JSON file | A protected `GET /api/reports` (see Exercises) |
| **Proxy only exists in dev** | `vite build` outputs static files, and nothing forwards `/api` in production | Serve `dist/` from Express with `express.static`, or put both behind one reverse proxy |

---

## Common mistakes

| Symptom | Likely cause |
|---|---|
| `req.body` is `undefined` | `app.use(express.json())` is missing, or the request has no `Content-Type: application/json` header |
| `EADDRINUSE: address already in use :::3001` | The server is already running in another terminal. Stop it, or find it with `lsof -i :3001` |
| Front end gets 404 for `/api/submitCase` | The proxy is missing from `vite.config.ts`, or Vite wasn't restarted after adding it |
| Front end gets 502 Bad Gateway / "Something went wrong" | Express isn't running, so the proxy has nothing to forward to. Check the `[1]` output of `npm run dev` |
| `reports.json` created in an unexpected folder | The server was started from a different directory. Always run the npm scripts from the project root |
| `SyntaxError: Unexpected end of JSON input` on submit | `reports.json` is empty or was hand-edited into invalid JSON. It must contain at least `[]` |

---

## Exercises

1. **Server-side validation.** Write the behaviour you want first: an empty body should get `400` with `{ errors: [...] }`. Build it with Zod, and make sure the front end still works for valid reports. Part 3 shows how to test this with `cy.request`.
2. **Read a report.** Add `GET /api/reports/:caseReference`, which returns the matching report or `404`. (Hint: `req.params.caseReference` and `Array.prototype.find`.)
3. **Configurable port.** Read the port from `process.env.PORT` with 3001 as the default. What else would need to change for the Vite proxy?
4. **SQLite.** Replace `loadReports`/`saveReports` with Node's built-in `node:sqlite` module (Node 22.5+) and a `reports` table. The API contract should stay exactly the same, so the front end needs no changes.

➡️ **Next:** [Part 3: Testing it all with Cypress](03-cypress-tutorial.md)
