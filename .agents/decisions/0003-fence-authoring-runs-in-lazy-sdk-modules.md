# 0003 — Fence authoring runs in lazy SDK modules

**Status:** Accepted

The Fence Assistant extends the same five planner facade methods and shared browser
agent as terrain. Schemas, product discovery, context DTOs, native parameter selection,
validation, prompts and orchestration load dynamically in roomle-ui. The example and
embedding adapter forward calls and own no fence geometry or tool implementation.

Core owns distribution, topology, terrain anchoring, fitting and ordinary history.
It exposes two missing interactions: programmatic construction contours independent
of the drawing manager, and exact edge-targeted gate/external placement. Thin bindings
expose cached rules, native station and iterable attachment incidence. The existing
set binding is retained; its JavaScript interface has no read iterator.

Interactive drawing cannot provide deterministic contour coordinates across click,
continuous and mobile settings. Best-fit insertion cannot guarantee a requested edge.
Those are native interaction gaps; moving assistant orchestration into Core would
prevent its independent lazy loading and duplicate existing SDK responsibilities.

Owned operations reject overlapping/manual writers while awaiting insertion or native
parameter callbacks. Initial configuration readiness and history commit do not prove
aggregate dependent geometry/BOM completion. Results expose pending or failure instead
of inferring readiness from a timer, save or first mesh, and uncertain writes are never
replayed automatically.
