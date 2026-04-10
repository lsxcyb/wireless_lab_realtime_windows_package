(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LinkUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeLinkKey(a, b) {
    return [a, b].slice().sort().join('|');
  }

  function removeLinkByKey(links, linkKey) {
    return links.filter(([a, b]) => normalizeLinkKey(a, b) !== linkKey);
  }

  function formatEndpointLabel(endpoint) {
    const labels = {
      'pc:NIC': '电脑 NIC',
      'router:WAN': '无线路由器 WAN',
      'router:LAN1': '无线路由器 LAN1',
      'router:LAN2': '无线路由器 LAN2',
      'router:WLAN': '无线路由器 WLAN',
      'modem:LAN1': '光猫 LAN1',
      'modem:LAN2': '光猫 LAN2',
      'modem:LAN4': '光猫 LAN4',
      'modem:ITV': '光猫 ITV',
      'modem:光口': '光猫 光口',
      'splitter:PON': '分光器 PON',
      'tablet:WiFi': '学生平板 WiFi',
    };

    return labels[endpoint] || endpoint;
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
      pairs: group.pairs.map(([a, b]) => [a, b]),
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
    const got = new Set(links.map(([a, b]) => normalizeLinkKey(a, b)));
    return linkRules.groups.filter(
      (group) => group.required && group.pairs.some(([a, b]) => got.has(normalizeLinkKey(a, b)))
    ).length;
  }

  function getMissingRequiredGroups(links, linkRules) {
    const got = new Set(links.map(([a, b]) => normalizeLinkKey(a, b)));
    return linkRules.groups.filter(
      (group) => group.required && !group.pairs.some(([a, b]) => got.has(normalizeLinkKey(a, b)))
    );
  }

  function getLinkIssue(a, b, linkRules, links) {
    const currentLinks = Array.isArray(links) ? links : [];
    const pairKey = normalizeLinkKey(a, b);
    const peersA = collectPeers(a, currentLinks);
    const peersB = collectPeers(b, currentLinks);

    if (peersA.length > 1) {
      return `${formatEndpointLabel(a)} 当前同时连接 ${formatEndpointList(peersA)}，一个端口只能保留一条连线。`;
    }

    if (peersB.length > 1) {
      return `${formatEndpointLabel(b)} 当前同时连接 ${formatEndpointList(peersB)}，一个端口只能保留一条连线。`;
    }

    if (linkRules.pairToGroup[pairKey]) {
      return null;
    }

    const expectedA = Array.from(linkRules.allowedPeers[a] || []);
    const expectedB = Array.from(linkRules.allowedPeers[b] || []);

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
    removeLinkByKey,
    formatEndpointLabel,
    buildLinkRules,
    getSatisfiedRequiredGroupCount,
    getMissingRequiredGroups,
    getLinkIssue,
  };
});
