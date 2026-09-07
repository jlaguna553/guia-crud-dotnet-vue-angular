---
title: "Parte 1: El backend en .NET"
description: Crea desde cero una API REST en ASP.NET Core, con controladores, modelos y el patrón Strategy para el almacenamiento.
---

En esta parte vas a crear, desde una carpeta vacía, la API REST que el resto de la guía va a
consumir. Al terminar tendrás un proyecto `Backend.Api` funcionando de verdad — no es teoría,
cada sección termina con código que corre.

## 1.1 ¿Qué es una API REST?

Una API (Application Programming Interface) es simplemente una forma en la que un programa le
ofrece funcionalidad a otro programa. Una **API REST** es una API que se expone sobre HTTP — el
mismo protocolo que usa tu navegador para pedir páginas web — usando URLs para identificar
recursos y **verbos HTTP** para decir qué quieres hacer con ese recurso.

| Verbo HTTP | Significa | En la API que vas a construir |
|---|---|---|
| `GET` | Leer datos, sin modificar nada | `GET /api/pedidos` → lista todos los pedidos |
| `GET` con id | Leer un recurso específico | `GET /api/pedidos/3` → el pedido con id 3 |
| `POST` | Crear un recurso nuevo | `POST /api/pedidos` → crea un pedido |
| `PUT` | Reemplazar/actualizar un recurso existente | `PUT /api/pedidos/3` → actualiza el pedido 3 |
| `DELETE` | Eliminar un recurso | `DELETE /api/pedidos/3` → borra el pedido 3 |

Los datos van a viajar como **JSON** (JavaScript Object Notation), un formato de texto para
representar objetos que es fácil de leer tanto para humanos como para programas. Así es como se
va a ver un pedido una vez que termines esta parte:

```json title="ejemplo — un pedido, en JSON"
{
  "id": 1,
  "fecha": "2026-01-15T10:30:00",
  "total": 150.50,
  "cliente": {
    "nombre": "Ana Martínez",
    "email": "ana@example.com"
  }
}
```

:::note[💡 Concepto: códigos de estado HTTP]
Cada respuesta HTTP trae un código numérico que indica qué pasó. Los que vas a usar en esta
API:
- **200 OK** — la petición funcionó y trae datos (GET).
- **201 Created** — se creó un recurso nuevo (POST exitoso).
- **204 No Content** — funcionó, pero no hay nada que devolver (PUT/DELETE exitosos).
- **404 Not Found** — pediste un recurso que no existe (ej. un id inválido).
:::

## 1.2 Crea el proyecto

Necesitas el [.NET SDK](https://dotnet.microsoft.com/download) instalado (`dotnet --version`
para confirmarlo). En una carpeta vacía para tu proyecto, ejecuta:

```bash title="terminal"
dotnet new webapi -n Backend.Api -controllers
cd Backend.Api
```

El flag `-controllers` le dice al template que genere **controladores** (el estilo que vamos a
usar en toda la guía) en vez de Minimal APIs. El comando generó una API de ejemplo
("WeatherForecast") para que veas que todo corre — pruébala antes de tocar nada:

```bash title="terminal"
dotnet run
```

Deberías ver un mensaje indicando en qué puerto quedó escuchando. Detén el servidor (Ctrl+C)
cuando confirmes que arrancó — vamos a reemplazar ese ejemplo por nuestra propia API.

```bash title="terminal — limpia el ejemplo generado"
rm Controllers/WeatherForecastController.cs WeatherForecast.cs
```

Este es el destino al que vas a llegar en esta parte:

```text title="estructura final de Backend.Api"
Backend.Api/
├── Program.cs                  # arranque de la app, configuración de servicios
├── Controllers/
│   └── PedidosController.cs    # recibe las peticiones HTTP
├── Models/
│   └── Pedidos.cs              # las clases Pedido y Cliente
├── Services/
│   ├── IPedidoService.cs       # el contrato: qué operaciones existen
│   ├── PedidoService.cs        # implementación basada en archivos
│   ├── IPedidoStorageStrategy.cs
│   ├── JsonPedidoStorageStrategy.cs
│   └── XmlPedidoStorageStrategy.cs
└── Data/
    └── pedidos.json            # donde van a vivir los datos, por defecto
```

## 1.3 Los modelos: Pedido y Cliente

