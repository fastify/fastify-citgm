# fastify-citgm

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/) [![Build Status](https://travis-ci.org/fastify/fastify-citgm.svg?branch=master)](https://travis-ci.org/fastify/fastify-citgm)

Command line tool to run the test of every Fastify plugin with a specified version of Fastify (default master branch).

## Usage
```
git clone https://github.com/fastify/fastify-citgm.git
npm install
./bin.js [args]
```

### Arguments
```
--fastify -F         Pass a custom fastify version, default to master branch

--verbose, -V        Enable verbose logs

--log-errors, -L     Log output of the failing test

--npm-logs, -N       Enable npm logs

--help, -H           Print this message
```

## Contributing
If you feel you can help in any way, be it with examples, extra testing, or new features please open a pull request or open an issue.


## Acknowledgements
This project is kindly sponsored by:
- [LetzDoIt](http://www.letzdoitapp.com/)

## License
**[MIT](https://github.com/fastify/fastify-citgm/blob/master/LICENSE)**
