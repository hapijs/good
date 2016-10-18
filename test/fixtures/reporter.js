'use strict';

const Stream = require('stream');

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

module.exports = Writer;
