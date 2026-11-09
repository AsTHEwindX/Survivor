import { world } from '@minecraft/server';
// ============================================
// 获取对象2026/9/30
// ============================================
export const roomHeatMap = new Map();//房屋温度
export const fallRecord = new Map();//摔落记录
export const gunState = new Map();//枪械状态
export const reloadTask = new Map();//装弹任务
export const playerHitCD = new Map();//推击cd
export const showDurTask = new Map();//弹药显示
export const specialCD = new Map();//特殊伤害cd
export const grabbed = new Map();//玩家被困

export const getP = (event) => event.player;// 被动方 - 被系统操作的对象 (playerSpawn、entityHurt 等)

export const getS = (event) => event.source;// 主动方 - 操作发起者 (itemUse、blockBreak 等)

export const getI = (event) => event.itemStack;// 获取事件中的物品 (itemUse、itemStartUse 等)

export const getAllP = () => world.getAllPlayers();// 所有在线玩家 (定时器遍历)

export const Pslot = (player) => player.selectedSlotIndex;// 获取玩家当前选中槽位

export const Pinv = (player) => player.getComponent('minecraft:inventory').container;// 获取玩家背包容器

export const Pitem = (player) => player.getComponent('minecraft:inventory').container.getItem(player.selectedSlotIndex);// 获取玩家当前手持物品

export const Pequ = (player) => player.getComponent('equippable');// 获取玩家装备栏组件
export const Ploc = (player) => player.location;
export const Bloc = (block) => ({
    x: Math.floor(block.location.x),
    y: Math.floor(block.location.y),
    z: Math.floor(block.location.z)
});
export const getProp = (obj, key) => obj.getDynamicProperty(key);
export const setProp = (obj, key, value) => obj.setDynamicProperty(key, value);
export function CheckItem(player, inv, param, toolName) {
    for (let i = 0; i < 9; i++) {
        const slotItem = inv.getItem(i);
        if (slotItem && slotItem.typeId === param) {
            const dur = slotItem.getDynamicProperty('dur');

            if (dur === undefined || dur === null) {
                return { slot: i, item: slotItem, dur: undefined };
            }
            if (dur <= 0) {
                batchP(player, [['msg', `-§f §c${toolName}已损坏 §f-`]]);
                return false;
            }
            return { slot: i, item: slotItem, dur: dur };
        }
    }
    batchP(player, [['msg', `-§f §c需要${toolName} §f-`]]);
    return false;
}

export function UseItem(player, inv, param, toolName, amount = 1) {
    for (let i = 0; i < 9; i++) {
        const slotItem = inv.getItem(i);
        if (slotItem && slotItem.typeId === param) {
            const dur = slotItem.getDynamicProperty('dur');
            if (dur === undefined || dur === null) {
                return true;
            }
            const newDur = Math.max(0, dur - amount);
            slotItem.setDynamicProperty('dur', newDur);
            inv.setItem(i, slotItem);

            if (newDur <= 0) {
                batchP(player, [['msg', `-§f §c${toolName}已损坏 §f-`]]);
            }
            return true;
        }
    }
    return false;
}
// ============================================
// 属性范围配置
// ============================================

const PROP_RANGE = {
    health: [0, 100],
    health2: [0, 100],
    hunger: [0, 100],
    thirst: [0, 100],
    stamina: [0, 100],
    fatigue: [0, 200]
};

// ============================================
// 核心函数
// ============================================

export const batchP = (player, actions) => {
    let returnValue = null;

    for (const action of actions) {
        const [type, ...args] = action;

        switch (type) {
            case 'setProp': {
                const prop = args[0];
                let value = args[1];

                const range = PROP_RANGE[prop];
                if (range) {
                    value = Math.max(range[0], Math.min(range[1], value));
                }

                player.setDynamicProperty(prop, value);
                break;
            }
            case 'getProp':
                returnValue = player.getDynamicProperty(args[0]);
                break;
            case 'cmd':
                player.runCommand(args[0]);
                break;
            case 'gamemode':
                player.setGameMode(args[0]);
                break;
            case 'kill':
                player.kill();
                break;
            case 'title':
                player.onScreenDisplay.setTitle(args[0]);
                break;
            case 'timeAdd':
                world.setTimeOfDay((world.getTimeOfDay() + args[0]) % 24000);
                break;
            case 'tag+':
                player.addTag(args[0]);
                break;
            case 'tag-':
                player.removeTag(args[0]);
                break;
            case 'effect': {
                let duration = args[1];
                if (duration === "infinite") duration = 20000000;
                player.addEffect(args[0], duration, { amplifier: args[2], showParticles: args[3] === undefined ? false : args[3] });
                break;
            }
            case 'msg':
                player.sendMessage(args[0]);
                break;
            case 'sound': {
                const pos = player.location;
                player.dimension.playSound(args[0], pos, { volume: 1, pitch: 1 });
                break;
            }
        }
    }
    return returnValue;
};


// ============================================
// 游戏模式检查
// ============================================

export function checkGameMode(P) {
    const gm = P.getGameMode();
    return gm === "Spectator" || gm === "Creative" || world.getDifficulty() === "Peaceful";
}