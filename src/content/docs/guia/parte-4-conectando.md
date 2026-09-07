---
title: "Parte 4: Conectando todo"
description: Cómo corren juntos backend y frontend, y cómo diagnosticar los errores más comunes de conexión.
---

Aplica sin importar si elegiste Vue o Angular. Repasamos cómo se levantan ambos servidores a la
vez, qué pasa en cada petición, y cómo diagnosticar los errores de conexión más comunes.

## 4.1 Levantar ambos servidores

Necesitas **dos terminales abiertas al mismo tiempo**, una por proyecto:

```bash title="terminal 1"
cd Backend.Api
dotnet run
# escucha en http://localhost:5000
```

```bash title="terminal 2 (Vue)"
cd Frontend.UI
npm run dev
# escucha en http://localhost:5173
```

```bash title="terminal 2 (Angular)"
cd Frontend.Angular
npm start
# escucha en http://localhost:4200
```

## 4.2 Qué pasa exactamente en cada petición

Cuando cargas la página y ves la tabla de pedidos:

1. El navegador carga el HTML/JS del frontend desde el servidor de desarrollo (Vite en Vue, o el dev-server de Angular).
2. El componente raíz se monta (`onMounted` en Vue / `ngOnInit` en Angular) y dispara `pedidoService.obtenerTodos()`.
3. El navegador hace un `fetch`/`XMLHttpRequest` (por debajo de axios o `HttpClient`) a `http://localhost:5000/api/pedidos`.
4. Como el frontend corre en otro puerto (otro "origen"), el navegador primero valida la política CORS que vimos en la Parte 1 — si el backend no la permitiera, la petición se bloquearía *antes de llegar a tu código*.
5. ASP.NET Core enruta la petición a `PedidosController.Get()`, que llama a `IPedidoService`, que lee `pedidos.json` (o SQLite, si llegaste a la Parte 5) y devuelve JSON.
6. El frontend recibe la respuesta, la guarda en su estado reactivo, y el framework vuelve a renderizar la tabla.

## 4.3 Errores comunes y cómo diagnosticarlos

| Síntoma | Causa probable | Solución |
|---|---|---|
| Consola muestra `CORS error` / `blocked by CORS policy` | El backend no está corriendo, o no tiene `app.UseCors(...)` activo antes de `MapControllers()` | Confirma que `dotnet run` está corriendo y que `Program.cs` tiene el bloque de CORS de la Parte 1 |
| `ERR_CONNECTION_REFUSED` / `Network Error` | El backend no está corriendo, o la URL en el servicio HTTP apunta a otro puerto | Verifica `API_URL` en `pedidoService.ts` / `pedido.service.ts` — debe ser `http://localhost:5000/api/pedidos` |
| La tabla siempre dice "Cargando pedidos..." | La promesa de `obtenerTodos()` nunca resuelve o lanzó una excepción no manejada | Revisa la pestaña Network del navegador y la consola por errores |
| `404 Not Found` al hacer PUT o DELETE | El id que envías no existe en el almacenamiento actual | Haz `GET /api/pedidos` primero para confirmar qué ids existen realmente |
| Los datos "desaparecen" al reiniciar el backend | Estás en modo SQLite de prueba con un archivo temporal, o borraste `Data/pedidos.json` | Confirma qué estrategia de almacenamiento está activa en `Program.cs` |

:::note[💡 Concepto: la pestaña Network de las DevTools, tu mejor amiga]
Abre las herramientas de desarrollador del navegador (F12) y ve a la pestaña **Network** antes
de reproducir un problema. Ahí ves cada petición HTTP real: su URL, su método, su código de
estado, y el body exacto que se envió y se recibió. El 90% de los bugs de "no se conecta el
frontend con el backend" se diagnostican mirando esta pestaña antes que el código.
:::

:::tip[📝 Ejercicio 4.1 — Provoca los errores a propósito]
Para reconocerlos rápido cuando aparezcan sin querer, provócalos ahora, controladamente:
1. Detén el backend (Ctrl+C) y recarga el frontend. Observa el error en la consola.
2. Vuelve a levantar el backend, pero comenta temporalmente `app.UseCors("AllowVue");` en `Program.cs`. Recarga el frontend y observa el error CORS. No olvides descomentarlo después.
3. Con todo funcionando, intenta un `DELETE` a un id que no existe (ej. 9999) desde curl, y confirma el 404.
:::
