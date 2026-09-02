---
name: Telary Color
description: Gestor de fórmulas de color para el área de pintura de Telary Home
version: 2.0
---

# Design System: Telary Color

## Overview

**Creative North Star: "El Laboratorio de Precisión"**

Telary Color es una herramienta industrial para operadores de pintura. Su diseño prioriza precisión, legibilidad y velocidad sobre expresión. Cada componente funciona como herramienta de laboratorio: directo, confiable, sin adornos.

El color es dato, no decoración. Aparece cuando representa información real (el cuadro de color de un Pantone, un badge de estado), nunca como elemento estético. La interfaz habla como un manual técnico: claro, conciso, sin ambigüedades.

**Key Characteristics:**
- Color como dato: el Pantone es protagonista solo cuando representa información real
- Densidad funcional: whitespace separa, establece jerarquía y facilita escaneo — no es generoso ni escaso
- Precisión sobre expresión: cada pixel comunica estado o jerarquía
- Sistema pequeño y coherente: 14 componentes reutilizables
- Accesibilidad integrada desde el diseño

## 1. Colors

### Semantic Token System

El sistema usa tokens semánticos que permiten dark mode futuro sin rehacer componentes. Los valores actuales son para light mode; dark mode invertirá las superficies y ajustará contraste.

#### Surfaces (Light Mode)
```
--surface-page:      #f8fafc  (slate-50)    — fondo de página
--surface-raised:    #ffffff                 — cards, paneles,dialogs
--surface-sunken:    #f1f5f9  (slate-100)   — secciones agrupadas, tablas alternas
--surface-overlay:   rgba(0,0,0,0.5)        — backdrop de modales
```

#### Text
```
--text-primary:      #0f172a  (slate-900)   — títulos, texto principal
--text-secondary:    #475569  (slate-600)   — texto de soporte, labels
--text-muted:        #64748b  (slate-500)   — timestamps, texto terciario
--text-disabled:     #94a3b8  (slate-400)   — placeholders, elementos deshabilitados
--text-inverse:      #ffffff                 — texto sobre fondos oscuros
```

#### Borders
```
--border-default:    #e2e8f0  (slate-200)   — bordes de cards, divisores
--border-strong:     #cbd5e1  (slate-300)   — bordes de inputs/selects
--border-focus:      #00205B               — focus rings (Pantone 281 C)
```

#### Primary (Pantone 281 C)
```
--primary-50:        #e6edf5               — fondos sutiles, hover states
--primary-100:       #b3cce6               — badges de seleccionado
--primary-500:       #00205B               — acciones primarias, branding
--primary-600:       #001a4d               — hover de primary
--primary-700:       #001338               — active/pressed
```

**Regla del Primary:** Se usa en ≤15% de cualquier pantalla. Su rareza le da autoridad cuando aparece. Si todo es azul, nada es azul.

#### Semantic Colors
```
--success-bg:        #f0fdf4
--success-text:      #15803d
--success-border:    #86efac

--warning-bg:        #fef3c7
--warning-text:      #b45309
--warning-border:    #fcd34d

--error-bg:          #fef2f2
--error-text:        #dc2626
--error-border:      #fca5a5

--info-bg:           #eff6ff
--info-text:         #2563eb
--info-border:       #93c5fd
```

#### Neutral Scale (para componentes)
```
--neutral-50:        #f8fafc   — hover states
--neutral-100:       #f1f5f9   — fondos deshabilitados, tablas alternas
--neutral-200:       #e2e8f0   — bordes
--neutral-300:       #cbd5e1   — bordes de inputs, botón cancelar
--neutral-400:       #94a3b8   — placeholders, iconos
--neutral-500:       #64748b   — texto muted
--neutral-600:       #475569   — texto secondary
--neutral-700:       #334155   — labels, acciones secundarias
--neutral-800:       #1e293b   — títulos
--neutral-900:       #0f172a   — texto primario
```

## 2. Typography

**Font Stack:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
**Mono Stack:** `ui-monospace, "SF Mono", "Cascadia Code", "Segoe UI Mono", monospace`

Sin carga de fuentes externas. Rápido en LAN, consistente en todos los dispositivos.

