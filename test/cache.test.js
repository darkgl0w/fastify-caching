'use strict'

const http = require('http')
const test = require('tap').test
const plugin = require('../plugin')

const fastify = require('fastify')

test('cache property gets added to instance', (t) => {
  t.plan(2)
  const instance = fastify()
  instance
    .register(plugin)
    .ready(() => {
      t.ok(instance.cache)
      t.ok(instance.cache.set)
    })
})

test('cache is usable - kill the flackyness using !!', (t) => {
  t.plan(6)

  const instance = fastify()
  t.teardown(() => instance.close())

  instance
    .register((i, o, n) => {
      i.addHook('onRequest', function (req, reply, done) {
        t.notOk(i[Symbol.for('fastify-caching.registered')])
        done()
      })
      n()
    })
    .register(plugin)

  instance.addHook('onRequest', function (req, reply, done) {
    t.equal(this[Symbol.for('fastify-caching.registered')], true)
    done()
  })

  instance.get('/one', (req, reply) => {
    instance.cache.set('one', { one: true }, 100, (err) => {
      if (err) return reply.send(err)
      reply.redirect('/two')
    })
  })

  instance.get('/two', (req, reply) => {
    instance.cache.get('one', (err, obj) => {
      if (err) t.threw(err)
      t.same(obj.item, { one: true })
      reply.send()
    })
  })

  instance.listen((err) => {
    t.error(err)

    instance.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        instance.inject({
          method: 'GET',
          path: response.headers.location
        }, (err, response) => {
          t.error(err)
        })
      }
    })
  })
})

test('cache is usable with function as plugin default options input', (t) => {
  t.plan(6)

  const instance = fastify()
  t.teardown(() => instance.close())

  instance
    .register((i, o, n) => {
      i.addHook('onRequest', function (req, reply, done) {
        t.notOk(i[Symbol.for('fastify-caching.registered')])
        done()
      })
      n()
    })
    .register(plugin, () => () => { })

  instance.addHook('onRequest', function (req, reply, done) {
    t.equal(this[Symbol.for('fastify-caching.registered')], true)
    done()
  })

  instance.get('/one', (req, reply) => {
    instance.cache.set('one', { one: true }, 100, (err) => {
      if (err) return reply.send(err)
      reply.redirect('/two')
    })
  })

  instance.get('/two', (req, reply) => {
    instance.cache.get('one', (err, obj) => {
      if (err) t.threw(err)
      t.same(obj.item, { one: true })
      reply.send()
    })
  })

  instance.listen((err) => {
    t.error(err)

    instance.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        instance.inject({
          method: 'GET',
          path: response.headers.location
        }, (err, response) => {
          t.error(err)
        })
      }
    })
  })
})

test('getting cache item with error returns error', (t) => {
  t.plan(4)
  const mockCache = {
    get: (info, callback) => callback(new Error('cache.get always errors')),
    set: (key, value, ttl, callback) => callback()
  }

  const instance = fastify()
  t.teardown(() => instance.close())
  instance.register(plugin, { cache: mockCache })

  instance.get('/one', (req, reply) => {
    instance.cache.set('one', { one: true }, 1000, (err) => {
      if (err) return reply.send(err)
      return reply
        .etag('123456')
        .send({ hello: 'world' })
    })
  })

  instance.get('/two', (req, reply) => {
    instance.cache.get('one', (err, obj) => {
      t.notOk(err)
      t.notOk(obj)
    })
  })

  instance.listen((err) => {
    t.error(err)

    instance.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      instance.inject({
        method: 'GET',
        path: '/two',
        headers: {
          'if-none-match': '123456'
        }
      }, (err, response) => {
        t.error(err)
        t.equal(response.statusCode, 500)
      })
    })
  })
})

test('etags get stored in cache', (t) => {
  t.plan(1)
  const instance = fastify()
  instance.register(plugin)

  instance.get('/one', (req, reply) => {
    reply
      .etag('123456')
      .send({ hello: 'world' })
  })

  instance.listen(0, (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/one`
    http
      .get(address, (res) => {
        const opts = {
          host: '127.0.0.1',
          port: portNum,
          path: '/one',
          headers: {
            'if-none-match': '123456'
          }
        }
        http
          .get(opts, (res) => {
            t.equal(res.statusCode, 304)
          })
          .on('error', t.threw)
      })
      .on('error', t.threw)
  })
})

test('etag cache life is customizable', (t) => {
  t.plan(1)
  const instance = fastify()
  instance.register(plugin)

  instance.get('/one', function (req, reply) {
    reply
      .etag('123456', 50)
      .send({ hello: 'world' })
  })

  instance.listen(0, (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const address = `http://127.0.0.1:${portNum}/one`
    http
      .get(address, (res) => {
        const opts = {
          host: '127.0.0.1',
          port: portNum,
          path: '/one',
          headers: {
            'if-none-match': '123456'
          }
        }
        setTimeout(() => {
          http
            .get(opts, (res) => {
              t.equal(res.statusCode, 200)
            })
            .on('error', t.threw)
        }, 150)
      })
      .on('error', t.threw)
  })
})

test('returns response payload', (t) => {
  t.plan(1)
  const instance = fastify()
  instance.register(plugin)

  instance.get('/one', (req, reply) => {
    reply
      .etag('123456', 300)
      .send({ hello: 'world' })
  })

  instance.listen(0, (err) => {
    if (err) t.threw(err)
    instance.server.unref()
    const portNum = instance.server.address().port
    const opts = {
      host: '127.0.0.1',
      port: portNum,
      path: '/one'
    }
    http
      .get(opts, (res) => {
        let payload = ''
        res.on('data', (chunk) => {
          payload += chunk
        }).on('end', () => {
          t.same(JSON.parse(payload), { hello: 'world' })
        }).on('error', t.threw)
      })
      .on('error', t.threw)
  })
})
