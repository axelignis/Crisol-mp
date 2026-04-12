# Phase 2: Catalog & Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 02-Catalog & Discovery
**Areas discussed:** Creación de piezas, Moderación admin, Catálogo público, Detalle y perfiles

---

## Creación de piezas

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard multi-paso | 4 pasos: info, variantes, fotos, revisar. Progreso visible. | ✓ |
| Formulario largo con secciones | Todo en una página con secciones colapsables | |
| Formulario largo con tabs | Tabs horizontales, navegación libre | |

**User's choice:** Wizard multi-paso
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Drag & drop con reorden | Zona de drop, thumbnails reordenables, portada por defecto | ✓ |
| Botón de upload simple | Botón + lista vertical de thumbnails | |

**User's choice:** Drag & drop con reorden
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Tabla editable inline | Tabla: tipo, valor, stock, modificador precio. + agregar fila | ✓ |
| Cards por tipo de variante | Sección por tipo, cada valor es una card | |

**User's choice:** Tabla editable inline
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save por paso | Guarda automáticamente al avanzar de paso | ✓ |
| Guardar manual | Botón explícito "Guardar borrador" | |

**User's choice:** Auto-save por paso
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Edición directa + flag admin | Menores se publican, mayores requieren re-aprobación | |
| Todo directo sin re-aprobación | Cualquier edición se publica al instante | ✓ |

**User's choice:** Todo directo sin re-aprobación
**Notes:** Modelo familiar, admin confía en artesanos

| Option | Description | Selected |
|--------|-------------|----------|
| Mismo formulario, campos condicionales | Un wizard, campos se muestran/ocultan según tipo | ✓ |
| Formularios separados por tipo | Tres wizards distintos | |

**User's choice:** Mismo formulario, campos condicionales
**Notes:** None

---

## Moderación admin

| Option | Description | Selected |
|--------|-------------|----------|
| Lista + panel lateral | Lista pendientes + panel derecho con detalle y acciones | ✓ |
| Página dedicada por pieza | Navegación a página completa de revisión | |

**User's choice:** Lista + panel lateral
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Mensaje de texto libre | Admin escribe comentario libre, artesano lo ve en su panel | ✓ |
| Checklist predefinido | Lista de razones comunes + notas opcionales | |

**User's choice:** Mensaje de texto libre
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| CRUD básico en admin | Página para crear/editar/eliminar categorías y tags | |
| Seed fijo + edición futura | Categorías seedeadas, CRUD en fase futura | ✓ |

**User's choice:** Seed fijo + edición futura
**Notes:** CRUD diferido a Phase 5

---

## Catálogo público

| Option | Description | Selected |
|--------|-------------|----------|
| Grid responsivo 2-3-4 cols | 2 móvil, 3 tablet, 4 desktop | ✓ |
| Masonry layout | Alturas variables estilo Pinterest | |
| Lista vertical | Una pieza por fila | |

**User's choice:** Grid responsivo 2-3-4 cols
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar izquierda | Filtros en sidebar, colapsa a sheet en móvil | ✓ |
| Barra superior de chips | Chips horizontales con dropdowns | |

**User's choice:** Sidebar izquierda
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Paginación clásica | Páginas numeradas, compatible SSG/ISR/SEO | ✓ |
| Load more | Botón cargar más, URL no cambia | |
| Infinite scroll | Scroll automático | |

**User's choice:** Paginación clásica
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| OR dentro, AND entre | OR intra-filtro, AND inter-filtro. Estándar e-commerce | ✓ |
| Todo AND | Todas selecciones con AND | |

**User's choice:** OR dentro, AND entre
**Notes:** None

---

## Detalle y perfiles

| Option | Description | Selected |
|--------|-------------|----------|
| Foto principal + thumbnails | Grande arriba, thumbnails abajo, lightbox fullscreen | ✓ |
| Carousel horizontal | Swipe/flechas, sin thumbnails | |
| Grid de fotos | Todas visibles en grid | |

**User's choice:** Foto principal + thumbnails
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Botones tipo chip/pill | Chips agrupados por tipo, precio dinámico, badge stock bajo | ✓ |
| Dropdowns/Select | Un select por tipo de variante | |

**User's choice:** Botones tipo chip/pill
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Header bio + grid de piezas | Foto, nombre, bio, redes arriba. Grid de piezas abajo. | ✓ |
| Página estilo portfolio | Hero grande, historia, técnicas, luego piezas | |

**User's choice:** Header bio + grid de piezas
**Notes:** None

---

## Claude's Discretion

- SEO metadata and JSON-LD implementation details
- Sort/order options for catalog
- Empty states design
- 3D viewer integration
- Sold pieces display (badge overlay)
- Lightbox implementation
- Filter URL query params
- Email templates for approval/rejection notifications
- ISR revalidation trigger details

## Deferred Ideas

- CRUD de categorías/tags desde admin — Phase 5
