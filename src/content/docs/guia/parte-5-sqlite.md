---
title: "Parte 5: Base de datos con SQLite"
description: Reemplaza el almacenamiento en archivos por SQLite y Entity Framework Core sin tocar el frontend.
---

Hasta ahora, los pedidos viven en un archivo `pedidos.json`. Funciona para aprender, pero tiene
límites reales. En esta parte lo reemplazas por una base de datos SQLite usando Entity
Framework Core — y gracias al diseño de la Parte 1, el frontend (Vue o Angular) **no cambia ni
una línea**.

## 5.1 ¿Por qué una base de datos en vez de archivos?

Guardar todo en un archivo JSON tiene problemas que se notan cuando la app crece:

- **Concurrencia**: si dos peticiones intentan escribir el archivo al mismo tiempo, una puede sobrescribir a la otra.
- **Rendimiento**: cada operación (incluso leer un solo pedido) lee y parsea *todo* el archivo completo.
- **Consultas**: "dame los pedidos de este mes con total mayor a $500" es trivial en SQL, y muy incómodo escribirlo a mano sobre una lista en memoria.
- **Integridad**: una base de datos puede garantizar reglas (por ejemplo, que el total no sea negativo) a nivel de motor, no solo de código de aplicación.

**SQLite** es un motor de base de datos relacional que guarda todo en un único archivo
(`.db`) — no necesitas instalar ni administrar un servidor de base de datos aparte, lo que lo
hace ideal para aprender y para aplicaciones pequeñas o embebidas.

## 5.2 Conceptos de Entity Framework Core

:::note[💡 Concepto: ¿qué es un ORM?]
Un ORM (Object-Relational Mapper) traduce entre objetos de tu lenguaje (clases C#, en este
caso) y filas de tablas relacionales, para que trabajes con `List<Pedido>` y LINQ en vez de
escribir SQL a mano. **Entity Framework Core** es el ORM oficial de .NET.
:::

| Término de EF Core | Qué es |
|---|---|
| `DbContext` | La "sesión" contra la base de datos: agrupa todas las tablas (DbSets) y sabe cómo conectarse. |
| `DbSet<T>` | Representa una tabla — en nuestro caso, `DbSet<Pedido> Pedidos`. |
| Migración | Un script versionado que describe cómo crear/alterar las tablas. Ideal para producción. |
| `EnsureCreated()` | Crea la base de datos y sus tablas directamente a partir del modelo, sin historial de migraciones. Más simple, perfecto para aprender — la usamos aquí. |
| Owned Entity Type | Una clase que no tiene su propia tabla ni identidad propia — vive como columnas dentro de la tabla de su "dueño". Así modelamos `Cliente` dentro de `Pedido`. |

:::caution[⚠️ Nota: `EnsureCreated` vs migraciones]
En una aplicación real en producción usarías `dotnet ef migrations add NombreMigracion` para
generar scripts versionados de cambios de esquema, y aplicarlos con `dotnet ef database
update`. Eso te permite evolucionar el esquema sin perder datos. `EnsureCreated()` es más
simple pero no lleva historial — si cambias el modelo después, tendrías que borrar la base y
recrearla. Es la elección correcta para aprender el concepto; migraciones es la elección
correcta para un proyecto real.
:::

## 5.3 Instalar los paquetes NuGet

Desde la carpeta `Backend.Api`:

```bash title="terminal"
dotnet add package Microsoft.EntityFrameworkCore.Sqlite
dotnet add package Microsoft.EntityFrameworkCore.Design
```

## 5.4 El DbContext: modelando el objeto anidado

Este es el punto más interesante de esta parte: `Pedido` tiene un `Cliente` anidado, pero una
tabla SQL no tiene "objetos anidados" — solo columnas. EF Core resuelve esto con `OwnsOne`: le
dice "el `Cliente` de un `Pedido` no es una tabla aparte, guárdalo como columnas dentro de la
misma fila".

```csharp title="Data/PedidoDbContext.cs"
using Backend.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Api.Data;

public class PedidoDbContext : DbContext
{
    public PedidoDbContext(DbContextOptions<PedidoDbContext> options) : base(options) { }

    public DbSet<Pedido> Pedidos => Set<Pedido>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Cliente no tiene tabla propia: EF Core lo guarda como columnas
        // dentro de la misma fila de Pedidos (Cliente_Nombre, Cliente_Email).
        modelBuilder.Entity<Pedido>().OwnsOne(p => p.Cliente);
    }
}
```

Cuando EF Core crea la tabla a partir de este modelo, genera exactamente esto:

