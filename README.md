# Sanctum Transport

Internal transport-management app for Sanctum World School (SWS) and Sanctum
Academy (SA), Jaipur. Two users: admin + transport head. Handles ~628 students,
19 routes, monthly fee collection, and driver payouts.

## Running locally

Requires Node.js 20+.

```bash
npm install
npm run build
npm run start
```

Open <http://localhost:3000>. The SQLite file lives at `./data/transport.db`
and is created on first run. Migrations in `./db/migrations/` run automatically.

On first boot, seed an admin user:

```bash
npm run seed-admin -- admin yourpassword "Your Name"
```

## Deploying to Railway

1. Push this repo to GitHub.
2. Sign in at <https://railway.app> (use "Login with GitHub").
3. **New Project → Deploy from GitHub repo** and pick this repository.
4. In the service **Variables** tab, add:
   - `SESSION_PASSWORD` — 32+ random characters (run
     `openssl rand -hex 32` in Terminal to generate one).
   - `DATABASE_PATH` — `/app/data/transport.db`
5. In the service **Settings → Volumes**, add a volume mounted at
   `/app/data` (1 GB is plenty).
6. Trigger a redeploy. Railway auto-detects Next.js and runs `npm run build`,
   then `npm run start`.
7. Once the build is green, open the service's **three-dot menu → Run
   Command** and seed users:

   ```
   npm run seed-admin -- admin yourpassword "Administrator"
   npm run seed-user -- transport anotherpassword "Transport Head" staff
   ```

8. Visit the Railway-generated URL and log in.

### Transferring your existing data

Your local `data/transport.db` is never committed. To copy it up to the
Railway volume, use the Railway CLI on your Mac:

```bash
brew install railway
railway login
cd path/to/this/repo
railway link                       # pick the project + service
# Copy the local DB onto the mounted volume:
railway ssh "cat > /app/data/transport.db" < data/transport.db
# Restart so the server opens the new file:
railway redeploy
```

If the CLI route is a hassle, it's fine to start fresh — the app creates an
empty DB on first boot and you can re-import from the original Excel files
later.
