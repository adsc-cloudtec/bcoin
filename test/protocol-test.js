/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off" */
/* eslint indent: "off" */

'use strict';

const assert = require('./util/assert');
const Network = require('../lib/protocol/network');
const util = require('../lib/utils/util');
const NetAddress = require('../lib/primitives/netaddress');
const TX = require('../lib/primitives/tx');
const Framer = require('../lib/net/framer');
const Parser = require('../lib/net/parser');
const packets = require('../lib/net/packets');
const common = require('./util/common');
const network = Network.get('main');

const tx8 = common.parseTX('tx8');
const tx9 = common.parseTX('tx9');

describe('Protocol', function() {
  const pkg = require('../lib/pkg');
  const agent = `/bcoin:${pkg.version}/`;
  let parser, framer;

  beforeEach(() => {
    parser = new Parser();
    framer = new Framer();
  });

  function packetTest(cmd, payload, test) {
    it(`should encode/decode ${cmd}`, (cb) => {
      parser.once('packet', (packet) => {
        try {
          assert.strictEqual(packet.cmd, cmd);
          test(packet);
        } catch (e) {
          cb(e);
          return;
        }
        cb();
      });
      const raw = framer.packet(cmd, payload.toRaw());
      parser.feed(raw);
    });
  }

  const v1 = packets.VersionPacket.fromOptions({
    version: 300,
    services: 1,
    time: network.now(),
    remote: new NetAddress(),
    local: new NetAddress(),
    nonce: util.nonce(),
    agent: agent,
    height: 0,
    noRelay: false
  });

  packetTest('version', v1, (payload) => {
    assert.strictEqual(payload.version, 300);
    assert.strictEqual(payload.agent, agent);
    assert.strictEqual(payload.height, 0);
    assert.strictEqual(payload.noRelay, false);
  });

  const v2 = packets.VersionPacket.fromOptions({
    version: 300,
    services: 1,
    time: network.now(),
    remote: new NetAddress(),
    local: new NetAddress(),
    nonce: util.nonce(),
    agent: agent,
    height: 10,
    noRelay: true
  });

  packetTest('version', v2, (payload) => {
    assert.strictEqual(payload.version, 300);
    assert.strictEqual(payload.agent, agent);
    assert.strictEqual(payload.height, 10);
    assert.strictEqual(payload.noRelay, true);
  });

  packetTest('verack', new packets.VerackPacket(), (payload) => {
  });

  const hosts = [
    new NetAddress({
      services: 1,
      host: '127.0.0.1',
      port: 8333,
      time: util.now()
    }),
    new NetAddress({
      services: 1,
      host: '::123:456:789a',
      port: 18333,
      time: util.now()
    })
  ];

  packetTest('addr', new packets.AddrPacket(hosts), (payload) => {
    assert.typeOf(payload.items, 'array');
    assert.strictEqual(payload.items.length, 2);

    assert.typeOf(payload.items[0].time, 'number');
    assert.strictEqual(payload.items[0].services, 1);
    assert.strictEqual(payload.items[0].host, hosts[0].host);
    assert.strictEqual(payload.items[0].port, hosts[0].port);

    assert.typeOf(payload.items[1].time, 'number');
    assert.strictEqual(payload.items[1].services, 1);
    assert.strictEqual(payload.items[1].host, hosts[1].host);
    assert.strictEqual(payload.items[1].port, hosts[1].port);
  });

  it('should include the raw data of only one transaction', () => {
    const raw = Buffer.concat([tx8.tx.toRaw(), tx9.tx.toRaw()]);

    const tx = TX.fromRaw(raw);
    tx.refresh();

    assert.bufferEqual(tx.toRaw(), tx8.tx.toRaw());
  });
});
