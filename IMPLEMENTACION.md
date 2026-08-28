# Telary Color — Gestor de Fórmulas de Color para el Área de Pintura

## 1. Contexto y propósito

Telary Home tiene un área de pintura donde se preparan los colores para la producción de diseños solicitados por clientes. Los colores se identifican con códigos **Pantone** (principalmente gama C, con posibilidad de otras gamas en el futuro) y se trabaja con dos tipos de pintura: **Reactivas** y **Pigmentos**.

Actualmente todo el conocimiento de fórmulas vive en libretas físicas, algunas con más de 20 años de antigüedad y en deterioro. Esto genera pérdida de información histórica, trabajo repetido y falta de trazabilidad de insumos.

**Telary Color** es un software (versión no oficial, en evaluación por el dueño de la empresa) que digitaliza y organiza ese conocimiento, permitiendo búsqueda casi instantánea por código Pantone, reutilización de muestras de color, e inventario trazable de insumos.

## 2. Problemas que resuelve

1. **Pérdida y deterioro de información**: las fórmulas en libretas físicas se dañan o se pierden con el tiempo.
2. **Trabajo duplicado**: diseños que ya se hicieron antes no se pueden encontrar por falta de organización en el registro, obligando a repetir el proceso de aproximación de color desde cero.
3. **Desperdicio de muestras válidas**: durante el proceso de aproximación al Pantone exigido por el cliente, se generan tonos que no llegaron a ser el color final pero que son perfectamente utilizables en futuros pedidos, y hoy se descartan o no quedan registrados.
4. **Falta de trazabilidad de inventario**: los colorantes e insumos para la pasta madre se compran en otras ciudades del país; sin registro de consumo no hay forma de anticipar cuándo reabastecer.

## 3. Objetivos del producto

- Búsqueda de una fórmula por código Pantone (ej. `221C`) en segundos.
- Registro histórico de todas las fórmulas realizadas, sin pérdida ni deterioro.
- Banco de muestras/tonos "no definitivos" pero reutilizables, vinculados al Pantone al que más se acercaron.
- Trazabilidad de consumo de insumos y alertas de reabastecimiento.
- Sistema de usuarios con login, roles y registro de último acceso.
- Interfaz visual intuitiva y estéticamente cuidada, con identidad propia del área de pintura.
- Arquitectura modular que permita agregar funciones nuevas sin reescribir el sistema (multi-gama Pantone, reportes, exportaciones, etc.).

## 4. Alcance de la primera versión (no oficial)

- Uso local, en red interna del área de pintura (sin necesidad de hosting pago).
- Multiusuario simultáneo dentro de esa red.
- Pensado para poder mostrarse como demo funcional al dueño de Telary Home antes de una eventual adopción oficial.

---

## 5. Arquitectura técnica propuesta

### Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend | FastAPI (Python) | Rápido de construir, tipado, buena documentación automática (OpenAPI) |
| Base de datos | SQLite | Un solo archivo, cero configuración de servidor, suficiente para este volumen |
| Frontend | React + Tailwind (PWA) | Instalable en celular/tablet como app, funciona en cualquier navegador de la red local |
| Autenticación | JWT + hash de contraseñas (bcrypt) | Sencillo, seguro, sin dependencias externas |
| Fotos de muestras | Almacenamiento en filesystem local, referenciado en la BD | Evita depender de servicios cloud en la fase no oficial |

### Despliegue

- Corre en una PC del área de pintura conectada a la red WiFi interna.
- Los usuarios acceden desde celular/tablet/PC vía navegador, apuntando a la IP local del servidor.
- Arquitectura preparada para migrar sin reescritura a un VPS o nube cuando la empresa apruebe el producto oficialmente.

### Modelo de datos (entidades principales)

