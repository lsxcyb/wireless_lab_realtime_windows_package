# 教师端数据监看功能完善设计

**日期：** 2026-04-13  
**版本：** 1.0  
**状态：** 已批准

## 概述

完善教师端的学生数据监看功能，增强数据可视化和实时监控能力。采用渐进式增强方案，通过 ECharts 图表库和 WebSocket 实时通信，为教师提供更直观、更实时的学生实验数据监控体验。

## 目标

1. **数据可视化增强** - 通过图表直观展示学生提交数据的统计信息
2. **实时监控增强** - 实时显示在线学生列表，提升教师对课堂状态的感知

## 功能需求

### 1. 在线学生列表

**位置：** 页面顶部 header 下方的横向滚动条

**显示内容：**
- 每个在线学生显示为圆角卡片
- 卡片内容：班级 | 小组 | 姓名
- 在线状态指示器：绿色圆点 + "在线" 文字
- 右侧显示在线总数：`在线学生：12 人`

**交互特性：**
- 横向滚动，支持鼠标拖拽
- 鼠标悬停显示详细信息
- 空状态显示：`暂无学生在线，等待学生连接...`

**数据来源：**
- WebSocket `presence` 消息
- 心跳超时检测：30秒无消息自动标记离线

### 2. 数据可视化面板

**位置：** 现有"学生提交数据"面板上方新增独立区域

**包含三个图表：**

#### 2.1 测试结果饼图（左侧）

**数据来源：**
- 从 `state.board` 统计三种状态：通过、DNS异常、未通过
- 实时更新，每次 `board_update` 时重新计算

**图表配置：**
- 使用 ECharts 饼图类型
- 颜色方案：
  - 通过：绿色 `#4ade80`
  - DNS异常：黄色 `#fbbf24`
  - 未通过：红色 `#f87171`
- 显示百分比和数量
- 支持图例点击切换显示
- 空状态显示："暂无数据"

#### 2.2 实时趋势图（中间）

**数据结构：**
```javascript
trendData = [
  { time: '14:30:15', total: 5, pass: 3 },
  { time: '14:30:45', total: 8, pass: 6 },
  // ...最多保留最近 20 个数据点
]
```

**触发时机：**
- 每次收到 `board_update` 消息时记录一个数据点
- 时间间隔小于 10 秒的更新合并到同一数据点
- 超过 20 个数据点时移除最早的

**图表配置：**
- 使用 ECharts 折线图
- 双 Y 轴：
  - 提交总数（蓝色线）
  - 通过数（绿色线）
- X 轴显示时间（HH:mm:ss 格式）
- 平滑曲线，带数据点标记
- 空状态显示："等待学生提交"

#### 2.3 小组排名榜（右侧）

**数据处理：**
- 从 `state.board` 按小组聚合数据
- 计算每组平均分
- 按平均分降序排列，取前 10 名

**展示方式：**
- 使用 ECharts 横向柱状图
- Y 轴：班级 + 小组名称（例如："高一(1)班 第3组"）
- X 轴：平均分（0-100）
- 柱子颜色渐变：分数越高颜色越深
- 显示具体分数值
- 空状态显示："暂无小组数据"

## 技术架构

### 整体架构

**新增组件：**
1. 在线学生横条（Online Students Bar）
2. 数据可视化面板（Charts Panel）
3. 状态管理扩展

**技术选型：**
- 图表库：ECharts 5.4.3（通过 CDN 引入）
- 通信协议：WebSocket（复用现有连接）
- 数据存储：前端内存（不持久化）

### 状态管理扩展

```javascript
const state = {
  board: [],              // 现有：学生提交数据
  socket: null,           // 现有：WebSocket 连接
  room: '',               // 现有：房间代号
  clientId: '',           // 现有：客户端 ID
  
  // 新增状态
  onlineStudents: [],     // 在线学生列表
  trendData: [],          // 趋势数据点（最多 20 个）
  chartInstances: {       // ECharts 实例引用
    pie: null,
    trend: null,
    ranking: null
  }
};
```

### WebSocket 消息扩展

**扩展现有 `presence` 消息：**

```javascript
// 学生端连接时发送
{
  type: 'presence',
  payload: {
    client_id: 'student-xxx',
    role: 'student',
    online: true,
    className: '高一(1)班',
    groupName: '第3组',
    studentName: '张三'
  }
}

// 学生端断开时发送
{
  type: 'presence',
  payload: {
    client_id: 'student-xxx',
    role: 'student',
    online: false
  }
}
```