```sql title="Resultado esperado — SQL generado al arrancar la app"
CREATE TABLE "Pedidos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pedidos" PRIMARY KEY AUTOINCREMENT,
    "Fecha" TEXT NOT NULL,
    "Total" TEXT NOT NULL,
    "Cliente_Nombre" TEXT NOT NULL,
    "Cliente_Email" TEXT NOT NULL
);
```

Una sola tabla, con el objeto anidado "aplanado" en dos columnas con prefijo
(`Cliente_Nombre`, `Cliente_Email`). El id ahora es `AUTOINCREMENT` — es la base de datos, no
tu código C#, quien asigna el siguiente id.

## 5.5 El nuevo servicio: CRUD real, fila por fila

Con archivos, `PedidoService` tenía que leer *toda* la lista, modificarla en memoria, y
reescribir *todo* el archivo — incluso para cambiar un solo pedido. Con una base de datos ya no
hace falta: cada operación toca solo la fila que necesita.

Para lograr esto sin romper el controlador, primero se extrajo una interfaz común
`IPedidoService` a partir del `PedidoService` original (ver Parte 1):

```csharp title="Services/IPedidoService.cs"
public interface IPedidoService
{
    Task<List<Pedido>> ObtenerTodosAsync();
    Task<Pedido?> ObtenerPorIdAsync(int id);
    Task<Pedido> CrearAsync(Pedido nuevoPedido);
    Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado);
    Task<bool> EliminarAsync(int id);
}
```

`PedidoService` (la versión de archivos) ahora implementa esta interfaz sin cambiar su
comportamiento. Y junto a ella, una segunda implementación completamente distinta por dentro,
pero con el mismo contrato:

```csharp title="Services/PedidoSqliteService.cs"
using Backend.Api.Data;
using Backend.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Api.Services;

public class PedidoSqliteService : IPedidoService
{
    private readonly PedidoDbContext _db;

    public PedidoSqliteService(PedidoDbContext db) { _db = db; }

    public async Task<List<Pedido>> ObtenerTodosAsync() =>
        await _db.Pedidos.AsNoTracking().ToListAsync();

    public async Task<Pedido?> ObtenerPorIdAsync(int id) =>
        await _db.Pedidos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Pedido> CrearAsync(Pedido nuevoPedido)
    {
        if (nuevoPedido.Fecha == default) nuevoPedido.Fecha = DateTime.Now;
        nuevoPedido.Id = null; // el Id lo asigna SQLite (autoincremental)
        _db.Pedidos.Add(nuevoPedido);
        await _db.SaveChangesAsync();
        return nuevoPedido;
    }

    public async Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado)
    {
        var existente = await _db.Pedidos.FirstOrDefaultAsync(p => p.Id == id);
        if (existente == null) return false;

        existente.Fecha = pedidoActualizado.Fecha;
        existente.Total = pedidoActualizado.Total;
        existente.Cliente.Nombre = pedidoActualizado.Cliente.Nombre;
        existente.Cliente.Email = pedidoActualizado.Cliente.Email;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EliminarAsync(int id)
    {
        var existente = await _db.Pedidos.FirstOrDefaultAsync(p => p.Id == id);
        if (existente == null) return false;

        _db.Pedidos.Remove(existente);
        await _db.SaveChangesAsync();
        return true;
    }
}
```

:::note[💡 Concepto: `AsNoTracking` y por qué Actualizar no lo usa]
EF Core normalmente *rastrea* cada entidad que lee, para poder detectar qué cambió cuando
llames a `SaveChangesAsync()`. En `ObtenerTodosAsync` y `ObtenerPorIdAsync` solo estamos
*leyendo* — no vamos a modificar nada, así que `AsNoTracking()` le dice a EF Core "no te
molestes en rastrear esto", lo cual es más rápido. En cambio, en `ActualizarAsync` sí
necesitamos que EF Core rastree la entidad `existente`: al modificar sus propiedades y llamar
`SaveChangesAsync()`, EF Core detecta solo los campos que cambiaron y genera un `UPDATE` con
exactamente esos campos.
:::

## 5.6 Activar SQLite en Program.cs

Igual que elegías entre JSON y XML en la Parte 1, ahora tienes una tercera opción. Comenta la
Opción 1 y descomenta la Opción 3:

```csharp title="Program.cs"
// Opción 1: archivo JSON (por defecto)
// builder.Services.AddScoped<IPedidoStorageStrategy, JsonPedidoStorageStrategy>();
// builder.Services.AddScoped<IPedidoService, PedidoService>();

// Opción 3: base de datos SQLite
builder.Services.AddDbContext<PedidoDbContext>(options =>
    options.UseSqlite("Data Source=Data/pedidos.db"));
builder.Services.AddScoped<IPedidoService, PedidoSqliteService>();
```

