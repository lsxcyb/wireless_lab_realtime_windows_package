(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LabData = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const assetVersion = '20260415a';
  const photos = {
    pc: `/client/assets/devices/pc.svg?v=${assetVersion}`,
    router: `/client/assets/devices/router.svg?v=${assetVersion}`,
    modem: `/client/assets/devices/modem.svg?v=${assetVersion}`,
    splitter: `/client/assets/devices/splitter.svg?v=${assetVersion}`,
    tablet: `/client/assets/devices/tablet.svg?v=${assetVersion}`,
  };

  const deviceBlueprints = [
    { id: 'pc', name: '电脑', type: '终端', x: 90, y: 120, ports: ['NIC'], multiInstance: true },
    { id: 'router', name: '无线路由器', type: '核心设备', x: 320, y: 250, ports: ['WAN', 'LAN1', 'LAN2', 'WLAN'] },
    { id: 'modem', name: '光猫', type: '接入设备', x: 620, y: 120, ports: ['LAN1', 'LAN2', 'LAN4', 'ITV', '光口'] },
    { id: 'splitter', name: '分光器', type: '光纤接入', x: 900, y: 120, ports: ['PON'] },
    { id: 'tablet', name: '学生平板', type: '无线终端', x: 600, y: 430, ports: ['WiFi'], multiInstance: true },
  ];

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

  const demoLinks = [
    ['pc:NIC', 'router:LAN1'],
    ['router:WAN', 'modem:LAN1'],
    ['modem:光口', 'splitter:PON'],
    ['tablet:WiFi', 'router:WLAN'],
  ];

  const baseNetworks = ['Cafe-Free', 'School-Guest', 'Unknown_Free_WiFi'];

  function createDevices() {
    return deviceBlueprints.map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type,
      x: device.x,
      y: device.y,
      ports: [...device.ports],
      multiInstance: device.multiInstance === true,
    }));
  }

  function createDemoLinks() {
    return demoLinks.map(([a, b]) => [a, b]);
  }

  return {
    photos,
    linkGroups,
    baseNetworks,
    createDevices,
    createDemoLinks,
  };
});
