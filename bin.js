#! /usr/bin/env node

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
  'fastify-leveldb',
  'fastify-elasticsearch'
]

const args = minimist(process.argv.slice(2), {
  boolean: ['npm-logs', 'verbose', 'log-errors', 'help'],
  string: ['fastify'],
  alias: {
    'npm-logs': 'N',
    'verbose': 'V',
    'log-errors': 'L',
    'fastify': 'F',
    'help': 'H'
  },
  default: {
    'npm-logs': false,
    'verbose': false,
    'log-errors': false,
    'fastify': 'fastify/fastify#next',
    'help': false
  }
})

if (args.help) {
  try {
    console.log(chalk.cyan(fs.readFileSync(path.resolve(__dirname, 'help.txt'), 'utf8')))
  } catch (err) {
    console.log(chalk.red(err))
  }
  process.exit()
}

plugins.forEach(plugin => {
  if (skipPlugins.indexOf(plugin) > -1) return
  q.add(worker, plugin)
})

q.drain(done => {
  console.log(chalk.green('Finish'))
  done()
})

function worker (q, plugin, done) {
  const log = Logger()
  log.text(`Testing plugin ${plugin}`)
  // get the plugin path
  const pluginPath = path.join(__dirname, 'node_modules', plugin)
  // use master branch of fastify
  const success = updatePluginFastify.call(this, pluginPath)
  if (!success) {
    log.warn(`Cannot update plugin ${plugin}`)
    done()
    return
  }

  // get node and npm binaries
  const nodeBin = which('node', { path: process.env.PATH })
  const npmBin = which('npm', { path: process.env.PATH })
  // install plugin dependencies
  log.text(`Installing dependencies ${plugin}`)
  installDeps(nodeBin, npmBin, pluginPath, err => {
    if (err) {
      log.warn(`${plugin} install deps failed!`)
      return done()
    }

    // run plugin tests
    log.text(`Running test ${plugin}`)
    runTest(nodeBin, npmBin, pluginPath, err => {
      if (err) {
        log.fail(`${plugin} test not ok!`)
      } else {
        log.succeed(`${plugin} test ok!`)
      }
      done()
    })
  })
}

function installDeps (nodeBin, npmBin, pluginPath, cb) {
  const install = child.spawn(nodeBin, [npmBin, 'install'], { cwd: pluginPath })
  var log = ''

  install.stdout.on('data', data => {
    log += data
  })

  install.stderr.on('data', (data) => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.red(data.toString()))
    }
  })

  install.on('close', code => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.magenta(log.toString()))
    }
    cb(code > 0 ? new Error('Install failed') : null)
  })
}

function runTest (nodeBin, npmBin, pluginPath, cb) {
  const test = child.spawn(nodeBin, [npmBin, 'test'], { cwd: pluginPath })
  var log = ''

  test.stdout.on('data', data => {
    log += data
  })

  test.stderr.on('data', (data) => {
    if (args['npm-logs'] && args['verbose']) {
      console.log(chalk.red(data.toString()))
    }
  })

  test.on('close', code => {
    if (args['verbose'] || (args['log-errors'] && code > 0)) {
      console.log(chalk.yellow(log.toString()))
    }
    cb(code > 0 ? new Error('Test failed') : null)
  })
}

function updatePluginFastify (pluginPath) {
  const packageJsonPath = path.join(pluginPath, 'package.json')

  try {
    var packageJson = require(packageJsonPath)
    packageJson.devDependencies.fastify = args['fastify']
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
