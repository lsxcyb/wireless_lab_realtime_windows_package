const boot = {
  autoConnect: document.body.dataset.autoConnect === 'true',
  defaultRoom: document.body.dataset.defaultRoom || 'classroom-101',
};

const state = {
  board: [],
  socket: null,
  room: boot.defaultRoom,
  clientId: `teacher-${Math.random().toString(36).slice(2, 8)}`,
  onlineStudents: [],
  trendData: [],
  chartInstances: {
    pie: null,
    trend: null,
    ranking: null
  }
};

const $ = (id) => document.getElementById(id);

function log(text) {
  $('log').textContent += `\n${text}`;
  $('log').scrollTop = $('log').scrollHeight;
}

function syncThemeButton() {
  $('themeBtn').textContent = document.documentElement.dataset.theme === 'dark' ? '切换浅色' : '切换深色';
}

function setNotice({ tone = 'info', title, detail, icon }) {
  $('linkNoticeCard').className = `noticeCard notice-${tone}`;
  $('linkNoticeTitle').textContent = title;
  $('linkNoticeText').textContent = detail;
  $('linkNoticeIcon').textContent = icon;
}

function normalizeScore(value) {
  const score = Number.parseInt(String(value || '0'), 10);
  return Number.isFinite(score) ? score : 0;
}

function scoreTone(test) {
  if (test === '通过') return 'good';
  if (test === 'DNS异常') return 'warn';
  return 'bad';
}

function renderBoardCards() {
  const host = $('boardCards');
  host.innerHTML = '';
  state.board.forEach((row) => {
    const card = document.createElement('article');
    card.className = `teacherSubmitCard ${scoreTone(row.test)}`;
    card.innerHTML = `<div class="teacherSubmitTop"><strong>${row.className}</strong><span>${row.groupName}</span></div><div class="teacherSubmitName">${row.studentName}</div><div class="teacherSubmitMeta"><span>分数 ${row.score}</span><span>状态 ${row.test}</span></div>`;
    host.appendChild(card);
  });
}

