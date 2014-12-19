![good Logo](https://raw.github.com/spumko/good/master/images/good.png)

[**hapi**](https://github.com/hapijs/hapi) process monitoring

[![Build Status](https://secure.travis-ci.org/hapijs/good.png)](http://travis-ci.org/hapijs/good)![Current Version](https://img.shields.io/npm/v/good.svg)

Lead Maintainer: [Lloyd Benson](https://github.com/lloydbenson)

_'Monitor'_ should be configured using a _'hapi'_ server instead of calling the _'Monitor'_ constructor directly.

**good** is a process monitor that listens for one or more of the below 'event types'. All of these events, _except_ 'ops',  map to a hapi event documented [here](https://github.com/hapijs/hapi/blob/master/API.md#server-events).
- `ops` - System and process performance - CPU, memory, disk, and other metrics.
- `response` - Information about incoming requests and the response. This maps to either the "response" or "tail" event emitted from hapi servers.
- `log` - logging information not bound to a specific request such as system errors, background processing, configuration errors, etc. Maps to the "log" event emitted from hapi servers.
- `error` - request responses that have a status code of 500. This maps to the "request-error" hapi event.
- `request` - Request logging information. This maps to the hapi 'request' event that is emitted via `request.log()`.

Applications with multiple server instances, each with its own monitor should only include one _log_ subscription per destination
as general events are a process-wide facility and will result in duplicated log events. To override some or all of the defaults,
set `options` to an object with the following optional settings:

- `[httpAgents]` - the list of `httpAgents` to report socket information about. Can be a single `http.Agent` or an array of agents objects. Defaults to `Http.globalAgent`.
- `[httpsAgents]` - the list of `httpsAgents` to report socket information about. Can be a single `https.Agent` or an array of agents. Defaults to `Https.globalAgent`.
- `[logRequestHeaders]` - determines if all request headers will be logged. Defaults to _false_
- `[logRequestPayload]` - determines if the request payload will be logged. Defaults to _false_
- `[logResponsePayload]` - determines if the response payload will be logged. Defaults to _false_
- `[opsInterval]` - the interval in milliseconds to sample system and process performance metrics. Minimum is _100ms_. Defaults to _15 seconds_.
- `[requestsEvent]` - the event type used to capture completed requests. Defaults to 'tail'. Options are:
    - 'response' - the response was sent but request tails may still be pending.
    - 'tail' - the response was sent and all request tails completed.
- `reporters` - Defaults to *no* reporters. All reporting objects must be installed in your project. `reporters` is an array of instantiated objects that implement the [good-reporter](https://github.com/hapijs/good-reporter) interface or an object with the following keys:
    - `reporter` - indicates the reporter object to create. Can be one of two values
        - a constructor function generally via `require`, ie `require('good-file')`
        - a module name to `require`. Uses the built-in Node `require` function so you can pass a module name or a path. The supplied module must implement the good-reporter interface.
    - `args` - an array of arguments that will be passed into the constructor named by `reporter`. Each reporter has different arguments for the constructor, check the documentation for more information.


For example:

```javascript
var Hapi = require('hapi');
var server = new Hapi.Server();
server.connection({ host: 'localhost' });

var options = {
    opsInterval: 1000,
    reporters: [{
        reporter: require('good-console'),
        args:[{ log: '*', response: '*' }]
    }, {
        reporter: require('good-file'),
        args: ['./test/fixtures/awesome_log', { ops: '*' }]
    }, {
        reporter: require('good-http'),
        args: [{ error: '*' }, 'http://prod.logs:3000', {
            threshold: 20,
            wreck: {
                headers: { 'x-api-key' : 12345 }
            }
        }]
    }]
};

server.register({
    register: require('good'),
    options: options
}, function (err) {

    if (err) {
        console.error(err);
    }
    else {
        server.start(function () {

            console.info('Server started at ' + server.info.uri);
        });
    }
});

```

This example does the following:

1. Sets up the [`GoodConsole`](https://github.com/hapijs/good-console) reporter listening for 'request' and 'log' events.
2. Sets up the [`GoodFile`](https://github.com/hapijs/good-file) reporter to listen for 'ops' events and log them to `./test/fixtures/awesome_log` according to the file rules listed in the good-file documentation.
3. Sets up the [`GoodHttp`](https://github.com/hapijs/good-http) reporter to listen for error events and POSTs them to `http://prod.logs:3000` with additional settings to pass into `Wreck`

Log messages are created with tags. Usually a log will include a tag to indicate if it is related to an error or info along with where the message originates. If, for example, the console should only output error's that were logged you can use the following configuration:

```javascript
var options = {
    reporters: [{
        reporter: require('good-console'),
        args: [{ log: ['error', 'medium'] }]
    }]
};
```

This will now _only_ log 'log' events that have the 'error' _or_ 'medium' tag attached to them. Any 'log' events without one of those tags will be ignored. Please see the documentation of the [good-reporter](https://github.com/hapijs/good-reporter) interface for more information about tags and event filtering.

## Event Payloads

Each event emitted from Good has a unique object representing the payload. This is useful for three reasons:

1. It provides a predictable interface.
2. It makes tracking down issues with MDB much easier because the payloads aren't just generic objects.
3. It is more likely to be optimized because the V8 runtime has a better idea of what the structure of each object is going ot be much sooner.

**All** of the below events are frozen to prevent tampering. If your reporter uses "strict mode", trying to change the value will throw an error.

### `GreatLog(event)`

Event object associated with 'log' events. The `event` argument is the `event` argument emitted by hapi 'log' events.

- `event` - 'log'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - string or object passed via `server.log()` calls.
- `pid` - the current process id.

### `GreatError(request, error)`

Event object associated with 'error' events. `request` and `error` are the objects sent by hapi on 'request-error' events.

- `event` - 'error'
- `timestamp` - JavaScript timestamp indicating when the 'log' event occurred.
- `pid` - the current process id.
- `url` - url of the request that originated the error. Maps to `request.url`.
- `method` - method of the request that originated the error. Maps to `request.method`.
` `error` - the raw error object.

The `toJSON` method of `GreatError` has been overwritten because `Error` objects can not be stringified directly. A stringified `GreatError` will have `error.message` and `error.stack` in place of the raw `Error` object.

### `GreatResponse(request, options)`

Event object associated with the `responseEvent` event option into Good. `request` is the `request` object emitted by the 'tail' or 'response' event by hapi. `options` is an object used for additional logging options.

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
- `source` - object with the following values:
    - `remoteAddress` - information about the remote address. maps to `request.info.remoteAddress`
    - `userAgent` - the user agent of the incoming request.
    - `referer` - the referer headed of the incoming request.
- `log` - maps to `request.getLog()` of the hapi request object.

Optional properties controlled by the `options` argument into Good.

- `headers` - the header object for the incomming request.
- `requestPayload` - maps to `request.payload`.
- `responsePayload` - maps to `request.response.source`.

### `GreatOps(ops)`

Event object associated with the 'ops' event emitted from Good. `ops` is the aggregated result of the ops operation.

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

### `GreatRequest(request, event)`

Event object associated with the "request" event. This is the hapi event emitter via `request.log()`. `request` and `events` are the parameters passed by hapi when emitting the "request" event.

- `event` - 'request'
- `timestamp` - timestamp of the incomming `event` object.
- `tags` - array of strings representing any tags associated with the 'log' event.
- `data` - the string or object mapped to `event.data`.
- `pid` - the current process id.
- `id` - id of the request, maps to `request.id`.
- `method` - method used by the request. Maps to `request.method`.
- `path` - incoming path requested. Maps to `request.path`.


## Reporters

### Officially supported by hapijs

This is a list of good-reporters under the hapijs umbrella:
- [good-udp](https://github.com/hapijs/good-udp)
- [good-file](https://github.com/hapijs/good-file)
- [good-http](https://github.com/hapijs/good-http)
- [good-console](https://github.com/hapijs/good-console)

### Community powered
Here are some additional reporters that are available from the hapijs community:
- [good-influxdb](https://github.com/totherik/good-influxdb)
- [good-loggly](https://github.com/fhemberger/good-loggly)
