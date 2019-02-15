# Add custom transform stream

## Basic transform stream class

```js
class LogDateTransform extends Stream.Transform {
    constructor() {
        super({ objectMode: true });
    }

    _transform(data, enc, next) {
        const date = new Date(Date.now()).toLocaleString("en-US");

        if (data.data) {
            return next(null, `${data.event}: ${date}: ${data.data}\n`);
        }
        next(null);
    }
}
```

## Good options

```js
const init = async () => {

    await server.register({
        plugin: Good,
        options: {
            ops: {
                interval: 1000
            },
            reporters: {
                myReporter: [
                    new LogDateTransform(),
                    'stdout'
                ]
            }
        }
    });

    await server.start();

    server.log('info', 'Server is running...');
};
```

This will show something like:
```
log: 2/15/2019, 9:49:07 AM: Server is running...
```

This reporter logs data with a date time.
