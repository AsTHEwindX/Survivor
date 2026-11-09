// ============================================
// 玩家基础2026/9/30
// ============================================
import { world, system, ItemStack } from '@minecraft/server';
import { getP,Pinv, batchP, getAllP, checkGameMode, roomHeatMap, fallRecord, gunState, reloadTask, playerHitCD, showDurTask, specialCD, grabbed } from '../Shares/Config_Common.js';
// ============================================
// 事件驱动
// ============================================
world.afterEvents.playerSpawn.subscribe((event) => PlayerSpawn(getP(event)));
// ===== 摔落判定 =====
system.runInterval(() => {
    for (const P of getAllP()) {
        if (checkGameMode(P)) continue;
        checkFallDamage(P);
    }
}, 1);

world.afterEvents.playerLeave.subscribe((e) => {
    const task = reloadTask.get(e.playerId);
    if (task?.timeoutId !== undefined) system.clearRun(task.timeoutId);

    roomHeatMap.delete(e.playerId);
    fallRecord.delete(e.playerId);
    gunState.delete(e.playerId);
    reloadTask.delete(e.playerId);
    playerHitCD.delete(e.playerId);
    showDurTask.delete(e.playerId);
    specialCD.delete(e.playerId);
    grabbed.delete(e.playerId);
    lastSneakState.clear();
    fireResetTask.clear(); 
});

// ===== 疲劳值更新（每 20 tick） =====
// 记录玩家上一次的潜行状态，防止重复触发
const lastSneakState = new Map();

system.runInterval(() => {
    for (const P of getAllP()) {
        if (checkGameMode(P)) continue;

        const hunger = batchP(P, [['getProp', 'hunger']]);
        const thirst = batchP(P, [['getProp', 'thirst']]);
        const fatigue = batchP(P, [['getProp', 'fatigue']]);

        const v = P.getVelocity();
        const s = Math.sqrt(v.x * v.x + v.z * v.z) * 20;

        let delta;
        if (v.y > 0.5 && s > 5) delta = 0.5;
        else if (v.y > 0.5) delta = 0.2;
        else if (s > 5) delta = 0.4;
        else if (s > 2) delta = 0;
        else delta = -0.05;

        updateFatigue(P, hunger, thirst, fatigue, delta);
        updateAbnormal(P);
    }
}, 20);

// ===== 饥饿口渴更新（每 360 tick） =====
system.runInterval(() => {
    for (const P of getAllP()) {
        if (checkGameMode(P)) continue;

        const hunger = batchP(P, [['getProp', 'hunger']]);
        const thirst = batchP(P, [['getProp', 'thirst']]);
        const health = batchP(P, [['getProp', 'health']]);
        const season = batchP(P, [['getProp', 'season']]);

        batchP(P, [['setProp', 'hunger', hunger - 1], ['setProp', 'thirst', thirst - (season === 2 ? 1.5 : 1)]]);

        updateHungerThirst(P, hunger, thirst, health);
    }
}, 360);

