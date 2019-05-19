# Add write stream to write to a file

## Basic write stream class

```js
const Fs = require('fs-extra');

const internals = {
    defaults: {
        encoding: 'utf8',
        flags: 'a',
        mode: 0o666
    }
};

class GoodFile extends Fs.WriteStream {
    constructor(path, options) {

        const settings = Object.assign({}, internals.defaults, options);
        settings.fd = -1; // prevent open from being called in `super`

        super(path, settings);
        this.open();
    }
    open() {

        this.fd = null;
        Fs.ensureFile(this.path, (err) => {

            if (err) {
                this.destroy();
                this.emit('error', err);
                return;
            }
            super.open();
        });
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
                  {
                    module: '@hapi/good-squeeze', // safely transform payload into a string
                    name: 'SafeJson'
                  },
                  {
                    module: GoodFile,
                    args: ['./logs/stuff']
                  }
                ]
            }
        }
    });

    await server.start();

    server.log(['log'], 'Server Started');
};
```

This will create a new entry like this:
```js
{"event":"log","timestamp":1557790855556,"tags":["log"],"data":"Server Started","pid":1714}
```
