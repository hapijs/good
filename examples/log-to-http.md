# Log to HTTP

## Basic Example

```
http: [{
    module: 'good-squeeze',
    name: 'Squeeze',
    args: [{ error: '*' }]
}, {
    module: 'good-http',
    args: [
        'http://prod.logs:3000',
        {
            wreck: {
                headers: { 'x-api-key': 12345 }
            }
        }
    ]
}
```

### Discussion

This reporter spec logs error events to the console.

It uses the `good-squeeze` Squeeze function to select only error events.

Events that pass the filter stream through `good-http` to the endpoint URL specified in the `args` array. See the `good-http` [constructor docs](https://github.com/hapijs/good-http#goodhttp-endpoint-config) for other arguments and payload details.