# Lecciones aprendidas

> Cada vez que un bug se cuela, una migración falla, o un commit incluya algo indeseado, anótalo aquí.
> Formato: `## Fecha — Incidente`. Causa raíz, no parche.

---

## 2026-04-26 — `git add -A` arrastró 326 archivos al repo

**Incidente:** Un commit incluyó toda la carpeta `ui-ux-pro-max-skill-main/` (skill externa de Claude que estaba en el working dir).

**Causa raíz:** Uso ciego de `git add -A` sin revisar `git status` previo, y la carpeta no estaba en `.gitignore`.

**Cómo evitarlo:**
- Antes de `git add`, hacer `git status` y revisar la lista.
- Stagear archivos específicos: `git add src/lib/foo.ts ...`.
- Mantener `.gitignore` actualizado para carpetas externas.

---

## 2026-04-26 — `column "sueldo_base" does not exist` (migración 008)

**Incidente:** La función `aguinaldo_proyectado` y servicios del frontend usaban `empleado_sueldo.sueldo_base`, pero la columna real es `sueldo_diario` (con `sueldo_mensual` como columna **generated** que no se puede escribir).

**Causa raíz:** Asumí el nombre de la columna sin verificar la migración del schema original (001).

**Cómo evitarlo:**
- Antes de escribir cualquier SQL que toque una tabla existente, hacer `Grep "create table <nombre>"` para ver el schema real.
- Para columnas generated, no incluirlas en upserts/inserts.

---

## 2026-04-26 — `cannot change name of view column` al recrear `aguinaldo_proyectado`

**Incidente:** `create or replace view` falló porque agregué `empresa_id` en medio de las columnas existentes.

**Causa raíz:** Postgres no permite reordenar ni renombrar columnas existentes en una vista con `CREATE OR REPLACE VIEW`. Las nuevas columnas se agregan AL FINAL.

**Cómo evitarlo:**
- Al modificar una vista existente, las nuevas columnas siempre van al final.
- Si necesitas reordenar, usar `DROP VIEW` + `CREATE VIEW` (cuidado con dependencias).

---

## 2026-04-26 — `column "estatus" does not exist` en `asistencia_dia` (migración 014)

**Incidente:** La vista `mi_asistencia` referenciaba `a.estatus`, pero `asistencia_dia` no tiene esa columna — el estatus se **deriva** en `v_reporte_asistencia` con un CASE basado en `falta`, `turno_id`, `minutos_retardo` y `entrada_real`.

**Causa raíz:** Asumí que `asistencia_dia` tenía estatus porque el frontend lo lee como string.

**Cómo evitarlo:**
- Mismo patrón: verificar contra la migración. La fuente de verdad para "qué columnas tiene una tabla" es la migración donde se define.
- Cuando una columna parece "obvia" pero no la encuentras, busca en vistas (`v_*`) — probablemente se calcula ahí.

---

## 2026-04-26 — `column "activo" does not exist` en `empleado_conceptos` (migración 016)

**Incidente:** La función `fn_generar_prenomina` recibió un refactor (migraciones 005 y 015) que simplificó el loop de `empleado_conceptos` quitando el JOIN con `conceptos_nomina` y referenciando `ec.activo` (columna inexistente) y `r_conc_emp.monto` (no se calculaba sin el JOIN). El error se manifestó como "No API key found in request" porque el gateway de Supabase respondió raro al fallar la función.

**Causa raíz:**
1. Refactor de función SQL sin verificar que las columnas usadas en cada loop existieran realmente.
2. Se perdió el patrón original `coalesce(monto_override, cn.valor) as monto` con JOIN — al "simplificar", se perdió la lógica.

**Cómo evitarlo:**
- Cuando refactorices una función SQL existente, comparar **diff completo** contra la versión previa antes de aplicarla.
- Si vas a quitar un JOIN, verificar de dónde vienen TODAS las columnas usadas dentro del loop.
- Errores 400/500 inesperados desde Supabase RPC pueden tener causas reales en SQL — siempre probar la función en el SQL editor para ver el mensaje correcto.

---

## 2026-04-26 — `unique violation` al regenerar prenómina

**Incidente:** Al re-generar prenómina del mismo periodo, fallaba con 409 Conflict por el `unique (periodo_id, empleado_id)` en `nomina_detalle`. Cancelar la prenómina previa desde la UI no era suficiente — los `nomina_detalle` quedaban huérfanos.

**Causa raíz:** "Cancelar" cambia estatus pero no borra detalles. La función `fn_generar_prenomina` (versión 015) limpiaba detalles solo de prenominas en `borrador` o `en_revision`, no de `cancelada`.

**Cómo evitarlo:**
- Para operaciones que pueden re-ejecutarse, anticipar el estado intermedio (registros huérfanos) y limpiarlos al inicio.
- "Soft delete" (cambiar estatus) y "regenerar" deben coordinarse explícitamente.