### Type Scale (1.125 ratio)

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `display` | 24px | 700 | 1.2 | Títulos de página principales |
| `heading` | 20px | 700 | 1.3 | Títulos de sección |
| `title` | 16px | 600 | 1.4 | Títulos de card, dialogs |
| `body` | 14px | 400 | 1.5 | Texto de contenido |
| `label` | 12px | 500 | 1.4 | Labels de formulario, headers de tabla |
| `caption` | 12px | 400 | 1.4 | Timestamps, texto auxiliar |
| `mono` | 12px | 400 | 1.5 | Códigos hex, valores técnicos |
| `small` | 12px | 400 | 1.4 | Notas al pie, ayuda |

### Rules
- **Tabular numbers** para datos numéricos: `font-variant-numeric: tabular-nums`
- **UPPERCASE** para labels técnicos de sección: "FÓRMULA (G/KG)", "DISEÑOS QUE USAN ESTA FÓRMULA"
- **MAYÚSCULAS con tracking** para labels de campo: `text-xs font-medium uppercase tracking-wider`
- **Mono** para códigos que deben alinearse: hex, códigos Pantone

## 3. Layout

### Content-Driven Width

No hay un max-width rígido. El ancho se adapta al tipo de contenido:

| Content Type | Max Width | Reasoning |
|--------------|-----------|-----------|
| Search + Results | `max-w-3xl` (768px) | Focus en resultados, legibilidad de PantoneCards |
| Pantone Detail | `max-w-4xl` (896px) | Color + fórmula + metadatos lado a lado |
| Formulas | `max-w-5xl` (1024px) | Aprovechar ancho para ingredientes |
| Tables (Inventario) | `max-w-6xl` (1152px) | Densidad horizontal para múltiples columnas |
| Forms | `max-w-2xl` (640px) | Limitar para facilitar lectura y llenado |
| Dashboard | `max-w-7xl` (1280px) | Usar espacio disponible eficientemente |

### Grid System

```css
/* Base: mobile-first */
.container { padding: 0 16px; }

/* Grid patterns */
.grid-cols-1 { /* mobile default */ }
.grid-cols-2 { /* tablet+: 2 columnas */ }
.grid-cols-3 { /* desktop: 3 columnas */ }
.grid-cols-4 { /* wide desktop: 4 columnas */ }

/* Gap scale */
.gap-2  { gap: 8px; }   /* elementos cercanos */
.gap-3  { gap: 12px; }  /* cards en grid */
.gap-4  { gap: 16px; }  /* secciones */
.gap-6  { gap: 24px; }  /* separación mayor */
```

### Spacing Rhythm

```
--space-1:   4px    /* intra-element */
--space-2:   8px    /* elementos cercanos */
--space-3:   12px   /* padding de card */
--space-4:   16px   /* entre secciones menores */
--space-5:   20px   /* padding de dialog */
--space-6:   24px   /* entre secciones mayores */
--space-8:   32px   /* separación de página */
--space-10:  40px   /* sección a sección */
--space-12:  48px   /* header a contenido */
```

**Regla:** Más espacio arriba del título que abajo. `space-y-4` entre secciones, `space-y-3` dentro de forms, `gap-2` a `gap-3` en grids.

### Header
- Altura: 56px
- Sticky: `position: sticky; top: 0; z-index: 40`
- Background: `--surface-raised`
- Border: `border-b border-default`
- Contenido: logo/mark a la izquierda, búsqueda al centro, acciones a la derecha

## 4. Navigation

### Desktop (md+)

**Top nav horizontal** — compacta, con búsqueda prominente.

```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  [Buscar... Ctrl+K]    [Fórmulas] [Inventario]  │
│                                    [Diseños] [Admin] [▸]│
└─────────────────────────────────────────────────────────┘
```

- Buscador: ancho fijo `max-w-md`, centrado, con shortcut `Ctrl+K`
- Links de nav: `text-sm font-medium`, activo = `text-primary bg-primary-50 rounded`
- Perfil: dropdown a la derecha con `shadow-lg`

### Mobile (<md)

**Bottom nav fija** — 5 ítems máximo, overflow en "Más".

```
┌──────────────┐
│              │
│   [Content]  │
│              │
├──────────────┤
│ 🔍 📋 💊 📦 ⋯ │
└──────────────┘
```

- Altura: 64px
- Background: `--surface-raised` con `backdrop-blur`
- Border: `border-t border-default`
- Activo: `text-primary`
- Inactivo: `text-muted`
- Touch target: `min-h-[44px]`

### Búsqueda

La búsqueda es el workflow principal. Siempre accesible:

