// ============================================
// 方块互动2026.10.1
// ============================================

import { world, system, ItemStack } from '@minecraft/server';
import { batchP, Pitem, Pinv, getAllP, UseItem, roomHeatMap } from '../Shares/Config_Common.js';
import { PlayerDie } from '../Core/Player_Basic.js';
import { currentSeason } from '../Core/Temp.js';

// ============================================
// 缓存
// ============================================
const cooldownMap = new Map();
// ============================================
// 变量
// ============================================
const FRUIT_BLOCKS = ['apple', 'orange', 'banana', 'tomato', 'zucchini'];
const BERRY_BLOCKS = ['blueberry', 'cranberry', 'blackberry'];

const CONTAINER_CONFIG = {
    'a:bedside_table': { name: '床头柜', emptyChance: 0.5, loot_tables: { 1: 'bedside_table1', 2: 'bedside_table2', 3: 'bedside_table3' } },
    'a:fridge':        { name: '冰箱',   emptyChance: 0.6, loot_tables: { default: 'fridge' } },
    'a:shelf':         { name: '货架',   emptyChance: 0.7, loot_tables: { 2: 'shelf_drink', 3: 'shelf_eat' } },
    'a:cash_register': { name: '收银台', emptyChance: 0.4, loot_tables: { default: 'cash_register' } }
};
// ============================================
// 监听接口
// ============================================
world.afterEvents.playerLeave.subscribe((event) => cooldownMap.delete(event.playerId));

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;
    const item = Pitem(player);

    if (cooldownMap.has(player.id)) return;
    cooldownMap.set(player.id, true);
    system.runTimeout(() => cooldownMap.delete(player.id), 5);

    system.run(() => {
        for (const fn of INTERACT_CHAIN) {
            if (fn(player, block, item)) return;
        }
    });
});
// ============================================
// 启动注册
// ============================================
system.beforeEvents.startup.subscribe((event) => {
    const regPlace = (id, roll) => event.blockComponentRegistry.registerCustomComponent(id, {
        onPlace: ({ block }) => {
            const states = roll(block);
            if (states) setBlockStates(block, states);
        }
    });

    const regTick = (id, tick) => event.blockComponentRegistry.registerCustomComponent(id, {
        onTick: ({ block }) => tick(block)
    });

    // 容器
    regPlace('a:chest', (block) => {
        const config = CONTAINER_CONFIG[block.typeId];
        if (!config) return;

        const states = block.permutation.getAllStates();
        const color = ('a:colour' in states) ? (Math.random() * 3 | 0) + 1 : 1;

        return {
            ...('a:facing_direction' in states && { 'a:facing_direction': 0 }),
            ...('a:colour' in states && { 'a:colour': color }),
            ...('a:empty' in states && { 
                'a:empty': block.typeId === 'a:shelf' 
                    ? (color === 1 ? 1 : 0) 
                    : (Math.random() < config.emptyChance ? 1 : 0) 
            })
        };
    });

    // 墙面纹理
    for (const id of ['a:wall_text', 'a:wall_letters', 'a:wall_painting']) {
        regPlace(id, () => ({ 'a:pattern1': 0, 'a:pattern2': 0 }));
    }

    // 房间温度
    regTick('a:room', (block) => {
        const bx = block.location.x | 0;
        const bz = block.location.z | 0;
        for (const P of getAllP()) {
            Math.abs((P.location.x | 0) - bx) <= 6 && Math.abs((P.location.z | 0) - bz) <= 6
                ? roomHeatMap.set(P.id, 8)
                : roomHeatMap.delete(P.id);
        }
    });

    // 季节更新 + 浆果放置
    event.blockComponentRegistry.registerCustomComponent('a:season', {
        onPlace: ({ block }) => isBerryBlock(block.typeId) && setBlockStates(block, { 'a:season': currentSeason, 'a:empty': 0 }),
        onTick: ({ block }) => block.permutation.getState('a:season') !== currentSeason && block.setPermutation(block.permutation.withState('a:season', currentSeason))
    });

    // 水果放置
    regPlace('a:colour', (block) => isBerryBlock(block.typeId) ? undefined : { 'a:colour': Math.random() * 3 | 0 });

    // 油桶|门|洗漱台|木障碍
    regPlace('a:oil_barrel', () => ({ 'a:colour': Math.random() < 0.1 ? 0 : Math.floor(Math.random() * 5) + 1 }));
    regPlace('a:door', () => ({ 'a:locked': Math.random() < 0.4 ? 1 : 0, 'a:colour': 2 }));
    regPlace('a:washbasin', () => ({ 'a:water': Math.random() < 0.5 ? 1 : 0 }));
    regPlace('a:obstacle_init', () => ({ 'a:colour': Math.random() < 0.3 ? 2 : 4 }));
});
// ============================================
// 函数
// ============================================

