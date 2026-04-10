const photos = LabData.photos;
const devices = LabData.createDevices();
const linkGroups = LabData.linkGroups;
const linkRules = LinkUtils.buildLinkRules(linkGroups);
const requiredLinkGroupCount = linkGroups.filter((group) => group.required !== false).length;
const state = {
  mode: 'select',
  selectedDevice: null,
  selectedPort: null,
  links: [],
  board: [],
  socket: null,
  dragging: null,
  hoveredLink: null,
};
const boot = {
  autoConnect: document.body.dataset.autoConnect === 'true',
  defaultRoom: document.body.dataset.defaultRoom || 'classroom-101',
};
const $ = (id) => document.getElementById(id);
const workspace = $('workspace');
const svg = $('svg');
let demoRevealTimer = null;

function log(text) {
  $('log').textContent += `\n${text}`;
  $('log').scrollTop = $('log').scrollHeight;
}

function setLinkNotice({ tone = 'info', title, detail, icon }) {
  $('linkNoticeCard').className = `noticeCard notice-${tone}`;
  $('linkNoticeTitle').textContent = title;
  $('linkNoticeText').textContent = detail;
  $('linkNoticeIcon').textContent = icon;
}

function syncThemeButton() {
  $('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '切换浅色' : '切换深色';
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

function normalizeLinkKey(a, b) {
  return LinkUtils.normalizeLinkKey(a, b);
}

function formatEndpoint(endpoint) {
  return LinkUtils.formatEndpointLabel(endpoint);
}

function getLinkIssue(a, b) {
  return LinkUtils.getLinkIssue(a, b, linkRules, state.links);
}

function correctLinks() {
  return LinkUtils.getSatisfiedRequiredGroupCount(state.links, linkRules);
}

function getMissingRequiredGroups() {
  return LinkUtils.getMissingRequiredGroups(state.links, linkRules);
}

function score() {
  const percent = Math.round((correctLinks() / requiredLinkGroupCount) * 100);
  $('score').textContent = `${percent} / 100`;
}

function updateLinkNotice() {
  if (state.hoveredLink) {
    const hovered = state.links.find(([a, b]) => normalizeLinkKey(a, b) === state.hoveredLink);
    if (hovered) {
      const issue = getLinkIssue(hovered[0], hovered[1]);
      if (issue) {
        setLinkNotice({ tone: 'bad', title: '错误连线', detail: issue, icon: '!' });
        return;
      }
      setLinkNotice({
        tone: 'good',
        title: '演示连线正确',
        detail: `${formatEndpoint(hovered[0])} ↔ ${formatEndpoint(hovered[1])}`,
        icon: '✓',
      });
      return;
    }
  }

  if (state.selectedPort) {
    setLinkNotice({
      tone: 'warn',
      title: '等待完成连线',
      detail: `已选择 ${formatEndpoint(state.selectedPort)}，请继续选择另一端口。`,
      icon: '…',
    });
    return;
  }

  const invalidLink = state.links.find(([a, b]) => !!getLinkIssue(a, b));
  if (invalidLink) {
    setLinkNotice({
      tone: 'bad',
      title: '存在错误连线',
      detail: getLinkIssue(invalidLink[0], invalidLink[1]),
      icon: '!',
    });
    return;
  }

  const missing = getMissingRequiredGroups();
  if (missing.length) {
    setLinkNotice({
      tone: 'warn',
      title: '演示拓扑未完成',
      detail: `还缺少：${missing.map((item) => item.label).join('、')}。`,
      icon: '!',
    });
    return;
  }

  setLinkNotice({
    tone: 'good',
    title: '教师演示拓扑已就绪',
    detail: '当前可以推送全班同步。',
    icon: '✓',
  });
}

function renderDeviceList() {
  const host = $('deviceList');
  host.innerHTML = '';
  devices.forEach((device) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `box deviceItem${state.selectedDevice === device.id ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(state.selectedDevice === device.id));
    button.innerHTML = `<div style="font-weight:700">${device.name}</div><div class="small">${device.type}</div>`;
    button.onclick = () => {
      state.selectedDevice = device.id;
      renderDeviceList();
      renderWorkspace();
    };
    host.appendChild(button);
  });
}

function portCenter(el) {
  const wr = workspace.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
}

function syncHoveredPorts() {
  document.querySelectorAll('.port').forEach((el) => {
    el.classList.toggle('link-hover', !!state.hoveredLink && state.hoveredLink.includes(el.dataset.key));
  });
}

function setHoveredLink(linkKey) {
  state.hoveredLink = linkKey;
  document.querySelectorAll('.link-path').forEach((path) => {
    path.classList.toggle('hovered', path.dataset.linkKey === state.hoveredLink);
  });
  syncHoveredPorts();
  updateLinkNotice();
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
    const key = normalizeLinkKey(link[0], link[1]);
    const issue = getLinkIssue(link[0], link[1]);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${p1.x} ${p1.y} C ${mid} ${p1.y}, ${mid} ${p2.y}, ${p2.x} ${p2.y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', index % 2 === 0 ? '#2563eb' : '#8b5cf6');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('class', `link-path${issue ? ' invalid' : ''}${state.hoveredLink === key ? ' hovered' : ''}`);
    path.dataset.linkKey = key;
    path.onmouseenter = () => setHoveredLink(key);
    path.onmouseleave = () => setHoveredLink(null);
    path.onclick = (event) => {
      event.stopPropagation();
      deleteLink(key);
    };
    path.oncontextmenu = (event) => {
      event.preventDefault();
      deleteLink(key);
    };
    if (issue) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = issue;
      path.appendChild(title);
    }
    svg.appendChild(path);
  });
  syncHoveredPorts();
}

function enableDrag(node, id) {
  const handle = node.querySelector('.dragHandle');
  const start = (event) => {
    state.dragging = {
      id,
      startX: event.touches ? event.touches[0].clientX : event.clientX,
      startY: event.touches ? event.touches[0].clientY : event.clientY,
      origX: devices.find((item) => item.id === id).x,
      origY: devices.find((item) => item.id === id).y,
    };
    event.preventDefault();
  };
  handle.addEventListener('mousedown', start);
  handle.addEventListener('touchstart', start, { passive: false });
}

function renderWorkspace() {
  [...workspace.querySelectorAll('.node')].forEach((node) => node.remove());
  devices.forEach((device) => {
    const node = document.createElement('div');
    node.className = `node${state.selectedDevice === device.id ? ' sel' : ''}`;
    node.dataset.id = device.id;
    node.style.left = `${device.x}px`;
    node.style.top = `${device.y}px`;
    node.innerHTML = `<div class="led ${state.links.some((link) => link[0].startsWith(`${device.id}:`) || link[1].startsWith(`${device.id}:`)) ? 'on' : ''}"></div><div class="nodeHead"><div><div class="iconWrap"><img src="${photos[device.id]}" alt="${device.name}"><div class="iconFallback">${device.name}</div></div><div class="imgTag">${device.name}</div></div><div><div style="font-weight:700">${device.name}</div><div class="meta">${device.type}</div></div></div><div class="ports"></div><div class="dragHandle">拖动设备位置</div><div class="linkHint">提示：教师台整理拓扑后可推送全班同步</div>`;
    const img = node.querySelector('img');
    const fallback = node.querySelector('.iconFallback');
    img.onerror = () => {
      img.style.display = 'none';
      fallback.style.display = 'block';
    };
    const ports = node.querySelector('.ports');
    device.ports.forEach((port) => {
      const key = `${device.id}:${port}`;
      const related = state.links.filter(([a, b]) => a === key || b === key);
      const classes = ['port'];
      if (state.mode === 'connect' && state.selectedPort !== key && related.length === 0) classes.push('connectable');
      if (related.length > 0) classes.push('connected');
      if (related.some(([a, b]) => !!getLinkIssue(a, b))) classes.push('invalid-link');
      if (state.selectedPort === key) classes.push('active');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = classes.join(' ');
      button.dataset.key = key;
      button.textContent = port;
      button.setAttribute('aria-pressed', String(state.selectedPort === key));
      button.onclick = (event) => {
        event.stopPropagation();
        portClick(key);
      };
      ports.appendChild(button);
    });
    enableDrag(node, device.id);
    workspace.appendChild(node);
  });
  requestAnimationFrame(drawLinks);
  updateLinkNotice();
}

function deleteLink(linkKey) {
  const next = LinkUtils.removeLinkByKey(state.links, linkKey);
  if (next.length === state.links.length) return;
  state.links = next;
  state.hoveredLink = null;
  renderWorkspace();
  score();
  pushState();
}

function portClick(key) {
  if (state.mode !== 'connect') return;
  if (!state.selectedPort) {
    state.selectedPort = key;
    return renderWorkspace();
  }
  if (state.selectedPort === key) {
    state.selectedPort = null;
    return renderWorkspace();
  }
  const exists = state.links.some(([a, b]) => (a === state.selectedPort && b === key) || (a === key && b === state.selectedPort));
  if (!exists) {
    state.links.push([state.selectedPort, key]);
    const issue = getLinkIssue(state.selectedPort, key);
    if (issue) log(`[link][error] ${issue}`);
    else log(`[link] 已连接 ${normalizeLinkKey(state.selectedPort, key)}`);
  }
  state.selectedPort = null;
  renderWorkspace();
  score();
  pushState();
}

function renderBoard() {
  const host = $('boardBody');
  host.innerHTML = '';
  $('boardSummary').textContent = state.board.length ? `当前已汇总 ${state.board.length} 条学生结果。` : '当前还没有学生提交结果。';
  state.board.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.className}</td><td>${row.groupName}</td><td>${row.studentName}</td><td>${row.score}</td><td>${row.test}</td>`;
    host.appendChild(tr);
  });
}

function exportBoard() {
  const rows = [['班级', '小组', '姓名', '分数', '测试结果']].concat(state.board.map((row) => [row.className, row.groupName, row.studentName, row.score, row.test]));
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'teacher_board.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function snapshot() {
  return {
    topology: { devices: devices.map((device) => ({ id: device.id, x: device.x, y: device.y })), links: state.links },
    teacher: { mode: $('lessonMode').value, fault: $('faultInject').value, note: $('teacherNote').value },
    board: state.board,
  };
}

function applySnapshot(data) {
  if (data.topology && Array.isArray(data.topology.devices)) {
    data.topology.devices.forEach((position) => {
      const device = devices.find((item) => item.id === position.id);
      if (device) {
        device.x = position.x;
        device.y = position.y;
      }
    });
    state.links = data.topology.links || [];
  }
  if (data.teacher) {
    $('lessonMode').value = data.teacher.mode || 'demo';
    $('faultInject').value = data.teacher.fault || 'none';
    $('teacherNote').value = data.teacher.note || '';
  }
  if (data.board) state.board = data.board;
  renderBoard();
  renderWorkspace();
  score();
}

function wsUrl() {
  const base = $('serverUrl').value.replace(/\/$/, '');
  return `${base}/${$('roomCode').value}/${$('role').value}/${$('clientId').value}`;
}

function connect() {
  if (state.socket) state.socket.close();
  const ws = new WebSocket(wsUrl());
  state.socket = ws;
  $('connState').textContent = '连接中...';
  ws.onopen = () => {
    $('connState').innerHTML = '<span class="good">已连接服务器。</span>';
    $('netState').textContent = `room=${$('roomCode').value} | role=teacher`;
    log(`[ws] 已连接 ${wsUrl()}`);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state_sync' && (!msg.meta || msg.meta.role === 'teacher')) applySnapshot(msg.payload);
    if (msg.type === 'board_update') {
      state.board = msg.payload || [];
      renderBoard();
    }
  };
  ws.onclose = () => {
    $('connState').innerHTML = '<span class="warn">连接已断开。</span>';
  };
  ws.onerror = () => {
    $('connState').innerHTML = '<span class="bad">连接失败，请检查服务器地址。</span>';
  };
}

function pushState() {
  if (!state.socket || state.socket.readyState !== 1) return;
  state.socket.send(JSON.stringify({ type: 'state_sync', payload: snapshot() }));
}

function saveLayout() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'teacher_topology.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadLayout(file) {
  const reader = new FileReader();
  reader.onload = () => {
    applySnapshot(JSON.parse(reader.result));
    pushState();
  };
  reader.readAsText(file, 'utf-8');
}

