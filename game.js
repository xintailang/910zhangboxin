/* ============================================
   抓小球小游戏 — 核心逻辑
   严格按 spec.md 技术架构实现
   ============================================ */

'use strict';

/* ---------- 全局常量 ---------- */
const CONFIG = {
  TOTAL_DURATION: 120,       // 游戏总时长（秒）
  BALL_SIZE: 60,             // 小球直径（px）
  MARGIN: 30,                // 位置边距保护（px）
  SCORE_HIT: 2,              // 点中加分
  SCORE_MISS: 1,             // 点空白扣分
  WARN_SECONDS: 10,          // 倒计时警示阈值（秒）
  ANIM_DISAPPEAR: 150,       // 消失动画时长（ms）
  STATUS_BAR_HEIGHT: 60      // 状态栏高度（px，与 CSS 一致）
};

/* ---------- 游戏状态 ---------- */
const gameState = {
  isPlaying: false,
  score: 0,
  startTime: 0,
  timerId: null,
  currentBall: null          // 当前活跃小球 DOM 引用
};

/* ---------- DOM 引用 ---------- */
const $ = (id) => document.getElementById(id);
const dom = {
  scoreValue: $('score-value'),
  timerValue: $('timer-value'),
  startBtn: $('start-btn'),
  gameArea: $('game-area'),
  ballLayer: $('ball-layer'),
  hintOverlay: $('hint-overlay'),
  endModal: $('end-modal'),
  finalScoreValue: $('final-score-value'),
  restartBtn: $('restart-btn')
};

/* ============================================
   初始化：绑定事件监听
   ============================================ */
function init() {
  dom.startBtn.addEventListener('click', onStartClick);
  dom.restartBtn.addEventListener('click', onRestartClick);

  // 关键：游戏区域点击 → 判定为"空白点击"（事件冒泡接收层）
  // 同时监听 pointerdown 和 click，通过 _lastHitAt 防双重触发
  dom.gameArea.addEventListener('pointerdown', onGameAreaClick);
  dom.gameArea.addEventListener('click', onGameAreaClick);

  // 窗口 resize / orientationchange 时重置小球位置
  window.addEventListener('resize', onResize);
}

/* ============================================
   事件处理
   ============================================ */

/** 点击"开始游戏"按钮 */
function onStartClick() {
  if (gameState.isPlaying) return;
  startGame();
}

/** 点击"重新开始"按钮 */
function onRestartClick() {
  hideEndModal();
  startGame();
}

/**
 * 游戏区域点击（空白点击扣分）
 * 注意：小球会 stopPropagation，所以只有"没点到小球"才会到这里
 * 同时监听 pointerdown 和 click，通过 _lastMissAt 防双重触发
 */
let _lastMissAt = 0;
function onGameAreaClick(e) {
  // 关键：只在游戏进行中才处理
  if (!gameState.isPlaying) return;

  // 防双重触发（pointerdown + click 同一次用户操作）
  const now = Date.now();
  if (now - _lastMissAt < 300) return;
  _lastMissAt = now;

  missClick();
}

/** 窗口大小变化 — 如果游戏中已有小球，重新生成防止越界 */
function onResize() {
  if (gameState.isPlaying && gameState.currentBall) {
    removeBallElement(gameState.currentBall, false);
    spawnBall();
  }
}

/* ============================================
   游戏流程
   ============================================ */

/** 开始一局游戏 */
function startGame() {
  // 状态重置
  gameState.isPlaying = true;
  gameState.score = 0;
  gameState.startTime = Date.now();

  // UI 重置
  updateScoreDisplay();
  updateTimerDisplay();
  dom.hintOverlay.classList.add('hidden');
  dom.startBtn.textContent = '游戏中...';
  dom.startBtn.disabled = true;

  // 清理可能残留的旧小球
  clearAllBalls();

  // 立即生成第一个小球（原子不变量：开始后立即有 1 球）
  spawnBall();

  // 启动防漂移倒计时（每秒更新一次 UI）
  gameState.timerId = setInterval(tick, 1000);
}

/** 倒计时 tick — 驱动 UI 更新 + 结束判定 */
function tick() {
  const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
  const timeLeft = Math.max(0, CONFIG.TOTAL_DURATION - elapsed);

  updateTimerDisplay(timeLeft);

  if (timeLeft <= 0) {
    endGame();
  }
}

/** 结束游戏 */
function endGame() {
  gameState.isPlaying = false;

  // 停止倒计时
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }

  // 移除场上小球（带消失动画）
  if (gameState.currentBall) {
    removeBallElement(gameState.currentBall, true);
    gameState.currentBall = null;
  }

  // 恢复按钮
  dom.startBtn.textContent = '开始游戏';
  dom.startBtn.disabled = false;

  // 显示结束弹窗
  showEndModal();
}

/** 显示结束弹窗 */
function showEndModal() {
  dom.finalScoreValue.textContent = gameState.score;
  dom.endModal.classList.remove('hidden');
}

/** 隐藏结束弹窗 */
function hideEndModal() {
  dom.endModal.classList.add('hidden');
}

/* ============================================
   小球生成 & 点击
   ============================================ */

/**
 * 生成一个新的活跃小球（核心！）
 * 始终恰好生成 1 个，满足原子不变量
 */
