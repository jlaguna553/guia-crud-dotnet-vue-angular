---
title: "Parte 1: El backend en .NET"
description: Crea desde cero, paso a paso, una API REST en ASP.NET Core — primero con datos en memoria, luego persistentes.
---

En esta parte vas a crear, desde una carpeta vacía, la API REST que el resto de la guía va a
consumir. Vamos a ir despacio: en cada sección agregas un poco de código, corres la aplicación,
y revisas el resultado real en la terminal antes de seguir. Nada de pegar todos los archivos de
una vez — si un paso no funciona, lo vas a notar de inmediato porque el paso anterior sí corría.

Además de la explicación en prosa, el código de esta guía trae **comentarios línea por línea**
explicando qué hace cada parte y por qué se escribió así — léelos, no los borres al copiar.

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

:::note[💡 Concepto: códigos de estado HTTP]
Cada respuesta HTTP trae un código numérico que indica qué pasó. Los que vas a usar en esta
API: **200 OK** (la petición funcionó y trae datos), **201 Created** (se creó un recurso
nuevo), **204 No Content** (funcionó, pero no hay nada que devolver) y **404 Not Found**
(pediste un recurso que no existe).
:::

## 1.2 Crea el proyecto y confirma que arranca

Necesitas el [.NET SDK](https://dotnet.microsoft.com/download) instalado
(`dotnet --version` para confirmarlo). En una carpeta vacía para tu proyecto, ejecuta:

```bash title="terminal"
dotnet new webapi -n Backend.Api -controllers
cd Backend.Api
dotnet run
```

El comando generó una API de ejemplo ("WeatherForecast"). Antes de tocar nada, confirma que
corre: abre otra terminal y ejecuta:

```bash title="terminal (segunda ventana)"
curl http://localhost:5000/weatherforecast
```

Deberías recibir un array JSON con datos falsos de clima. Si ves eso, tu entorno está bien
configurado. Detén el servidor (`Ctrl+C` en la primera terminal) y borra el ejemplo — lo vamos
a reemplazar por nuestra propia API:

```bash title="terminal"
rm Controllers/WeatherForecastController.cs WeatherForecast.cs
```

## 1.3 El primer endpoint: datos hardcodeados

Vamos a construir de adentro hacia afuera: primero un endpoint que responde con datos fijos
escritos directamente en el código (sin archivos, sin base de datos), para tener algo que
*corre y responde* lo antes posible. Vamos a mejorar esto en cada sección siguiente.

Primero, el modelo — la forma de un pedido. Este es el objeto anidado del que hablábamos en la
introducción: un `Pedido` tiene dentro un `Cliente` completo, no solo un nombre suelto.

```csharp title="Models/Pedidos.cs"
namespace Backend.Api.Models; // agrupa las clases de este archivo bajo un mismo espacio de nombres

public class Cliente
{
    // "{ get; set; }" (propiedad automática) expone el campo para leer y escribir;
    // "= string.Empty" le da un valor inicial para que nunca sea null.
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class Pedido
{
    public int? Id { get; set; } // "int?" (nullable): un pedido nuevo aún no tiene id — lo asigna el backend
    public DateTime Fecha { get; set; }
    public decimal Total { get; set; } // decimal, no float: precisión exacta para dinero (ver nota abajo)
    public Cliente Cliente { get; set; } = new(); // objeto anidado: cada Pedido "contiene" un Cliente completo
}
```

:::caution[⚠️ Nota: por qué `decimal` y no `float` o `double`]
`float` y `double` guardan números en binario, y muchas cantidades decimales "exactas" para
nosotros (como 0.1) no tienen una representación binaria exacta. Sumar dinero con `float` puede
dar resultados como `150.49999999` en vez de `150.50`. `decimal` existe específicamente para
evitar ese problema en cálculos financieros.
:::

Ahora el controlador, con dos pedidos escritos a mano y un único endpoint:

```csharp title="Controllers/PedidosController.cs"
using Backend.Api.Models; // para poder usar las clases Pedido y Cliente definidas arriba
using Microsoft.AspNetCore.Mvc; // trae ControllerBase, [ApiController], [HttpGet], IActionResult...

namespace Backend.Api.Controllers;

[ApiController] // activa comportamientos automáticos de API REST (validación de modelo, respuestas 400 automáticas, etc.)
[Route("api/[controller]")] // "[controller]" se reemplaza por "Pedidos" (nombre de la clase sin "Controller") → ruta base api/pedidos
public class PedidosController : ControllerBase // ControllerBase da acceso a Ok(), NotFound(), CreatedAtAction()...
{
    // "static readonly": una sola lista, compartida por todas las peticiones mientras el proceso esté corriendo
    private static readonly List<Pedido> _pedidos = new()
    {
        new Pedido {
            Id = 1, Fecha = new DateTime(2026, 1, 15, 10, 30, 0), Total = 150.50m, // la "m" marca el literal como decimal
            Cliente = new Cliente { Nombre = "Ana Martinez", Email = "ana@example.com" }
        },
        new Pedido {
            Id = 2, Fecha = new DateTime(2026, 1, 16, 9, 0, 0), Total = 899.99m,
            Cliente = new Cliente { Nombre = "Carlos Ruiz", Email = "carlos@example.com" }
        }
    };

    [HttpGet] // responde a GET /api/pedidos (sin id en la URL → toda la colección)
    public IActionResult Get() => Ok(_pedidos); // Ok(...): arma una respuesta 200 con el objeto serializado a JSON
}
```

Y `Program.cs` mínimo para que todo esto quede conectado:

```csharp title="Program.cs"
var builder = WebApplication.CreateBuilder(args); // arma la configuración de la app antes de arrancar (lee args, env, etc.)
builder.Services.AddControllers(); // registra el soporte para clases *Controller como PedidosController

var app = builder.Build(); // construye la aplicación ya configurada
app.MapControllers(); // conecta las rutas de los controladores; sin esto, [HttpGet] no respondería nada
app.Run("http://0.0.0.0:5000"); // arranca el servidor y lo deja escuchando en el puerto 5000
```

:::tip[📝 Haz esto ahora]
Crea las carpetas `Models/` y `Controllers/` con esos dos archivos, y reemplaza el contenido de
`Program.cs`. Guarda todo y corre `dotnet run`.
:::

Con la app corriendo, en la otra terminal:

```bash title="terminal"
curl http://localhost:5000/api/pedidos
```

```json title="✅ resultado real — deberías ver exactamente esto"
[{"id":1,"fecha":"2026-01-15T10:30:00","total":150.5,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}},{"id":2,"fecha":"2026-01-16T09:00:00","total":899.99,"cliente":{"nombre":"Carlos Ruiz","email":"carlos@example.com"}}]
```

Si ves ese array con tus dos pedidos, vas por buen camino. Si en cambio ves una página de
error, revisa el mensaje en la terminal donde corre `dotnet run` — casi siempre es un error de
compilación que te dice exactamente en qué línea está el problema.

## 1.4 Un pedido a la vez: `GET /api/pedidos/{id}`

Agrega este método dentro de la misma clase `PedidosController`, debajo de `Get()`:

```csharp title="Controllers/PedidosController.cs (agregar)"
[HttpGet("{id}")] // "{id}" es un parámetro de ruta: GET /api/pedidos/2 → el parámetro id recibe el valor 2
public IActionResult GetPorId(int id)
{
    var pedido = _pedidos.FirstOrDefault(p => p.Id == id); // el primer elemento que cumple la condición, o null si ninguno
    if (pedido == null) return NotFound(); // sin ese pedido, responde 404
    return Ok(pedido); // si existe, responde 200 con el pedido serializado a JSON
}
```

Guarda, deja que `dotnet run` recompile solo (o reinícialo), y prueba dos casos: uno que existe
y uno que no.

```bash title="terminal"
curl -i http://localhost:5000/api/pedidos/2
```

```http title="✅ resultado real — el pedido 2 existe"
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":2,"fecha":"2026-01-16T09:00:00","total":899.99,"cliente":{"nombre":"Carlos Ruiz","email":"carlos@example.com"}}
```

```bash title="terminal"
curl -i http://localhost:5000/api/pedidos/99
```

```http title="✅ resultado real — el pedido 99 no existe"
HTTP/1.1 404 Not Found
Content-Type: application/problem+json; charset=utf-8

{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404, ...}
```

:::note[💡 Concepto: el 404 "gratis" de ASP.NET Core]
No escribiste ningún código para generar ese JSON de error — `NotFound()` le pide a ASP.NET
Core que responda con un 404, y el framework arma automáticamente ese cuerpo estándar
("ProblemDetails", definido en el RFC 9110). Es una de las ventajas de usar un framework maduro:
los casos comunes ya vienen resueltos de forma consistente.
:::

## 1.5 Crear pedidos: `POST /api/pedidos`

Agrega este método:

```csharp title="Controllers/PedidosController.cs (agregar)"
[HttpPost] // responde a POST /api/pedidos
public IActionResult Post([FromBody] Pedido pedido) // [FromBody]: deserializa el JSON del cuerpo de la petición a un Pedido
{
    // el próximo id disponible = el mayor id existente + 1, o 1 si la lista está vacía
    pedido.Id = _pedidos.Any() ? _pedidos.Max(p => p.Id) + 1 : 1;
    if (pedido.Fecha == default) pedido.Fecha = DateTime.Now; // si el cliente no mandó fecha, usa la actual
    _pedidos.Add(pedido);
    // 201 Created + la URL del nuevo recurso (apuntando a GetPorId) + el pedido creado en el body
    return CreatedAtAction(nameof(GetPorId), new { id = pedido.Id }, pedido);
}
```

```bash title="terminal"
curl -X POST http://localhost:5000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-01-17T12:00:00","total":45.00,"cliente":{"nombre":"Lucia Fernandez","email":"lucia@example.com"}}'
```

```json title="✅ resultado real"
{"id":3,"fecha":"2026-01-17T12:00:00","total":45.00,"cliente":{"nombre":"Lucia Fernandez","email":"lucia@example.com"}}
```

Fíjate que tú no enviaste `id` — el servidor lo calculó (`_pedidos.Max(p => p.Id) + 1`). Vuelve
a pedir la lista completa para confirmar que ahora hay tres:

```bash title="terminal"
curl http://localhost:5000/api/pedidos
```

Deberías contar 3 elementos en el array. Ahora, el detalle importante:

:::caution[⚠️ Prueba esto — reinicia el servidor]
Detén `dotnet run` con `Ctrl+C` y vuelve a ejecutarlo. Pide de nuevo `curl
http://localhost:5000/api/pedidos`. **Vas a volver a ver solo 2 pedidos** — el que creaste
desapareció. `_pedidos` es una lista en memoria: vive mientras el proceso está corriendo, y se
reinicia desde cero cada vez que arrancas la app. Esto es exactamente el problema que resolvemos
en la sección 1.7.
:::

## 1.6 Editar y eliminar: `PUT` y `DELETE`

Agrega estos dos métodos para completar el CRUD en memoria:

```csharp title="Controllers/PedidosController.cs (agregar)"
[HttpPut("{id}")] // responde a PUT /api/pedidos/{id}
public IActionResult Put(int id, [FromBody] Pedido pedido)
{
    var index = _pedidos.FindIndex(p => p.Id == id); // posición del pedido en la lista, o -1 si no existe
    if (index == -1) return NotFound();
    pedido.Id = id; // fuerza que el id sea el de la URL, por si el cliente mandó otro distinto en el body
    _pedidos[index] = pedido; // reemplaza el pedido completo en esa posición
    return NoContent(); // 204: la operación funcionó, pero no hay nada que devolver en el body
}

[HttpDelete("{id}")] // responde a DELETE /api/pedidos/{id}
public IActionResult Delete(int id)
{
    var pedido = _pedidos.FirstOrDefault(p => p.Id == id);
    if (pedido == null) return NotFound();
    _pedidos.Remove(pedido);
    return NoContent();
}
```

```bash title="terminal"
curl -i -X PUT http://localhost:5000/api/pedidos/1 \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-01-15T10:30:00","total":200.00,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}'
```

```http title="✅ resultado real"
HTTP/1.1 204 No Content
```

```bash title="terminal"
curl -i -X DELETE http://localhost:5000/api/pedidos/2
```

```http title="✅ resultado real"
HTTP/1.1 204 No Content
```

:::tip[📝 Ejercicio 1.1 — Confirma el estado final]
Pide `GET /api/pedidos` una vez más. Deberías ver solo el pedido con id 1, con el total ya
actualizado a 200. Si tienes dudas de qué ids quedan vivos en cualquier momento, siempre puedes
volver a pedir la lista completa — es tu fuente de verdad.
:::

## 1.7 Datos que sobreviven un reinicio: el patrón Strategy

Ya viste el problema: una lista en memoria se borra cada vez que reinicias la app. La solución
es guardar los pedidos en algún lado persistente — para esta guía, un archivo. Pero en vez de
escribir la lectura/escritura de archivos directamente en el controlador, la separamos detrás
de una interfaz, así el día de mañana puedes cambiar *dónde* se guarda sin tocar el resto del
código.

```csharp title="Services/IPedidoStorageStrategy.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

// El contrato: cualquier forma de guardar pedidos debe poder leer TODA la lista
// y guardar TODA la lista. No dice CÓMO -- eso lo decide cada implementación concreta.
public interface IPedidoStorageStrategy
{
    Task<List<Pedido>> LeerPedidosAsync();
    Task GuardarPedidosAsync(List<Pedido> pedidos);
}
```

```csharp title="Services/JsonPedidoStorageStrategy.cs"
using System.Text.Json; // el serializador JSON incluido en .NET, sin instalar nada extra
using Backend.Api.Models;

namespace Backend.Api.Services;

public class JsonPedidoStorageStrategy : IPedidoStorageStrategy // implementa el contrato de arriba
{
    // ruta absoluta al archivo; se calcula una sola vez, cuando se crea una instancia de esta clase
    private readonly string _filePath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "pedidos.json");

    public async Task<List<Pedido>> LeerPedidosAsync()
    {
        if (!File.Exists(_filePath)) return new List<Pedido>(); // primera vez que corre: todavía no existe el archivo
        var json = await File.ReadAllTextAsync(_filePath); // lee todo el contenido del archivo como texto plano
        // convierte ese texto JSON en una lista de objetos Pedido; si el resultado es null, usa una lista vacía
        return JsonSerializer.Deserialize<List<Pedido>>(json) ?? new List<Pedido>();
    }

    public async Task GuardarPedidosAsync(List<Pedido> pedidos)
    {
        var options = new JsonSerializerOptions { WriteIndented = true }; // WriteIndented: JSON legible, con saltos de línea
        var json = JsonSerializer.Serialize(pedidos, options); // convierte la lista completa de objetos a texto JSON
        await File.WriteAllTextAsync(_filePath, json); // sobreescribe el archivo entero con el contenido nuevo
    }
}
```

Ahora movemos la lógica que antes vivía suelta en el controlador (calcular el siguiente id,
buscar por id, etc.) a una clase de servicio, que usa la estrategia de almacenamiento en vez de
la lista estática:

```csharp title="Services/IPedidoService.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

// El contrato de "operaciones de negocio" sobre pedidos: lo que el controlador puede pedir,
// sin saber si por debajo hay un archivo JSON, XML o (Parte 5) una base de datos.
public interface IPedidoService
{
    Task<List<Pedido>> ObtenerTodosAsync();
    Task<Pedido?> ObtenerPorIdAsync(int id); // "Pedido?": puede que no exista ninguno con ese id
    Task<Pedido> CrearAsync(Pedido nuevoPedido);
    Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado); // bool: si encontró (y actualizó) el pedido
    Task<bool> EliminarAsync(int id);
}
```

```csharp title="Services/PedidoService.cs"
using Backend.Api.Models;

namespace Backend.Api.Services;

public class PedidoService : IPedidoService
{
    private readonly IPedidoStorageStrategy _storage; // depende de la INTERFAZ, no de JsonPedidoStorageStrategy directamente

    // el contenedor de dependencias decide qué implementación concreta llega aquí (lo ves en Program.cs)
    public PedidoService(IPedidoStorageStrategy storage)
    {
        _storage = storage;
    }

    // "=>" (expression body): forma corta para un método de una sola instrucción
    public async Task<List<Pedido>> ObtenerTodosAsync() => await _storage.LeerPedidosAsync();

    public async Task<Pedido?> ObtenerPorIdAsync(int id)
    {
        var pedidos = await _storage.LeerPedidosAsync(); // trae TODOS los pedidos del almacenamiento...
        return pedidos.FirstOrDefault(p => p.Id == id); // ...y busca el que corresponde ya en memoria
    }

    public async Task<Pedido> CrearAsync(Pedido nuevoPedido)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        nuevoPedido.Id = pedidos.Any() ? pedidos.Max(p => p.Id) + 1 : 1; // mismo cálculo que antes vivía en el controlador
        if (nuevoPedido.Fecha == default) nuevoPedido.Fecha = DateTime.Now;
        pedidos.Add(nuevoPedido); // agrega el nuevo pedido a la lista en memoria...
        await _storage.GuardarPedidosAsync(pedidos); // ...y guarda la lista COMPLETA de vuelta en el almacenamiento
        return nuevoPedido;
    }

    public async Task<bool> ActualizarAsync(int id, Pedido pedidoActualizado)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        var index = pedidos.FindIndex(p => p.Id == id);
        if (index == -1) return false;
        pedidoActualizado.Id = id;
        pedidos[index] = pedidoActualizado;
        await _storage.GuardarPedidosAsync(pedidos); // vuelve a guardar toda la lista, con ese pedido ya reemplazado
        return true;
    }

    public async Task<bool> EliminarAsync(int id)
    {
        var pedidos = await _storage.LeerPedidosAsync();
        var pedido = pedidos.FirstOrDefault(p => p.Id == id);
        if (pedido == null) return false;
        pedidos.Remove(pedido);
        await _storage.GuardarPedidosAsync(pedidos); // guarda la lista sin ese pedido
        return true;
    }
}
```

:::note[💡 Por qué "leer todo, modificar en memoria, guardar todo"]
Con un archivo no hay forma de "actualizar solo una fila" como en una base de datos — el
archivo se lee y se escribe completo cada vez. Es ineficiente para archivos grandes, pero
perfecto para aprender el patrón; en la [Parte 5](/guia/parte-5-sqlite/) vas a ver la
alternativa real (tocar solo la fila que cambia) al pasar a SQLite.
:::

Reescribe el controlador para que dependa de `IPedidoService` en vez de tocar la lista
directamente — nota que la *forma* de cada endpoint no cambia, solo de dónde saca los datos:

```csharp title="Controllers/PedidosController.cs (reemplaza todo el archivo)"
using Backend.Api.Models;
using Backend.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly IPedidoService _pedidoService; // ahora depende de la interfaz, no de una lista propia

    public PedidosController(IPedidoService pedidoService) // inyectado por el contenedor de dependencias
    {
        _pedidoService = pedidoService;
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _pedidoService.ObtenerTodosAsync());

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
        var creado = await _pedidoService.CrearAsync(pedido); // toda la lógica de asignar id ahora vive en el servicio
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

Y por último, conecta las piezas en `Program.cs` — aquí es donde se decide *qué* implementación
usa cada interfaz:

```csharp title="Program.cs (reemplaza todo el archivo)"
using Backend.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
// registra qué CLASE CONCRETA entregar cuando alguien pida IPedidoStorageStrategy / IPedidoService por constructor
builder.Services.AddScoped<IPedidoStorageStrategy, JsonPedidoStorageStrategy>();
builder.Services.AddScoped<IPedidoService, PedidoService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVue", policy => // "AllowVue" es solo el nombre que le damos a esta política, para referenciarla después
    {
        // en desarrollo, permite cualquier origen/método/header; en producción restringirías esto (ver 1.8)
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();
app.UseCors("AllowVue"); // activa la política CORS de arriba; debe ir ANTES de MapControllers
app.MapControllers();
app.Run("http://0.0.0.0:5000");
```

:::note[💡 Concepto: inyección de dependencias]
`PedidosController` recibe un `IPedidoService` por su constructor — no lo crea con `new
PedidoService()`. A eso lo llamamos **inyección de dependencias**: en vez de que cada clase
construya lo que necesita, se lo "inyecta" un contenedor central (las líneas `AddScoped<...>`
de `Program.cs`). La ventaja: el controlador depende de una *interfaz*, no de una
implementación concreta, así que puedes cambiar qué implementación se usa sin tocar el
controlador — que es exactamente lo que vas a hacer en la [Parte 5](/guia/parte-5-sqlite/) para
pasar de archivos a SQLite.
:::

:::tip[📝 Haz esto ahora]
Crea las carpetas `Services/` y `Data/` (esta última vacía por ahora), agrega los cuatro
archivos nuevos, reemplaza `PedidosController.cs` y `Program.cs` completos, y borra cualquier
`using` que el compilador marque como no usado. Corre `dotnet run`.
:::

Repite la prueba de la sección 1.5, pero ahora fíjate en el resultado:

```bash title="terminal"
curl http://localhost:5000/api/pedidos
```

```json title="✅ resultado real — arranca vacío, ya no hay datos hardcodeados"
[]
```

```bash title="terminal"
curl -X POST http://localhost:5000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-01-15T10:30:00","total":150.50,"cliente":{"nombre":"Ana Martinez","email":"ana@example.com"}}'
```

Ahora abre el archivo que se acaba de crear:

```bash title="terminal"
cat Data/pedidos.json
```

```json title="✅ resultado real — tu pedido, guardado en disco"
[
  {
    "Id": 1,
    "Fecha": "2026-01-15T10:30:00",
    "Total": 150.50,
    "Cliente": {
      "Nombre": "Ana Martinez",
      "Email": "ana@example.com"
    }
  }
]
```

:::note[🔍 Detalle curioso: mayúsculas distintas]
¿Notaste que el JSON de la API usa `"id"` en minúscula pero el archivo en disco usa `"Id"` con
mayúscula? La API usa una convención llamada camelCase por configuración automática de
ASP.NET Core; el archivo lo escribimos nosotros mismos en `JsonPedidoStorageStrategy` con
`JsonSerializer.Serialize` sin esa configuración, así que usa el nombre exacto de la propiedad
de C#. No es un error — son dos serializaciones independientes, cada una con sus propias reglas.
:::

:::tip[📝 Ejercicio 1.2 — Prueba la persistencia de verdad]
Reinicia el servidor (`Ctrl+C` y `dotnet run` de nuevo) y pide `GET /api/pedidos`. Esta vez tu
pedido **debe seguir ahí** — a diferencia de la sección 1.5, ahora sobrevive al reinicio porque
vive en un archivo, no en memoria.
:::

:::tip[📝 Ejercicio 1.3 — El CRUD completo, ahora persistente]
Repite el ciclo completo GET → POST → PUT → DELETE de las secciones 1.3 a 1.6, confirmando cada
resultado con `curl`. Todo debería comportarse igual que antes — es la ventaja de haber
diseñado el controlador contra una interfaz: cambiar el almacenamiento por debajo no cambió el
comportamiento HTTP que ya probaste.
:::

:::tip[📝 Ejercicio 1.4 — Reto opcional: una segunda estrategia]
Escribe `XmlPedidoStorageStrategy.cs` con el mismo contrato de `IPedidoStorageStrategy`, pero
serializando a `Data/pedidos.xml` con `System.Xml.Serialization.XmlSerializer`. Luego cambia una
sola línea en `Program.cs` (`AddScoped<IPedidoStorageStrategy, XmlPedidoStorageStrategy>`) y
confirma que el CRUD sigue funcionando exactamente igual, ahora guardando XML en vez de JSON.
:::

## 1.8 CORS: por qué el frontend va a poder llamar a esta API

Un detalle que vas a necesitar en la Parte 3: por defecto, los navegadores bloquean que una
página en `http://localhost:5173` (Vue) o `http://localhost:4200` (Angular) haga peticiones a
`http://localhost:5000` (otro "origen"), por razones de seguridad. Esto se llama política de
**CORS** (Cross-Origin Resource Sharing). Ya la habilitaste en la sección 1.7 — es este bloque:

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

Con la API funcionando y persistiendo datos, sigue a la [Parte 2](/guia/parte-2-elige-camino/)
para elegir con qué framework vas a construir la interfaz que la consume.
