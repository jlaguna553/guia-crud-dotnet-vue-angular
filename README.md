# Guía CRUD .NET + Vue/Angular

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

Sitio de documentación (Astro + [Starlight](https://starlight.astro.build)) con la guía paso a
paso para construir el CRUD de Pedidos de este repositorio con Vue o Angular, y luego
reemplazar el almacenamiento en archivos por SQLite.

Carpeta independiente de `Backend.Api`, `Frontend.UI` y `Frontend.Angular` a propósito: se
despliega por separado en Vercel sin afectar ni depender de esos proyectos.

## Desarrollo local

Requiere Node 20.3+ (Astro 7 / Starlight necesitan Node moderno).

```bash
npm install
npm run dev      # http://localhost:4321
```

```bash
npm run build     # genera ./dist
npm run preview   # sirve ./dist para verificar el build de producción
```

## Estructura de contenido

```
src/content/docs/
├── index.mdx                          # Parte 0 — Bienvenida
└── guia/
    ├── parte-1-backend.md
    ├── parte-2-elige-camino.mdx
    ├── parte-3-vue.mdx
    ├── parte-3-angular.mdx
    ├── parte-4-conectando.md
    ├── parte-5-sqlite.md
    └── parte-6-siguientes-pasos.md
```

La navegación lateral se configura en `astro.config.mjs` (bloque `sidebar`). Las capturas
reales de las apps Vue/Angular corriendo viven en `public/img/{vue,angular}/`. El componente
`src/components/Resultado.astro` es el que las muestra dentro de cada lección.

## Desplegar en Vercel

Vercel detecta Astro automáticamente (no requiere `vercel.json`). Con la carpeta `guia-crud`
como raíz del proyecto en Vercel, el build command (`npm run build`) y el output
(`dist/`) se configuran solos.
