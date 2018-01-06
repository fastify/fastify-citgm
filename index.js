'use strict'

// Node core
const fs = require('fs')
const path = require('path')
const child = require('child_process')
// npm
const minimist = require('minimist')
const which = require('which').sync
const q = require('workq')()
const pino = require('pino')
const pinoColada = require('pino-colada')()

// Plugins to test
const plugins = Object.keys(require('./package.json').dependencies)
const skipPlugins = [
  'fastify-mongodb',
  'fastify-redis',
  'fastify-postgres',
  'fastify-leveldb'
]

const args = minimist(process.argv.slice(2), {
  string: ['log-level'],
  boolean: ['npm-logs'],
  alias: {
    'log-level': 'L',
    'npm-logs': 'N'
  },
  default: {
    'log-level': 'info',
    'npm-logs': false
  }
})

pinoColada.pipe(process.stdout)
const log = pino({
  level: args['log-level']
}, pinoColada)

plugins.forEach(plugin => {
  if (skipPlugins.indexOf(plugin) > -1) return
  q.add(worker.bind({ plugin }))
})

q.drain(done => {
  log.info('finish')
  done()
})

function worker (q, done) {
  log.info(`Started working on plugin ${this.plugin}`)
  // get the plugin path
  const pluginPath = path.resolve(__dirname, 'node_modules', this.plugin)
  // use master branch of fastify
  const success = updatePluginFastify.call(this, pluginPath)
  if (!success) {
    log.info(`Cannot update plugin ${this.plugin}`)
    done()
    return
  }

  // get node and npm binaries
  const nodeBin = which('node', { path: process.env.PATH })
  const npmBin = which('npm', { path: process.env.PATH })
  // install plugin dependencies
  installDeps(nodeBin, npmBin, pluginPath, err => {
    if (err) {
      log.warn(`${this.plugin} install deps failed!`)
      return done()
    }

    // run plugin tests
    runTest(nodeBin, npmBin, pluginPath, err => {
      if (err) {
        log.warn(`${this.plugin} test not ok!`)
      } else {
        log.info(`${this.plugin} test ok!`)
      }
      done()
    })
  })
}

function installDeps (nodeBin, npmBin, pluginPath, cb) {
  const install = child.spawn(nodeBin, [npmBin, 'install'], { cwd: pluginPath })

  install.stdout.on('data', data => {
    if (args['npm-logs']) {
      log.debug(data.toString())
    }
  })

  install.stderr.on('data', (data) => {
    if (args['npm-logs']) {
      log.error(data.toString())
    }
  })

  install.on('close', code => {
    cb(code > 0 ? new Error('Install failed') : null)
  })
}

function runTest (nodeBin, npmBin, pluginPath, cb) {
  const test = child.spawn(nodeBin, [npmBin, 'test'], { cwd: pluginPath })

  test.stdout.on('data', data => {
    log.debug(data.toString())
  })

  test.stderr.on('data', (data) => {
    if (args['npm-logs']) {
      log.error(data.toString())
    }
  })

  test.on('close', code => {
    cb(code > 0 ? new Error('Test failed') : null)
  })
}

function updatePluginFastify (pluginPath) {
  const packageJsonPath = path.resolve(pluginPath, 'package.json')

  try {
    var packageJson = require(packageJsonPath)
    packageJson.devDependencies.fastify = 'git+https://github.com/fastify/fastify.git'
  } catch (err) {
    log.debug(`Cannot open or update package.json for plugin ${this.plugin}`, err)
    return false
  }

  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
  } catch (err) {
    log.debug(`Cannot overwrite package.json for plugin ${this.plugin}`, err)
    return false
  }

  return true
}