- **Desktop:** Barra visible en header, focus con `Ctrl+K`
- **Mobile:** Botón de búsqueda en bottom nav que abre panel de búsqueda
- **Resultados:** Lista vertical con PantoneCards, scroll infinito si >20 resultados

## 5. Components

Sistema de 14 componentes. Todos reutilizables, coherentes, sin decoración.

### 5.1 Button

| Variant | Background | Text | Border | Use |
|---------|-----------|------|--------|-----|
| `primary` | `--primary-500` | white | none | Acción principal (Guardar, Crear) |
| `secondary` | `--neutral-100` | `--text-primary` | `--border-strong` | Acciones secundarias |
| `danger` | `--error-text` | white | none | Eliminar, acciones destructivas |
| `ghost` | transparent | `--primary-500` | none | Acciones de texto (Ver, Editar) |
| `link` | transparent | `--primary-500` | none | `text-decoration: underline` |

**Sizes:**
- `sm`: `px-3 py-1.5 text-xs` — acciones inline
- `md`: `px-4 py-2 text-sm` — botones estándar
- `lg`: `px-5 py-2.5 text-base` —CTAs principales

**States:**
- Default → hover (darken 5%) → active (darken 10%) → disabled (opacity 50%)
- Focus: `ring-2 ring-primary-500/30 ring-offset-2`
- Loading: spinner + `aria-busy="true"`

### 5.2 Input

```
border: --border-strong
background: --surface-raised
radius: --radius-sm (4px)
padding: 10px 12px
text: --text-primary, text-sm
```

**States:**
- Default: `border-strong`
- Focus: `border-focus ring-2 ring-focus/30 outline-none`
- Error: `border-error ring-2 ring-error/30`
- Disabled: `bg-surface-sunken text-disabled cursor-not-allowed`

**Labels:** `text-xs font-medium uppercase tracking-wider text-secondary` arriba del input, no placeholder como label.

### 5.3 Select

Mismo estilo que Input. Flecha descendente a la derecha. Mismo focus ring.

### 5.4 Search

Input especializado con ícono de búsqueda a la izquierda y botón clear a la derecha.

- **Icono:** `lucide-search` o similar, `text-muted`
- **Clear button:** `min-h-[44px] min-w-[44px]` para touch
- **Shortcut badge:** `Ctrl+K`显示 a la derecha del input en desktop
- **Loading state:** spinner pequeño a la derecha, no overlay

### 5.5 Card

```
background: --surface-raised
border: 1px solid --border-default
radius: --radius-sm (4px)
padding: 12px
```

**Elevation:**
- Default: `shadow-xs` (sutil)
- Hover: `shadow-md` (elevación por interacción)
- Active: `shadow-sm` ( contrae al presionar)

**Regla:** Las cards no tienen sombra en reposo por defecto. Solo se elevan en hover/active. Las sombras son funcionales, no decorativas.

### 5.6 Badge

| Type | Background | Text | Use |
|------|-----------|------|-----|
| `success` | `--success-bg` | `--success-text` | Estado "ok", aprobado |
| `warning` | `--warning-bg` | `--warning-text` | "bajo_umbral" |
| `error` | `--error-bg` | `--error-text` | Error, descartado |
| `info` | `--info-bg` | `--info-text` | Informativo |
| `neutral` | `--neutral-100` | `--text-secondary` | Default, sin estado |

**Shape:** `rounded-full` (pastilla). `px-2.5 py-0.5 text-xs font-medium`.

### 5.7 Dialog

```
backdrop: --surface-overlay
panel: --surface-raised, --radius-md (8px), shadow-xl
padding: 20px
width: max-w-md (448px)
```

**Anatomy:**
- Title: `text-lg font-semibold text-primary` + `aria-labelledby`
- Body: `text-body text-secondary`
- Actions: flex row, gap-2, right-aligned. Primary (confirm) + Secondary (cancel)

**Accessibility:** Focus trap, `Escape` para cerrar, `role="dialog"`, `aria-modal="true"`

### 5.8 Table

```
header: text-xs uppercase tracking-wider text-muted, border-b border-default
rows: border-b border-default
cells: py-3 text-sm text-primary
hover: bg-surface-sunken
```

**Mobile:** Scroll horizontal con `overflow-x-auto`. Opcional: card view en mobile para tablas anchas.

**Densidad:** `py-2` para tablas densas (inventario), `py-3` para tablas normales.

### 5.9 Tabs

