'use strict';

const Stream = require('stream');


const internals = {};


exports.NotConstructor = {};


exports.NotStream = function () { };


exports.Incrementer = class extends Stream.Transform {

    constructor(starting) {

        super({ objectMode: true });
        this.starting = starting;
        this.once('end', () => {

            this._finalized = true;
        });
    }

    _transform(value, encoding, callback) {

        value.number = value.number + this.starting;
        callback(null, value);
    }
};


exports.Stringify = class extends Stream.Transform {

    constructor() {

        super({ objectMode: true });
        this.once('end', () => {

            this._finalized = true;
        });
    }

    _transform(value, encoding, callback) {

        callback(null, JSON.stringify(value) + '\n');
    }
};


exports.Namer = class extends Stream.Transform {

    constructor(name) {

        super({ objectMode: true });
        this.name = name || '';
    }

    _transform(value, encoding, callback) {

        value.name = this.name;
        callback(null, value);
    }
};


exports.Writer = class extends Stream.Writable {

    constructor(objectMode) {

        super({ objectMode });
        this.data = [];
        this.once('finish', () => {

            this._finalized = true;
        });
    }

    _write(chunk, end, callback) {

        this.data.push(chunk);
        callback(null);
    }
};


exports.Cleaner = class extends Stream.Transform {

    constructor(remove) {

        super({ objectMode: true });
        this.remove = [].concat(remove);
    }

    _transform(value, encoding, callback) {

        for (let i = 0; i < this.remove.length; ++i) {
            const key = this.remove[i];
            delete value[key];
        }

        callback(null, value);
    }
};
