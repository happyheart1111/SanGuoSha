# 三国杀网页版 — 长期项目笔记

纯 DOM+CSS 渲染（game.js `_doRender` 每帧 `innerHTML` 整块重建）；卡牌结算基于回合制（判定/摸牌/出牌/弃牌），HP 制。

## 引擎关键约定（改代码前必读）
- **回合驱动靠 setTimeout 链**：startCurrentTurn → resolveJudgePhase → goToDrawPhase → goToPlayPhase → aiPlayPhase → aiPlayCards → endPlayPhase → nextPlayer。任何"响应类"动作（出闪/南蛮万箭响应/决斗/八卦阵判定/同心/濒死救桃）完成后，必须调用 `_resumeSourcePlay(source)` 或 `_resumeGameAfterDying(current)` 恢复出牌方回合，否则回合永久挂起（stall）。
- **顶层 `let game` 与 `window.game`**：game.js 顶层 `let game` 是脚本级词法绑定（浏览器里跨 `<script>` 不可见），ddz.js 等用 `const game = new Game(); window.game = game;` 经 window 桥接。测试若把所有文件拼进同一 vm 脚本，裸 `game` 解析到的是那份恒为 undefined 的词法绑定，必须经由 `window.game` 访问。
- **团队感知**：斗地主用 `getEnemies/getAllies/ddzTargetFilter` 区分敌我；任何伤害/治疗/给牌的目标选择都要过这三个过滤器，否则农民会误伤/误奶队友。

## 已知引擎缺陷模式（已修复，记录防回归）
- AOE 最后一个目标是 AI 时 `processAOETargets` 不续链 → 改 idx>=length 调 `_resumeSourcePlay`。
- `aiRespondJuedou` 漏 `_resumeSourcePlay(challenger)`（人类路径有）。
- `pendingDamageCards[target.id]` 可能在重排的响应计时器触发前被清空 → `pd` undefined 时访问 `pd.shanNeeded` 崩溃（aiRespondToSha / humanUseBaguazhen / humanRespondShan 三处已加 `if(pd)` 守卫）。
- 死亡结算（killPlayer→triggerNongminBonus）后需续链，否则出牌方回合挂起。

## ddz 玩法（欢乐斗地主）
- 1 地主 vs 2 农民，叫分定地主；地主 +1 体力上限 +【飞扬】【跋扈】，农民队友阵亡【同心】。差异层在 ddz.js，复用全部卡牌结算。
- 禁将 caopi。

## VFX 特效系统
- `src/game/vfx.js` 提供独立 VFX 层（#vfx-layer，position:fixed, z-index:500, pointer-events:none），不受 _doRender 的 innerHTML 重建影响
- 核心API：VFX.damageEffect / healEffect / skillActivate / turnBanner / deathEffect / cardFly / particleBurst / screenShake
- 所有 VFX 调用必须用 `typeof VFX !== 'undefined'` 守卫
- VFX 位置定位用 `getBoundingClientRect()` 查询 `.player-slot` 内的 `.hero-name` 匹配 `player.hero.name`
- 触发点：dealDamage(08-ui) / resolveTao(02-turn) / killPlayer(05-combat) / startCurrentTurn(02-turn) / useCardOnTarget(02-turn) / doLeiji+各skill(04-skills)
