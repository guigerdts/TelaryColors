# Propuesta de Rediseño UX/UI — Módulo Diseños

**Fecha**: 2026-09-02
**Estado**: Análisis y propuesta (sin código)
**Sistema visual**: "El Laboratorio de Precisión" — DESIGN.md v2.0

---

## 1. Flujo Actual

### 1.1 Pantallas Existentes

| Pantalla | Ruta | Funcionalidad |
|----------|------|---------------|
| **DesignsPage** | `/designs` | Formulario de creación + listado de cards |

### 1.2 Lo que Existe

**Creación (única operación disponible):**
- Campo nombre (requerido)
- Selector tipo de pintura (reactiva/pigmento)
- DesignColorPicker (botones toggle para 1-7 colores Pantone)
- ConfirmDialog antes de crear

**Listado:**
- Cards en grilla 2 columnas (mobile: 1 columna)
- Muestra: nombre, tipo de pintura, cantidad de colores
- Sin búsqueda, sin filtros, sin ordenamiento
- Sin estados de carga, error, o vacío

**Lo que NO existe:**
- Edición (backend soporta PATCH, frontend no lo usa)
- Eliminación (backend soporta DELETE, frontend no lo usa)
- Detalle individual
- Búsqueda o filtrado
- Visualización de colores como swatches
- Conexión visible con fórmulas asociadas
- Estados de carga/error/vacío

### 1.3 Contratos Backend Disponibles

```
GET    /designs              → DesignOut[] (con nested colors)
POST   /designs              → DesignOut (201)
PATCH  /designs/{id}         → DesignOut
DELETE /designs/{id}         → 204
```

**DesignOut** incluye: id, name, paint_type, client?, notes?, created_by, created_at, updated_at, colors[] (con pantone_color_id)

**Relación con fórmulas**: La tabla `formula_designs` vincula diseños con fórmulas. El endpoint `GET /formulas/{id}/detail` devuelve fórmulas con sus diseños vinculados, pero NO existe el endpoint inverso (diseño → fórmulas asociadas).

### 1.4 Tests Existentes

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `Designs.test.jsx` | 4 | Creación (staging, confirm, cancel, error) |
| `DesignColorPicker.test.jsx` | 3 | Cardinalidad 1-7 |

**Comportamientos críticos a preservar:**
- ConfirmDialog antes de crear (no crear sin confirmar)
- Cardinalidad 1-7 colores (deshabilitar octavo)
- Errores backend se muestran textualmente
- Nombre único (error 409 del backend)

---

## 2. Problemas UX/UI

### 2.1 Problemas Estructurales

| # | Problema | Impacto | Prioridad |
|---|----------|---------|-----------|
| P1 | **Sin edición** — El backend soporta PATCH pero el frontend no lo expone. Los operadores no pueden corregir diseños existentes. | Alto | Crítico |
| P2 | **Sin eliminación** — No hay forma de borrar diseños obsoletos. | Medio | Alto |
| P3 | **Sin detalle** — No hay vista individual del diseño. No se puede ver la información completa ni las fórmulas asociadas. | Alto | Crítico |
| P4 | **Sin búsqueda/filtrado** — Con muchos diseños, encontrar uno específico es lento. | Alto | Alto |

### 2.2 Problemas Visuales

| # | Problema | Impacto | Prioridad |
|---|----------|---------|-----------|
| V1 | **Colores hardcodeados** — Usa `slate-*` y `accent-281c` en vez de tokens del design system. Inconsistente con Dashboard, Search, Pantone, Formulas. | Medio | Alto |
| V2 | **Sin visualización de colores** — Los colores Pantone se muestran como texto ("2 colores"), no como swatches visuales. El operador no puede identificar un diseño por sus colores. | Alto | Crítico |
| V3 | **Cards minimalistas** — Solo nombre, tipo, y conteo. No muestran la información que el operador necesita para trabajar. | Medio | Alto |
| V4 | **Sin estados de carga** — No hay skeleton ni indicador de carga. | Bajo | Medio |
| V5 | **Sin estado vacío** — Lista vacía sin guía al usuario. | Bajo | Medio |