//A0 设置方块状态
function setBlockStates(block, states) {
    const targets = block.getParts?.() ?? [block];

    for (const part of targets) {
        if (!part) continue;
        let perm = part.permutation;
        for (const [k, v] of Object.entries(states)) perm = perm.withState(k, v);
        part.setPermutation(perm);
    }
}

//A1 通用可打断动作
function startTimedAction(player, block, config) {
    if (config.startMsg) batchP(player, [['msg', config.startMsg]]);
    if (config.startSound) batchP(player, [['sound', config.startSound]]);

    let isInterrupted = false;
    let isCompleted = false;

    const startSlot = player.selectedSlotIndex;

    const interrupt = () => {
        isInterrupted = true;
        isCompleted = true;
        system.run(() => {
            if (config.interruptMsg) batchP(player, [['msg', config.interruptMsg]]);
            if (config.startSound) batchP(player, [['cmd', `stopsound @s ${config.startSound}`]]);
        });
    };

    system.runTimeout(() => {
        if (isInterrupted) return;
        isCompleted = true;
        if (config.onComplete) config.onComplete(player, block);
    }, config.duration);

    const checkInterval = system.runInterval(() => {
        if (isCompleted) return system.clearRun(checkInterval);

        if (player.selectedSlotIndex !== startSlot) {
            interrupt();
            return system.clearRun(checkInterval);
        }

        if (config.checkItem && !config.checkItem(player)) {
            interrupt();
            return system.clearRun(checkInterval);
        }

        const v = player.getVelocity();
        if (Math.sqrt(v.x * v.x + v.z * v.z) * 20 > 0.2) {
            interrupt();
            return system.clearRun(checkInterval);
        }
    }, 1);
}

//A2 切换方块状态
function toggleState(block, stateKey, values, label, player) {
    let currentValue;
    try {
        currentValue = block.permutation.getState(stateKey);
    } catch {
        return;
    }
    if (currentValue === undefined) return;
    let currentIndex = values.indexOf(currentValue);
    if (currentIndex === -1) currentIndex = 0;
    const newValue = values[(currentIndex + 1) % values.length];
    setBlockStates(block, { [stateKey]: newValue });
    batchP(player, [['msg', `§a已切换${label}: ${stateKey}=${newValue}`]]);
}

