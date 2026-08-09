# 三国杀网页版 — 长期项目笔记

纯 DOM+CSS 渲染（game.js `_doRender` 每帧 `innerHTML` 整块重建）；卡牌结算基于回合制（判定/摸牌/出牌/弃牌），HP 制。

## 引擎关键约定（改代码前必读）
- **回合驱动靠 setTimeout 链**：startCurrentTurn → resolveJudgePhase → goToDrawPhase → goToPlayPhase → aiPlayPhase → aiPlayCards → endPlayPhase → nextPlayer。任何"响应类"动作（出闪/南蛮万箭响应/决斗/八卦阵判定/同心/濒死救桃）完成后，必须调用 `_resumeSourcePlay(source)` 或 `_resumeGameAfterDying(current)` 恢复出牌方回合，否则回合永久挂起（stall）。
- **出牌目标选择 = 场上点选**：`showTargetSelection(card, targets, callback)` 设置 `waitingForTarget = { type:'target_select', card, targets, callback }`，玩家直接点击场上玩家面板（`pickTarget(pid)`），可选目标金色高亮 `target-selectable`，不可选目标置灰 `target-blocked`（getTargetSelectState 判定）。取消用 `cancelTargetSelect()`；humanEndPlayPhase/nextPlayer 会自动清理残留。不要改回 targetOverlay 弹窗（旧弹窗已废弃但 DOM 保留）。
- **顶层 `let game` 与 `window.game`**：game.js 顶层 `let game` 是脚本级词法绑定（浏览器里跨 `<script>` 不可见），ddz.js 等用 `const game = new Game(); window.game = game;` 经 window 桥接。测试若把所有文件拼进同一 vm 脚本，裸 `game` 解析到的是那份恒为 undefined 的词法绑定，必须经由 `window.game` 访问。
- **团队感知**：斗地主用 `getEnemies/getAllies/ddzTargetFilter` 区分敌我；任何伤害/治疗/给牌的目标选择都要过这三个过滤器，否则农民会误伤/误奶队友。

## 已知引擎缺陷模式（已修复，记录防回归）
- AOE 最后一个目标是 AI 时 `processAOETargets` 不续链 → 改 idx>=length 调 `_resumeSourcePlay`。
- **决斗恢复目标必须是 `players[currentPlayerIdx]`（当前出牌方），不是 challenger**：aiRespondJuedou / humanRespondJuedou / humanRespondJuedouSecond / resolveAutoPlayPending(juedou) 共 4 处。否则 AI 发起决斗→玩家反击→AI 无杀 时 AI 回合挂起（challenger=玩家→人类分支空操作）。
- `pendingDamageCards[target.id]` 可能在重排的响应计时器触发前被清空 → `pd` undefined 时访问 `pd.shanNeeded` 崩溃（aiRespondToSha / humanUseBaguazhen / humanRespondShan 三处已加 `if(pd)` 守卫）。
- 死亡结算（killPlayer→triggerNongminBonus）后需续链，否则出牌方回合挂起。
- 过河拆桥/顺手牵羊**盲选 UI 必须提供装备+判定区按钮**（仅手牌按钮在目标无手牌时会卡死）；取消按钮一律用 `cancelWait()`（会恢复 source 出牌），不要直接 `waitingForTarget=null`。
- 托管（resolveAutoPlayPending）必须为每个新增的 waitingForTarget 类型补分支，否则托管时卡死。

## 武将技能框架约定（新技能接入点）
- resolveSha 已拆为三段链：resolveSha(谋烈弓/破军) → _beginShaResponse(黄忠烈弓/马超铁骑) → _beginShaResponseCore(闪响应)；直接伤害用 `_dealShaDamage`（会设 pendingDamageCards 保证奸雄可取牌）。
- 判定替换钩子：`maybeGuicai(judgePlayer, judgeCard, callback)` — 已挂延时锦囊(_processJudgeCards)/铁骑/刚烈。
- 卖血技触发点统一在 dealDamage(08-ui)：夏侯惇刚烈(带 _ganglianGuard 防递归)、司马懿反馈(带 _fankuiGuard)、张角雷击、郭嘉天妒、曹操奸雄。
- 观星触发点在 startCurrentTurn（判定前），人类用 waitingForTarget 'guanxing'，AI 随机放一半到底部。
- 空城过滤：getValidTargets 的 sha/juedou + AI 目标过滤（ai.js 出杀/决斗两处）。
- 新增武将（09-08 新增）：zhugeliang/zhaoyun/huangzhong/machao/xiahoudun/caoren/simayi/jiexusheng(吴)/mouhuangzhong；谋黄忠花色记录在 useCardOnTarget（使用牌+成为目标时），存 player.mouLieGongSuits。
- 赵云龙胆接入点：playSelectedCard(闪当杀) / waitForShanResponse+humanRespondShan(杀当闪) / humanRespondJuedou+humanRespondAOE(闪当杀) / aiRespondToSha+aiRespondToAOE+aiRespondJuedou / handleCardClick+clickable 高亮。

## ddz 玩法（欢乐斗地主）
- 1 地主 vs 2 农民，叫分定地主；地主 +1 体力上限 +【飞扬】【跋扈】，农民队友阵亡【同心】。差异层在 ddz.js，复用全部卡牌结算。
- 禁将 caopi。

## VFX 特效系统
- `src/game/vfx.js` 提供独立 VFX 层（#vfx-layer，position:fixed, z-index:500, pointer-events:none），不受 _doRender 的 innerHTML 重建影响
- 核心API：VFX.damageEffect / healEffect / skillActivate / turnBanner / deathEffect / cardFly / particleBurst / screenShake
- 所有 VFX 调用必须用 `typeof VFX !== 'undefined'` 守卫
- VFX 位置定位用 `getBoundingClientRect()` 查询 `.player-slot` 内的 `.hero-name` 匹配 `player.hero.name`
- 触发点：dealDamage(08-ui) / resolveTao(02-turn) / killPlayer(05-combat) / startCurrentTurn(02-turn) / useCardOnTarget(02-turn) / doLeiji+各skill(04-skills)
