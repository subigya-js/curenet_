# CureNet research interface

The React application exposes the focused CureNet research modules:

- Lung CT slice classification
- Brain-stroke CT slice classification
- Symptom-based condition retrieval
- Model methodology and contribution scope

Copy `.env.example` to `.env` and configure the FastAPI base URL when it is
not running at `http://127.0.0.1:8000`.

```bash
npm ci
cp .env.example .env
npm start
```

Production verification:

```bash
npm run build
CI=true npm test -- --watchAll=false --watchman=false
```