```
container: border-b border-default
tab: text-sm font-medium text-muted, padding 12px 16px
active: text-primary border-b-2 border-primary
hover: text-primary
```

Sin animaciones. Cambio instantáneo de contenido.

### 5.10 Form Fields

**Layout:**
- Desktop: 2 columnas (`grid grid-cols-2 gap-4`)
- Mobile: 1 columna

**Anatomy:**
```
┌─────────────────────────┐
│ LABEL (uppercase)       │
│ ┌─────────────────────┐ │
│ │ Input               │ │
│ └─────────────────────┘ │
│ Helper text (opcional)  │
└─────────────────────────┘
```

**Required fields:** `*` en label, no otro indicador visual.

### 5.11 Toast / Feedback

**Posición:** top-right en desktop, top-center en mobile.

**Types:**
- Success: `--success-bg`, `--success-text`, ícono check
- Error: `--error-bg`, `--error-text`, ícono alerta
- Warning: `--warning-bg`, `--warning-text`
- Info: `--info-bg`, `--info-text`

**Comportamiento:** Auto-dismiss 3s, dismiss manual con X, stack vertical.

### 5.12 Loading / Skeleton

**Skeleton:** bloques animados con `animate-pulse` que replican la forma del contenido.

**Spinner:** solo para acciones (botones), no para carga de página.

**Full-page loading:** skeleton del layout completo, no spinner centrado.

### 5.13 Empty States

**Anatomy:**
```
┌─────────────────────────┐
│       [Ícono]           │
│   Título descriptivo    │
│   Explicación breve     │
│   [Acción primaria]     │
└─────────────────────────┘
```

El empty state enseña qué hacer, no solo dice "no hay datos".

### 5.14 StatusBadge

Componente que combina Badge con lógica de estado:

```jsx
<StatusBadge status="ok" />          // → "OK" (success)
<StatusBadge status="bajo_umbral" /> // → "Bajo umbral" (warning)
<StatusBadge status="archivada" />   // → "Archivada" (neutral)
```

Incluye mapa de labels y estilos por estado.

## 6. Elevation & Depth

Sombra funcional, no decorativa. Cada nivel tiene nombre y propósito.

| Level | Token | Use | When |
|-------|-------|-----|------|
| 0 | none | Superficie base | Página, fondo |
| 1 | `shadow-xs` | Cards en reposo | Sutil presencia |
| 2 | `shadow-sm` | Inputs, selects | Elementos interactivos |
| 3 | `shadow-md` | Cards en hover, dropdowns | Elevación por interacción |
| 4 | `shadow-lg` | Paneles, nav desktop | Separación de contenido |
| 5 | `shadow-xl` | Dialogs, modales | Sobreposición total |

**Regla:** Nunca `shadow-xl` en una card en reposo. Las sombras suben solo con interacción.

## 7. Shapes

```
--radius-none: 0
--radius-sm:   4px    /* buttons, inputs, cards */
--radius-md:   8px    /* dialogs, paneles */
--radius-lg:   12px   /* cards hero (PantoneCard) */
--radius-full: 9999px /* badges, avatares */
```

Sin bordes decorativos, clip paths, ni formas experimentales. La geometría comunica orden.

## 8. States

### Loading States
- **Skeleton:** muestra la forma del contenido sin datos
- **Spinner:** solo en botones durante acción
- **Progressive:** carga progressive de contenido (primero estructura, después datos)

### Empty States
- Siempre incluyen ícono + título + descripción + acción
- La acción es el siguiente paso lógico del usuario
- Nunca solo "No hay resultados"

### Error States
- **Inline:** error debajo del campo (formularios)
- **Toast:** error no crítico que no bloquea
- **Full-page:** error que impide cargar la página (con retry)
- **Role:** `role="alert"` para todos los mensajes de error

### Success States
- **Toast:** confirmación de acción completada
- **Inline:** campo validado exitosamente
- **Transition:** cambio de estado visible (badge cambia de color)

### Disabled States
- **Opacity:** 50%
- **Cursor:** `not-allowed`
- **No interaction:** `pointer-events: none`
- **Label:** `text-disabled`

## 9. Responsive

### Breakpoints

```css
sm: 640px    /* landscape phones */
md: 768px    /* tablets */
lg: 1024px   /* small desktops */
xl: 1280px   /* large desktops */
```

### Behavior

