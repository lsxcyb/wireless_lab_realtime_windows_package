(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LinkUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const multiInstanceBaseIds = new Set(['pc', 'tablet']);
  const sharedEndpoints = new Set(['router:WLAN']);
  const deviceLabels = {
    pc: '电脑',
    router: '无线路由器',
    modem: '光猫',
    splitter: '分光器',
    tablet: '学生平板',
  };

  function normalizeLinkKey(a, b) {
    return [a, b].slice().sort().join('|');
  }

  function removeLinkByKey(links, linkKey) {
    return links.filter(([a, b]) => normalizeLinkKey(a, b) !== linkKey);
  }

  function splitEndpoint(endpoint) {
    const [deviceId, port = ''] = String(endpoint || '').split(':');
    return { deviceId, port };
  }

  function getBaseDeviceId(deviceId) {
    const match = String(deviceId || '').match(/^(.*)-(\d+)$/);
    if (!match) return String(deviceId || '');
    return multiInstanceBaseIds.has(match[1]) ? match[1] : String(deviceId || '');
  }

  function getInstanceIndex(deviceId) {
    const match = String(deviceId || '').match(/^(.*)-(\d+)$/);
    if (!match || !multiInstanceBaseIds.has(match[1])) return null;
    return Number(match[2]);
  }

  function normalizeEndpoint(endpoint) {
    const { deviceId, port } = splitEndpoint(endpoint);
    const baseId = getBaseDeviceId(deviceId);
    return port ? `${baseId}:${port}` : baseId;
  }

  function isEndpointShared(endpoint) {
    return sharedEndpoints.has(normalizeEndpoint(endpoint));
  }

  function formatEndpointLabel(endpoint) {
    const { deviceId, port } = splitEndpoint(endpoint);
    const baseId = getBaseDeviceId(deviceId);
    const label = deviceLabels[baseId] || deviceId;
    const instanceIndex = getInstanceIndex(deviceId);
    const deviceLabel = instanceIndex ? `${label} ${instanceIndex}` : label;
    return port ? `${deviceLabel} ${port}` : deviceLabel;
  }

  function formatEndpointList(endpoints) {
    const labels = endpoints.map(formatEndpointLabel);
    if (labels.length <= 1) {
      return labels[0] || '';
    }
    if (labels.length === 2) {
      return `${labels[0]} 或 ${labels[1]}`;
    }
    return `${labels.slice(0, -1).join('、')} 或 ${labels[labels.length - 1]}`;
  }

  function buildLinkRules(linkGroups) {
    const allowedPeers = {};
    const pairToGroup = {};
    const groups = linkGroups.map((group) => ({
      id: group.id,
      label: group.label,
      required: group.required !== false,
      pairs: group.pairs.map(([a, b]) => [normalizeEndpoint(a), normalizeEndpoint(b)]),
    }));

    groups.forEach((group) => {
      group.pairs.forEach(([a, b]) => {
        if (!allowedPeers[a]) allowedPeers[a] = new Set();
        if (!allowedPeers[b]) allowedPeers[b] = new Set();
        allowedPeers[a].add(b);
        allowedPeers[b].add(a);
        pairToGroup[normalizeLinkKey(a, b)] = group.id;
      });
    });

    return {
      groups,
      allowedPeers,
      pairToGroup,
      requiredGroupIds: groups.filter((group) => group.required).map((group) => group.id),
    };
  }

  function collectPeers(endpoint, links) {
    const peers = [];
    links.forEach(([a, b]) => {
      if (a === endpoint) peers.push(b);
      if (b === endpoint) peers.push(a);
    });
    return peers;
  }

  function getSatisfiedRequiredGroupCount(links, linkRules) {
    const got = new Set(links.map(([a, b]) => normalizeLinkKey(normalizeEndpoint(a), normalizeEndpoint(b))));
    return linkRules.groups.filter(
      (group) => group.required && group.pairs.some(([a, b]) => got.has(normalizeLinkKey(a, b)))
    ).length;
  }

  function getMissingRequiredGroups(links, linkRules) {
    const got = new Set(links.map(([a, b]) => normalizeLinkKey(normalizeEndpoint(a), normalizeEndpoint(b))));
    return linkRules.groups.filter(
      (group) => group.required && !group.pairs.some(([a, b]) => got.has(normalizeLinkKey(a, b)))
    );
  }

  function getLinkIssue(a, b, linkRules, links) {
    const currentLinks = Array.isArray(links) ? links : [];
    const pairKey = normalizeLinkKey(normalizeEndpoint(a), normalizeEndpoint(b));
    const peersA = collectPeers(a, currentLinks);
    const peersB = collectPeers(b, currentLinks);

    if (!isEndpointShared(a) && peersA.length > 1) {
      return `${formatEndpointLabel(a)} 当前同时连接 ${formatEndpointList(peersA)}，一个端口只能保留一条连线。`;
    }

    if (!isEndpointShared(b) && peersB.length > 1) {
      return `${formatEndpointLabel(b)} 当前同时连接 ${formatEndpointList(peersB)}，一个端口只能保留一条连线。`;
    }

    if (linkRules.pairToGroup[pairKey]) {
      return null;
    }

    const expectedA = Array.from(linkRules.allowedPeers[normalizeEndpoint(a)] || []);
    const expectedB = Array.from(linkRules.allowedPeers[normalizeEndpoint(b)] || []);

    if (expectedA.length) {
      return `${formatEndpointLabel(a)} 可连接 ${formatEndpointList(expectedA)}，不应连接 ${formatEndpointLabel(b)}。`;
    }

    if (expectedB.length) {
      return `${formatEndpointLabel(b)} 可连接 ${formatEndpointList(expectedB)}，不应连接 ${formatEndpointLabel(a)}。`;
    }

    return `该连线不在实验标准拓扑中：${formatEndpointLabel(a)} 不应连接 ${formatEndpointLabel(b)}。`;
  }

  return {
    normalizeLinkKey,
    normalizeEndpoint,
    removeLinkByKey,
    formatEndpointLabel,
    buildLinkRules,
    getSatisfiedRequiredGroupCount,
    getMissingRequiredGroups,
    getLinkIssue,
    isEndpointShared,
  };
});
