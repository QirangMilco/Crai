# Docs Maintenance Checklist

Use this checklist when changing architecture or implementation:

## Before editing
- identify whether the change affects architecture, API, data model, flow, or phase plan
- update the smallest relevant document first
- avoid mixing design intent and implementation details

## After editing
- check whether README links need updates
- verify related docs still agree on naming
- ensure new fields or events are reflected in both spec and flow docs
- mark deprecated documents instead of silently diverging

## Suggested update order
1. architecture-overview.md
2. core-api-spec.md
3. data-model.md
4. runtime-flow.md
5. phase-plan.md
6. README.md