//A3 调试棒
function handleDebugStick(player, block, item) {
    if (item?.typeId !== 'a:debug_stick' || player.playerPermissionLevel < 2) return false;

    if (player.isSneaking) {
        toggleState(block, 'a:facing_direction', [0, 1, 2, 3], '方向', player);
        return true;
    }

    const id = block.typeId;

    const total = {
        'a:wall_text': 21, 'a:wall_letters': 1, 'a:wall_painting': 9,
        'a:wall_english_letters': 26, 'a:wall_english_letters_light': 26
    }[id];

    if (total !== undefined) {
        const p1 = block.permutation.getState('a:pattern1');
        const p2 = block.permutation.getState('a:pattern2');
        if (p1 === undefined || p2 === undefined) return true;

        const next = (p2 * 16 + p1 + 1) % total;
        setBlockStates(block, { 'a:pattern1': next % 16, 'a:pattern2': Math.floor(next / 16) });
        batchP(player, [['msg', `§a已切换: ${next}`]]);
        return true;
    }

    const food = [...FRUIT_BLOCKS, ...BERRY_BLOCKS].find(b => id === `a:${b}_block`);
    const values =
        id === 'a:oil_barrel' ? [0, 1, 2, 3, 4, 5]
        : id === 'a:chair'    ? [1, 2]
        : food                ? (BERRY_BLOCKS.includes(food) ? [0, 1, 2, 3] : [0, 1, 2])
        : [1, 2, 3, 4];

    toggleState(block, 'a:colour', values, '颜色', player);
    return true;
}
//A4 判断是否为浆果方块
function isBerryBlock(blockId) {
    return BERRY_BLOCKS.some(b => blockId === `a:${b}_block`);
}
//A4.5水果方块交互
function handleFoodBlock(player, block) {
    const name = block.typeId.slice(2, -6);

    // 浆果
    if (isBerryBlock(block.typeId)) {
        if (block.permutation.getState('a:empty') === 1) {
            batchP(player, [['msg', '§c这个浆果丛已经采过了']]);
            return true;
        }

        const s = block.permutation.getState('a:season');
        const count =
            s === 2 ? Math.floor(Math.random() * 3) + 2
            : s === 3 ? Math.floor(Math.random() * 3) + 1
            : s === 1 ? Math.floor(Math.random() * 2) + 1
            : 1;

        player.dimension.spawnItem(new ItemStack(`a:${name}`, count), player.location);
        setBlockStates(block, { 'a:empty': 1 });
        batchP(player, [['msg', '§7你采摘了浆果']]);
        return true;
    }

    // 水果
    if (FRUIT_BLOCKS.includes(name)) {
        const itemId = name === 'apple' ? 'a:apple1' : `a:${name}`;
        const lore = { 0: '§r§c腐烂的', 1: '§r§e一般的', 2: '§r§a新鲜的' }[block.permutation.getState('a:colour')];
        if (lore === undefined) return false;

        const itemStack = new ItemStack(itemId, 1);
        itemStack.setLore([lore]);
        player.dimension.spawnItem(itemStack, player.location);
        block.dimension.setBlockType(block.location, 'minecraft:air');
        return true;
    }

    return false;
}
//A6 容器交互
function handleContainerLoot(player, block) {
    if (!CONTAINER_CONFIG[block.typeId]) return false;

    const config = CONTAINER_CONFIG[block.typeId];
    if (block.permutation.getState('a:empty') === 1) {
        batchP(player, [['sound', 'random.click']]);
        return true;
    }

    let lootTable;
    const colour = block.permutation.getState('a:colour');
    if (colour !== undefined && colour !== null) lootTable = config.loot_tables[colour];
    if (!lootTable) lootTable = config.loot_tables['default'] ?? Object.values(config.loot_tables)[0];

    startTimedAction(player, block, {
        duration: 60,
        startMsg: `§7正在搜索${config.name}...`,
        startSound: 'block.search',
        interruptMsg: '§c搜索被打断',
        onComplete: (player, block) => {
            const pos = block.location;
            batchP(player, [['cmd', `loot spawn ${pos.x} ${pos.y} ${pos.z} loot ${lootTable}`]]);

            let perm = { 'a:empty': 1 };
            if (block.typeId === 'a:shelf') perm['a:colour'] = 1;
            setBlockStates(block, perm);

            batchP(player, [['msg', `§7${config.name}搜索完毕`], ['sound', 'random.orb']]);
        }
    });

    return true;
}

//A7 椅子交互
function handleChair(player, block) {
    const pos = block.location;
    player.setProperty('a:facing_direction', block.permutation.getState('a:facing_direction'));
    player.setProperty('a:animation', 2);
    batchP(player, [['cmd', `tp @s ${pos.x} ${pos.y + 1} ${pos.z}`]]);

    system.runTimeout(() => {
        const id = system.runInterval(() => {
            const v = player.getVelocity();

            if (Math.sqrt(v.x * v.x + v.z * v.z) * 20 > 0.1) {
                system.clearRun(id);
                player.setProperty('a:animation', 0);
                return batchP(player, [['cmd', 'tp @s ^^1^0.2']]);
            }

            if (system.currentTick % 20 === 0) {
                const f = batchP(player, [['getProp', 'fatigue']]);
                f > 0 && batchP(player, [['setProp', 'fatigue', f - 0.3]]);
            }
        }, 1);
    }, 30);
}

