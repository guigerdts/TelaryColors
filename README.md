# Telary Color

Gestor de fórmulas de color para el área de pintura de Telary Home.
Stack: FastAPI (Python), SQLite, React + Vite + Tailwind (PWA).
Búsqueda instantánea por código Pantone. Fase 4 completada.

---

## 1. Requisitos previos

| Requisito | Versión | Cómo verificar |
|-----------|---------|----------------|
| Python    | ≥ 3.13  | `python3 --version` |
| Node.js   | ≥ 22    | `node --version` |
| npm       | ≥ 10    | `npm --version` |

No se necesitan dependencias del SO adicionales — SQLite ya viene incluido
con Python (`sqlite3` del stdlib).

---

## 2. Levantar el backend

### Instalación (solo la primera vez)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Variables de entorno

Copiar el template y ajustar (opcional — los defaults funcionan para desarrollo local):

```bash
cp .env.example .env
```

Defaults que ya sirven:
- SQLite en `backend/data/app.db` (se crea sola)
- Admin seed: `admin` / `telary-admin` (cambiar `SECRET_KEY` en `.env` para producción)

### Migraciones (alembic)

La base se crea al primer arranque, pero las migraciones se aplican con:

```bash
cd backend
.venv/bin/python -m alembic upgrade head
```

Estado actual: 4 migraciones (0001→0004), todas aditivas, sin conflicto posible.

### Arranque

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> IMPORTANTE: usar siempre `.venv/bin/python -m uvicorn`. El binario
> `uvicorn` del PATH de Termux es un stub roto y NO funciona.

Verificar: `http://localhost:8000/docs` (Swagger UI).

---

## 3. Levantar el frontend

El build de producción (`frontend/dist/`) ya existe — FastAPI lo sirve
directamente en `/` (single-origin, sin CORS). **No hace falta correr
`npm run build` para probar la app.**

### Opción A: Producción (recomendado para probar desde celulares en la LAN)

El backend por sí solo sirve la app completa. Iniciá el backend (paso 2)
y accedé desde el celular a:

```
http://<ip-de-tu-dispositivo>:8000
```

### Opción B: Desarrollo con hot-reload (para iterar desde la PC)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — proxy /api → :8000
```

Vite redirige `/api/*` y `/uploads/*` al backend. El SPA se sirve desde
Vite con hot-reload.

---

## 4. Crear el primer usuario

No hay endpoint de registro abierto — el sistema es de uso interno
del área de pintura. El primer usuario (admin) se crea con el seed
idempotente:

```bash
cd backend
.venv/bin/python -m app.seed
```

Resultado:
- Si no existe ningún admin en la base → crea uno con las credenciales
  configuradas (default: `admin` / `telary-admin`).
- Si ya existe un admin → no-op (nunca duplica).

### Credenciales por defecto

| Campo    | Valor           |
|----------|-----------------|
| Usuario  | `admin`         |
| Contraseña | `telary-admin` |

Cambiar en producción vía variables de entorno (`SEED_ADMIN_USERNAME`,
`SEED_ADMIN_PASSWORD` en `.env`).

### Login (para usar la API desde curl o Postman)

```bash
curl -X POST http://localhost:8000/api/v1/login \
  -d "username=admin" \
  -d "password=telary-admin"
```

Respuesta:

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": 1, "username": "admin", "role": "admin" }
}
```

### Crear un usuario normal (operador del área de pintura)

```bash
TOKEN="<pegar access_token del login>"

curl -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "pintor1",
    "full_name": "Operador de Pintura",
    "password": "clave123",
    "role": "operator"
  }'
```

Roles disponibles: `admin`, `operator`.

---

## 5. Compartir en la red local

Para que otros en la misma WiFi accedan desde su celular:

### Obtener tu IP local

```bash
hostname -I
# Alternativa:
ip -4 addr show | grep inet
```

### Acceso desde otro dispositivo en la misma red

En el celular (mismo WiFi), abrir en el navegador:

```
http://<tu-ip>:8000
```

Ejemplo: si tu IP es `192.168.1.15`, accedés a `http://192.168.1.15:8000`.

### Si el firewall bloquea (proot-Ubuntu / Linux)

```bash
# Permitir tráfico entrante en el puerto 8000
sudo ufw allow 8000/tcp   # Ubuntu/Debian
# o
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
```

---

## 6. Datos de prueba

**La base arranca completamente vacía.** No hay pantones, fórmulas,
diseños, ni insumos de ejemplo precargados. Solo queda el admin que
crea el seed.

### Cómo cargar el primer Pantone real

```bash
TOKEN="<pegar access_token del login>"

# Crear un Pantone (ej: 281C de Tailored Brands, gamut coating)
curl -X POST http://localhost:8000/api/v1/pantone-colors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "281C",
    "gamut": "C",
    "paint_type": "reactiva"
  }'
```

Valores válidos:
- `gamut`: `"C"` (Coating), `"TPX"` (Textile Paper eXtended), `"U"` (Uncoating)
- `paint_type`: `"reactiva"`, `"pigmento"`

### Cargar una fórmula para ese Pantone

```bash
# Crear fórmula (requiere pantone_color_id del paso anterior, e.g. "1")
curl -X POST http://localhost:8000/api/v1/formulas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Azul Telary Estandar",
    "notes": "Fórmula maestra para 281C",
    "pantone_color_id": 1,
    "ingredients": [
      {
        "name": "Colorante Azul B",
        "quantity": 450.0,
        "unit": "g"
      },
      {
        "name": "Pasta Blanca Base",
        "quantity": 320.0,
        "unit": "g"
      },
      {
        "name": "Solvente X",
        "quantity": 230.0,
        "unit": "g"
      }
    ]
  }'
```

Valores válidos de `unit`: `"g"`, `"kg"`.

### Cargar un Diseño vinculado a la fórmula

```bash
curl -X POST http://localhost:8000/api/v1/formulas/1/designs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEL-281-001",
    "name": "Base Azul Estandar",
    "gamut": "C",
    "paint_type": "reactiva",
    "client": "Telary Home"
  }'
```

Una vez cargados estos datos, podés probar el flujo completo:
buscar por código `281C` en la barra de búsqueda, ver el detalle
de la fórmula con sus ingredientes, y registrar transacciones
de inventario (entradas/salidas/consumo).

---

## Tests

```bash
cd backend && .venv/bin/python -m pytest     # backend (pytest)
cd frontend && npm test                       # frontend (vitest)
```

---

## PWA

La aplicación incluye manifest e iconos para instalación en la LAN
(sin service worker: requiere HTTPS, fuera del alcance de esta fase).
Desde el celular, en Chrome se puede "Agregar a pantalla de inicio"
para experimentar como app nativa.

---

## Estado del proyecto

Fase 4 completada — 9 PRs integrados a main:
Fórmulas de color con búsqueda Pantone, diseño vinculado,
inventario con trazabilidad, diseño visual Impeccable.
