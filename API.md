# API Reference

- [Options](#options)
- [Reporter Interface](#reporter-interface)
  * [Filtering Using Plugin Configs](#filtering-using-plugin-configs)
  * [Reporter Lifecycle](#reporter-lifecycle)
- [Event Types](#event-types)
- [Event Payloads](#event-payloads)
  * [`ServerLog`](#serverlog)
  * [`RequestError`](#requesterror)
  * [`RequestSent`](#requestsent)
  * [`Ops`](#ops)
  * [`RequestLog`](#requestlog)
  * [Extension Payloads](#extension-payloads)

**good** is a process monitor that listens for one or more of the below 'event types'. All of these events, _except_ 'ops' map to a hapi event documented [here](https://github.com/hapijs/hapi/blob/master/API.md#server-events).

Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination
as general events are a process-wide facility and will result in duplicated log events.

## Options
- `[includes]` - optional configuration object
    - `[request]` - array of extra hapi request object fields to supply to reporters on "response" events. Valid values ['headers', 'payload']. Defaults to `[]`.
    - `[response]` - array of extra hapi response object fields to supply to reporters on "response" events. Valid values ['payload']. Defaults to `[]`.
- `[ops]` - options for controlling the ops reporting from good. Set to `false` to disable ops monitoring completely.
    - `config` - options passed directly into the [`Oppsy`](https://github.com/hapijs/oppsy) constructor as the `config` value. Defaults to `{}`
    - `interval` - interval used when calling `Oppsy.start()`. Defaults to `15000`.
- `[responseEvent]` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `[extensions]` - an array of [hapi event names](https://github.com/hapijs/hapi/blob/master/API.md#server-events) to listen for and report via the good reporting mechanism. Can not be any of ['log', 'request-error', 'ops', 'request', 'response', 'tail']. **Disclaimer** This option should be used with caution. This option will allow users to listen to internal events that are not meant for public consumption. The list of available events can change with any changes to the hapi event system. Also, *none* of the official hapijs reporters have been tested against these custom events. The schema for these events can not be guaranteed because they vary from version to version of hapi.
- `[reporters]` - Defaults to `{}`. `reporters` is a `key`, `value` pair where the `key` is a reporter name and the `value` is an array of mixed value types. Valid values for the array items are:
    - streams specifications object with the following keys
        - `module` - a string that will be used to import a module from node_modules or a local file. Should export a single constructor function that can be invoked with `new`.
        - `[name]` - if the imported module exports more than one constructor function, use `name` to specify which one to use.
        - `[args]` - an array of arguments to pass to the constructor when this stream object is created via `new`.
    - instantiated stream objects
    - string name of a built in `process` stream. Valid values are `"stdout"` and `"stderr"`.

## Reporter Interface

The reporter interface uses the standard stream-and-pipe interface found commonly in the node ecosystem. Each item in the array of streams will be piped together in the array order. Any stream described using a stream specification object will be constructed with `new` to prevent any cross contamination from one reporter to another. For example, when passing the following specification for an "ops-console" reporter:

```
{
    ops-console: [{
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{ ops: '*' }]
    }, {
        module: 'good-squeeze',
        name: 'SafeJson'
    }, 'stdout']
}
```

Internally, this would create an array (`streams`), import `good-squeeze` from node_modules, and then create a new "Squeeze" transform stream via `new Squeeze({ ops: '*' })` and push that result into `streams`. Then it would create a "SafeJson" transform stream via `new SafeJson()` and push that into `streams`. Finally, since 'stdout' is an existing process stream, it gets pushed directly into `streams`. Once all of the streams have been created and collected, the algorithm does essentially the following:

```
const result = streams[0].pipe(streams[1]).pipe(streams[2]);
```

*Any* time one of the "good events" occurs, a unique copy of the event is pushed into each reporter stream pipeline. It is up to the developer to filter events they don't care about on a per pipeline basis. The "Squeeze" transform stream provides the basic event type and tag filtering used in previous versions of good which should meet many filtering needs.

It is also up to the developer to manage `objectMode` in each pipeline from one stream to the next. The first stream will *always* receive an object. After that, it's up to the developer to manage the message type throughout the pipeline. In the above example, because we want to write to `stdout`, we needed to add a transform stream to convert the payload coming out of "Squeeze" to a string using "SafeJson" before sending it to `process.stdout`. Objects can not be written directly to `process.stdout`, so "SafeJson" was used to safely stringify the message coming from the "Squeeze" stream.

Finally, the developer must make sure the reporting pipeline makes sense. In the above example, we pipe through two transform streams, convert the object to a string, and then write send it to `process.stdout` which is a write stream. If the developer mixes up the order, this pipeline would crash the process.

Each reporter pipeline receives it's own copy of the message from good. That means the payload can be freely modified without worrying about impacting other reporters. Just add more and more transform streams into the pipeline to fine-tune any reporting needs. Need a different filtering mechanism? Write a new transform stream to filter based on IP, request route, payload type... Want to add extra data about events? Just add a transform stream into the mix to add the current date, something specific to your company, filter out sensitive information before logging it... the sky is the limit.

These changes address the two most common requests; "how do I filter on `X`?" and "how do I add `Y` to the message payload?". Now developers are empowered to customize the reporting pipeline to suite their needs. While there is far less hand-holding with this interface, developers have much more control of reporting coming out of good.

**This change also allows user to leverage *any* existing transform or write stream in the node ecosystem to be used with good.**

### Filtering Using Plugin Configs

Plugin configs set at the route and request level can be used to drive additional filtering. In this example a reporter allows setting a `suppressResponseLog` property.

Setting plugin config at route level
```
var routeConfig = {
    plugins: {
        good: {
            suppressResponseEvent: true
        }
    }
};

server.route({ method: 'GET', path: '/user', config: routeConfig });
```

Setting config in a handler
```
const handler = function (request, reply) {

    request.plugins.good = {
        suppressResponseEvent: true
    };

    reply.continue();
}
```

In the `_transform` method implemented by the reporter
```
_transform(data, enc, next) {

    if (data.eventName === 'response' && data.config.suppressResponseLog) {
        return next();
    }

    return next(null, data);
}
```

### Reporter Lifecycle

**Startup**

1. When "onPreStart" is emitted from the hapi server, the monitoring operation starts.
2. All of the streams are created via `new` (if needed) and collected into an temporary internal array.
3. All of the streams in the temporary array are piped together. This will cause any standard [Node stream](https://nodejs.org/api/stream.html) events to occur that instances can listen for.

At this point, data will start flowing to each of the reporters through the pipe interface. Data can be accessed in individual instances though any of the standard stream methods and events.

**Shutdown**

1. When "onPostStop" is emitted from the hapi server, the shutdown sequence starts.
2. `null` is pushed through each reporter pipeline. Any synchronous teardown can happen on stream instances in "end" or "finish" events. See [Node stream](https://nodejs.org/api/stream.html) for more information about end-of-stream events. The callback signaling to hapi that our logic is done executing will happen on the next tick Node tick.

## Event Types

- `ops` - System and process performance - CPU, memory, disk, and other metrics.
- `response` - Information about incoming requests and the response. This maps to either the "response" or "tail" event emitted from hapi servers.
- `log` - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc. Maps to the "log" event emitted from hapi servers.
- `error` - request responses that have a status code of 500. This maps to the "request-error" hapi event.
- `request` - Request logging information. This maps to the hapi 'request' event that is emitted via `request.log()`.

## Event Payloads

Each event emitted from Good has a unique object representing the payload. This is useful for three reasons:

1. It provides a predictable interface.
2. It makes tracking down issues with MDB much easier because the payloads aren't just generic objects.
3. It is more likely to be optimized because the V8 runtime has a better idea of what the structure of each object is going to be much sooner.

### `ServerLog`

Event object associated with 'log' events.

- `event` - 'log'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - string or object passed via `server.log()` calls.
- `pid` - the current process id.

### `RequestError`

Event object associated with 'error' events.

- `event` - 'error'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `id` - request id. Maps to `request.id`.
- `url` - url of the request that originated the error. Maps to `request.url`.
- `method` - method of the request that originated the error. Maps to `request.method`.
- `pid` - the current process id.
- `error` - the raw error object.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.

The `toJSON` method of `GreatError` has been overwritten because `Error` objects can not be stringified directly. A stringified `GreatError` will have `error.message` and `error.stack` in place of the raw `Error` object.

### `RequestSent`

Event object associated with the `responseEvent` event option into Good. `request`

- `event` - 'response'
- `timestamp` - JavaScript timestamp that maps to `request.info.received`.
- `id` - id of the request, maps to `request.id`.
- `instance` - maps to `request.connection.info.uri`.
- `labels` - maps to `request.connection.settings.labels`
- `method` - method used by the request. Maps to `request.method`.
- `path` - incoming path requested. Maps to `request.path`.
- `query` - query object used by request. Maps to `request.query`.
- `responseTime` - calculated value of `Date.now() - request.info.received`.
- `statusCode` - the status code of the response.
- `pid` - the current process id.
- `httpVersion` - the http protocol information from the request.
- `source` - object with the following values:
    - `remoteAddress` - information about the remote address. maps to `request.info.remoteAddress`
    - `userAgent` - the user agent of the incoming request.
    - `referer` - the referer headed of the incoming request.
- `route` - route path used by request. Maps to `request.route.path`.
- `log` - maps to `request.getLog()` of the hapi request object.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.

### `Ops`

Event object associated with the 'ops' event emitted from Oppsy.

- `event` - 'ops'
- `timestamp` - current time when the object is created.
- `host` - the host name of the current machine.
- `pid` - the current process id.
- `os` - object with the following values:
    - `load` - array containing the 1, 5, and 15 minute load averages.
    - `mem` - object with the following values:
        - `total` - total system memory in bytes.
        - `free` - total free system memory in bytes.
    - `uptime` - system uptime in seconds.
- `proc` - object with the following values:
    - `uptime` - uptime of the running process in seconds
    - `mem` - returns result of `process.memoryUsage()`
        - `rss` - 'resident set size' which is the amount of the process held in memory.
        - `heapTotal` - V8 heap total
        - `heapUsed` - V8 heap used
    - `delay` - the calculated Node event loop delay.
- `load` - object with the following values:
    - `requests` - object containing information about all the requests passing through the server.
    - `concurrents` - object containing information about the number of concurrent connections associated with each `listener` object associated with the hapi server.
    - `responseTimes` - object with calculated average and max response times for requests.
    - `sockets` - object with the following values:
        - `http` - socket information http connections. Each value contains the name of the socket used and the number of open connections on the socket. It also includes a `total` for total number of open http sockets.
        - `https` - socket information https connections. Each value contains the name of the socket used and the number of open connections on the socket. It also includes a `total` for total number of open https sockets.

### `RequestLog`

Event object associated with the "request" event. This is the hapi event emitter via `request.log()`.

- `event` - 'request'
- `timestamp` - timestamp of the incoming `event` object.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - the string or object mapped to `event.data`.
- `pid` - the current process id.
- `id` - id of the request, maps to `request.id`.
- `method` - method used by the request. Maps to `request.method`.
- `path` - incoming path requested. Maps to `request.path`.
- `config` - plugin-specific config object combining `request.route.settings.plugins.good` and `request.plugins.good`. Request-level overrides route-level. Reporters could use `config` for additional filtering logic.

### Extension Payloads

Because the extension payloads from hapi can vary from one version to another and one event to another, the payload is only loosely defined.
- `event` - the event name.
- `timestamp` - the time the event occurred.
- `payload` - array of arguments hapi passed to our event handler function