**教师端处理逻辑：**
- 收到 `online: true` 时添加或更新学生到 `onlineStudents`
- 收到 `online: false` 时从 `onlineStudents` 移除学生
- 使用 `client_id` 作为唯一标识，避免重复添加

## 实现细节

### 文件修改清单

#### 1. `client/teacher.html`

**修改内容：**
- 在 `<header>` 后添加在线学生横条 DOM 结构
- 在主面板前添加图表容器 DOM
- 在 `<head>` 中引入 ECharts CDN

**新增 DOM 结构：**
```html
<!-- 在线学生横条 -->
<div class="onlineStudentsBar">
  <div class="onlineStudentsScroll" id="onlineStudentsScroll">
    <!-- 动态渲染学生卡片 -->
  </div>
  <div class="onlineStudentsCount" id="onlineStudentsCount">在线学生：0 人</div>
</div>

<!-- 图表面板 -->
<section class="chartsPanel">
  <div class="chartContainer">
    <div class="chartTitle">测试结果分布</div>
    <div id="pieChart" style="width:100%;height:300px;"></div>
  </div>
  <div class="chartContainer">
    <div class="chartTitle">实时趋势</div>
    <div id="trendChart" style="width:100%;height:300px;"></div>
  </div>
  <div class="chartContainer">
    <div class="chartTitle">小组排名（前10）</div>
    <div id="rankingChart" style="width:100%;height:300px;"></div>
  </div>
</section>
```

**引入 ECharts：**
```html
<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
```

#### 2. `client/assets/teacher-app.js`

**新增函数：**

```javascript
// 渲染在线学生列表
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

// 初始化图表
function initCharts() {
  state.chartInstances.pie = echarts.init($('pieChart'));
  state.chartInstances.trend = echarts.init($('trendChart'));
  state.chartInstances.ranking = echarts.init($('rankingChart'));
  
  // 监听窗口 resize
  window.addEventListener('resize', () => {
    Object.values(state.chartInstances).forEach(chart => chart && chart.resize());
  });
  
  updateCharts();
}

// 更新图表数据
function updateCharts() {
  updatePieChart();
  updateTrendChart();
  updateRankingChart();
}

// 更新饼图
function updatePieChart() {
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

// 添加趋势数据点
function addTrendDataPoint() {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const total = state.board.length;
  const pass = state.board.filter(row => row.test === '通过').length;
  
  // 如果最后一个数据点时间间隔小于 10 秒，则更新而不是新增
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
  
  // 保留最近 20 个数据点
  if (state.trendData.length > 20) {
    state.trendData.shift();
  }
}

// 更新趋势图
function updateTrendChart() {
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

// 计算小组排名
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

// 更新排名图
function updateRankingChart() {
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
```

**修改现有函数：**

```javascript
// 修改 ws.onmessage，添加 presence 处理
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  // 现有逻辑
  if (msg.type === 'board_update') {
    state.board = msg.payload || [];
    addTrendDataPoint();
    renderBoard();
    updateCharts();
    log(`[board] 已接收 ${state.board.length} 条学生结果`);
    return;
  }
  
  if (msg.type === 'state_sync' && msg.payload && Array.isArray(msg.payload.board)) {
    state.board = msg.payload.board;
    addTrendDataPoint();
    renderBoard();
    updateCharts();
  }
  
  // 新增：处理 presence 消息
  if (msg.type === 'presence') {
    const { client_id, online, className, groupName, studentName } = msg.payload;
    
    if (online) {
      // 添加或更新在线学生
      const index = state.onlineStudents.findIndex(s => s.client_id === client_id);
      const student = { client_id, className, groupName, studentName };
      
      if (index >= 0) {
        state.onlineStudents[index] = student;
      } else {
        state.onlineStudents.push(student);
      }
    } else {
      // 移除离线学生
      state.onlineStudents = state.onlineStudents.filter(s => s.client_id !== client_id);
    }
    
    renderOnlineStudents();
    log(`[presence] ${studentName || client_id} ${online ? '上线' : '离线'}`);
  }
};

// 修改 bootApp，初始化图表
function bootApp() {
  bindEvents();
  syncThemeButton();
  renderBoard();
  initCharts();
  renderOnlineStudents();
  if (boot.autoConnect) connect();
}
```

#### 3. `client/assets/app.css`

**新增样式：**

