# Log to File

- [Basic Example](#basic-example)
- [Separators in JSON Streams](#Separators-in-JSON-streams)
- [Log Rotation](#log-rotation)

## Basic Example

```
file: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{ ops: '*' }]
}, {
    module: 'good-squeeze',
    name: 'SafeJson'
}, {
    module: 'good-file',
    args: ['./test/fixtures/awesome_log']
}]
```

This reporter spec logs ops events to a file.

It uses the `good-squeeze` Squeeze function to select only ops events.

Events that pass the filter stream to `good-squeeze` SafeJson for formatting.

JSON-formatted events stream to `good-file`, which writes them to `./test/fixtures/awesome_log`.

### Separators in JSON Streams

To insert a comma between JSON-formatted objects, add `args` to the SafeJson formatter. `good` passes the `args` array to the [SafeJson constructor](https://github.com/hapijs/good-squeeze#safejsonoptions-stringify).

```
file: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{ ops: '*' }]
}, {
    module: 'good-squeeze',
    name: 'SafeJson',
    args: [{}, { separator: ',' }]
}, {
    module: 'good-file',
    args: ['./test/fixtures/awesome_log']
}]
```

### Log Rotation

`good-file` does not do log rotation. See [rotating-file-stream](https://github.com/iccicci/rotating-file-stream) for one alternative. See the [rotating-file-stream constructor docs](https://github.com/iccicci/rotating-file-stream#new-rotatingfilestreamfilename-options) for parameter details.

```
file: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{ ops: '*' }]
}, {
    module: 'good-squeeze',
    name: 'SafeJson',
    args: [{}, { separator: ',' }]
}, {
    module: 'rotating-file-stream',
    args: ['ops_log', {
        size: '1000B',
        path: './logs'
    }]
}]
```

This reporter outputs JSON to files in the `./logs` directory that rotate when the file size exceeds 1000 bytes (useful for testing rotation). It uses `rotating-file-stream`'s default naming which is YYYYMMDD-HHMM-nn-filename (For example: `20160509-2056-01-ops_log`, `20160509-2056-02-ops_log`.)