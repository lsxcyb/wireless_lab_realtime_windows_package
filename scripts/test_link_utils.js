const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLinkKey,
  removeLinkByKey,
  buildLinkRules,
  getSatisfiedRequiredGroupCount,
  getMissingRequiredGroups,
  getLinkIssue,
} = require('../client/assets/link-utils.js');

const linkGroups = [
  {
    id: 'pc-router',
    label: '电脑接入无线路由器',
    pairs: [
      ['pc:NIC', 'router:LAN1'],
      ['pc:NIC', 'router:LAN2'],
    ],
  },
  {
    id: 'router-modem',
    label: '路由器 WAN 接入光猫 LAN1',
    pairs: [['router:WAN', 'modem:LAN1']],
  },
  {
    id: 'modem-splitter',
    label: '光猫光口接入分光器',
    pairs: [['modem:光口', 'splitter:PON']],
  },
  {
    id: 'tablet-wlan',
    label: '学生平板接入路由器 WLAN',
    required: false,
    pairs: [['tablet:WiFi', 'router:WLAN']],
  },
];

const linkRules = buildLinkRules(linkGroups);

test('normalizeLinkKey returns stable key regardless of endpoint order', () => {
  assert.equal(
    normalizeLinkKey('router:WAN', 'modem:LAN1'),
    normalizeLinkKey('modem:LAN1', 'router:WAN')
  );
});

test('removeLinkByKey removes matching link regardless of stored endpoint order', () => {
  const links = [
    ['router:WAN', 'modem:LAN1'],
    ['pc:NIC', 'router:LAN1'],
  ];

  const result = removeLinkByKey(links, normalizeLinkKey('modem:LAN1', 'router:WAN'));

  assert.deepEqual(result, [['pc:NIC', 'router:LAN1']]);
});

test('removeLinkByKey leaves unrelated links untouched', () => {
  const links = [['pc:NIC', 'router:LAN1']];

  const result = removeLinkByKey(links, normalizeLinkKey('tablet:WiFi', 'router:WLAN'));

  assert.deepEqual(result, links);
});

test('LAN1 and LAN2 are both valid teacher PC uplinks', () => {
  assert.equal(getLinkIssue('pc:NIC', 'router:LAN1', linkRules, [['pc:NIC', 'router:LAN1']]), null);
  assert.equal(getLinkIssue('pc:NIC', 'router:LAN2', linkRules, [['pc:NIC', 'router:LAN2']]), null);
});

test('tablet WiFi to router WLAN is valid optional connection', () => {
  assert.equal(getLinkIssue('tablet:WiFi', 'router:WLAN', linkRules, [['tablet:WiFi', 'router:WLAN']]), null);
});

test('getLinkIssue explains computer connected to modem optical port as invalid', () => {
  const issue = getLinkIssue('pc:NIC', 'modem:光口', linkRules, [['pc:NIC', 'modem:光口']]);

  assert.match(issue, /电脑/);
  assert.match(issue, /无线路由器 LAN1/);
  assert.match(issue, /无线路由器 LAN2/);
});

test('getLinkIssue explains router WAN connected to tablet as invalid', () => {
  const issue = getLinkIssue('router:WAN', 'tablet:WiFi', linkRules, [['router:WAN', 'tablet:WiFi']]);

  assert.match(issue, /路由器 WAN/);
  assert.match(issue, /光猫 LAN1/);
});

test('duplicate link on same endpoint is flagged immediately', () => {
  const links = [
    ['pc:NIC', 'router:LAN1'],
    ['pc:NIC', 'router:LAN2'],
  ];

  const issue = getLinkIssue('pc:NIC', 'router:LAN1', linkRules, links);

  assert.match(issue, /同时连接/);
  assert.match(issue, /LAN1/);
  assert.match(issue, /LAN2/);
});

test('required group count accepts LAN2 as valid teacher uplink', () => {
  const links = [
    ['pc:NIC', 'router:LAN2'],
    ['router:WAN', 'modem:LAN1'],
    ['modem:光口', 'splitter:PON'],
  ];

  assert.equal(getSatisfiedRequiredGroupCount(links, linkRules), 3);
  assert.deepEqual(getMissingRequiredGroups(links, linkRules), []);
});