// ============================================
// 函数
// ============================================
//A1玩家生成
function PlayerSpawn(P) {
    P.setProperty('a:reload', false);
    P.setProperty('a:unreload', false);

    if (P.hasTag("live")) return;

    batchP(P, [
        ['setProp', 'health', 100], ['setProp', 'health2', 0], ['setProp', 'fatigue', 0], ['setProp', 'thirst', 100], ['setProp', 'hunger', 100], ['setProp', 'temperature', 15], ['setProp', 'season', 1], ['setProp', 'infected_ticks', 0], ['setProp', 'immunity_ticks', 0], ['setProp', 'armor', 0], ['tag-', 'bleeding'], ['tag-', 'sleep_tired'], ['tag-', 'sleep_exhausted'], ['tag-', 'sleep_overdue'], ['tag+', 'sleep_normal'], ['tag-', 'a:infected'], ['tag-', 'bleeding'], ['effect', 'saturation', 'infinite', 1], ['setProp', 'a:kill_count', 0], ['tag+', 'live']
    ]);

    const inv = Pinv(P);
    
    // 给予背包占位符
    for (let i = 9; i <= 35; i++) {
        const stackItem = new ItemStack('a:stack', 1);
        stackItem.lockMode = 'slot';
        stackItem.keepOnDeath = true;
        inv.setItem(i, stackItem);
    }

    // 第一次进服设置世界规则（这个属于世界属性，只需执行一次）
    if (!world.getDynamicProperty("gamerule_set")) {
        batchP(P, [
            ['cmd', 'gamerule doMobSpawning false'], ['cmd', 'gamerule playerWaypoints off'], ['cmd', 'gamerule naturalRegeneration false'], ['cmd', 'gamerule doLimitedCrafting true'], ['cmd', 'gamerule doImmediateRespawn true'], ['cmd', 'gamerule doWeatherCycle false'], ['cmd', 'gamerule commandBlockOutput false'], ['cmd', 'gamerule sendCommandFeedback false'], ['msg', '§aBy 哔哩哔哩 AsTHEwindX§4[请勿以任何理由搬运到自己的addon或者擅自发布]']
        ]);
        world.setDynamicProperty("gamerule_set", true);
    }

    if (!P.hasTag('a:read_guide')) {
        P.addTag('a:read_guide');

        // 延迟 3 秒（60刻）发送提示，避开加载界面
        system.runTimeout(() => {
            if (!P.isValid) return;
            
            // 发送给该玩家
            P.sendMessage("§e[提示] §f请查看背包物品栏【生存模式】右上角的说明书，以了解游戏设置和游玩协议。");
            
        }, 20); 
    }
}

//A2玩家死亡
export function PlayerDie(P) {
    const deathLoc = { x: P.location.x, y: P.location.y, z: P.location.z };

    batchP(P, [
        ['tag-', 'live'],
        ['sound', 'player.death_rattle'],
        ['cmd', `spawnpoint @s ${Math.floor(deathLoc.x)} ${Math.floor(deathLoc.y)} ${Math.floor(deathLoc.z)}`],
        ['kill'],
        ['title', '§4你 死 了'],
        ['gamemode', 'Spectator']
    ]);

    const task = reloadTask.get(P.id);
    if (task?.timeoutId !== undefined) system.clearRun(task.timeoutId);

    const st = gunState.get(P.id);
    if (st) {
        st.isShooting = false;
        if (st.taskId !== null) system.clearRun(st.taskId);
    }

    roomHeatMap.delete(P.id);
    fallRecord.delete(P.id);
    gunState.delete(P.id);
    reloadTask.delete(P.id);
    playerHitCD.delete(P.id);
    showDurTask.delete(P.id);
    specialCD.delete(P.id);
    grabbed.delete(P.id);

    system.runTimeout(() => {
        batchP(P, [['effect', 'invisibility', 'infinite', 0, false]]);
    }, 20);

    P.setProperty('a:animation', 0);
    P.setProperty('a:facing_mirror', 0);
    P.setProperty('a:facing_direction', 0);
}

//A3摔落伤害
function checkFallDamage(P) {
    const isFalling = P.isFalling;
    if (!isFalling && !fallRecord.has(P.id)) return;

    const y = P.location.y;

    if (isFalling) {
        const record = fallRecord.get(P.id);
        if (!record) fallRecord.set(P.id, { maxY: y });
        else if (y > record.maxY) record.maxY = y;
        return;
    }

    const record = fallRecord.get(P.id);
    fallRecord.delete(P.id);

    const fall = record.maxY - y;
    if (fall <= 3) return;

    const dmg = Math.floor((fall - 3) * 5);
    const finalHealth = batchP(P, [['getProp', 'health']]) - dmg;

    if (finalHealth <= 0) return PlayerDie(P);

    batchP(P, [['setProp', 'health', finalHealth], ['sound', 'player.hurt_minor']]);
}

