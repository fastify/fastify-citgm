'use strict'

// Node core
const fs = require('fs')
const path = require('path')
const child = require('child_process')
// npm
const minimist = require('minimist')
const which = require('which').sync
const q = require('workq')()
const chalk = require('chalk')

// utils
const Logger = require('./log')

// Plugins to test
const plugins = Object.keys(require('./package.json').dependencies)
const skipPlugins = [
  'fastify-mongodb',
  'fastify-redis',
  'fastify-postgres',
  'fastify-leveldb'
]

const args = minimist(process.argv.slice(2), {
  boolean: ['npm-logs', 'verbose'],
  alias: {
    'npm-logs': 'N',
    'verbose': 'V'
  },
  default: {
    'npm-logs': false,
    'verbose': false
  }
})

plugins.forEach(plugin => {
  if (skipPlugins.indexOf(plugin) > -1) return
  q.add(worker.bind({ plugin }))
})

q.drain(done => {
  console.log(chalk.green('Finish'))
  done()
})

function worker (q, done) {
  const log = Logger()
  log.text(`Testing plugin ${this.plugin}`)
  // get the plugin path
  const pluginPath = path.resolve(__dirname, 'node_modules', this.plugin)
  // use master branch of fastify
  const success = updatePluginFastify.call(this, pluginPath)
  if (!success) {
    log.warn(`Cannot update plugin ${this.plugin}`)
    done()
    return
  }

  // get node and npm binaries
  const nodeBin = which('node', { path: process.env.PATH })
  const npmBin = which('npm', { path: process.env.PATH })
  // install plugin dependencies
  log.text(`Installing dependencies ${this.plugin}`)
  installDeps(nodeBin, npmBin, pluginPath, err => {
    if (err) {
      log.warn(`${this.plugin} install deps failed!`)
      return done()
    }

    // run plugin tests
    log.text(`Running test ${this.plugin}`)
    runTest(nodeBin, npmBin, pluginPath, err => {
      if (err) {
        log.fail(`${this.plugin} test not ok!`)
      } else {
        log.succeed(`${this.plugin} test ok!`)
      }
      done()
    })
  })
}

function installDeps (nodeBin, npmBin, pluginPath, cb) {
  const install = child.spawn(nodeBin, [npmBin, 'install'], { cwd: pluginPath })

  install.stdout.on('data', data => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.yellow(data.toString()))
    }
  })

  install.stderr.on('data', (data) => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.red(data.toString()))
    }
  })

  install.on('close', code => {
    cb(code > 0 ? new Error('Install failed') : null)
  })
}

function runTest (nodeBin, npmBin, pluginPath, cb) {
  const test = child.spawn(nodeBin, [npmBin, 'test'], { cwd: pluginPath })

  test.stdout.on('data', data => {
    if (args['verbose']) {
      console.log(chalk.yellow(data.toString()))
    }
  })

  test.stderr.on('data', (data) => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.red(data.toString()))
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
    console.log(chalk.red(`Cannot open or update package.json for plugin ${this.plugin}`), err)
    return false
  }

  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
  } catch (err) {
    console.log(chalk.red(`Cannot overwrite package.json for plugin ${this.plugin}`), err)
    return false
  }

  return true
}