function spawnBall() {
  // 如果有旧活跃球（例如 endGame 调用前），先移除
  // 正常流程下 currentBall 应已在 handleBallClick 中被置 null
  const pos = generateBallPosition();
  if (!pos) return; // 极端情况：游戏区域太小

  const ball = document.createElement('div');
  ball.className = 'ball ball-appear';
  ball.style.left = pos.x + 'px';
  ball.style.top = pos.y + 'px';

  // 关键：同时监听 pointerdown 和 click，通过 _lastHitAt 防双重触发
  // 关键：stopPropagation 阻止冒泡 → 游戏区域的 miss handler 不会触发
  ball.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!ball._lastHitAt || Date.now() - ball._lastHitAt > 300) {
      ball._lastHitAt = Date.now();
      handleBallClick(ball);
    }
  });
  ball.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!ball._lastHitAt || Date.now() - ball._lastHitAt > 300) {
      ball._lastHitAt = Date.now();
      handleBallClick(ball);
    }
  });

  dom.ballLayer.appendChild(ball);
  gameState.currentBall = ball;
}

/**
 * 处理小球被点击（+2 分 + 小球消失 + 立即生成新球）
 * 设计：新旧并存 → 新球立即生成（保持"始终 1 球"不变量）
 *       旧球后台播放 150ms 消失动画后从 DOM 移除
 */
function handleBallClick(ball) {
  if (!gameState.isPlaying) return;

  // 加分
  gameState.score += CONFIG.SCORE_HIT;
  updateScoreDisplay(true);

  // 标记当前活跃球为 null（逻辑上小球已死）
  gameState.currentBall = null;

  // 立即在新位置生成下一个小球 — 保持原子不变量
  spawnBall();

  // 旧球播放消失动画，150ms 后从 DOM 移除
  ball.classList.remove('ball-appear');
  ball.classList.add('ball-disappear');
  setTimeout(() => {
    if (ball.parentNode) ball.parentNode.removeChild(ball);
  }, CONFIG.ANIM_DISAPPEAR);
}

/** 处理空白点击（-1 分 + 闪红反馈） */
function missClick() {
  // 分数下限保护：最低 0 分
  if (gameState.score > 0) {
    gameState.score -= CONFIG.SCORE_MISS;
    updateScoreDisplay();
  }

  // 闪红反馈
  triggerMissFlash();
}

/** 扣分闪红反馈 */
function triggerMissFlash() {
  dom.gameArea.classList.remove('flash-miss');
  // 强制 reflow 重启动画
  void dom.gameArea.offsetWidth;
  dom.gameArea.classList.add('flash-miss');
}

/**
 * 生成小球随机位置
 * 确保小球不会遮挡状态栏、不会超出视口四边
 * @returns {{ x: number, y: number } | null}
 */
function generateBallPosition() {
  const areaWidth = dom.gameArea.clientWidth;
  const areaHeight = dom.gameArea.clientHeight;
  const ball = CONFIG.BALL_SIZE;
  const margin = CONFIG.MARGIN;

  // 游戏区域高度已经是减去状态栏的高度（fixed: top: 60px）
  // 所以 minY 从 0 开始即可，加上 margin 保护顶部
  const maxX = areaWidth - ball - margin;
  const maxY = areaHeight - ball - margin;

  if (maxX < margin || maxY < margin) {
    // 极端情况：区域太小放不下小球
    return null;
  }

  const x = Math.random() * (maxX - margin) + margin;
  const y = Math.random() * (maxY - margin) + margin;

  return { x, y };
}

/* ============================================
   小球清理工具（防 innerHTML='' 反模式）
   ============================================ */

/** 移除单个小球元素 */
function removeBallElement(ball, animate = true) {
  if (!ball || !ball.parentNode) return;

  if (animate) {
    ball.classList.remove('ball-appear');
    ball.classList.add('ball-disappear');
    setTimeout(() => {
      if (ball.parentNode) ball.parentNode.removeChild(ball);
    }, CONFIG.ANIM_DISAPPEAR);
  } else {
    ball.parentNode.removeChild(ball);
  }
}

/** 清除所有残留小球（结束游戏 / resize 时使用） */
function clearAllBalls() {
  const balls = dom.ballLayer.querySelectorAll('.ball');
  balls.forEach(b => b.parentNode.removeChild(b));
  gameState.currentBall = null;
}

/* ============================================
   UI 更新
   ============================================ */

/** 更新分数显示 */
function updateScoreDisplay(isHit = false) {
  dom.scoreValue.textContent = gameState.score;
  if (isHit) {
    dom.scoreValue.classList.remove('score-pop');
    void dom.scoreValue.offsetWidth; // 重启动画
    dom.scoreValue.classList.add('score-pop');
  }
}

/**
 * 更新倒计时显示
 * @param {number} [timeLeft] - 剩余秒数（不传则实时计算）
 */
function updateTimerDisplay(timeLeft) {
  if (timeLeft === undefined) {
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    timeLeft = Math.max(0, CONFIG.TOTAL_DURATION - elapsed);
  }

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  dom.timerValue.textContent = `${mm}:${ss}`;

  // 警示色切换
  if (timeLeft <= CONFIG.WARN_SECONDS) {
    dom.timerValue.classList.remove('timer-normal');
    dom.timerValue.classList.add('timer-warning');
  } else {
    dom.timerValue.classList.remove('timer-warning');
    dom.timerValue.classList.add('timer-normal');
  }
}

/* ============================================
   启动
   ============================================ */
document.addEventListener('DOMContentLoaded', init);
