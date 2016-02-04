'use strict';

const Stream = require('stream');
const Pumpify = require('pumpify');

const dataStream = new Stream.Readable({ objectMode: true });
dataStream._read = () => {};

dataStream.once('end', () => {
  console.log('read stream end');
});

class RandomID extends Stream.Transform {
  constructor(options) {
    super(options);
    this.once('end', () => {
      console.log('ended');
    });
  }
  _transform(chunk, encoding, callback) {
    chunk.id = Math.random();
    callback(null, chunk);
  }
}

class Stringify extends Stream.Transform {
  constructor(options) {
    super(options);
  }
  _transform(chunk, encoding, callback) {
    callback(null, JSON.stringify(chunk) + '\n');
  }
}

const randomid = new RandomID({ objectMode: true });
const stringify = new Stringify({ objectMode: true });


const pipeline = Pumpify.obj(randomid, stringify, process.stdout);

//dataStream.pipe(pipeline);
debugger;

// pipeline.write({
//   foo: 'bar'
// });

for (var i = 0; i < 1000; i++) {
  pipeline.write({i});
}
pipeline.end();

//dataStream.push(null);
