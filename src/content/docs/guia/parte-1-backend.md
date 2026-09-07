---
title: "Parte 1: El backend en .NET"
description: API REST en ASP.NET Core, controladores, modelos y el patrón Strategy para el almacenamiento.
---

Antes de escribir una sola línea de frontend, necesitas entender con qué vas a hablar. En esta
parte exploramos `Backend.Api`, la API REST que ya existe en el proyecto.

## 1.1 ¿Qué es una API REST?

Una API (Application Programming Interface) es simplemente una forma en la que un programa le
ofrece funcionalidad a otro programa. Una **API REST** es una API que se expone sobre HTTP — el
mismo protocolo que usa tu navegador para pedir páginas web — usando URLs para identificar
recursos y **verbos HTTP** para decir qué quieres hacer con ese recurso.

| Verbo HTTP | Significa | En nuestra API |
|---|---|---|
| `GET` | Leer datos, sin modificar nada | `GET /api/pedidos` → lista todos los pedidos |
| `GET` con id | Leer un recurso específico | `GET /api/pedidos/3` → el pedido con id 3 |
| `POST` | Crear un recurso nuevo | `POST /api/pedidos` → crea un pedido |
| `PUT` | Reemplazar/actualizar un recurso existente | `PUT /api/pedidos/3` → actualiza el pedido 3 |
| `DELETE` | Eliminar un recurso | `DELETE /api/pedidos/3` → borra el pedido 3 |

Los datos viajan como **JSON** (JavaScript Object Notation), un formato de texto para
representar objetos que es fácil de leer tanto para humanos como para programas:

```json title="un pedido, en JSON"
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
Cada respuesta HTTP trae un código numérico que indica qué pasó. Los que vas a ver en esta API:
- **200 OK** — la petición funcionó y trae datos (GET).
- **201 Created** — se creó un recurso nuevo (POST exitoso).
- **204 No Content** — funcionó, pero no hay nada que devolver (PUT/DELETE exitosos).
- **404 Not Found** — pediste un recurso que no existe (ej. un id inválido).
:::

## 1.2 Anatomía de Backend.Api

El proyecto sigue una separación de responsabilidades típica de una API en ASP.NET Core:

```text title="estructura"
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
    └── pedidos.json            # donde viven los datos, por defecto
```

### Los modelos: Pedido y Cliente

Un modelo es simplemente una clase que describe la **forma** de un dato. Aquí es donde vive el
"objeto anidado" del que hablábamos en la introducción: un `Pedido` tiene dentro un `Cliente`
completo, no solo un nombre suelto.

```csharp title="Models/Pedidos.cs"
public class Cliente
{
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class Pedido
{
    public int? Id { get; set; }
    public DateTime Fecha { get; set; }
    public decimal Total { get; set; }   // decimal, no float: precisión para dinero
    public Cliente Cliente { get; set; } = new();
}
```

:::caution[⚠️ Nota: por qué `decimal` y no `float` o `double`]
`float` y `double` guardan números en binario, y muchas cantidades decimales "exactas" para
nosotros (como 0.1) no tienen una representación binaria exacta. Sumar dinero con `float` puede
dar resultados como `150.49999999` en vez de `150.50`. `decimal` existe específicamente para
evitar ese problema en cálculos financieros — úsalo siempre que el número represente dinero.
:::

### El controlador: PedidosController

El controlador es la puerta de entrada HTTP: traduce cada verbo/URL en una llamada a la lógica
de negocio, y esa lógica vive en un *servicio*, no en el controlador. Fíjate que el controlador
no sabe nada de archivos, JSON, ni SQLite — solo conoce `IPedidoService`, una interfaz.

```csharp title="Controllers/PedidosController.cs"
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

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] Pedido pedido)
    {
        var creado = await _pedidoService.CrearAsync(pedido);
        return CreatedAtAction(nameof(GetPorId), new { id = creado.Id }, creado);
    }

    // ...GetPorId, Put y Delete siguen el mismo patrón
}
```

:::note[💡 Concepto: inyección de dependencias]
Fíjate que `PedidosController` recibe un `IPedidoService` por su constructor — no lo crea él
mismo con `new PedidoService()`. Esto se llama **inyección de dependencias**: en vez de que
cada clase construya lo que necesita, se lo "inyecta" un contenedor central (configurado en
`Program.cs`). La ventaja: el controlador depende de una *interfaz* (un contrato), no de una
implementación concreta. Puedes cambiar qué implementación se usa sin tocar el controlador —
exactamente lo que vas a hacer en la [Parte 5](/guia/parte-5-sqlite/) para pasar de archivos a SQLite.
:::

## 1.3 El patrón Strategy: intercambiar cómo se guardan los datos

`IPedidoService` define *qué* operaciones existen (obtener todos, crear, actualizar,
eliminar...). `PedidoService` es la implementación por defecto, que a su vez delega el *cómo*
guardar en un `IPedidoStorageStrategy`:

```csharp title="Services/IPedidoStorageStrategy.cs"
public interface IPedidoStorageStrategy
{
    Task<List<Pedido>> LeerPedidosAsync();
    Task GuardarPedidosAsync(List<Pedido> pedidos);
}
```

Este contrato tiene hoy dos implementaciones intercambiables: `JsonPedidoStorageStrategy` (lee/escribe `Data/pedidos.json`) y `XmlPedidoStorageStrategy` (lee/escribe `Data/pedidos.xml`), mismo contrato.

```csharp title="Services/JsonPedidoStorageStrategy.cs"
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
        var json = JsonSerializer.Serialize(pedidos, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_filePath, json);
    }
}
```

Y en `Program.cs`, se elige cuál estrategia usar registrándola en el contenedor de
dependencias — es literalmente una línea la que decide si guardas en JSON o en XML:

```csharp title="Program.cs"
// Opción 1: archivo JSON (por defecto)
builder.Services.AddScoped<IPedidoStorageStrategy, JsonPedidoStorageStrategy>();
builder.Services.AddScoped<IPedidoService, PedidoService>();

