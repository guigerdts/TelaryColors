# Telary Color — Fase 2: Muestras Reutilizables

Continuación de la Fase 1 (foundation, data layer, auth+users, pantone+formulas, designs+audit, frontend SPA — mergeada a main). Esta fase agrega el módulo de **muestras**: registro de los tonos generados durante el proceso de aproximación al Pantone del cliente, incluyendo los que no fueron el resultado final pero son reutilizables a futuro.

## Objetivo de la fase

Que cada vez que se haga una muestra física o virtual durante el proceso de aproximación de color, quede registrada con su foto, el Pantone objetivo, y un estado que indique si es reutilizable — para que aparezca automáticamente cuando alguien busque ese Pantone en el futuro.

## Modelo de datos (extiende el esquema de Fase 1)

**Tabla `samples`**
- `id`
- `pantone_target_id` → FK a `pantone_colors` (el Pantone que el cliente exigía)
- `formula_id` → FK a `formulas`, nullable (si la muestra terminó vinculada a una fórmula guardada)
- `photo_url` → ruta del archivo en filesystem local
- `status` → enum: `aprobada` | `archivada_reutilizable` | `descartada`
- `notes` → texto libre (ej. "quedó ligeramente más cálido que el objetivo")
- `created_by` → FK a `users`
- `created_at`

Reutiliza el sistema de `access_logs` de Fase 1 para auditar creación/cambio de estado de cada muestra.

## Slices sugeridos (mismo patrón RED/GREEN de Fase 1)

**A — Data layer**
- Migración: tabla `samples` + índices sobre `pantone_target_id` y `status`.
- Modelos/schemas Pydantic para creación, actualización de estado, lectura.

**B — Backend: subida y almacenamiento de fotos**
- Endpoint de upload de imagen (validar tipo/tamaño), guardar en filesystem local, devolver `photo_url`.
- No depender de servicios cloud (consistente con la fase no oficial).

**C — Backend: CRUD de muestras**
- Crear muestra (vinculada a `pantone_target_id`, con o sin `formula_id`).
- Listar muestras por Pantone objetivo.
- Cambiar estado de una muestra (con registro en `access_logs`).
- Endpoint para filtrar muestras `archivada_reutilizable` por Pantone.

**D — Integración con búsqueda de Pantone**
- Al consultar la ficha de un Pantone (endpoint ya existente de Fase 1), incluir también las muestras reutilizables asociadas, no solo la fórmula "oficial".
- Esto es lo que resuelve el problema original: que un tono cercano generado en el pasado aparezca disponible aunque nunca se haya guardado como fórmula definitiva.

**E — Frontend: flujo de registro de muestra**
- Formulario simple: seleccionar/buscar Pantone objetivo, subir foto, notas, marcar estado.
- Pensado para uso rápido desde celular en planta (mínimos clics).

**F — Frontend: visualización en ficha de color**
- En la pantalla de ficha de Pantone (ya existente), agregar sección "Muestras relacionadas" mostrando miniaturas de las `archivada_reutilizable`, con su nota y fecha.
- Permitir desde ahí "promover" una muestra a fórmula guardada si se decide usarla como definitiva.

## Criterios de aceptación

- Se puede registrar una muestra con foto en menos de 3 pasos desde el celular.
- Al buscar un Pantone, se ven tanto la fórmula guardada (si existe) como las muestras reutilizables asociadas.
- Toda creación/cambio de estado de muestra queda en `access_logs`.
- Cobertura de tests backend (pytest) y frontend (vitest) equivalente al estándar dejado en Fase 1 (100% de los tests nuevos en verde antes de mergear).

## Fuera de alcance de esta fase

- Reconocimiento automático de color por foto (comparación algorítmica contra el Pantone).
- Compresión/optimización avanzada de imágenes (guardar tal cual, optimizar después si el volumen lo amerita).
- Fase 3 (inventario) — no tocar esas tablas todavía.

## Instrucción para OpenCode

Seguir el mismo patrón de slices A→F con PRs independientes, RED antes de GREEN en cada uno, y merge estándar (no squash) a `main` preservando historial, tal como se hizo en Fase 1.