//A8 门交互
function handleDoor(player, block) {
    const item = Pitem(player);
    const colour = block.permutation.getState('a:colour');
    const isBroken = colour === 1;
    const isLocked = block.permutation.getState('a:locked') === 1;

    const isAxe = item?.typeId === 'a:fire_axe';
    const isPick = item?.typeId === 'a:lock_pick';

    if (isAxe && (isBroken || isLocked)) {
        startTimedAction(player, block, {
            duration: 100, startMsg: '§7正在劈门...', startSound: 'block.break_door', interruptMsg: '§c劈门被打断',
            checkItem: (p) => Pitem(p)?.typeId === 'a:fire_axe',
            onComplete: (player, block) => {
                UseItem(player, Pinv(player), item.typeId, '消防斧', 30);

                isBroken
                    ? (batchP(player, [['sound', 'mob.zombie.woodbreak']]), block.dimension.setBlockType(block.location, 'minecraft:air'))
                    : (setBlockStates(block, { 'a:colour': 1, 'a:locked': 0 }), batchP(player, [['sound', 'block.pry_success_door']]));
            }
        });
        return;
    }

    if (isLocked && !isBroken) {
        if (!isPick) return batchP(player, [['sound', 'block.door_locked']]);

        startTimedAction(player, block, {
            duration: 31, startMsg: '§7正在撬锁...', startSound: 'block.prying_door', interruptMsg: '§c撬锁被打断',
            checkItem: (p) => Pitem(p)?.typeId === 'a:lock_pick',
            onComplete: (player, block) => {
                Math.random() < 0.4
                    ? (setBlockStates(block, { 'a:locked': 0 }), batchP(player, [['sound', 'block.pry_success_door']]))
                    : (batchP(player, [['cmd', 'clear @s a:lock_pick 0 1']]),
                       system.runTimeout(() => batchP(player, [['sound', 'block.pry_failure_door']]), 20));
            }
        });
        return;
    }

    const newDir = { 0: 3, 3: 0, 1: 2, 2: 1 }[block.permutation.getState('a:facing_direction')];
    if (newDir === undefined) return;
    setBlockStates(block, { 'a:facing_direction': newDir });
    batchP(player, [['sound', 'block.open_door']]);
}

//A9 木障碍交互
function handleWoodenObstacle(player, block) {
    const item = Pitem(player);
    if (!item) return;

    const isDismantle = item.typeId === 'a:claw_hammer' || item.typeId === 'a:crowbar';
    const isDestroy = item.typeId === 'a:jungle_axe' || item.typeId === 'a:fire_axe';
    if (!isDismantle && !isDestroy) return;

    startTimedAction(player, block, {
        duration: isDismantle ? 31 : 20,
        startMsg: isDismantle ? '§7正在拆木障碍...' : '§7正在破坏木障碍...',
        startSound: isDismantle ? 'block.pull' : 'mob.zombie.woodbreak',
        interruptMsg: '§c操作被打断',
        checkItem: (p) => Pitem(p)?.typeId === item.typeId,
        onComplete: (player, block) => {
            UseItem(player, Pinv(player), item.typeId, item.typeId, isDestroy ? 5 : 1);

            if (isDestroy) return block.dimension.setBlockType(block.location, 'minecraft:air');

            const current = block.permutation.getState('a:colour');

            if (current === 3 || current === 1) {
                batchP(player, [['sound', 'block.pulling_out']]);
                player.dimension.spawnItem(new ItemStack('a:wooden_plank', 1), block.location);
            }

            current <= 1
                ? block.dimension.setBlockType(block.location, 'minecraft:air')
                : setBlockStates(block, { 'a:colour': current - 1 });
        }
    });
}

//A10 床交互
function sleep(P, bedBlock) {
    // 判断床的颜色状态。如果既不是 3 也不是 4，则直接返回，不执行后续逻辑
    const bedColour = bedBlock.permutation.getState('a:colour');
    if (bedColour !== 3 && bedColour !== 4) {
        return; 
    }

    const allPlayers = getAllP().filter(p => p.hasTag('live'));

    for (const player of allPlayers) {
        // 先获取脚下方块
        const blockUnder = player.getBlockStandingOn();
        
        // 如果脚下没有方块，或者方块不是床，就提示并中断
        if (!blockUnder || blockUnder.typeId !== 'a:bed') {
            return batchP(P, [['msg', `§e等待以下玩家上床: §c${player.name}`]]);
        }
    }

    const pos = bedBlock.location;
    const direction = bedBlock.permutation.getState('a:facing_direction');
    const [ox, oz] = [[0, 0.95], [0.95, 0], [0, -0.05], [-0.05, 0]][direction] ?? [0, 0];

    for (const player of allPlayers) {
        const newHunger = batchP(player, [['getProp', 'hunger']]) - 25;
        const newThirst = batchP(player, [['getProp', 'thirst']]) - 25;

        player.setProperty('a:facing_direction', direction);
        player.setProperty('a:animation', 1);
        
        // 【新增】切换为第三人称视角
        player.runCommand('camera @s set minecraft:third_person');
        
        batchP(player, [['cmd', 'spawnpoint @s'], ['cmd', `tp @s ${pos.x + ox} ${pos.y + 1} ${pos.z + oz}`]]);

        let isInterrupted = false;

        const tpTimer = system.runInterval(() => {
            if (isInterrupted) return;

            const v = player.getVelocity();
            if (Math.sqrt(v.x * v.x + v.z * v.z) * 20 > 0.1) {
                isInterrupted = true;
                system.clearRun(tpTimer);
                for (const other of getAllP().filter(p => p.hasTag('live'))) {
                    other.setProperty('a:animation', 0);
                    other.removeEffect('darkness');
                    other.removeEffect('blindness');
                    // 【新增】打断时恢复第一人称视角
                    other.runCommand('camera @s clear');
                    batchP(other, [['msg', `§c${player.name} 的睡眠被打断`], ['sound', 'random.click']]);
                }
            }
        }, 1);

        system.runTimeout(() => {
            if (isInterrupted) return;
            system.clearRun(tpTimer);

            for (const other of getAllP().filter(p => p.hasTag('live'))) {
                other.setProperty('a:animation', 0);
                // 【新增】结束睡眠时恢复第一人称视角
                other.runCommand('camera @s clear');
            }

            batchP(player, [['setProp', 'fatigue', 0], ['setProp', 'hunger', newHunger], ['setProp', 'thirst', newThirst], ['cmd', 'time add 8000'], ['tag-', 'sleep_tired'], ['tag-', 'sleep_exhausted'], ['tag-', 'sleep_overdue'], ['tag+', 'sleep_normal']]);

            (newHunger <= 0 || newThirst <= 0) && (batchP(player, [['msg', '§c你因饥饿/口渴过度而在睡眠中死亡...']]), PlayerDie(player));
        }, 120);
    }
}