- **users**: id, nombre, usuario, contraseña (hash), rol, último_acceso, creado_en
- **access_logs**: id, user_id, fecha_hora, acción
- **pantone_colors**: id, código (ej. `221C`), gama (`C`, `U`, otras), tipo_pintura (Reactiva/Pigmento)
- **formulas**: id, pantone_color_id, nombre/observaciones, creado_por, creado_en, actualizado_en
- **formula_ingredients**: id, formula_id, colorante, cantidad, unidad
- **samples**: id, formula_id (nullable), pantone_objetivo, foto_url, estado (`aprobada` / `archivada_reutilizable` / `descartada`), notas, creado_por, creado_en
- **inventory_items**: id, nombre, tipo (colorante/insumo pasta madre), proveedor, ciudad_compra, stock_actual, umbral_reorden, unidad
- **inventory_transactions**: id, inventory_item_id, tipo (`entrada`/`consumo`), cantidad, formula_id (nullable), fecha, usuario_id

### Principios de diseño de arquitectura

- Separación clara backend/frontend vía API REST documentada (OpenAPI/Swagger generado por FastAPI).
- Cada módulo (fórmulas, muestras, inventario, usuarios) debe poder crecer o desactivarse de forma independiente.
- Toda acción relevante (crear fórmula, modificar inventario, login) queda en `access_logs` para auditoría.
- Índices de búsqueda optimizados sobre `pantone_colors.código` para lograr búsqueda instantánea.

---

## 6. Especificaciones de diseño (UI/UX)

- **Identidad visual**: paleta y tipografía que evoquen el área de pintura/color — se sugiere fondo neutro claro para no interferir con la percepción de colores reales mostrados en pantalla, con acentos de color usados con intención (no decorativos).
- **Pantalla principal**: buscador prominente por código Pantone, con autocompletado y resultados casi instantáneos.
- **Ficha de color**: al abrir un Pantone, mostrar de inmediato la fórmula, ingredientes, tipo de pintura, historial de muestras asociadas y última vez que se produjo.
- **Registro de muestra**: flujo simple para subir foto, marcar el Pantone al que se aproximó, y decidir si se archiva como reutilizable.
- **Panel de inventario**: vista de insumos con alerta visual (color de estado) cuando el stock está por debajo del umbral de reorden.
- **Login**: pantalla simple, con visualización del último acceso del usuario tras iniciar sesión.
- Diseño responsive: debe verse y usarse bien tanto en celular (uso principal en planta) como en PC (uso administrativo).

---

## 7. Fases de desarrollo

### Fase 1 — MVP
- Login de usuarios + registro de último acceso.
- CRUD de colores Pantone y sus fórmulas.
- Búsqueda instantánea por código Pantone.

### Fase 2 — Muestras reutilizables
- Registro de muestras con foto.
- Estado de muestra (aprobada / reutilizable / descartada).
- Vinculación de muestras a Pantones objetivo.

### Fase 3 — Inventario y trazabilidad
- Registro de insumos (colorantes, pasta madre) con proveedor y ciudad de compra.
- Registro de consumo por producción (vinculado a fórmulas).
- Alertas de reabastecimiento por umbral mínimo.

### Fase 4 — Extensiones
- Soporte multi-gama Pantone (no solo C).
- Reportes y exportación (PDF/Excel) para presentar al dueño de la empresa.
- Roles de usuario más granulares (operario, supervisor, administrador).
- Posible migración a despliegue en la nube si la empresa aprueba el producto oficialmente.

---

## 8. Fuera de alcance (por ahora)

- Integración con sistemas oficiales de Telary Home (ERP, facturación) hasta que el producto sea aprobado.
- Multi-empresa o multi-sede.
- App nativa móvil (se prioriza PWA web).

---

## 9. Instrucciones para el agente de desarrollo (OpenCode)

- Priorizar simplicidad y velocidad de entrega del MVP (Fase 1) sobre features avanzadas.
- Mantener el modelo de datos definido en la sección 5 como base, pero permitir migraciones (usar Alembic si se usa SQLAlchemy).
- Toda nueva funcionalidad debe registrar auditoría en `access_logs` cuando modifique datos.
- El código debe quedar organizado en módulos independientes (`formulas`, `samples`, `inventory`, `users`) para facilitar el crecimiento descrito en la Fase 4.
- Documentar la API con OpenAPI/Swagger automático de FastAPI.
- No introducir dependencias de servicios pagos o en la nube en esta fase no oficial.