| Element | Mobile (<md) | Tablet (md+) | Desktop (lg+) |
|---------|-------------|--------------|---------------|
| Navigation | Bottom nav | Top nav | Top nav |
| Search | Full-width panel | Header bar | Header bar |
| Grid | 1 column | 2 columns | 3 columns |
| Table | Scroll horizontal | Full width | Full width |
| Form | 1 column | 2 columns | 2 columns |
| PantoneCard | Full width | Half width | Half width |
| Dialog | Full width | Max-width 448px | Max-width 448px |

### Touch Targets

Todos los elementos interactivos: `min-h-[44px] min-w-[44px]` en mobile.

## 10. Color Visualization

El workflow principal define el sistema: Search → Pantone → Formula.

### PantoneCard

La tarjeta que representa un color Pantone. Es el componente más importante del sistema.

**Anatomy:**
```
┌─────────────────────────┐
│ ██████████████████████  │ ← Color block (altura fija 96px)
│ ██████████████████████  │    Solo color sólido, sin texto
├─────────────────────────┤
│ PMS 211 C               │ ← Código + gamut
│ Reactiva                │ ← Tipo de pintura
│ #E8B4B8                 │ ← Hex (copiable)
├─────────────────────────┤
│ 2 fórmulas              │ ← Link a fórmulas
│ 3 diseños               │ ← Link a diseños
└─────────────────────────┘
```

**Color Block:**
- Altura: 96px (desktop), 72px (mobile)
- Background: el color real del Pantone
- Border-radius: `--radius-lg` (12px) arriba
- Sin texto, sin overlay — solo el color

**Hex Code:**
- Mono font, `text-xs`
- Botón copy con `min-h-[44px]` touch target
- Feedback visual al copiar (checkmark temporal)

### Color Swatch (inline)

Para mostrar colores en contexto (listas, tablas, badges):
- Tamaño: 24×24px o 32×32px
- Border-radius: `--radius-sm`
- Border: `1px solid --border-default` (para colores claros)
- Tooltip: nombre del color al hover

### Color Picker (futuro)

No implementado en esta versión. Cuando se necesite, usar el sistema de tokens existente.

## 11. Accessibility Checklist

- [ ] **Contraste:** todos los textos cumplen WCAG AA (4.5:1 normal, 3:1 grande)
- [ ] **Focus states:** `ring-2` visible en todos los interactivos
- [ ] **Keyboard:** tab order lógico, escape cierra modales, enter activa botones
- [ ] **Labels:** todos los inputs tienen labels visibles (no solo placeholder)
- [ ] **Touch targets:** `min-h-[44px]` en mobile
- [ ] **Reduced motion:** `motion-safe:` para todas las animaciones
- [ ] **Color no exclusivo:** los estados no dependen solo de color (icono + texto)
- [ ] **ARIA:** `role`, `aria-label`, `aria-labelledby`, `aria-describedby` donde aplica
- [ ] **Skip link:** "Saltar al contenido principal" en header
- [ ] **Screen reader:** contenido alternativo para colores (hex, nombre)

## 12. Do's and Don'ts

### Do:
- ✅ Usar tokens semánticos, no colores hard-coded
- ✅ Mantener consistencia visual en todos los componentes
- ✅ Usar `tabular-nums` para datos numéricos
- ✅ UPPERCASE para labels técnicos de sección
- ✅ Skeleton loading, no spinners de página completa
- ✅ Empty states que enseñan qué hacer
- ✅ Focus rings visibles en todos los interactivos
- ✅ `motion-safe:` para todas las animaciones
- ✅ Touch targets de 44px en mobile
- ✅ Sistema de fuentes del sistema (sin carga externa)

### Don't:
- ❌ Gradientes decorativos
- ❌ Glassmorphism
- ❌ Animaciones innecesarias (sin `motion-safe:`)
- ❌ Cards genéricas sin propósito
- ❌ Decoración sin función
- ❌ `shadow-xl` en cards en reposo
- ❌ Más de 2 colores de acento
- ❌ Fuentes externas
- ❌ Bordes decorativos o clip paths
- ❌ Spinners de página completa
- ❌ Empty states sin acción
- ❌ Inputs sin label visible
- ❌ Errores que dependen solo de color

---

**FINISH:** Este diseño se construye desde el workflow Search → Pantone → Formula. Cada componente se diseña primero para ese flujo, después se extiende al resto de la aplicación. El resultado debe sentirse como una herramienta de laboratorio precisa, no como una landing page.
