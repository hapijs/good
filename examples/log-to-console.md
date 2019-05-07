# Log to Console

## Basic Example

```
console: [{
    module: '@hapi/good-squeeze',
    name: 'Squeeze',
    args: [{
        log: '*',
        response: '*'
    }]
}, {
    module: '@hapi/good-console'
}, 'stdout']
```

This reporter spec logs response and log events to the console.

It uses `@hapi/good-squeeze` to select only log and response events.

Events that pass the filter stream to `@hapi/good-console` for formatting. See the `good console` [constructor docs](https://github.com/hapijs/good-console#new-goodconsoleconfig) for details on `args` values.

Formatted events stream to `process.stdout` for display.
