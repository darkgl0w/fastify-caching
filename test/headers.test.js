'use strict'

const { test } = require('tap')
const plugin = require('../plugin')
const Fastify = require('fastify')

test('decorators get added', (t) => {
  t.plan(3)

  const fastify = Fastify()
  fastify.register(plugin)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    t.ok(reply.etag)
    reply.send()
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err) => {
      t.error(err)
    })
  })
})

test('decorators add headers', (t) => {
  t.plan(4)

  const tag = '123456'
  const fastify = Fastify()
  fastify.register(plugin)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply
      .etag(tag)
      .send()
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers.etag)
      t.equal(response.headers.etag, tag)
    })
  })
})

test('sets etag header for falsy argument', (t) => {
  t.plan(3)

  const fastify = Fastify()
  fastify.register(plugin)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply
      .etag()
      .send()
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers.etag)
    })
  })
})

test('sets no-cache header', (t) => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(plugin, { privacy: plugin.privacy.NOCACHE })

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'no-cache')
    })
  })
})

test('sets private with max-age header', (t) => {
  t.plan(4)

  const opts = {
    privacy: plugin.privacy.PRIVATE,
    expiresIn: 300
  }

  const fastify = Fastify()
  fastify.register(plugin, opts)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'private, max-age=300')
    })
  })
})

test('sets public with max-age and s-maxage header', (t) => {
  t.plan(4)

  const opts = {
    privacy: plugin.privacy.PUBLIC,
    expiresIn: 300,
    serverExpiresIn: 12345
  }

  const fastify = Fastify()
  fastify.register(plugin, opts)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'public, max-age=300, s-maxage=12345')
    })
  })
})

test('only sets max-age and ignores s-maxage with private header', (t) => {
  t.plan(4)

  const opts = {
    privacy: plugin.privacy.PRIVATE,
    expiresIn: 300,
    serverExpiresIn: 12345
  }

  const fastify = Fastify()
  fastify.register(plugin, opts)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'private, max-age=300')
    })
  })
})

test('s-maxage is optional with public header', (t) => {
  t.plan(4)

  const opts = {
    privacy: plugin.privacy.PUBLIC,
    expiresIn: 300
  }

  const fastify = Fastify()
  fastify.register(plugin, opts)

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'public, max-age=300')
    })
  })
})

test('sets no-store with max-age header', (t) => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(plugin, { privacy: 'no-store', expiresIn: 300 })

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply.send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers['cache-control'])
      t.equal(response.headers['cache-control'], 'no-store, max-age=300')
    })
  })
})

test('sets the expires header', (t) => {
  t.plan(4)

  const now = new Date()

  const fastify = Fastify()
  fastify.register(plugin, { privacy: plugin.privacy.NOCACHE })

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply
      .expires(now)
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers.expires)
      t.equal(response.headers.expires, now.toUTCString())
    })
  })
})

test('sets the expires header to a falsy value', (t) => {
  t.plan(3)

  const fastify = Fastify()
  fastify.register(plugin, { privacy: plugin.privacy.NOCACHE })

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply
      .expires()
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.notOk(response.headers.expires)
    })
  })
})

test('sets the expires header to a custom value', (t) => {
  t.plan(4)

  const fastify = Fastify()
  fastify.register(plugin, { privacy: plugin.privacy.NOCACHE })

  t.teardown(() => fastify.close())

  fastify.get('/', (req, reply) => {
    reply
      .expires('foobar')
      .send({ hello: 'world' })
  })

  fastify.listen((err) => {
    t.error(err)

    fastify.inject({
      method: 'GET',
      path: '/'
    }, (err, response) => {
      t.error(err)

      t.ok(response.headers.expires)
      t.equal(response.headers.expires, 'foobar')
    })
  })
})