// Opción 2: archivo XML
// builder.Services.AddScoped<IPedidoStorageStrategy, XmlPedidoStorageStrategy>();
// builder.Services.AddScoped<IPedidoService, PedidoService>();
```

Esto es el **patrón Strategy**: encapsular un algoritmo intercambiable (aquí, "cómo persisto
una lista de pedidos") detrás de una interfaz común, para poder cambiarlo sin tocar el código
que lo usa. Guarda bien esta idea — es exactamente el mecanismo que te va a permitir enchufar
SQLite en la Parte 5 sin romper nada.

## 1.4 Levanta la API y pruébala

Desde la carpeta `Backend.Api`, ejecuta:

```bash
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
quien decide la identidad de los recursos que crea.

:::tip[📝 Ejercicio 1.1 — Prueba el CRUD completo por curl]
Con la API corriendo, ejecuta en orden (reemplaza `<ID>` por el id que te devolvió el POST):
1. `GET /api/pedidos` — confirma que tu pedido aparece en la lista.
2. `PUT /api/pedidos/<ID>` con un body completo cambiando el `total`.
3. `GET /api/pedidos/<ID>` — confirma que el total cambió.
4. `DELETE /api/pedidos/<ID>` y vuelve a hacer `GET` — confirma que ya no está.

Tip: también puedes abrir `Backend.Api.http` en VS Code con la extensión REST Client, en vez de escribir curl a mano.
:::

:::tip[📝 Ejercicio 1.2 — Léelo con tus propias palabras]
Abre `Services/PedidoService.cs` y, sin mirar esta guía, escribe en un comentario o en un papel
qué hace cada uno de sus 5 métodos. Luego compara con lo que leíste aquí. Forzarte a explicar
código ajeno es una de las mejores formas de comprobar si realmente lo entendiste.
:::

## 1.5 CORS: por qué el frontend sí puede llamar a esta API

Un detalle que vas a necesitar en la Parte 3: por defecto, los navegadores bloquean que una
página en `http://localhost:5173` (Vue) o `http://localhost:4200` (Angular) haga peticiones a
`http://localhost:5000` (otro "origen"), por razones de seguridad. Esto se llama política de
**CORS** (Cross-Origin Resource Sharing). `Program.cs` ya la habilita explícitamente para este
proyecto de aprendizaje:

```csharp title="Program.cs"
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