function demo() {
  state.links = LabData.createDemoLinks();
  $('lessonMode').value = 'demo';
  $('faultInject').value = 'none';
  $('teacherNote').value = '教师台已切换到标准演示拓扑。';
  $('teacherResult').innerHTML = '<span class="good">已载入标准演示拓扑。</span>';
  renderWorkspace();
  score();
  pushState();
}

function applyRouteBootstrap() {
  $('clientId').value = `teacher-${Math.random().toString(36).slice(2, 8)}`;
  $('serverUrl').value = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  $('roomCode').value = boot.defaultRoom;
  $('connState').textContent = boot.autoConnect ? '正在自动连接服务器...' : '未连接服务器。';
}

function bindEvents() {
  document.querySelectorAll('.mode').forEach((button) => {
    button.onclick = () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll('.mode').forEach((item) => item.classList.toggle('active', item === button));
    };
  });
  document.querySelectorAll('.tab').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
      document.querySelectorAll('.pane').forEach((pane) => pane.classList.remove('active'));
      $(`pane-${button.dataset.pane}`).classList.add('active');
    };
  });
  $('connectBtn').onclick = connect;
  $('pushBtn').onclick = pushState;
  $('exportBoardBtn').onclick = exportBoard;
  $('themeBtn').onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    syncThemeButton();
  };
  $('applyTeacherBtn').onclick = () => {
    $('teacherResult').innerHTML = '<span class="good">已应用教师设置并推送。</span>';
    pushState();
  };
  $('saveLayoutBtn').onclick = saveLayout;
  $('loadLayoutBtn').onclick = () => $('layoutFile').click();
  $('layoutFile').onchange = (event) => {
    if (event.target.files[0]) loadLayout(event.target.files[0]);
  };
  $('demoBtn').onclick = demo;
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
    const device = devices.find((item) => item.id === state.dragging.id);
    device.x = Math.max(10, Math.min(workspace.clientWidth - 190, state.dragging.origX + (event.clientX - state.dragging.startX)));
    device.y = Math.max(30, Math.min(workspace.clientHeight - 170, state.dragging.origY + (event.clientY - state.dragging.startY)));
    const node = workspace.querySelector(`.node[data-id="${device.id}"]`);
    if (node) {
      node.style.left = `${device.x}px`;
      node.style.top = `${device.y}px`;
      drawLinks();
    }
  });
  window.addEventListener('mouseup', () => {
    if (state.dragging) pushState();
    state.dragging = null;
  });
}

function bootApp() {
  applyRouteBootstrap();
  bindEvents();
  syncThemeButton();
  renderDeviceList();
  renderBoard();
  renderWorkspace();
  score();
  if (boot.autoConnect) connect();
}

bootApp();