### 2.3 Problemas de Información

| # | Problema | Impacto | Prioridad |
|---|----------|---------|-----------|
| I1 | **Sin conexión visual Diseño ↔ Fórmula** — No se ve qué fórmulas usa cada diseño. | Alto | Crítico |
| I2 | **Campos client/notes ignorados** — El backend los soporta pero el formulario no los muestra. | Medio | Medio |
| I3 | **Sin metadata** — No se muestra fecha de creación, autor, o última modificación. | Bajo | Bajo |

---

## 3. Arquitectura Propuesta

### 3.1 Flujo de Pantallas

```
┌─────────────────────────────────────────────────────────────┐
│                     /designs (Listado)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Header: "Diseños" + Contador + Botón "Nuevo diseño"    │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ Barra de búsqueda + Filtros (tipo pintura)             │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ Tabla de diseños (desktop) / Cards (mobile)            │ │
│  │ - Color swatches (1-7)                                 │ │
│  │ - Nombre + tipo                                        │ │
│  │ - Fórmulas asociadas (count)                           │ │
│  │ - Acciones: Ver / Editar / Eliminar                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   /designs/:id (Detalle)│  │  Modal: Nuevo/Editar     │
│  ┌───────────────────┐  │  │  ┌───────────────────┐  │
│  │ Color palette     │  │  │  │ Nombre            │  │
│  │ (swatches grandes)│  │  │  │ Tipo pintura      │  │
│  ├───────────────────┤  │  │  │ Cliente (opt)     │  │
│  │ Info: nombre,     │  │  │  │ Notas (opt)       │  │
│  │ tipo, cliente,    │  │  │  │ Color picker      │  │
│  │ notas, fechas     │  │  │  │ Confirmar         │  │
│  ├───────────────────┤  │  │  └───────────────────┘  │
│  │ Fórmulas asociadas│  │  └─────────────────────────┘
│  │ (lista enlazada)  │  │
│  ├───────────────────┤  │
│  │ Acciones:         │  │
│  │ Editar / Eliminar │  │
│  └───────────────────┘  │
└─────────────────────────┘
```

### 3.2 Decisiones de Arquitectura

#### Decisión 1: Tabla vs Cards para el listado

**Decisión: Tabla en desktop, Cards en mobile.**

**Justificación:**
- El operador necesita escanear rápidamente muchos diseños para encontrar uno específico
- Una tabla permite ordenar por nombre, tipo, fecha — más eficiente que cards para escaneo
- Los colores se muestran como swatches inline en una columna — identificación visual inmediata
- En mobile (< 768px), las cards son más legibles porque el espacio horizontal es limitado
- La tabla del design system ya define estilos consistentes (headerWeight, rowBorder, hoverBg)

**Implementación:**
- Desktop (md+): `<table>` con columnas: Colores | Nombre | Tipo | Fórmulas | Acciones
- Mobile (< md): Cards apiladas con la misma información

#### Decisión 2: Jerarquía de información

**Decisión: Color → Nombre → Tipo → Fórmulas → Acciones.**

**Justificación:**
- El operador identifica un diseño PRIMERO por sus colores (es lo visualmente distintivo)
- El nombre es la identificación oficial
- El tipo de pintura es relevante para la producción
- Las fórmulas asociadas muestran la trazabilidad (core product principle)
- Las acciones van al final porque son secundarias al contenido

#### Decisión 3: Conexión visual Diseño ↔ Pantone ↔ Fórmula

**Decisión: Swatches de color inline + lista de fórmulas enlazadas.**

**Justificación:**
- Los colores Pantone se muestran como swatches circulares (8x8 o 10x10) con el código como tooltip
- En el listado: swatches en fila, máximo 7 visibles
- En el detalle: paleta grande con código y gamut
- Las fórmulas asociadas se muestran como una lista de enlaces en el detalle
- En el listado: badge con count ("2 fórmulas") que enlaza al detalle

**Sin endpoint inverso**: El frontend necesitará cargar fórmulas y cruzar por `pantone_color_id` para mostrar qué fórmulas usa cada diseño. Esto es viable porque ambas entidades comparten el campo `pantone_color_id`.

