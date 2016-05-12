# `good-squeeze` Tips

- [Separators in JSON Streams](#separators-in-json-streams)
- [Tag Filtering](#tag-filtering)

## Separators in JSON Streams

To insert a comma between JSON-formatted objects, add `args` to the SafeJson formatter. `good` passes the `args` array to the [SafeJson constructor](https://github.com/hapijs/good-squeeze#safejsonoptions-stringify).

```
file: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{ ops: '*' }]
}, {
    module: 'good-squeeze',
    name: 'SafeJson',
    args: [
        null,
        { separator: ',' }
    ]
}, {
    module: 'good-file',
    args: ['./test/fixtures/awesome_log']
}]
```

## Tag Filtering

To filter events by tags, pass `good-squeeze` a string or array of tags. See the [Squeeze constructor docs](https://github.com/hapijs/good-squeeze#squeezeevents-options) and [Squeeze.subcription docs](https://github.com/hapijs/good-squeeze#squeezesubscriptionevents) for more details.

```
console: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{
        log: ['database', 'api'],
        response: 'hapi',
        error: '*'
    }]
}, {
    module: 'good-console'
}, 'stdout']
```

This reporter reports log events tagged `database`, `api` or both, response events tagged `hapi` and all error events.