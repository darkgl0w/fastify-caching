'use strict'

const { test } = require('tap')
const plugin = require('../plugin')

const Fastify = require('fastify')

test('cache property gets added to instance', (t) => {
  t.plan(2)
  const fastify = Fastify()
  fastify
    .register(plugin)
    .ready(() => {
      t.ok(fastify.cache)
      t.ok(fastify.cache.set)
    })
})

test('cache is usable - kill the flackyness using !!', (t) => {
  t.plan(6)

  const fastify = Fastify()
  t.teardown(() => fastify.close())

  fastify
    .register((i, o, n) => {
      i.addHook('onRequest', function (req, reply, done) {
        t.notOk(i[Symbol.for('fastify-caching.registered')])
        done()
      })
      n()
    })
    .register(plugin)

  fastify.addHook('onRequest', function (req, reply, done) {
    t.equal(this[Symbol.for('fastify-caching.registered')], true)
    done()
  })

  fastify.get('/one', (req, reply) => {
    fastify.cache.set('one', { one: true }, 100, (err) => {
      if (err) return reply.send(err)
      reply.redirect('/two')
    })
  })

  fastify.get('/two', (req, reply) => {
    fastify.cache.get('one', (err, obj) => {
      if (err) t.threw(err)
      t.same(obj.item, { one: true })
      reply.send()
    })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        fastify.inject({
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

  const fastify = Fastify()
  t.teardown(() => fastify.close())

  fastify
    .register((i, o, n) => {
      i.addHook('onRequest', function (req, reply, done) {
        t.notOk(i[Symbol.for('fastify-caching.registered')])
        done()
      })
      n()
    })
    .register(plugin, () => () => { })

  fastify.addHook('onRequest', function (req, reply, done) {
    t.equal(this[Symbol.for('fastify-caching.registered')], true)
    done()
  })

  fastify.get('/one', (req, reply) => {
    fastify.cache.set('one', { one: true }, 100, (err) => {
      if (err) return reply.send(err)
      reply.redirect('/two')
    })
  })

  fastify.get('/two', (req, reply) => {
    fastify.cache.get('one', (err, obj) => {
      if (err) t.threw(err)
      t.same(obj.item, { one: true })
      reply.send()
    })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        fastify.inject({
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

  const fastify = Fastify()
  t.teardown(() => fastify.close())
  fastify.register(plugin, { cache: mockCache })

  fastify.get('/one', (req, reply) => {
    fastify.cache.set('one', { one: true }, 1000, (err) => {
      if (err) return reply.send(err)
      return reply
        .etag('123456')
        .send({ hello: 'world' })
    })
  })

  fastify.get('/two', (req, reply) => {
    fastify.cache.get('one', (err, obj) => {
      t.notOk(err)
      t.notOk(obj)
    })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      fastify.inject({
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
  t.plan(4)
  const fastify = Fastify()
  t.teardown(() => fastify.close())
  fastify.register(plugin)

  fastify.get('/one', (req, reply) => {
    reply
      .etag('123456')
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      fastify.inject({
        method: 'GET',
        path: '/one',
        headers: {
          'if-none-match': '123456'
        }
      }, (err, response) => {
        t.error(err)
        t.equal(response.statusCode, 304)
      })
    })
  })
})

test('etag cache life is customizable', (t) => {
  t.plan(4)
  const fastify = Fastify()
  t.teardown(() => fastify.close())
  fastify.register(plugin)

  fastify.get('/one', function (req, reply) {
    reply
      .etag('123456', 50)
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      // We wait 150 milliseconds that the cache expires
      setTimeout(() => {
        fastify.inject({
          method: 'GET',
          path: '/one',
          headers: {
            'if-none-match': '123456'
          }
        }, (err, response) => {
          t.error(err)
          t.equal(response.statusCode, 200)
        })
      }, 150)
    })
  })
})

test('returns response payload', (t) => {
  t.plan(4)
  const fastify = Fastify()
  t.teardown(() => fastify.close())
  fastify.register(plugin)

  fastify.get('/one', (req, reply) => {
    reply
      .etag('123456', 300)
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/one'
    }, (err, response) => {
      t.error(err)

      fastify.inject({
        method: 'GET',
        path: '/one'
      }, (err, response) => {
        t.error(err)

        t.same(JSON.parse(response.payload), { hello: 'world' })
      })
    })
  })
})