//B1更新饥口渴饥饿
function updateHungerThirst(P, hunger, thirst, health) {
    if (hunger <= 0 || thirst <= 0) return PlayerDie(P);
    if (hunger >= 60 && thirst >= 60 && !P.hasTag("bleeding") && health < 75) {
        batchP(P, [['setProp', 'health', health + 5]]);
    }
}
//更新异常状态
function updateAbnormal(P) {
    // ===== 感染 =====
    if (P.hasTag('a:infected')) {
        const ticks = (P.getDynamicProperty('infected_ticks')) - 1;
        P.setDynamicProperty('infected_ticks', ticks);

        // 每 20 tick（1 秒）扣 1 血
        if (ticks % 20 === 0) {
            const hp = P.getDynamicProperty('health');
            batchP(P, [['setProp', 'health', hp - 1]]);
        }

        // 每 1200 tick（1 分钟）拉低 FOV
        if (ticks % 1200 === 0) {
            const stage = Math.floor((6000 - ticks) / 1200);

            if (stage === 1) {
                batchP(P, [['cmd', 'camera @s fov_set 65 2 in_out_sine']]);
            } else if (stage === 2) {
                batchP(P, [['cmd', 'camera @s fov_set 58 2 in_out_sine']]);
            } else if (stage === 3) {
                batchP(P, [['cmd', 'camera @s fov_set 50 2 in_out_sine']]);
            } else if (stage === 4) {
                batchP(P, [['cmd', 'camera @s fov_set 42 2 in_out_sine']]);
            } else if (stage === 5) {
                batchP(P, [['cmd', 'camera @s fov_set 35 2 in_out_sine']]);
            }
        }

        // 到 0 → 死亡
        if (ticks <= 0) {
            batchP(P, [['msg', '§4你因感染而死']]);
            PlayerDie(P);
        }
    } else {
        P.setDynamicProperty('infected_ticks', 0);
    }

    // ===== 流血 =====
    if (P.hasTag('bleeding')) {
        const ticks = (P.getDynamicProperty('bleeding_ticks')) + 1;
        P.setDynamicProperty('bleeding_ticks', ticks);

        if (ticks % 600 === 0) {
            const hp = P.getDynamicProperty('health');
            batchP(P, [['setProp', 'health', hp - 1]]);
        }
    } else {
        P.setDynamicProperty('bleeding_ticks', 0);
    }
}
//B2疲劳值更新
function updateFatigue(P, hunger, thirst, currentFatigue, delta) {
    let temp = batchP(P, [['getProp', 'temperature']]);
    if (typeof temp !== 'number' || isNaN(temp)) temp = 15;

    batchP(P, [[hunger < 30 ? 'tag+' : 'tag-', 'hunger'], [thirst < 30 ? 'tag+' : 'tag-', 'thirst'], [temp < 3 ? 'tag+' : 'tag-', 'freezing'], [temp >= 3 && temp < 12 ? 'tag+' : 'tag-', 'cold']]);

    const badStatusCount =
        (hunger < 30 ? 1 : 0) +
        (thirst < 30 ? 1 : 0) +
        (temp >= 3 && temp < 12 ? 1 : 0) +
        (temp < 3 ? 1 : 0);

    (badStatusCount >= 2 || temp < 3)
        ? batchP(P, [['effect', 'slowness', 'infinite', 0, false]])
        : P.removeEffect('slowness');

    let fatigueChange = delta + 0.083;
    if (P.isSneaking) fatigueChange = -0.2;
    if (typeof currentFatigue !== 'number' || isNaN(currentFatigue)) currentFatigue = 0;

    const newFatigue = currentFatigue + fatigueChange;
    batchP(P, [['setProp', 'fatigue', newFatigue]]);

    newFatigue >= 100
        ? (P.hasTag('fatigue_melee') || P.addTag('fatigue_melee'))
        : (P.hasTag('fatigue_melee') && P.removeTag('fatigue_melee'));

    newFatigue >= 150
        ? batchP(P, [['effect', 'slowness', 'infinite', 1, false]])
        : P.removeEffect('slowness');

    newFatigue >= 200 && (batchP(P, [['msg', '§c我好累']]), onFatigueCollapse(P));
}

//B3疲劳昏倒
export function onFatigueCollapse(P) {
    Math.random() < 0.2
        ? batchP(P, [['setProp', 'fatigue', 0], ['msg', '§a你昏睡了8小时，感觉好多了...'], ['timeAdd', 8000], ['tag-', 'sleep_tired'], ['tag-', 'sleep_exhausted'], ['tag-', 'sleep_overdue'], ['tag+', 'sleep_normal']])
        : (batchP(P, [['timeAdd', 8000], ['msg', '§c你在昏迷中被丧尸啃食...']]), PlayerDie(P));
}