Un modelo es simplemente una clase que describe la **forma** de un dato. Aquí es donde vive el
"objeto anidado" del que hablábamos en la introducción: un `Pedido` va a tener dentro un
`Cliente` completo, no solo un nombre suelto.

```csharp title="Models/Pedidos.cs"
using System.Text.Json.Serialization;
using System.Xml.Serialization;

namespace Backend.Api.Models;

public class Cliente
{
    [JsonPropertyName("nombre")]
    [XmlElement("Nombre")]
    public string Nombre { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    [XmlElement("Email")]
    public string Email { get; set; } = string.Empty;
}

public class Pedido
{
    [JsonPropertyName("id")]
    [XmlElement("Id")]
    public int? Id { get; set; }

    [JsonPropertyName("fecha")]
    [XmlElement("Fecha")]
    public DateTime Fecha { get; set; }

    [JsonPropertyName("total")]
    [XmlElement("Total")]
    public decimal Total { get; set; } // decimal, no float: precisión para dinero

    [JsonPropertyName("cliente")]
    [XmlElement("Cliente")]
    public Cliente Cliente { get; set; } = new();
}
```

:::caution[⚠️ Nota: por qué `decimal` y no `float` o `double`]
`float` y `double` guardan números en binario, y muchas cantidades decimales "exactas" para
nosotros (como 0.1) no tienen una representación binaria exacta. Sumar dinero con `float` puede
dar resultados como `150.49999999` en vez de `150.50`. `decimal` existe específicamente para
evitar ese problema en cálculos financieros — úsalo siempre que el número represente dinero.
:::

:::tip[📝 Ejercicio 1.1 — Crea los modelos]
Crea la carpeta `Models/` y dentro el archivo `Pedidos.cs` con el código de arriba. Compila para
confirmar que no hay errores: `dotnet build`.
:::

## 1.4 El patrón Strategy: una interfaz para el almacenamiento

Antes de decidir *dónde* vamos a guardar los pedidos (¿un archivo? ¿una base de datos?),
definimos *qué* operaciones necesita cualquier forma de guardarlos: leer todos, y guardar
todos. Esto es una interfaz — un contrato que cualquier implementación futura debe cumplir.

```csharp title="Services/IPedidoStorageStrategy.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

public interface IPedidoStorageStrategy
{
    Task<List<Pedido>> LeerPedidosAsync();
    Task GuardarPedidosAsync(List<Pedido> pedidos);
}
```

Ahora una primera implementación, que guarda todo en un archivo JSON:

```csharp title="Services/JsonPedidoStorageStrategy.cs"
using System.Text.Json;
using Backend.Api.Models;

namespace Backend.Api.Services;

public class JsonPedidoStorageStrategy : IPedidoStorageStrategy
{
    private readonly string _filePath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "pedidos.json");

    public async Task<List<Pedido>> LeerPedidosAsync()
    {
        if (!File.Exists(_filePath)) return new List<Pedido>();
        var json = await File.ReadAllTextAsync(_filePath);
        return JsonSerializer.Deserialize<List<Pedido>>(json) ?? new List<Pedido>();
    }

    public async Task GuardarPedidosAsync(List<Pedido> pedidos)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(pedidos, options);
        await File.WriteAllTextAsync(_filePath, json);
    }
}
```

