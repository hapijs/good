# Censoring Data with `white-out`

## Basic Example

```
console: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{
        log: '*',
        response: '*'
    }]
}, {
    module: 'white-out',
    args: [{
        password: 'remove',
        age: 'censor'
    }]
}, {
    module: 'good-console'
}, 'stdout']
```

This reporter spec logs response and log events to the console. It removes any data with key `password` (will not appear in output) and censors data with key `age` (appears as Xs).

It uses `good-squeeze` to select only log and response events.

Events that pass the filter go to `white-out` to censor or remove identified keys. Note that `white-out` will look for keys in the entire object, including nested objects.

Sanitized event data streams to `good-console` for formatting. See the `good console` [constructor docs](https://github.com/hapijs/good-console#new-goodconsoleconfig) for details on `args` values.

Formatted events stream to `process.stdout` for display.

You can use `white-out` with files, http, and other output types by adding the `white-out` configuration to the stream spec. See [white-out](https://github.com/continuationlabs/white-out) for more details.