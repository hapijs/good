'use strict';

const Stream = require('stream');

class Incrementer extends Stream.Transform {
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
}

class Stringify extends Stream.Transform {
    constructor() {

        super({ objectMode: true });
        this.once('end', () => {

            this._finalized = true;
        });
    }
    _transform(value, encoding, callback) {

        callback(null, JSON.stringify(value) + '\n');
    }
}

class Namer extends Stream.Transform {
    constructor(name) {

        super({ objectMode: true });
        this.name = name || '';
    }
    _transform(value, encoding, callback) {

        value.name = this.name;
        callback(null, value);
    }
}

class Writer extends Stream.Writable {
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
}

class Cleaner extends Stream.Transform {
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
}

const NotConstructor = {};
const NotStream = function () {};

module.exports = { Incrementer, Stringify, Writer, NotConstructor, NotStream, Namer, Cleaner };
