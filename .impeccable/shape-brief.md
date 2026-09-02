# Telary Color — Visual Redesign Brief

## 1. Job and Audience

**Who arrives:** Pintores de planta y administradores del departamento de pintura de Telary Home. Operadores en mobile (phones, LAN interna) buscando códigos Pantone, fórmulas e ingredientes. Admins en desktop gestionando usuarios, inventario y diseños.

**Context:** Piso de planta industrial. Horas连续as de uso. Atención dividida entre la pantalla y el proceso físico de pintura. Manos a veces sucias, guantes, iluminación variable.

**Visitor mode:** Operate — completan tareas, no exploran. Velocidad y precisión sobre expresión.

**Primary task:** Buscar código Pantone → identificar color visualmente → consultar fórmula con cantidades exactas → registrar consumo.

## 2. Outcome and Proof

**Success:** Operador encuentra fórmula en <3 segundos desde la búsqueda. Color visible de inmediato. Cantidades legibles sin zoom. Sin pasos intermedios innecesarios.

**Real evidence:** La app ya existe con funcionalidad completa. El redesign preserva toda la lógica de negocio, endpoints, modelos, auth y permisos. Solo cambia la cara.

**Product-specific truth:** Cada Pantone tiene su lugar exacto. Cada fórmula es trazable. El color es dato, no decoración.

## 3. Selected Direction

**Creative North Star: "El Laboratorio de Precisión"**

Un laboratorio de color industrial no es bonito — es preciso. Cada herramienta tiene su lugar, cada medida es exacta, cada superficie comunica estado. La interfaz habla como un equipo de laboratorio: directo, confiable, sin adornos. El color aparece cuando es dato real (el cuadro de color del Pantone, el badge de estado), nunca como decoración.

**Visual authority:** El sistema actual de DESIGN.md (Pantone 281 C como acento único, escala neutral de slate, system-ui fonts) es la base. El redesign expande esto hacia un sistema más denso, más técnico, más orientado a productividad — sin perder la identidad de laboratorio.

**Structural thesis:** Densidad sobre空呼吸. La información densa (fórmulas con múltiples ingredientes, tablas de inventario, listas de colores) necesita espacio eficiente, no generoso. El whitespace es funcional, no decorativo.

**Focal moment:** La PantoneCard — el cuadro de color sólido que conecta el código con la realidad física. Debe ser lo primero que ve el ojo, inmediatamente identificable.

## 4. Scope and Boundaries

**Fidelity:** Sistema de diseño completo con dirección visual. Se aplica progresivamente a pantallas existentes.

**Breadth:** Navigation, hierarchy, layout, component system, typography, color, states, responsive, forms/tables, color visualization.

**Target:** `frontend/src/` — todos los componentes y páginas existentes.

**Untouched:** Backend, lógica de negocio, endpoints, modelos, auth, permisos, contratos de API, datos de prueba.

**Anti-goals:**
- Estética de landing page
- Exceso de gradientes
- Glassmorphism
- Animaciones innecesarias
- Interfaces llenas de cards genéricas
- Decoración que dificulte el trabajo
- Fuentes externas (system-ui es el contrato para LAN)

## 5. States and Ranges

**Content ranges:**
- Pantone codes: 3-8 caracteres + gamut (C/TPX/U)
- Formulas: 1-15 ingredientes por fórmula
- Diseños: 1-7 colores por diseño
- Inventario: 1-100+ items con stock varying
- Muestras: 0-50+ con fotos opcionales

**Material states:** empty, loading, error, success, first-run, expert use, permissions (admin vs operator), overflow (listas largas).

## 6. Interaction and Layout

**Navigation:**
- Desktop: top nav horizontal, compact, con breadcrumb trail
- Mobile: bottom nav fija, 5 ítems máximo, "Más" overflow
- Búsqueda siempre visible (Ctrl+K shortcut)

**Hierarchy:**
1. Pantone color block (visual anchor)
2. Codigo + gamut (identificación)
3. Fórmula/ingredientes (acción principal)
4. Metadatos secundarios (estado, fechas)

**Layout:**
- Mobile-first, `max-w-5xl` centrado
- Grid denso: `gap-2` a `gap-3`, no `gap-6`
- Formularios: 2 columnas en desktop, 1 en mobile
- Tablas: scroll horizontal en mobile, densas en desktop

**Responsive:**
- Mobile: una columna, bottom nav, touch targets 44px
- Tablet: 2 columnas, nav horizontal
- Desktop: 3 columnas donde aplica, sidebar opcional

## 7. Constraints and Open Decisions

**Platform:** Web app, React 19 + Vite 8 + Tailwind CSS 4. Internal LAN, no HTTPS.

**Performance:** System fonts (no external loading), minimal JS, skeleton loading (no spinners).

**Accessibility:** WCAG 2.1 AA. Touch targets 44px. Focus rings visibles. `prefers-reduced-motion` respetado.

**Localization:** Todo en español. Labels técnicos en mayúsculas ("FÓRMULA (G/KG)").

**Component vocabulary:** ConfirmDialog, StatusBadge, PantoneCard, Search input, tables. Todos reemplazables en apariencia, no en comportamiento.

**Open decisions:**
- ¿Dark mode o light mode-only? (Recomiendo: light-only por el contexto de planta con iluminación variable)
- ¿Sidebar en desktop o top nav compacta? (Recomiendo: top nav por la simplicidad del workflow)