#### Decisión 4: Acciones primarias/secundarias

| Acción | Primaria/Secundaria | Dónde aparece |
|--------|---------------------|---------------|
| **Crear diseño** | Primaria | Header del listado, botón principal |
| **Ver detalle** | Secundaria | Row de tabla / card, botón "Ver" |
| **Editar** | Secundaria | Detalle, row de tabla, modal |
| **Eliminar** | Peligro | Solo en detalle, con ConfirmDialog |

#### Decisión 5: Desktop vs Mobile

| Elemento | Desktop (md+) | Mobile (< md) |
|----------|---------------|---------------|
| Listado | Tabla completa | Cards apiladas |
| Búsqueda | Input inline con filtros | Input full-width |
| Colores | Swatches en columna | Swatches en fila |
| Acciones | Botones en row | Botones en card footer |
| Detalle | Layout de 2 columnas | Layout apilado |
| Modal | Centrado, max-w-md | Full-screen sheet |

#### Decisión 6: Información que puede omitirse visualmente

| Información | Listado | Detalle | Justificación |
|-------------|---------|---------|---------------|
| `created_by` | Oculto | Mostrar | El operador no necesita saber quién creó |
| `created_at` | Oculto | Mostrar | Relevante solo para auditoría |
| `updated_at` | Oculto | Mostrar | Relevante para saber si está actualizado |
| `id` | Oculto | Mostrar | El nombre es la identificación |
| `client` | Oculto | Mostrar | Solo relevante en contexto |
| `notes` | Oculto | Mostrar | Información complementaria |

#### Decisión 7: Diseños sin fórmula/Pantone/imagen

| Estado | Manejo |
|--------|--------|
| Sin fórmulas asociadas | Badge gris "Sin fórmulas" en listado; mensaje vacío en detalle |
| Sin cliente | Mostrar "—" o omitir la fila en detalle |
| Sin notas | Omitir la sección en detalle |
| 1 solo color | Swatch único, igual estilo |
| 7 colores | Swatches en fila, scroll si necesario |

#### Decisión 8: Alta densidad sin perder legibilidad

- **Tabla desktop**: filas compactas (h-10), swatches pequeños (6x6), texto-sm
- **Cards mobile**: padding mínimo (p-3), jerarquía clara por tamaño de texto
- **Colores**: swatches circulares con borde sutil, hover que muestra código completo
- **Espaciado**: usar tokens del design system (spacing-2, spacing-3, spacing-4)
- **Tipografía**: escala del design system (label para columnas, body para contenido)

---

## 4. Componentes

### 4.1 Componentes Existentes a Reutilizar

| Componente | Uso en Diseños | Cambios necesarios |
|------------|----------------|-------------------|
| `ConfirmDialog` | Confirmar crear/editar/eliminar | Ninguno |
| `DesignColorPicker` | Selector de colores en modal | Migrar a design tokens |
| `PantoneCard` (patrón) | Swatches inline | Extraer lógica de swatch a componente compartido |

### 4.2 Componentes Nuevos Necesarios

| Componente | Descripción | Prioridad |
|------------|-------------|-----------|
| `DesignRow` | Fila de tabla / card mobile para un diseño | Crítica |
| `ColorSwatches` | Swatches de colores en fila (listado) | Crítica |
| `DesignDetail` | Vista de detalle del diseño | Alta |
| `DesignForm` | Modal de crear/editar (unifica create/update) | Alta |
| `DesignFilters` | Barra de búsqueda y filtros | Media |

### 4.3 Componentes a Modificar

| Componente | Cambios |
|------------|---------|
| `DesignsPage` | Reescribir: tabla + búsqueda + modal + detalle |
| `DesignColorPicker` | Migrar de `slate-*`/`accent-281c` a design tokens |
| `AppRouter` | Agregar ruta `/designs/:id` |

---

## 5. Estados

### 5.1 Loading