//A11 镜子
function handleMirror(player, block) {
    const colour = block.permutation.getState('a:colour');
    if (colour === 2) return batchP(player, [['msg', '§c镜子碎了']]);

    const pLoc = player.location;
    const bLoc = block.location;
    const dir = block.permutation.getState('a:facing_direction');
    const off = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }][dir] ?? { x: 0, z: 1 };

    player.runCommand(`tp @s ${bLoc.x + 0.5 + off.x} ${pLoc.y} ${bLoc.z + 0.5 + off.z}`);
    player.setProperty('a:facing_mirror', dir === 0 ? 4 : dir);
    player.runCommand('hud @s hide all');
    player.camera.setCamera('minecraft:third_person_front');
    batchP(player, [['msg', '§7照镜子,蹲下退出']]);

    const lockYaw = [180, 90, 0, 270][dir] ?? 0;
    let isInterrupted = false;

    const checkInterval = system.runInterval(() => {
        if (isInterrupted) return;

        player.teleport(player.location, { rotation: { x: 0, y: lockYaw } });

        if (player.isSneaking) {
            isInterrupted = true;
            system.clearRun(checkInterval);
            player.runCommand('camera @s clear');
            player.runCommand('hud @s reset');
            player.setProperty('a:facing_mirror', 0);
        }
    }, 1);
}

//A12 洗漱台
function handleWashbasin(player, block) {
    if (block.permutation.getState('a:water') !== 1) return batchP(player, [['msg', '§c水龙头没有水']]);

    const inv = Pinv(player);
    const slot = player.selectedSlotIndex;
    const slotItem = inv.getItem(slot);

    if (!slotItem) {
        batchP(player, [['setProp', 'thirst', 100], ['msg', '§a你喝了个痛快，口渴值已补满'], ['sound', 'player.drink']]);
        setBlockStates(block, { 'a:water': 0 });
        return;
    }

    const isCanteen = slotItem.typeId === 'a:canteen';
    if (slotItem.typeId !== 'a:water_bottle' && !isCanteen) return;

    slotItem.setDynamicProperty('dur', isCanteen ? 10 : 5);
    inv.setItem(slot, slotItem);

    batchP(player, [['msg', '§a你装满了'], ['sound', 'ambient.fill_water']]);
    setBlockStates(block, { 'a:water': 0 });
}

// ============================================
// 交互链
// ============================================
const BLOCK_STATE_CONFIG = {
    'a:bed': { interact: sleep },
    'a:chair': { interact: handleChair },
    'a:wooden_door': { interact: handleDoor },
    'a:wooden_obstacle': { interact: handleWoodenObstacle },
    'a:mirror': { interact: handleMirror },
    'a:washbasin': { interact: handleWashbasin },
};

const INTERACT_CHAIN = [
    handleDebugStick,
    handleFoodBlock,
    handleContainerLoot,
    (p, b) => BLOCK_STATE_CONFIG[b.typeId]?.interact?.(p, b)
];