function renderBoardTable() {
  const host = $('boardBody');
  host.innerHTML = '';
  state.board.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.className}</td><td>${row.groupName}</td><td>${row.studentName}</td><td>${row.score}</td><td>${row.test}</td>`;
    host.appendChild(tr);
  });
}

function renderStats() {
  const total = state.board.length;
  const pass = state.board.filter((row) => row.test === '通过').length;
  const warn = state.board.filter((row) => row.test === 'DNS异常').length;
  const fail = total - pass - warn;
  $('statTotal').textContent = String(total);
  $('statPass').textContent = String(pass);
  $('statWarn').textContent = String(warn);
  $('statFail').textContent = String(fail);
  $('score').textContent = `${pass} / ${total}`;
  $('boardSummary').textContent = total ? `当前已接收 ${total} 条学生提交结果。` : '当前还没有学生提交结果。';
  $('teacherResult').textContent = total ? '学生提交数据已更新。' : '等待学生提交。';

  if (!total) {
    setNotice({ tone: 'info', title: '等待数据', detail: '等待学生端提交实验结果。', icon: 'i' });
    return;
  }
  if (fail > 0) {
    setNotice({ tone: 'bad', title: '存在未通过结果', detail: `当前有 ${fail} 组结果未通过，请优先关注。`, icon: '!' });
    return;
  }
  if (warn > 0) {
    setNotice({ tone: 'warn', title: '存在 DNS 异常', detail: `当前有 ${warn} 组结果为 DNS 异常。`, icon: '!' });
    return;
  }
  setNotice({ tone: 'good', title: '全部通过', detail: '当前提交的学生结果均已通过测试。', icon: '✓' });
}

function renderBoard() {
  renderBoardCards();
  renderBoardTable();
  renderStats();
}

function renderOnlineStudents() {
  const container = $('onlineStudentsScroll');
  const count = $('onlineStudentsCount');

  if (state.onlineStudents.length === 0) {
    container.innerHTML = '<div class="emptyState">暂无学生在线，等待学生连接...</div>';
    count.textContent = '在线学生：0 人';
    return;
  }

  container.innerHTML = state.onlineStudents.map(student => `
    <div class="onlineStudentCard">
      <span class="onlineIndicator"></span>
      <span>${student.className} | ${student.groupName} | ${student.studentName}</span>
    </div>
  `).join('');

  count.textContent = `在线学生：${state.onlineStudents.length} 人`;
}

function initCharts() {
  if (!window.echarts) {
    console.error('ECharts 未加载');
    return;
  }

  state.chartInstances.pie = echarts.init($('pieChart'));
  state.chartInstances.trend = echarts.init($('trendChart'));
  state.chartInstances.ranking = echarts.init($('rankingChart'));

  window.addEventListener('resize', () => {
    Object.values(state.chartInstances).forEach(chart => chart && chart.resize());
  });

  updateCharts();
}

function updateCharts() {
  updatePieChart();
  updateTrendChart();
  updateRankingChart();
}

function updatePieChart() {
  if (!state.chartInstances.pie) return;

  const pass = state.board.filter(row => row.test === '通过').length;
  const warn = state.board.filter(row => row.test === 'DNS异常').length;
  const fail = state.board.length - pass - warn;

  const option = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: '50%',
      data: [
        { value: pass, name: '通过', itemStyle: { color: '#4ade80' } },
        { value: warn, name: 'DNS异常', itemStyle: { color: '#fbbf24' } },
        { value: fail, name: '未通过', itemStyle: { color: '#f87171' } }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  state.chartInstances.pie.setOption(option);
}

function addTrendDataPoint() {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const total = state.board.length;
  const pass = state.board.filter(row => row.test === '通过').length;

  if (state.trendData.length > 0) {
    const lastPoint = state.trendData[state.trendData.length - 1];
    const lastTime = new Date(`1970-01-01 ${lastPoint.time}`);
    const currentTime = new Date(`1970-01-01 ${timeStr}`);
    if ((currentTime - lastTime) / 1000 < 10) {
      lastPoint.total = total;
      lastPoint.pass = pass;
      return;
    }
  }

  state.trendData.push({ time: timeStr, total, pass });

  if (state.trendData.length > 20) {
    state.trendData.shift();
  }
}

function updateTrendChart() {
  if (!state.chartInstances.trend) return;

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['提交总数', '通过数'] },
    xAxis: {
      type: 'category',
      data: state.trendData.map(d => d.time)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '提交总数',
        type: 'line',
        smooth: true,
        data: state.trendData.map(d => d.total),
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: '通过数',
        type: 'line',
        smooth: true,
        data: state.trendData.map(d => d.pass),
        itemStyle: { color: '#4ade80' }
      }
    ]
  };

  state.chartInstances.trend.setOption(option);
}

function calculateGroupRanking() {
  const groupMap = {};

  state.board.forEach(row => {
    const key = `${row.className} ${row.groupName}`;
    if (!groupMap[key]) {
      groupMap[key] = { scores: [], name: key };
    }
    groupMap[key].scores.push(normalizeScore(row.score));
  });

  const rankings = Object.values(groupMap).map(group => ({
    name: group.name,
    avgScore: group.scores.reduce((a, b) => a + b, 0) / group.scores.length
  }));

  rankings.sort((a, b) => b.avgScore - a.avgScore);

  return rankings.slice(0, 10);
}

function updateRankingChart() {
  if (!state.chartInstances.ranking) return;

  const rankings = calculateGroupRanking();

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '20%' },
    xAxis: { type: 'value', max: 100 },
    yAxis: {
      type: 'category',
      data: rankings.map(r => r.name).reverse()
    },
    series: [{
      type: 'bar',
      data: rankings.map(r => r.avgScore).reverse(),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#83bff6' },
          { offset: 1, color: '#188df0' }
        ])
      },
      label: {
        show: true,
        position: 'right',
        formatter: '{c}'
      }
    }]
  };

  state.chartInstances.ranking.setOption(option);
}

function exportBoard() {
  const rows = [['班级', '小组', '姓名', '分数', '测试结果']].concat(
    state.board.map((row) => [row.className, row.groupName, row.studentName, row.score, row.test])
  );
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'teacher_board.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws/${state.room}/teacher/${state.clientId}`;
}

function connect() {
  if (state.socket) state.socket.close();
  const ws = new WebSocket(wsUrl());
  state.socket = ws;
  log(`[ws] 连接中 ${wsUrl()}`);
  ws.onopen = () => {
    $('netState').textContent = `room=${state.room} | role=teacher | id=${state.clientId}`;
    log(`[ws] 已连接`);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'board_update') {
      state.board = msg.payload || [];
      renderBoard();
      addTrendDataPoint();
      updateCharts();
      log(`[board] 已接收 ${state.board.length} 条学生结果`);
      return;
    }
    if (msg.type === 'state_sync' && msg.payload && Array.isArray(msg.payload.board)) {
      state.board = msg.payload.board;
      renderBoard();
      addTrendDataPoint();
      updateCharts();
    }
    if (msg.type === 'presence') {
      const { client_id, online, className, groupName, studentName } = msg.payload;

      if (online) {
        const index = state.onlineStudents.findIndex(s => s.client_id === client_id);
        const student = { client_id, className, groupName, studentName };

        if (index >= 0) {
          state.onlineStudents[index] = student;
        } else {
          state.onlineStudents.push(student);
        }
      } else {
        state.onlineStudents = state.onlineStudents.filter(s => s.client_id !== client_id);
      }

      renderOnlineStudents();
      log(`[presence] ${studentName || client_id} ${online ? '上线' : '离线'}`);
    }
  };
  ws.onclose = () => {
    $('netState').textContent = 'room=连接已断开';
    log('[ws] 连接已断开');
  };
  ws.onerror = () => {
    $('netState').textContent = 'room=连接失败';
    log('[ws] 连接失败');
  };
}

function bindEvents() {
  $('exportBoardBtn').onclick = exportBoard;
  $('themeBtn').onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    syncThemeButton();
  };
}

function bootApp() {
  bindEvents();
  syncThemeButton();
  renderBoard();
  renderOnlineStudents();
  initCharts();
  if (boot.autoConnect) connect();
}

bootApp();