```
┌─────────────────────────────────────────┐
│ Diseños                         [Nuevo] │
├─────────────────────────────────────────┤
│ [████████████████] (búsqueda skeleton)  │
├─────────────────────────────────────────┤
│ [███] [████████] [██] [████] [██]      │  ← skeleton rows (3-5)
│ [███] [████████] [██] [████] [██]      │
│ [███] [████████] [██] [████] [██]      │
└─────────────────────────────────────────┘
```

### 5.2 Empty

```
┌─────────────────────────────────────────┐
│ Diseños                         [Nuevo] │
├─────────────────────────────────────────┤
│                                         │
│         📋 (icono)                      │
│   Sin diseños creados                   │
│   Crea tu primer diseño para comenzar.  │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Error

```
┌─────────────────────────────────────────┐
│ Diseños                         [Nuevo] │
├─────────────────────────────────────────┤
│ ⚠️ Error al cargar diseños: [detalle]  │
│                     [Reintentar]        │
└─────────────────────────────────────────┘
```

### 5.4 Normal (con datos)

```
┌─────────────────────────────────────────┐
│ Diseños (12)                    [Nuevo] │
├─────────────────────────────────────────┤
│ 🔍 Buscar diseño...    Tipo: [Todos ▾]  │
├─────────────────────────────────────────┤
│ ●●●  Colección Aromo      reactiva  2f  │
│ ●●●● Colección Aurora     pigmento  1f  │
│ ●●   Línea Básica         reactiva  3f  │
│ ●●●●●●● Colección Premium pigmento 0f  │
└─────────────────────────────────────────┘
● = swatch de color    f = fórmulas
```

### 5.5 Estados Parciales

| Estado | Descripción |
|--------|-------------|
| Búsqueda sin resultados | "No se encontraron diseños para '[query]'" |
| Filtro sin resultados | "No hay diseños de tipo [tipo]" |
| Cargando detalle | Skeleton de detalle |
| Error al crear | Mensaje inline + formulario preservado |
| Error al eliminar | ConfirmDialog con error inline |

---

## 6. Responsive

### 6.1 Breakpoints

| Breakpoint | Comportamiento |
|------------|----------------|
| < 640px (sm) | Cards apiladas, búsqueda full-width, modal full-screen |
| 640-768px (sm-md) | Cards en 2 columnas, búsqueda inline |
| 768-1024px (md-lg) | Tabla, búsqueda inline con filtros |
| > 1024px (lg+) | Tabla completa, filtros inline |

### 6.2 Mobile (< 768px)

- Listado: cards apiladas, una por diseño
- Colores: swatches en fila debajo del nombre
- Acciones: botones "Ver" y "Editar" en el footer de la card
- Modal crear/editar: full-screen sheet con botón "Guardar" fijo arriba
- Detalle: layout apilado, paleta de colores arriba

### 6.3 Desktop (≥ 768px)

- Listado: tabla con columnas
- Colores: swatches en columna de la tabla
- Acciones: botones "Ver", "Editar", "Eliminar" en la última columna
- Modal crear/editar: centrado, max-w-md
- Detalle: layout de 2 columnas (info izquierda, fórmulas derecha)

---

## 7. Accesibilidad

| Requisito | Implementación |
|-----------|---------------|
| `aria-label` en swatches | Cada swatch tiene `aria-label="Color PMS 281 C"` |
| `aria-live="polite"` en contador | Counter de colores anuncia cambios |
| `role="alert"` en errores | Mensajes de error con role alert |
| `role="status"` en éxito | Mensajes de éxito con role status |
| `focus-visible` en acciones | Rings de foco visibles en todos los botones |
| `min-h-[44px]` en touch targets | Todos los botones cumplen mínimo táctil |
| Keyboard navigation | Tab order lógico: búsqueda → filtros → tabla → acciones |
| Screen reader | Nombres de diseño y colores accesibles |
| `aria-busy` en loading | Indicador de carga para screen readers |

---

## 8. Preservación Funcional

### 8.1 Comportamientos que NO deben cambiar

| Comportamiento | Razón |
|----------------|-------|
| ConfirmDialog antes de crear | Protege contra creaciones accidentales |
| Cardinalidad 1-7 colores | Regla de negocio validada en backend |
| Errores backend se muestran textualmente | Transparencia para el operador |
| Nombre único (error 409) | Integridad de datos |
| Solo admin/operator pueden gestionar | Permisos del sistema |
| Diseños son lazy-loaded | Performance del bundle |

### 8.2 Datos que NO se modifican

| Dato | Razón |
|------|-------|
| API contracts | No hay cambios de backend |
| Estructura de DesignOut | Se consume tal cual |
| Relación con fórmulas | Se cruza por `pantone_color_id` |
| Audit trail | Se mantiene en backend |

---

## 9. Archivos Afectados

### 9.1 Archivos a Modificar

| Archivo | Cambios | Estimación |
|---------|---------|------------|
| `frontend/src/pages/Designs.jsx` | Reescribir completamente | Alto |
| `frontend/src/components/DesignColorPicker.jsx` | Migrar a design tokens | Bajo |
| `frontend/src/router/AppRouter.jsx` | Agregar ruta `/designs/:id` | Bajo |

### 9.2 Archivos a Crear

| Archivo | Descripción | Estimación |
|---------|-------------|------------|
| `frontend/src/components/DesignRow.jsx` | Fila de tabla / card mobile | Medio |
| `frontend/src/components/ColorSwatches.jsx` | Swatches de colores inline | Bajo |
| `frontend/src/pages/DesignDetail.jsx` | Vista de detalle | Medio |
| `frontend/src/components/DesignForm.jsx` | Modal crear/editar | Medio |
| `frontend/src/components/DesignFilters.jsx` | Búsqueda y filtros | Bajo |

### 9.3 Archivos de Test a Crear/Modificar

| Archivo | Tests estimados |
|---------|-----------------|
| `Designs.test.jsx` | Reescribir (10-12 tests) |
| `DesignRow.test.jsx` | Crear (4-5 tests) |
| `ColorSwatches.test.jsx` | Crear (3-4 tests) |
| `DesignDetail.test.jsx` | Crear (5-6 tests) |
| `DesignForm.test.jsx` | Crear (6-8 tests) |
| `DesignColorPicker.test.jsx` | Actualizar (3 tests existentes) |

---

## 10. Plan de Implementación

### Fase 3.1: Fundamentos Visuales (sin cambio funcional)

**Objetivo**: Migrar a design tokens, crear componentes base.

1. **Migrar DesignColorPicker a design tokens**
   - Reemplazar `slate-*` por tokens del sistema
   - Reemplazar `accent-281c` por `primary-500`
   - Verificar tests existentes pasan

2. **Crear componente ColorSwatches**
   - Swatches circulares con borde
   - Tooltip con código y gamut
   - Soporte para 1-7 colores
   - Accesibilidad: `aria-label` en cada swatch

3. **Crear componente DesignRow**
   - Fila de tabla (desktop) / card (mobile)
   - Recibe: design object, callbacks (onView, onEdit, onDelete)
   - Muestra: color swatches, nombre, tipo, fórmulas count

### Fase 3.2: Listado y Búsqueda

**Objetivo**: Tabla funcional con búsqueda y filtros.

4. **Crear componente DesignFilters**
   - Input de búsqueda (nombre)
   - Select de tipo de pintura (reactiva/pigmento/todos)
   - Contador de resultados

5. **Reescribir DesignsPage — Listado**
   - Header con título + contador + botón "Nuevo diseño"
   - DesignFilters
   - Tabla desktop / cards mobile
   - Estados: loading, empty, error, normal
   - Búsqueda local (filtro por nombre y tipo)

### Fase 3.3: CRUD Completo

**Objetivo**: Crear, editar, eliminar.

6. **Crear componente DesignForm**
   - Modal shared para crear y editar
   - Campos: nombre, tipo pintura, cliente (opt), notas (opt), color picker
   - Validación client-side
   - ConfirmDialog antes de guardar
   - Manejo de errores backend

7. **Integrar crear en DesignsPage**
   - Botón "Nuevo diseño" abre modal
   - Confirmar → POST → refresh list

8. **Integrar editar**
   - Botón "Editar" en row abre modal precargado
   - Confirmar → PATCH → refresh list
   - Diseños completos muestran colores como readonly

9. **Integrar eliminar**
   - Botón "Eliminar" en row (solo desktop) o detalle
   - ConfirmDialog de peligro
   - Confirmar → DELETE → refresh list

### Fase 3.4: Detalle

**Objetivo**: Vista individual del diseño.

10. **Crear DesignDetail page**
    - Ruta `/designs/:id`
    - Paleta de colores grande (swatches 12x12)
    - Info: nombre, tipo, cliente, notas, fechas
    - Fórmulas asociadas (lista de enlaces)
    - Acciones: Editar, Eliminar, Volver

11. **Conectar listado → detalle**
    - Click en nombre o botón "Ver" navega a `/designs/:id`

### Fase 3.5: Testing y Pulido

**Objetivo**: Cobertura completa y pulido visual.

12. **Tests unitarios**
    - Reescribir Designs.test.jsx
    - Crear tests para nuevos componentes
    - Verificar estados de carga/error/vacío

13. **Pulido visual**
    - Verificar coherencia con Dashboard, Search, Pantone, Formulas
    - Ajustar espaciados, tipografía, colores
    - Verificar responsive en todos los breakpoints

14. **Validación final**
    - 58+ tests pasando
    - Build limpio
    - Accesibilidad verificada

---

## 11. Riesgos

### 11.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Cruce de fórmulas por pantone_color_id** — No existe endpoint inverso (design → formulas). El frontend necesitará cargar todas las fórmulas y cruzar. | Media | Medio | Cargar fórmulas una vez al montar, cachear, cruzar por `pantone_color_id`. Con pocos datos (<100 fórmulas) es viable. |
| **Rendimiento de listado** — Con muchos diseños (>50), la tabla puede ser lenta. | Baja | Bajo | Paginación simple o "load more" si es necesario. Por ahora, listado completo es aceptable. |
| **Tests rotos** — Reescribir Designs.jsx puede romper los 4 tests existentes. | Alta | Bajo | Reescribir tests junto con el componente. Los tests de cardinalidad no se tocan. |

### 11.2 Riesgos UX

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Complejidad del modal** — Unificar crear/editar en un modal puede confundir. | Media | Medio | Labels claros ("Nuevo diseño" vs "Editar diseño"), estado visual diferente. |
| **Pérdida de contexto** — Navegar a detalle y volver al listado puede perder la posición de scroll. | Media | Bajo | Guardar posición de scroll en state, o usar `scrollRestoration`. |
| **Mobile: many colors** — 7 swatches en una card mobile pueden ser apretados. | Baja | Bajo | Swatches más pequeños (6x6) en mobile, wrap a segunda fila si necesario. |

### 11.3 Riesgos de Alcance

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Scope creep** — Agregar funcionalidad no solicitada (paginación, export, etc.). | Media | Alto | Mantener el alcance definido. Solo lo propuesto. |
| **Cambios de backend** — Tentación de agregar endpoints nuevos. | Baja | Alto | NO cambiar backend. Trabajar con los contratos existentes. |

---

## 12. Resumen Ejecutivo

### Estado Actual
- Módulo mínimo: solo creación con listado básico
- Sin edición, eliminación, detalle, búsqueda, ni filtros
- Colores hardcodeados, sin swatches visuales
- 7 tests existentes

### Propuesta
- **Listado**: Tabla (desktop) / Cards (mobile) con búsqueda y filtros
- **Detalle**: Vista individual con paleta de colores y fórmulas asociadas
- **CRUD**: Crear, editar, eliminar con modales y confirmaciones
- **Visual**: Design tokens, swatches de colores, estados completos
- **Tests**: 30-40 tests estimados

### Impacto
- **Archivos a modificar**: 3
- **Archivos a crear**: 5
- **Tests a crear/reescribir**: 6
- **Estimación total**: 12-15 horas de implementación

### Próximo Paso
Esperar aprobación para comenzar Fase 3.1 (Fundamentos Visuales).
