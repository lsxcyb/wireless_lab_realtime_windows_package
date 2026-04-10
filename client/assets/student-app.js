const photos = LabData.photos;
const allDevices = LabData.createDevices();
const linkGroups = LabData.linkGroups;
const linkRules = LinkUtils.buildLinkRules(linkGroups);
const requiredLinkGroupCount = linkGroups.filter((group) => group.required !== false).length;
const baseNetworks = [...LabData.baseNetworks];
const state = { mode: 'place', selectedPort: null, links: [], config: null, joined: false, socket: null, dragging: null, hoveredLink: null, placedDeviceIds: [], paletteDragId: null };
const boot = { autoConnect: document.body.dataset.autoConnect === 'true', defaultRoom: document.body.dataset.defaultRoom || 'classroom-101' };
const $ = (id) => document.getElementById(id);
const workspace = $('workspace');
const svg = $('svg');
let demoRevealTimer = null;

function log(text) { $('log').textContent += `\n${text}`; $('log').scrollTop = $('log').scrollHeight; }
function setLinkNotice({ tone = 'info', title, detail, icon }) { $('linkNoticeCard').className = `noticeCard notice-${tone}`; $('linkNoticeTitle').textContent = title; $('linkNoticeText').textContent = detail; $('linkNoticeIcon').textContent = icon; }
function syncThemeButton() { $('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '切换浅色' : '切换深色'; }
function correctLinks() { return LinkUtils.getSatisfiedRequiredGroupCount(state.links, linkRules); }
function normalizeLinkKey(a, b) { return LinkUtils.normalizeLinkKey(a, b); }
function formatEndpoint(endpoint) { return LinkUtils.formatEndpointLabel(endpoint); }
function getLinkIssue(a, b) { return LinkUtils.getLinkIssue(a, b, linkRules, state.links); }
function getMissingRequiredGroups() { return LinkUtils.getMissingRequiredGroups(state.links, linkRules); }
function getLinkByEndpoint(endpoint) { return state.links.find(([a, b]) => a === endpoint || b === endpoint) || null; }
function getDeviceById(id) { return allDevices.find((device) => device.id === id) || null; }
function getPlacedDevices() { return state.placedDeviceIds.map((id) => getDeviceById(id)).filter(Boolean); }
function isDevicePlaced(id) { return state.placedDeviceIds.includes(id); }
function isDeviceAreaPoint(clientX, clientY) {
  const list = $('deviceList');
  const rect = list.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
function updateRecycleHighlight(clientX, clientY) {
  $('deviceList').classList.toggle('recycle-ready', isDeviceAreaPoint(clientX, clientY));
}
function clearRecycleHighlight() {
  $('deviceList').classList.remove('recycle-ready');
}

function clampDevicePosition(x, y) {
  return {
    x: Math.max(10, Math.min(workspace.clientWidth - 190, x)),
    y: Math.max(30, Math.min(workspace.clientHeight - 170, y)),
  };
}

function placeDevice(id, x, y) {
  const device = getDeviceById(id);
  if (!device || isDevicePlaced(id)) return false;
  const next = clampDevicePosition(x, y);
  device.x = next.x;
  device.y = next.y;
  state.placedDeviceIds.push(id);
  state.selectedPort = null;
  log(`[device] 已放入 ${device.name}`);
  renderDeviceList();
  renderWorkspace();
  score();
  return true;
}

function removeDevice(id) {
  if (!isDevicePlaced(id)) return false;
  const device = getDeviceById(id);
  state.placedDeviceIds = state.placedDeviceIds.filter((item) => item !== id);
  state.links = state.links.filter(([a, b]) => !a.startsWith(`${id}:`) && !b.startsWith(`${id}:`));
  if (state.selectedPort && state.selectedPort.startsWith(`${id}:`)) state.selectedPort = null;
  state.hoveredLink = null;
  clearRecycleHighlight();
  log(`[device] 已回收 ${device ? device.name : id}`);
  renderDeviceList();
  renderWorkspace();
  score();
  return true;
}

function score() {
  let total = 0;
  if (correctLinks() === requiredLinkGroupCount) total += 45;
  if (state.config) total += 25;
  if (state.joined) total += 15;
  if ($('testResult').textContent.includes('测试通过')) total += 15;
  $('score').textContent = `${Math.min(100, total)} / 100`;
}

function setSubmitButtonState(stateName, label = '提交当前结果') {
  const button = $('submitResultBtn');
  button.textContent = label;
  button.classList.remove('success', 'error', 'pending');
  if (stateName) button.classList.add(stateName);
}

function canSubmitResult() {
  return $('className').value.trim() !== '' && $('groupName').value.trim() !== '';
}

function updateSubmitAvailability() {
  const button = $('submitResultBtn');
  const ready = canSubmitResult();
  button.disabled = !ready;
  if (!ready) {
    setSubmitButtonState('', '提交当前结果');
    $('submitResult').innerHTML = '<span class="warn">请先填写班级和小组后再提交。</span>';
    return;
  }
  if (!state.socket || state.socket.readyState !== 1) {
    setSubmitButtonState('', '提交当前结果');
    $('submitResult').innerHTML = '<span class="warn">连接教师台后可提交结果。</span>';
    return;
  }
  if (!$('submitResult').textContent.includes('已提交')) {
    $('submitResult').innerHTML = '<span class="good">已满足提交条件，可提交到教师台。</span>';
  }
}

function revealDemoButton() {
  const button = $('demoBtn');
  button.hidden = false;
  button.classList.add('revealed');
  log('[hint] 已显示隐藏演示按钮，快捷键 Ctrl+Shift+D 也可直接触发演示。');
  clearTimeout(demoRevealTimer);
  demoRevealTimer = setTimeout(() => {
    button.hidden = true;
    button.classList.remove('revealed');
  }, 8000);
}

function updateLinkNotice() {
  if (!state.placedDeviceIds.length) return setLinkNotice({ tone: 'info', title: '等待摆放设备', detail: '请先从左侧设备区拖入需要的设备，再进行连线。', icon: 'i' });
  if (state.hoveredLink) {
    const hovered = state.links.find(([a, b]) => normalizeLinkKey(a, b) === state.hoveredLink);
    if (hovered) {
      const issue = getLinkIssue(hovered[0], hovered[1]);
      if (issue) return setLinkNotice({ tone: 'bad', title: '错误连线', detail: issue, icon: '!' });
      return setLinkNotice({ tone: 'good', title: '连线正确', detail: `${formatEndpoint(hovered[0])} ↔ ${formatEndpoint(hovered[1])}`, icon: '✓' });
    }
  }
  if (state.selectedPort) return setLinkNotice({ tone: 'warn', title: '等待完成连线', detail: `已选择 ${formatEndpoint(state.selectedPort)}，请继续选择另一端口；点击已连线端口可直接删除旧连线。`, icon: '…' });
  const invalidLink = state.links.find(([a, b]) => !!getLinkIssue(a, b));
  if (invalidLink) return setLinkNotice({ tone: 'bad', title: '存在错误连线', detail: getLinkIssue(invalidLink[0], invalidLink[1]), icon: '!' });
  const missingGroups = getMissingRequiredGroups();
  if (missingGroups.length) return setLinkNotice({ tone: state.links.length ? 'warn' : 'info', title: state.links.length ? '连线未完成' : '等待操作', detail: state.links.length ? `还缺少：${missingGroups.map((group) => group.label).join('、')}。` : '请先摆放设备，再选择端口或连线。', icon: state.links.length ? '!' : 'i' });
  setLinkNotice({ tone: 'good', title: '必需连线已完成', detail: '当前拓扑正确。可继续配置并执行网络测试。', icon: '✓' });
}

function refreshSSIDs(selectNew = true) {
  const host = $('ssidSelect');
  const custom = ($('ssid').value || '').trim();
  const list = [...baseNetworks];
  if (custom && !list.includes(custom)) list.unshift(custom);
  if (!list.includes('SmartClass-101')) list.splice(Math.min(list.length, 1), 0, 'SmartClass-101');
  const current = host.value;
  host.innerHTML = '';
  list.forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value; host.appendChild(option); });
  if (selectNew && custom) host.value = custom; else if (list.includes(current)) host.value = current;
}

function renderDeviceList() {
  const host = $('deviceList');
  host.innerHTML = '';
  allDevices.forEach((device) => {
    const placed = isDevicePlaced(device.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `box deviceItem${placed ? ' placed' : ''}`;
    button.draggable = !placed;
    button.setAttribute('aria-pressed', String(placed));
    button.innerHTML = `<div style="font-weight:700">${device.name}</div><div class="small">${device.type}</div><div class="small">${placed ? '已在连接区' : '拖到右侧连接区'}</div>`;
    button.ondragstart = (event) => {
      if (placed) return;
      state.paletteDragId = device.id;
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', device.id);
        event.dataTransfer.effectAllowed = 'move';
      }
    };
    button.ondragend = () => {
      state.paletteDragId = null;
      workspace.classList.remove('drag-over');
      clearRecycleHighlight();
    };
    host.appendChild(button);
  });
}

function syncHoveredPorts() { document.querySelectorAll('.port').forEach((el) => el.classList.toggle('link-hover', !!state.hoveredLink && state.hoveredLink.includes(el.dataset.key))); }
function setHoveredLink(linkKey) { state.hoveredLink = linkKey; document.querySelectorAll('.link-path').forEach((path) => path.classList.toggle('hovered', path.dataset.linkKey === state.hoveredLink)); syncHoveredPorts(); updateLinkNotice(); }
function portCenter(element) { const wr = workspace.getBoundingClientRect(); const rect = element.getBoundingClientRect(); return { x: rect.left - wr.left + rect.width / 2, y: rect.top - wr.top + rect.height / 2 }; }

function enableDrag(node, id) {
  const handle = node.querySelector('.dragHandle');
  const start = (event) => {
    const device = getDeviceById(id);
    state.dragging = { id, startX: event.touches ? event.touches[0].clientX : event.clientX, startY: event.touches ? event.touches[0].clientY : event.clientY, origX: device.x, origY: device.y };
    event.preventDefault();
  };
  handle.addEventListener('mousedown', start);
  handle.addEventListener('touchstart', start, { passive: false });
}

function drawLinks() {
  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${workspace.clientWidth} ${workspace.clientHeight}`);
  state.links.forEach((link, index) => {
    const a = workspace.querySelector(`[data-key="${link[0]}"]`);
    const b = workspace.querySelector(`[data-key="${link[1]}"]`);
    if (!a || !b) return;
    const p1 = portCenter(a);
    const p2 = portCenter(b);
    const mid = (p1.x + p2.x) / 2;
    const linkKey = normalizeLinkKey(link[0], link[1]);
    const issue = getLinkIssue(link[0], link[1]);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${p1.x} ${p1.y} C ${mid} ${p1.y}, ${mid} ${p2.y}, ${p2.x} ${p2.y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', index % 2 === 0 ? '#2563eb' : '#8b5cf6');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('class', `link-path${issue ? ' invalid' : ''}${state.hoveredLink === linkKey ? ' hovered' : ''}`);
    path.dataset.linkKey = linkKey;
    path.onmouseenter = () => setHoveredLink(linkKey);
    path.onmouseleave = () => setHoveredLink(null);
    path.onclick = (event) => { event.stopPropagation(); deleteLink(linkKey); };
    path.oncontextmenu = (event) => { event.preventDefault(); deleteLink(linkKey); };
    if (issue) { const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = issue; path.appendChild(title); }
    svg.appendChild(path);
  });
  syncHoveredPorts();
}

function renderWorkspace() {
  [...workspace.querySelectorAll('.node, .workspaceEmpty')].forEach((node) => node.remove());
  if (!state.placedDeviceIds.length) {
    const empty = document.createElement('div');
    empty.className = 'workspaceEmpty';
    empty.innerHTML = '<strong>连接区当前没有设备</strong><span>从左侧设备区拖动设备到这里开始搭建拓扑。</span>';
    workspace.appendChild(empty);
  }
  getPlacedDevices().forEach((device) => {
    const node = document.createElement('div');
    node.className = 'node';
    node.dataset.id = device.id;
    node.style.left = `${device.x}px`;
    node.style.top = `${device.y}px`;
    node.innerHTML = `<div class="led ${state.links.some((link) => link[0].startsWith(`${device.id}:`) || link[1].startsWith(`${device.id}:`)) ? 'on' : ''}"></div><div class="nodeHead"><div><div class="iconWrap"><img src="${photos[device.id]}" alt="${device.name}"><div class="iconFallback">${device.name}</div></div><div class="imgTag">${device.name}</div></div><div><div style="font-weight:700">${device.name}</div><div class="meta">${device.type}</div></div></div><div class="ports"></div><div class="dragHandle">拖动设备位置</div><div class="linkHint">提示：点击已连线端口、或悬停后点连线本身，都可删除；错误连线会立即标红</div>`;
    const img = node.querySelector('img');
    const fallback = node.querySelector('.iconFallback');
    img.onerror = () => { img.style.display = 'none'; fallback.style.display = 'block'; };
    const ports = node.querySelector('.ports');
    device.ports.forEach((port) => {
      const key = `${device.id}:${port}`;
      const relatedLinks = state.links.filter(([a, b]) => a === key || b === key);
      const classes = ['port'];
      if (state.mode === 'connect' && state.selectedPort !== key && relatedLinks.length === 0) classes.push('connectable');
      if (relatedLinks.length > 0) classes.push('connected');
      if (relatedLinks.some(([a, b]) => !!getLinkIssue(a, b))) classes.push('invalid-link');
      if (state.selectedPort === key) classes.push('active');
      const slot = document.createElement('div');
      slot.className = 'portSlot';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = classes.join(' ');
      button.dataset.key = key;
      button.innerHTML = `<span class="portLabel">${port}</span>${relatedLinks.length > 0 ? '<span class="portBadge">已连</span>' : ''}`;
      button.setAttribute('aria-pressed', String(state.selectedPort === key));
      button.onclick = (event) => {
        event.stopPropagation();
        if (state.mode === 'connect' && relatedLinks.length > 0) {
          deleteLink(normalizeLinkKey(relatedLinks[0][0], relatedLinks[0][1]));
          return;
        }
        portClick(button.dataset.key);
      };
      button.oncontextmenu = (event) => {
        const existingLink = getLinkByEndpoint(button.dataset.key);
        if (!existingLink) return;
        event.preventDefault();
        event.stopPropagation();
        deleteLink(normalizeLinkKey(existingLink[0], existingLink[1]));
      };
      slot.appendChild(button);
      if (relatedLinks.length > 0) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'portDelete';
        deleteButton.textContent = '×';
        deleteButton.dataset.tip = `删除 ${port} 当前连线`;
        deleteButton.title = `删除 ${port} 当前连线`;
        deleteButton.setAttribute('aria-label', `删除 ${port} 当前连线`);
        deleteButton.onclick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          deleteLink(normalizeLinkKey(relatedLinks[0][0], relatedLinks[0][1]));
        };
        slot.appendChild(deleteButton);
      }
      ports.appendChild(slot);
    });
    enableDrag(node, device.id);
    workspace.appendChild(node);
  });
  requestAnimationFrame(drawLinks);
  updateLinkNotice();
}

function deleteLink(linkKey) {
  const nextLinks = LinkUtils.removeLinkByKey(state.links, linkKey);
  if (nextLinks.length === state.links.length) return;
  state.links = nextLinks;
  state.hoveredLink = null;
  renderWorkspace();
  score();
  log(`[link] 已删除连线 ${linkKey}`);
}

function portClick(key) {
  if (state.mode !== 'connect') return;
  const existingLink = getLinkByEndpoint(key);
  if (!state.selectedPort) {
    if (existingLink) {
      deleteLink(normalizeLinkKey(existingLink[0], existingLink[1]));
      return;
    }
    state.selectedPort = key;
    return renderWorkspace();
  }
  if (state.selectedPort === key) { state.selectedPort = null; return renderWorkspace(); }
  if (existingLink) {
    deleteLink(normalizeLinkKey(existingLink[0], existingLink[1]));
    return;
  }
  const exists = state.links.some(([a, b]) => (a === state.selectedPort && b === key) || (a === key && b === state.selectedPort));
  if (!exists) {
    state.links.push([state.selectedPort, key]);
    const issue = getLinkIssue(state.selectedPort, key);
    if (issue) log(`[link][error] ${issue}`); else log(`[link] 已连接 ${normalizeLinkKey(state.selectedPort, key)}`);
  }
  state.selectedPort = null;
  renderWorkspace();
  score();
}

function validDNS(value) { return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test((value || '').trim()); }
function dnsLooksReachable(value) { return ['8.8.8.8', '8.8.4.4', '114.114.114.114', '1.1.1.1', '223.5.5.5', '180.76.76.76', '192.168.1.1'].includes((value || '').trim()); }

function saveConfig() {
  state.config = { user: $('pppoeUser').value, pwd: $('pppoePwd').value, ssid: $('ssid').value, wifi: $('wifiPwd').value, dns: $('dnsServer').value, start: $('dhcpStart').value, end: $('dhcpEnd').value };
  refreshSSIDs(true);
  $('configResult').innerHTML = `<span class="good">已保存配置：</span>SSID=${state.config.ssid}`;
  log('[config] 已保存并刷新SSID列表');
  score();
}

function joinWifi() {
  if (!state.config) { $('testResult').innerHTML = '<span class="warn">请先保存配置。</span>'; return; }
  if ($('ssidSelect').value !== state.config.ssid) { $('testResult').innerHTML = '<span class="bad">未选择目标SSID。</span>'; state.joined = false; return score(); }
  if ($('joinPwd').value !== state.config.wifi) { $('testResult').innerHTML = '<span class="bad">无线密码错误。</span>'; state.joined = false; return score(); }
  state.joined = true;
  $('testResult').innerHTML = '<span class="good">已连接目标SSID。</span>';
  score();
}

function runTest() {
  const linkOk = correctLinks() === requiredLinkGroupCount;
  const configOk = !!state.config;
  const joinedOk = !!state.joined;
  const dnsValue = configOk ? state.config.dns || '' : '';
  const dnsResolveOk = validDNS(dnsValue) && dnsLooksReachable(dnsValue);
  const baseOk = linkOk && configOk && joinedOk;
  if (baseOk && dnsResolveOk) {
    $('testTable').innerHTML = `<tr><td>连接目标SSID</td><td>是</td></tr><tr><td>获取IP地址</td><td>192.168.1.108</td></tr><tr><td>DNS 解析</td><td>通过（${dnsValue}）</td></tr><tr><td>访问互联网</td><td>通过</td></tr>`;
    $('testResult').innerHTML = '<span class="good">测试通过：网络可用，域名解析正常。</span>';
  } else if (baseOk) {
    $('testTable').innerHTML = `<tr><td>连接目标SSID</td><td>是</td></tr><tr><td>获取IP地址</td><td>192.168.1.108</td></tr><tr><td>DNS 解析</td><td>失败（${dnsValue || '未填写'}）</td></tr><tr><td>访问互联网</td><td>只能访问 IP，无法解析域名</td></tr>`;
    $('testResult').innerHTML = '<span class="warn">测试部分通过：已连上 Wi-Fi 并获取 IP，但 DNS 配置错误。</span>';
  } else {
    $('testTable').innerHTML = '<tr><td>连接目标SSID</td><td>待修正</td></tr><tr><td>获取IP地址</td><td>待修正</td></tr><tr><td>DNS 解析</td><td>失败</td></tr><tr><td>访问互联网</td><td>失败</td></tr>';
    $('testResult').innerHTML = '<span class="bad">测试失败：请检查连线、Wi-Fi 接入或配置参数。</span>';
  }
  score();
}

function buildSubmissionRow() {
  let testStatus = '未通过';
  if ($('testResult').textContent.includes('测试通过')) testStatus = '通过';
  else if ($('testResult').textContent.includes('部分通过')) testStatus = 'DNS异常';
  return {
    className: $('className').value || '未填写',
    groupName: $('groupName').value || '未填写',
    studentName: $('studentName').value || '未填写',
    score: $('score').textContent.split(' / ')[0],
    test: testStatus,
  };
}

function submitResult() {
  if (!canSubmitResult()) {
    setSubmitButtonState('error', '缺少班级/小组');
    $('submitResult').innerHTML = '<span class="bad">提交失败：请先填写班级和小组。</span>';
    return;
  }
  if (!state.socket || state.socket.readyState !== 1) {
    setSubmitButtonState('error', '未连接');
    $('submitResult').innerHTML = '<span class="bad">未连接教师台，无法提交结果。</span>';
    return;
  }
  const row = buildSubmissionRow();
  setSubmitButtonState('pending', '提交中...');
  state.socket.send(JSON.stringify({ type: 'board_submit', payload: row }));
  setSubmitButtonState('success', '已提交');
  $('submitResult').innerHTML = `<span class="good">已提交：${row.className} / ${row.groupName} / ${row.studentName}</span>`;
  log(`[board] 已提交结果 ${row.className}/${row.groupName}/${row.studentName}`);
}

function snapshot() { return { topology: { devices: getPlacedDevices().map((device) => ({ id: device.id, x: device.x, y: device.y })), links: state.links }, config: state.config || {} }; }

function applySnapshot(snapshotState) {
  if (snapshotState.topology && Array.isArray(snapshotState.topology.devices)) {
    state.placedDeviceIds = snapshotState.topology.devices.map((position) => position.id);
    snapshotState.topology.devices.forEach((position) => {
      const device = getDeviceById(position.id);
      if (device) { device.x = position.x; device.y = position.y; }
    });
    state.links = snapshotState.topology.links || [];
  }
  if (snapshotState.config) {
    state.config = snapshotState.config;
    $('pppoeUser').value = snapshotState.config.user || '';
    $('pppoePwd').value = snapshotState.config.pwd || '';
    $('ssid').value = snapshotState.config.ssid || '';
    $('wifiPwd').value = snapshotState.config.wifi || '';
    $('dnsServer').value = snapshotState.config.dns || '8.8.8.8';
    $('dhcpStart').value = snapshotState.config.start || '192.168.1.100';
    $('dhcpEnd').value = snapshotState.config.end || '192.168.1.150';
    refreshSSIDs(true);
  }
  renderDeviceList();
  renderWorkspace();
  score();
}

function wsUrl() { return `${$('serverUrl').value.replace(/\/$/, '')}/${$('roomCode').value}/${$('role').value}/${$('clientId').value}`; }
function connect() {
  if (state.socket) state.socket.close();
  const ws = new WebSocket(wsUrl());
  state.socket = ws;
  $('connState').textContent = '连接中...';
  ws.onopen = () => { $('connState').innerHTML = '<span class="good">已连接服务器。</span>'; $('netState').textContent = `room=${$('roomCode').value} | role=student`; log(`[ws] 已连接 ${wsUrl()}`); updateSubmitAvailability(); };
  ws.onmessage = (event) => { const msg = JSON.parse(event.data); if (msg.type === 'state_sync') { applySnapshot(msg.payload); log('[ws] 已接收教师同步'); } };
  ws.onclose = () => { $('connState').innerHTML = '<span class="warn">连接已断开。</span>'; updateSubmitAvailability(); };
  ws.onerror = () => { $('connState').innerHTML = '<span class="bad">连接失败，请检查服务器地址。</span>'; updateSubmitAvailability(); };
}

function saveLayout() { const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'student_topology.json'; a.click(); URL.revokeObjectURL(a.href); }
function loadLayout(file) { const reader = new FileReader(); reader.onload = () => applySnapshot(JSON.parse(reader.result)); reader.readAsText(file, 'utf-8'); }
function demo() { state.placedDeviceIds = allDevices.map((device) => device.id); state.links = LabData.createDemoLinks(); $('pppoeUser').value = 'school_classroom'; $('pppoePwd').value = 'Class@2026'; $('ssid').value = 'SmartClass-101'; $('wifiPwd').value = 'ClassNet2026'; $('dnsServer').value = '8.8.8.8'; $('dhcpStart').value = '192.168.1.100'; $('dhcpEnd').value = '192.168.1.150'; saveConfig(); $('joinPwd').value = 'ClassNet2026'; joinWifi(); runTest(); renderDeviceList(); renderWorkspace(); }

function applyRouteBootstrap() { $('clientId').value = `student-${Math.random().toString(36).slice(2, 8)}`; $('serverUrl').value = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`; $('roomCode').value = boot.defaultRoom; $('connState').textContent = boot.autoConnect ? '正在自动连接服务器...' : '未连接服务器。'; }

function bindEvents() {
  document.querySelectorAll('.mode').forEach((button) => { button.onclick = () => { state.mode = button.dataset.mode; document.querySelectorAll('.mode').forEach((item) => item.classList.toggle('active', item === button)); }; });
  document.querySelectorAll('.tab').forEach((button) => { button.onclick = () => { document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.pane').forEach((pane) => pane.classList.remove('active')); $(`pane-${button.dataset.pane}`).classList.add('active'); }; });
  $('connectBtn').onclick = connect;
  $('submitResultBtn').onclick = submitResult;
  $('themeBtn').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; syncThemeButton(); };
  $('saveConfigBtn').onclick = saveConfig;
  $('joinBtn').onclick = joinWifi;
  $('runTestBtn').onclick = runTest;
  $('saveLayoutBtn').onclick = saveLayout;
  $('loadLayoutBtn').onclick = () => $('layoutFile').click();
  $('layoutFile').onchange = (event) => { if (event.target.files[0]) loadLayout(event.target.files[0]); };
  $('demoBtn').onclick = demo;
  $('className').addEventListener('input', updateSubmitAvailability);
  $('groupName').addEventListener('input', updateSubmitAvailability);
  $('ssid').addEventListener('input', () => refreshSSIDs(false));
  workspace.addEventListener('dragover', (event) => {
    if (!state.paletteDragId) return;
    event.preventDefault();
    workspace.classList.add('drag-over');
  });
  workspace.addEventListener('dragleave', (event) => {
    if (event.target === workspace) workspace.classList.remove('drag-over');
  });
  workspace.addEventListener('drop', (event) => {
    const deviceId = event.dataTransfer?.getData('text/plain') || state.paletteDragId;
    workspace.classList.remove('drag-over');
    state.paletteDragId = null;
    if (!deviceId) return;
    event.preventDefault();
    const rect = workspace.getBoundingClientRect();
    placeDevice(deviceId, event.clientX - rect.left - 86, event.clientY - rect.top - 48);
  });
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      revealDemoButton();
      demo();
    }
  });
  window.addEventListener('resize', () => requestAnimationFrame(drawLinks));
  window.addEventListener('mousemove', (event) => {
    if (!state.dragging) return;
    const device = getDeviceById(state.dragging.id);
    const next = clampDevicePosition(state.dragging.origX + ((event.touches ? event.touches[0].clientX : event.clientX) - state.dragging.startX), state.dragging.origY + ((event.touches ? event.touches[0].clientY : event.clientY) - state.dragging.startY));
    device.x = next.x;
    device.y = next.y;
    updateRecycleHighlight(event.clientX, event.clientY);
    const node = workspace.querySelector(`.node[data-id="${device.id}"]`);
    if (node) {
      node.style.left = `${device.x}px`;
      node.style.top = `${device.y}px`;
      drawLinks();
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (state.dragging && isDeviceAreaPoint(event.clientX, event.clientY)) removeDevice(state.dragging.id);
    clearRecycleHighlight();
    state.dragging = null;
  });
  window.addEventListener('touchmove', (event) => {
    if (!state.dragging) return;
    const device = getDeviceById(state.dragging.id);
    const next = clampDevicePosition(state.dragging.origX + (event.touches[0].clientX - state.dragging.startX), state.dragging.origY + (event.touches[0].clientY - state.dragging.startY));
    device.x = next.x;
    device.y = next.y;
    updateRecycleHighlight(event.touches[0].clientX, event.touches[0].clientY);
    const node = workspace.querySelector(`.node[data-id="${device.id}"]`);
    if (node) {
      node.style.left = `${device.x}px`;
      node.style.top = `${device.y}px`;
      drawLinks();
    }
  }, { passive: false });
  window.addEventListener('touchend', (event) => {
    const point = event.changedTouches && event.changedTouches[0];
    if (state.dragging && point && isDeviceAreaPoint(point.clientX, point.clientY)) removeDevice(state.dragging.id);
    clearRecycleHighlight();
    state.dragging = null;
  });
}

function bootApp() { applyRouteBootstrap(); bindEvents(); syncThemeButton(); refreshSSIDs(false); renderDeviceList(); renderWorkspace(); score(); updateSubmitAvailability(); if (boot.autoConnect) connect(); }

bootApp();