```css
/* 在线学生横条 */
.onlineStudentsBar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  overflow: hidden;
}

.onlineStudentsScroll {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-behavior: smooth;
}

.onlineStudentsScroll::-webkit-scrollbar {
  height: 6px;
}

.onlineStudentsScroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.onlineStudentCard {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  white-space: nowrap;
  font-size: 14px;
  transition: all 0.2s;
}

.onlineStudentCard:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.onlineIndicator {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.onlineStudentsCount {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  white-space: nowrap;
}

.emptyState {
  padding: 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

/* 图表面板 */
.chartsPanel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  margin-bottom: 20px;
}

.chartContainer {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
}

.chartTitle {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1e293b;
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .chartsPanel {
    grid-template-columns: 1fr;
  }
}

/* 深色主题适配 */
[data-theme="dark"] .onlineStudentsBar {
  background: #1e293b;
  border-bottom-color: #334155;
}

[data-theme="dark"] .onlineStudentCard {
  background: #0f172a;
  border-color: #334155;
  color: #e2e8f0;
}

[data-theme="dark"] .chartContainer {
  background: #1e293b;
  border-color: #334155;
}

[data-theme="dark"] .chartTitle {
  color: #e2e8f0;
}
```

#### 4. `server/app.py`

**无需修改** - 现有的 `presence` 消息机制已经支持在线状态通知，只需学生端在连接时发送扩展的 `presence` 消息即可。

#### 5. `client/assets/student-app.js`（可选扩展）

如果需要学生端主动发送身份信息，可以在连接成功后发送：

```javascript
ws.onopen = () => {
  // 发送身份信息
  ws.send(JSON.stringify({
    type: 'presence',
    payload: {
      client_id: state.clientId,
      role: 'student',
      online: true,
      className: $('className').value,
      groupName: $('groupName').value,
      studentName: $('studentName').value
    }
  }));
};
```

## 边界情况处理

### 1. 数据为空时

**饼图：**
- 显示占位文字："暂无数据"
- 使用 ECharts 的 `graphic` 组件显示提示

**趋势图：**
- 显示空状态："等待学生提交"
- X 轴显示占位时间点

**排名榜：**
- 显示："暂无小组数据"

### 2. 学生断线重连

**处理策略：**
- 使用 `client_id` 作为唯一标识
- 重连时更新现有记录，不重复添加
- 心跳超时（30秒）后自动标记离线

### 3. 图表响应式

**实现方式：**
- 监听窗口 `resize` 事件
- 调用 `chart.resize()` 重新计算尺寸
- 小屏幕（<1200px）时图表垂直堆叠

### 4. 性能优化

**趋势数据：**
- 最多保留 20 个数据点
- 超出后移除最早的数据点
- 10秒内的更新合并到同一数据点

**图表更新：**
- 使用防抖，避免频繁重绘
- 仅在数据变化时更新图表

**在线学生列表：**
- 超过 50 人时启用虚拟滚动（可选）
- 使用 `DocumentFragment` 批量更新 DOM

### 5. 错误处理

**ECharts 加载失败：**
- 检测 `window.echarts` 是否存在
- 失败时显示降级提示："图表加载失败，请刷新页面"

**WebSocket 断线：**
- 在线列表显示"连接已断开"
- 图表停止更新，保留最后状态

**数据异常：**
- 分数值使用 `normalizeScore()` 规范化
- 空值或非法值统一处理为 0

## 测试要点

### 功能测试

1. **在线学生列表**
   - 学生连接时正确显示
   - 学生断开时正确移除
   - 在线人数统计准确
   - 横向滚动流畅

2. **测试结果饼图**
   - 数据统计准确
   - 颜色映射正确
   - 图例交互正常
   - 空状态显示正确

3. **实时趋势图**
   - 数据点正确添加
   - 时间轴显示准确
   - 双线条颜色区分清晰
   - 最多保留 20 个点

4. **小组排名榜**
   - 平均分计算正确
   - 排序准确（降序）
   - 显示前 10 名
   - 柱状图渐变效果正常

### 兼容性测试

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

### 性能测试

- 100 个学生在线时列表渲染流畅
- 图表更新延迟 < 100ms
- 内存占用稳定（无泄漏）

## 未来扩展

本设计采用渐进式增强方案，为未来扩展预留空间：

1. **数据持久化** - 服务端增加 SQLite 或 JSON 文件存储
2. **历史数据查询** - 支持查看历史提交记录
3. **导出增强** - 导出包含图表的 PDF 报告
4. **声音提醒** - 新提交时播放提示音
5. **新提交高亮** - 卡片闪烁动画
6. **数据筛选** - 按班级/小组/状态筛选

## 总结

本设计通过引入 ECharts 图表库和扩展 WebSocket 消息，为教师端增加了直观的数据可视化和实时在线监控功能。采用渐进式增强方案，无需修改服务端架构，降低了实施风险，同时为未来功能扩展预留了空间。