Y justo después de construir la app, este bloque crea el archivo `pedidos.db` y su tabla la
primera vez que arranca:

```csharp title="Program.cs"
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetService<PedidoDbContext>();
    db?.Database.EnsureCreated();
}
```

:::note[💡 Por qué esto funciona sin tocar el controlador]
`PedidosController` depende de `IPedidoService`, no de `PedidoService` ni de
`PedidoSqliteService` directamente (revisa la Parte 1). Por eso, cambiar qué implementación
concreta se registra en `Program.cs` es suficiente — es el mismo principio de inversión de
dependencias que ya viste con la estrategia JSON/XML, aplicado un nivel más arriba.
:::

## 5.7 Prueba el CRUD mínimo contra la base de datos

Levanta la API (`dotnet run`) y repite las mismas pruebas de la Parte 1 — el comportamiento
HTTP es idéntico, solo cambió qué hay detrás:

```bash title="terminal"
curl -X POST http://localhost:5000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-01-15T10:30:00","total":150.50,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}'
```

```json title="Resultado real, verificado contra SQLite"
{"id":1,"fecha":"2026-01-15T10:30:00","total":150.50,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}
```

```bash title="terminal"
curl -X PUT http://localhost:5000/api/pedidos/1 \
  -H "Content-Type: application/json" \
  -d '{"id":1,"fecha":"2026-01-15T10:30:00","total":999.99,"cliente":{"nombre":"Ana M. Editado","email":"ana2@example.com"}}'

curl http://localhost:5000/api/pedidos/1
```

```json title="Resultado real — tras el PUT, el GET refleja el cambio"
{"id":1,"fecha":"2026-01-15T10:30:00","total":999.99,"cliente":{"nombre":"Ana M. Editado","email":"ana2@example.com"}}
```

```bash title="terminal"
curl -X DELETE http://localhost:5000/api/pedidos/1
curl http://localhost:5000/api/pedidos
```

```json title="Resultado real — tras el DELETE, la lista queda vacía"
[]
```

Este es exactamente el mismo CRUD mínimo (crear, leer, actualizar, eliminar) que probaste con
archivos en la Parte 1 — con la misma API, los mismos endpoints, el mismo formato JSON. La
diferencia completa está del otro lado de `IPedidoService`, invisible para cualquier cliente
HTTP, incluido tu frontend Vue o Angular.

:::tip[📝 Ejercicio 5.1 — Activa SQLite y corre tu frontend encima]
1. Cambia `Program.cs` a la Opción 3, borra `Data/pedidos.db` si ya existía de una prueba anterior, y levanta la API.
2. Sin cambiar nada del frontend (Vue o Angular), ábrelo y crea/edita/elimina pedidos normalmente.
3. Con un visor de SQLite (por ejemplo, la extensión "SQLite Viewer" de VS Code, o `sqlite3 Data/pedidos.db` por terminal), abre `pedidos.db` y confirma que ves tus filas reales en la tabla `Pedidos`.
:::

:::tip[📝 Ejercicio 5.2 — Rompe algo a propósito, para entenderlo]
Comenta la línea `modelBuilder.Entity<Pedido>().OwnsOne(p => p.Cliente);` en `PedidoDbContext`
y vuelve a arrancar la API contra una base nueva. Lee el error que lanza EF Core al intentar
crear el modelo. ¿Por qué EF Core no puede simplemente "adivinar" que `Cliente` debe guardarse
como columnas en vez de como su propia tabla?
:::

:::tip[📝 Ejercicio 5.3 — Migraciones (opcional, más avanzado)]
Investiga y prueba el flujo con migraciones en vez de `EnsureCreated()`: `dotnet tool install
--global dotnet-ef`, luego `dotnet ef migrations add InicialSqlite` y `dotnet ef database
update`. Compara la tabla que genera la migración con la que generó `EnsureCreated()` —
deberían ser equivalentes.
:::

:::tip[📝 Ejercicio 5.4 — Una consulta que los archivos no te daban gratis]
Agrega temporalmente un endpoint `GET /api/pedidos/resumen` que devuelva el total sumado de
todos los pedidos usando LINQ: `await _db.Pedidos.SumAsync(p => p.Total)`. Con archivos,
tendrías que leer y sumar toda la lista en C# a mano; con EF Core, la suma la calcula la base
de datos.
:::

## 5.8 Vuelve a JSON cuando quieras

Como sigue siendo el patrón Strategy, revertir es tan simple como comentar la Opción 3 y
descomentar la Opción 1 en `Program.cs`. Los archivos `pedidos.json` y `pedidos.db` conviven
sin conflicto — solo uno está activo a la vez, según qué registres en el contenedor de
dependencias.
