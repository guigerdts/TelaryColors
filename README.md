# Telary Color

Gestor de fórmulas de color para el área de pintura de Telary Home.
Stack: FastAPI (Python), SQLite, React + Vite + Tailwind (PWA).
Búsqueda instantánea por código Pantone. Fase 1 MVP — en desarrollo.

## Requisitos

- Python 3.13
- Node.js 22

## Backend (FastAPI + SQLite)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Variables de entorno (opcional): copiar `.env.example` a `.env` y ajustar.

Ejecutar en la LAN:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> IMPORTANTE: usar siempre `python -m uvicorn` (o `.venv/bin/python`) desde
> el venv. El binario `uvicorn` del PATH de este equipo es un stub de
> Termux roto y no debe usarse.

Verificar en el navegador: `http://<ip-de-la-lan>:8000/docs` (Swagger UI).

## Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
npm run dev        # desarrollo: http://localhost:5173 (proxy /api → :8000)
npm run build      # producción: genera frontend/dist
```

En producción FastAPI sirve `frontend/dist` desde el mismo origen
(deployment single-origin, sin CORS).

## Tests

```bash
cd backend && .venv/bin/python -m pytest     # backend (pytest)
cd frontend && npm test                      # frontend (vitest)
```

## PWA

La aplicación incluye manifest e iconos para instalación en la LAN
(sin service worker: requiere HTTPS, fuera del alcance de Fase 1).

## Estado

Fase 1 MVP — arquitectura base. Módulos (auth, users, pantone-colors,
formulas, designs) en desarrollo.