Esto es el **patrón Strategy**: encapsular un algoritmo intercambiable (aquí, "cómo persisto
una lista de pedidos") detrás de una interfaz común, para poder cambiarlo sin tocar el código
que lo usa. Guarda bien esta idea — es exactamente el mecanismo que te va a permitir enchufar
SQLite más adelante, en la [Parte 5](/guia/parte-5-sqlite/), sin romper nada.

:::tip[📝 Ejercicio 1.2 — Crea la estrategia de almacenamiento]
1. Crea la carpeta `Services/` con `IPedidoStorageStrategy.cs` y `JsonPedidoStorageStrategy.cs`.
2. Crea la carpeta `Data/` (vacía por ahora — se llenará sola cuando guardes el primer pedido).
3. Reto opcional: escribe también `XmlPedidoStorageStrategy.cs`, con el mismo contrato pero serializando a `Data/pedidos.xml` usando `System.Xml.Serialization.XmlSerializer`. Vas a necesitarlo si más adelante quieres comparar formatos de almacenamiento.
:::

## 1.5 El servicio: la lógica de negocio del CRUD

`IPedidoStorageStrategy` solo sabe leer y escribir *toda* la lista. El servicio es quien
traduce eso en operaciones puntuales: obtener uno por id, crear (asignando el siguiente id
disponible), actualizar, eliminar. Primero el contrato:

```csharp title="Services/IPedidoService.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

public interface IPedidoService
{
    Task<List<Pedido>> ObtenerTodosAsync();
    Task<Pedido?> ObtenerPorIdAsync(int id);
    Task<Pedido> CrearAsync(Pedido nuevoPedido);
    Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado);
    Task<bool> EliminarAsync(int id);
}
```

Y la implementación, que por dentro usa la estrategia de almacenamiento que le inyectes:

```csharp title="Services/PedidoService.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

public class PedidoService : IPedidoService
{
    private readonly IPedidoStorageStrategy _storage;

    public PedidoService(IPedidoStorageStrategy storage)
    {
        _storage = storage;
    }

    public async Task<List<Pedido>> ObtenerTodosAsync() => await _storage.LeerPedidosAsync();

    public async Task<Pedido?> ObtenerPorIdAsync(int id)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        return pedidos.FirstOrDefault(p => p.Id == id);
    }

    public async Task<Pedido> CrearAsync(Pedido nuevoPedido)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        nuevoPedido.Id = pedidos.Any() ? pedidos.Max(p => p.Id) + 1 : 1;

        if (nuevoPedido.Fecha == default) nuevoPedido.Fecha = DateTime.Now;

        pedidos.Add(nuevoPedido);
        await _storage.GuardarPedidosAsync(pedidos);
        return nuevoPedido;
    }

    public async Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        var index = pedidos.FindIndex(p => p.Id == id);
        if (index == -1) return false;

        pedidoActualizado.Id = id;
        pedidos[index] = pedidoActualizado;
        await _storage.GuardarPedidosAsync(pedidos);
        return true;
    }

    public async Task<bool> EliminarAsync(int id)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        var pedido = pedidos.FirstOrDefault(p => p.Id == id);
        if (pedido == null) return false;

        pedidos.Remove(pedido);
        await _storage.GuardarPedidosAsync(pedidos);
        return true;
    }
}
```

:::tip[📝 Ejercicio 1.3 — Crea el servicio]
Agrega `IPedidoService.cs` y `PedidoService.cs` a `Services/`. Fíjate que `PedidoService`
depende de `IPedidoStorageStrategy` — la interfaz de la sección anterior, no de
`JsonPedidoStorageStrategy` directamente. Todavía no va a compilar solo (falta conectarlo,
sección 1.7) — es normal.
:::

## 1.6 El controlador: la puerta de entrada HTTP

El controlador traduce cada verbo/URL en una llamada al servicio. Fíjate que no sabe nada de
archivos, JSON, ni bases de datos — solo conoce `IPedidoService`, una interfaz.

```csharp title="Controllers/PedidosController.cs"
using Backend.Api.Models;
using Backend.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly IPedidoService _pedidoService;

    public PedidosController(IPedidoService pedidoService)
    {
        _pedidoService = pedidoService;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var pedidos = await _pedidoService.ObtenerTodosAsync();
        return Ok(pedidos);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPorId(int id)
    {
        var pedido = await _pedidoService.ObtenerPorIdAsync(id);
        if (pedido == null) return NotFound();
        return Ok(pedido);
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] Pedido pedido)
    {
        var creado = await _pedidoService.CrearAsync(pedido);
        return CreatedAtAction(nameof(GetPorId), new { id = creado.Id }, creado);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, [FromBody] Pedido pedido)
    {
        var exito = await _pedidoService.ActualizarAsync(id, pedido);
        if (!exito) return NotFound();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var exito = await _pedidoService.EliminarAsync(id);
        if (!exito) return NotFound();
        return NoContent();
    }
}
```

:::note[💡 Concepto: inyección de dependencias]
Fíjate que `PedidosController` recibe un `IPedidoService` por su constructor — no lo crea él
mismo con `new PedidoService()`. Esto se llama **inyección de dependencias**: en vez de que
cada clase construya lo que necesita, se lo "inyecta" un contenedor central que vas a configurar
en la próxima sección. La ventaja: el controlador depende de una *interfaz* (un contrato), no de
una implementación concreta. Vas a poder cambiar qué implementación se usa sin tocar el
controlador — exactamente lo que vas a hacer en la [Parte 5](/guia/parte-5-sqlite/) para pasar
de archivos a SQLite.
:::

:::tip[📝 Ejercicio 1.4 — Crea el controlador]
Crea la carpeta `Controllers/` con `PedidosController.cs`. Sigue sin compilar — falta el último
paso.
:::

## 1.7 Conecta todo en Program.cs

`dotnet new webapi` generó un `Program.cs` con código de ejemplo. Reemplaza su contenido
completo por este:

```csharp title="Program.cs"
using Backend.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// REGISTRO DE ESTRATEGIA (Intercambiable entre JSON y XML)
builder.Services.AddScoped<IPedidoStorageStrategy, JsonPedidoStorageStrategy>();
// builder.Services.AddScoped<IPedidoStorageStrategy, XmlPedidoStorageStrategy>();

builder.Services.AddScoped<IPedidoService, PedidoService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVue", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

app.UseCors("AllowVue");
app.MapControllers();

app.Run("http://0.0.0.0:5000");
```

Este es el corazón del patrón Strategy en acción: **una sola línea decide si guardas en JSON o
en XML**, y ninguna otra clase del proyecto necesita cambiar para que eso funcione.

:::tip[📝 Ejercicio 1.5 — Conecta el proyecto]
Reemplaza `Program.cs` con el código de arriba y compila: `dotnet build`. Si te quedó algún
`using` de más de la plantilla original, el compilador te lo va a señalar — bórralo.
:::

## 1.8 Levanta la API y pruébala

```bash title="terminal"
dotnet run
```

Deberías ver un mensaje indicando que la app escucha en `http://0.0.0.0:5000`. Déjala corriendo
y, en otra terminal, prueba los distintos verbos con `curl`:

```bash title="terminal"
# Listar (al principio, un array vacío: [])
curl http://localhost:5000/api/pedidos

# Crear un pedido
curl -X POST http://localhost:5000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-01-15T10:30:00","total":150.50,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}'
```

```json title="Resultado esperado en la terminal"
{"id":1,"fecha":"2026-01-15T10:30:00","total":150.50,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}
```

Fíjate que tú no enviaste `id` — la API lo asignó sola (mira `CrearAsync` en `PedidoService`:
calcula el siguiente id disponible). Este es un principio importante de REST: el servidor es
quien decide la identidad de los recursos que crea. Y si abres `Data/pedidos.json`, ahí está tu
pedido guardado — el archivo lo creó `JsonPedidoStorageStrategy` la primera vez que guardaste algo.

:::tip[📝 Ejercicio 1.6 — Prueba el CRUD completo por curl]
Con la API corriendo, ejecuta en orden (reemplaza `<ID>` por el id que te devolvió el POST):
1. `GET /api/pedidos` — confirma que tu pedido aparece en la lista.
2. `PUT /api/pedidos/<ID>` con un body completo cambiando el `total`.
3. `GET /api/pedidos/<ID>` — confirma que el total cambió.
4. `DELETE /api/pedidos/<ID>` y vuelve a hacer `GET` — confirma que ya no está.
:::

:::tip[📝 Ejercicio 1.7 — Explícalo con tus propias palabras]
Sin mirar esta guía, escribe en un comentario o en un papel qué hace cada uno de los 5 métodos
de `PedidoService`. Luego compara con lo que escribiste tú mismo en la sección 1.5. Forzarte a
explicar tu propio código es una de las mejores formas de comprobar si realmente lo entendiste.
:::

## 1.9 CORS: por qué el frontend va a poder llamar a esta API

Un detalle que vas a necesitar en la Parte 3: por defecto, los navegadores bloquean que una
página en `http://localhost:5173` (Vue) o `http://localhost:4200` (Angular) haga peticiones a
`http://localhost:5000` (otro "origen"), por razones de seguridad. Esto se llama política de
**CORS** (Cross-Origin Resource Sharing). Ya la habilitaste en la sección 1.7:

```csharp title="Program.cs (repaso)"
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVue", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});
// ...
app.UseCors("AllowVue");
```

:::caution[⚠️ Nota para producción]
`AllowAnyOrigin()` es perfecto para aprender, pero en una app real restringirías la política a
los dominios exactos de tu frontend (por ejemplo, `policy.WithOrigins("https://mi-app.com")`),
para que ningún sitio arbitrario pueda leer tu API desde el navegador de un usuario.
:::

Con la API funcionando, sigue a la [Parte 2](/guia/parte-2-elige-camino/) para elegir con qué
framework vas a construir la interfaz que la consume.
