---
title: "Parte 6: Siguientes pasos"
description: Recapitulación de lo aprendido, recursos oficiales y retos para seguir extendiendo el CRUD.
---

Recapitulemos lo que construiste y hacia dónde puedes seguir desde aquí.

## 6.1 Lo que ya sabes hacer

- Diseñar y consumir una API REST (verbos HTTP, códigos de estado, JSON).
- Aplicar el patrón Strategy y la inversión de dependencias para que el código dependa de interfaces, no de implementaciones concretas.
- Construir un CRUD completo con componentes reutilizables en **Vue** y/o **Angular**: modelos tipados, servicio HTTP, formulario con doble propósito (crear/editar), tabla con estados de carga.
- Manejar objetos anidados, fechas y valores monetarios de forma correcta en frontend y backend.
- Diagnosticar problemas de CORS y de conexión frontend-backend.
- Reemplazar un almacenamiento simple en archivos por una base de datos real con Entity Framework Core y SQLite, sin romper el resto del sistema.

:::note[💡 La idea que conecta todo el curso]
Si te quedas con una sola idea de esta guía, que sea esta: **separar "qué hace algo" (una
interfaz/contrato) de "cómo lo hace" (una implementación) es lo que te permite cambiar piezas
grandes de un sistema — el framework del frontend, el almacenamiento de datos — sin que el
resto se entere.** Lo viste tres veces: `IPedidoStorageStrategy` (JSON vs XML),
`IPedidoService` (archivos vs SQLite), y el propio contrato HTTP de la API (Vue vs Angular, del
lado del cliente). Es el mismo principio de diseño aplicado en tres capas distintas.
:::

## 6.2 Retos para seguir practicando

- **Autenticación**: agrega un login simple y protege los endpoints de escritura (POST/PUT/DELETE) para que requieran estar autenticado.
- **Paginación**: si tuvieras miles de pedidos, devolver todos en un solo `GET` no escala. Investiga paginación con `Skip`/`Take` en EF Core.
- **Tests automatizados**: escribe tests unitarios para `PedidoService`/`PedidoSqliteService` (backend) y tests de componentes para el formulario (frontend).
- **El otro framework**: si hiciste Vue, prueba ahora Angular (o viceversa) con la [Parte 2](/guia/parte-2-elige-camino/) — vas a reconocer cada concepto mucho más rápido la segunda vez.
- **Otra entidad**: agrega un CRUD de "Productos" desde cero, replicando la misma arquitectura en capas que ya conoces.

## 6.3 Recursos oficiales

| Tema | Recurso |
|---|---|
| ASP.NET Core | [learn.microsoft.com/aspnet/core](https://learn.microsoft.com/aspnet/core) |
| Entity Framework Core | [learn.microsoft.com/ef/core](https://learn.microsoft.com/ef/core) |
| Vue 3 | [vuejs.org](https://vuejs.org) |
| Angular | [angular.dev](https://angular.dev) |
| Fundamentos de HTTP y REST | [MDN Web Docs — HTTP](https://developer.mozilla.org/es/docs/Web/HTTP) |

:::caution[🚀 ¿Y si quiero publicar mi CRUD en internet?]
Esta guía en sí se puede desplegar como sitio estático (por ejemplo en Vercel). El sistema de
Pedidos que construiste es distinto: el frontend (Vue o Angular compilado) sí se puede alojar
en un hosting estático como Vercel o Netlify, pero el backend .NET necesita un servidor que
ejecute .NET — servicios como Render, Railway o Azure App Service son buenos puntos de partida.
Es, en sí mismo, un excelente reto siguiente una vez que domines lo que cubre esta guía.
:::

Eso es todo. Vuelve al [inicio](/) cuando quieras repasar, o al [selector de
camino](/guia/parte-2-elige-camino/) para intentar el framework que todavía no probaste.
¡Buen trabajo llegando hasta acá!
