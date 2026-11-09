// ============================================
// 物品解析器 + 组件执行器2026/9/30
// ============================================

import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { Pinv, Pitem, getAllP, batchP, CheckItem, getProp, setProp } from '../Shares/Config_Common.js';

// ============================================
// 变量
// ============================================
const FRUIT_BASE = {
    'a:apple1': { hunger: 20, thirst: 10, name: '苹果', isBerry: false },
    'a:orange': { hunger: 12, thirst: 10, name: '橙子', isBerry: false },
    'a:banana': { hunger: 18, thirst: 5, name: '香蕉', isBerry: false },
    'a:tomato': { hunger: 10, thirst: 15, name: '西红柿', isBerry: false },
    'a:zucchini': { hunger: 8, thirst: 20, name: '西葫芦', isBerry: false },
    'a:blueberry': { hunger: 3, thirst: 1, name: '蓝莓', isBerry: true },
    'a:cranberry': { hunger: 1, thirst: 3, name: '蔓越莓', isBerry: true },
    'a:blackberry': { hunger: 2, thirst: 2, name: '黑莓', isBerry: true }
};

export const Normal_ITEMS = {
    'a:fire_axe': ['C:name:消防斧', 'C:prop:dur:150', 'C:prop:max_dur:150', 'C:prop:use_time:16'],
    'a:jungle_axe': ['C:name:丛林斧', 'C:prop:dur:320', 'C:prop:max_dur:320', 'C:prop:use_time:16'],
    'a:claw_hammer': ['C:name:羊角锤', 'C:prop:dur:50', 'C:prop:max_dur:50', 'C:prop:use_time:16'],
    'a:crowbar': ['C:name:撬棍', 'C:prop:dur:250', 'C:prop:max_dur:250', 'C:prop:use_time:16'],
    'a:walkie_talkie': ['C:name:对讲机', 'B:walkie_talkie_use', 'C:prop:use_time:16'],
    'a:canteen': ['C:name:水壶', 'C:prop:dur:10', 'C:prop:max_dur:10', 'C:prop:use_time:48', 'A:check_water_container', 'B:water_container_use'],
    'a:water_bottle': ['C:name:水瓶', 'C:prop:dur:5', 'C:prop:max_dur:5', 'C:prop:use_time:64', 'A:check_water_container', 'B:water_container_use'],
    'a:lighter': ['C:name:打火机', 'C:prop:dur:1800', 'C:prop:use_time:10'],
    'a:flashlight': ['C:name:手电筒', 'C:prop:dur:3000', 'C:prop:max_dur:3000', 'C:prop:use_time:10'],
    'a:can_opener': ['C:prop:dur:100', 'C:prop:use_time:16'],
    'a:wooden_torch': ['C:name:火把', 'A:has_lighter', 'C:prop:dur:2000', 'C:prop:use_time:16'],
    'a:wooden_torch_lit': ['C:prop:dur:240', 'C:prop:use_time:16'],
    'a:fuel_bottle': ['C:name:便携式油桶', 'C:prop:dur:0', 'C:prop:max_dur:100', 'C:prop:use_time:16', 'A:check_fuel_bottle', 'B:fuel_bottle_use'],

    'a:apple1': ['C:name:苹果', 'B:use_fruit', 'C:prop:use_time:32'],
    'a:orange': ['C:name:橙子', 'B:use_fruit', 'C:prop:use_time:32'],
    'a:banana': ['C:name:香蕉', 'B:use_fruit', 'C:prop:use_time:32'],
    'a:tomato': ['C:name:西红柿', 'B:use_fruit', 'C:prop:use_time:32'],
    'a:zucchini': ['C:name:西葫芦', 'B:use_fruit', 'C:prop:use_time:32'],
    'a:blueberry': ['C:name:蓝莓', 'B:use_fruit', 'C:prop:use_time:10'],
    'a:cranberry': ['C:name:蔓越莓', 'B:use_fruit', 'C:prop:use_time:10'],
    'a:blackberry': ['C:name:黑莓', 'B:use_fruit', 'C:prop:use_time:10'],

    'a:emergency_ration': ['C:name:粮食包', 'C:prop:hunger:85', 'C:prop:thirst:-5', 'C:prop:use_time:32', 'C:cc'],
    'a:energy_bar': ['C:name:§e能量棒', 'C:prop:hunger:45', 'C:prop:thirst:-5', 'C:prop:fatigue:-50', 'C:prop:use_time:64', 'C:cc'],
    'a:chewing_gum': ['C:name:§a口香糖', 'C:prop:hunger:10', 'C:prop:fatigue:-15', 'C:prop:use_time:64', 'C:cc'],
    'a:lollipop': ['C:name:棒棒糖', 'C:prop:hunger:18', 'C:prop:thirst:-3', 'C:prop:fatigue:-25', 'C:prop:use_time:24', 'C:cc'],
    'a:cup_noodles': ['C:name:杯面', 'C:prop:hunger:40', 'C:prop:thirst:-10', 'C:prop:use_time:48', 'C:cc'],
    'a:canned_fish': ['C:name:鱼罐头', 'A:has_can_opener', 'C:prop:hunger:20', 'C:prop:thirst:10', 'C:prop:use_time:64', 'C:cc'],
    'a:canned_beans': ['C:name:豆子罐头', 'A:has_can_opener', 'C:prop:hunger:40', 'C:prop:thirst:15', 'C:prop:use_time:64', 'C:cc'],
    'a:canned_bacon': ['C:name:培根罐头', 'A:has_can_opener', 'C:prop:hunger:65', 'C:prop:thirst:-12', 'C:prop:use_time:64', 'C:cc'],
    'a:canned_pet': ['C:name:宠物罐头', 'A:has_can_opener', 'C:prop:hunger:35', 'C:prop:thirst:-10', 'C:eff:nausea:200:1', 'C:sound:player.nausea', 'C:prop:use_time:64', 'C:cc'],

    'a:water': ['C:name:瓶装水', 'C:prop:thirst:80', 'C:cc', 'C:prop:use_time:64', 'C:spawn:a:water_bottle:1'],
    'a:canned_energy_drink': ['C:name:罐装能量饮料', 'C:prop:thirst:38', 'C:prop:fatigue:-50', 'C:cc', 'C:prop:use_time:64'],
    'a:canned_soda': ['C:name:罐装碳酸饮料', 'C:prop:thirst:32', 'C:prop:hunger:10', 'C:cc', 'C:prop:use_time:64'],
    'a:canned_beer': ['C:name:罐装啤酒', 'C:prop:thirst:28', 'C:prop:hunger:-5', 'C:eff:nausea:100:1', 'C:cc', 'C:prop:use_time:64'],
    'a:canned_coffee': ['C:name:罐装咖啡', 'C:prop:thirst:30', 'C:prop:fatigue:-30', 'C:prop:use_time:48', 'C:cc'],
    'a:canned_juice': ['C:name:罐装果汁', 'C:prop:thirst:35', 'C:prop:hunger:8', 'C:prop:use_time:40', 'C:cc'],
    'a:milk': ['C:name:牛奶', 'C:prop:thirst:22', 'C:prop:hunger:20', 'C:cc', 'C:prop:use_time:64'],
    'a:vodka': ['C:name:伏特加', 'C:prop:thirst:12', 'C:prop:hunger:-5', 'C:eff:nausea:300:1', 'C:cc', 'C:prop:use_time:64'],

    'a:ruger_mark4': ['C:prop:dur:0', 'C:prop:max_dur:10'],
    'a:walther_p22': ['C:prop:dur:0', 'C:prop:max_dur:10'],
    'a:glock17': ['C:prop:dur:0', 'C:prop:max_dur:17'],
    'a:beretta_92f': ['C:prop:dur:0', 'C:prop:max_dur:15'],
    'a:sig_p226': ['C:prop:dur:0', 'C:prop:max_dur:15'],
    'a:colt_1911': ['C:prop:dur:0', 'C:prop:max_dur:7'],
    'a:hk_usp45': ['C:prop:dur:0', 'C:prop:max_dur:12'],
    'a:mossberg_500a': ['C:prop:dur:0', 'C:prop:max_dur:6'],
    'a:remington_870': ['C:prop:dur:0', 'C:prop:max_dur:8'],
    'a:m4_shotgun': ['C:prop:dur:0', 'C:prop:max_dur:9'],
    'a:ar15': ['C:prop:dur:0', 'C:prop:max_dur:20'],
    'a:m4_carbine': ['C:prop:dur:0', 'C:prop:max_dur:30'],
    'a:sks': ['C:prop:dur:0', 'C:prop:max_dur:10'],
    'a:akm': ['C:prop:dur:0', 'C:prop:max_dur:30']
};

// 预计算
const ITEM_META = {};

for (const [id, config] of Object.entries(Normal_ITEMS)) {
    let dur;
    let maxDur;
    let useTime = 0;
    const conditions = [];
    const others = [];

    for (const cmd of config) {
        if (cmd.startsWith('A:')) {
            conditions.push(cmd);
            continue;
        }
        if (cmd.startsWith('C:prop:')) {
            const parts = cmd.split(':');
            const propKey = parts[2];
            
            if (propKey === 'dur') dur = parseInt(parts[3]);
            else if (propKey === 'max_dur') maxDur = parseInt(parts[3]);
            else if (propKey === 'use_time') useTime = parseInt(parts[3]);
            else others.push(cmd); 
            
            continue;
        }
        others.push(cmd);
    }

    ITEM_META[id] = { dur, maxDur, useTime, conditions, others };
}

export const GUN_IDS = [
    'a:ruger_mark4', 'a:walther_p22', 'a:glock17', 'a:beretta_92f',
    'a:sig_p226', 'a:colt_1911', 'a:hk_usp45',
    'a:mossberg_500a', 'a:remington_870', 'a:m4_shotgun',
    'a:ar15', 'a:sks', 'a:cz858'
];


// ============================================
// 【新增】武器科普数据库
// ============================================
const GUN_CODEX = {
    // ================= 手枪类 =================
    'a:ruger_mark4': {
        title: 'Ruger Mark IV',
        type: '手枪',
        desc: '§l§0Ruger Mark IV§r§0\n\n经典的 .22 LR 口径半自动手枪。因其极低的后坐力和清脆的枪声,常被用于基础射击训练与静音清剿。\n\n§l§0[参数评估]§r§0\n\n单发威力较低,但弹药重量轻,具有极高的携弹量。适合精准射击头部目标。'
    },
    'a:walther_p22': {
        title: 'Walther P22',
        type: '手枪',
        desc: '§l§0Walther P22§r§0\n\n紧凑型 .22 口径战术手枪。体积小巧,非常适合作为隐蔽式副武器贴身携带。\n\n§l§0[参数评估]§r§0\n\n在狭窄的室内环境中具有极快的拔枪速度与机动性,但面对高强度防具目标时杀伤力不足。'
    },
    'a:glock17': {
        title: 'Glock 17',
        type: '手枪',
        desc: '§l§0Glock 17§r§0\n\n采用 9mm 口径的聚合物框架手枪。具备 17 发大容量弹匣,且对潮湿、泥泞等极端环境的耐受力极强。\n\n§l§0[参数评估]§r§0\n\n最常见的防身武器。结构可靠,弹药通用性高,适合应对中近距离的突发威胁。'
    },
    'a:beretta_92f': {
        title: 'Beretta 92F',
        type: '手枪',
        desc: '§l§0Beretta 92F§r§0\n\n经典的 9mm 全金属军用手枪。其开膛待击设计带来了优异的射击手感,精度在同级别武器中处于领先地位。\n\n§l§0[参数评估]§r§0\n\n重量略沉,但优秀的精度使得它非常适合枪法精准的使用者进行中距离点射。'
    },
    'a:colt_1911': {
        title: 'Colt 1911',
        type: '手枪',
        desc: '§l§0Colt 1911§r§0\n\n拥有百年历史的 .45 ACP 口径手枪。其发射的大口径弹药具备极其惊人的停止作用。\n\n§l§0[参数评估]§r§0\n\n7 发弹匣容量较小,且后坐力较大。但单发命中即可有效迟滞目标的行动,需节约使用。'
    },
    'a:hk_usp45': {
        title: 'HK USP45',
        type: '手枪',
        desc: '§l§0HK USP45§r§0\n\n高度战术化的 .45 口径手枪。其采用先进的制造工艺,在保留大口径动能的同时,大幅优化了后坐力控制。\n\n§l§0[参数评估]§r§0\n\n相较于 1911,它拥有更大的弹匣容量与更快的战术装填速度,是顶级的大口径防身武器。'
    },

    // ================= 霰弹枪类 =================
    'a:mossberg_500a': {
        title: 'Mossberg 500A',
        type: '霰弹枪',
        desc: '§l§0Mossberg 500A§r§0\n\n经典的泵动式霰弹枪。发射 12 号口径弹丸,近距离杀伤面积极大。\n\n§l§0[参数评估]§r§0\n\n室内清道夫。射程极短,泵动射速较慢,后坐力巨大。容错率低,空枪极易陷入险境\n\n§l§0[规格数据]§r§0\n§7• 弹容:§f 6 发\n§7• 射速:§f 0.75 秒/发\n§7• 射程:§f 近距离 (6格)\n§7• 散布:§f 大\n§7• 装弹:§f 1 秒/发 (空仓1.5秒)'
    },
    'a:remington_870': {
        title: 'Remington 870',
        type: '霰弹枪',
        desc: '§l§0Remington 870§r§0\n\n多国军警的制式防暴武器。加长弹仓带来了更高的续航,弹丸散布更为密集。\n\n§l§0[参数评估]§r§0\n\n手感极佳,中近距离交火从容。受限于泵动机制射速依然较慢,面对尸潮需极好的节奏感与弹药规划\n\n§l§0[规格数据]§r§0\n§7• 弹容:§f 9 发\n§7• 射速:§f 0.75 秒/发\n§7• 射程:§f 近距离 (8格)\n§7• 散布:§f 中等偏大\n§7• 装弹:§f 1 秒/发 (空仓1.5秒)'
    },
    'a:m4_shotgun': {
        title: 'M4 Shotgun',
        type: '霰弹枪',
        desc: '§l§0M4 Shotgun§r§0\n\n导气式半自动战术霰弹枪。摒弃传统泵动,配备 12 发大弹仓与极佳的收束散布。\n\n§l§0[参数评估]§r§0\n\n近距离绞肉机。高射速带来压倒性压制力,但弹药消耗极快。一旦打空,缓慢的逐发装填将是致命弱点\n\n§l§0[规格数据]§r§0\n§7• 弹容:§f 12 发\n§7• 射速:§f 0.4 秒/发 (半自动)\n§7• 射程:§f 中距离 (12格)\n§7• 散布:§f 小\n§7• 装弹:§f 1 秒/发 (空仓1.5秒)'
    },

    // ================= 步枪类 =================
    'a:ar15': {
        title: 'AR-15',
        type: '步枪',
        desc: '§l§0AR-15§r§0\n\n轻量化的 5.56mm 半自动步枪。具备极高的射击精度与极低的后坐力,是中远距离精准射击的理想平台。\n\n§l§0[参数评估]§r§0\n\n单发点射精度极高。但仅具备单发模式,在遭遇极近距离突袭时,火力密度略显不足。'
    },
    'a:sks': {
        title: 'SKS',
        type: '步枪',
        desc: '§l§0SKS§r§0\n\n老式的 7.62mm 半自动步枪。其使用的全威力步枪弹具备极强的穿透力与远距离杀伤力,结构简单且极其耐用。\n\n§l§0[参数评估]§r§0\n\n中远距离交战的利器,命中即可造成致命伤害。但近战机动性差,且不具备连发能力。'
    },
'a:cz858': {
    title: 'CZ 858',
    type: '步枪',
    desc: '§l§0CZ 858§r§0\n\n捷克制造的 7.62mm 民用步枪，基于著名的 AK 平台改进而来。它继承了这个枪族标志性的粗犷与绝对可靠，做工却更为细腻。\n\n§l§0[参数评估]§r§0\n\n高达 31 发的弹匣容量配合极快的射速，能瞬间倾泻出致命火力。虽然民用底子导致其连续射击时枪口上跳明显，但近距离的爆发压制力足以让任何目标胆寒。'
}
};


// ============================================
// 监听接口
// ============================================
world.afterEvents.itemStartUse.subscribe((event) => {
    const item = event.itemStack;
    const meta = ITEM_META[item.typeId];
    if (!meta) return;

    const P = event.source;
    const inv = Pinv(P);

    const { useTime, conditions, others } = meta;

    for (const entry of conditions) {
        const parts = entry.split(':');
        const handler = PRECONDITION_HANDLERS[parts[1]];
        if (handler && !handler(P, inv, item, parts.slice(2).join(':'))) return;
    }

    system.runTimeout(() => {
        const currentItem = Pitem(P);
        if (currentItem?.typeId === item.typeId) {
            executeEntries(P, item, inv, others);
        }
    }, useTime);
});

world.afterEvents.itemUse.subscribe((event) => {
    const P = event.source;
    const item = event.itemStack;
    if (!P || !item) return;
    if (item.typeId !== 'a:survival_book') return;

    showMainMenu(P);
});

// 主计时器
system.runInterval(() => {
    for (const P of getAllP()) {
        const inv = Pinv(P);

        for (let i = 0; i < 9; i++) {
            const slotItem = inv.getItem(i);
            const meta = ITEM_META[slotItem?.typeId];
            if (!meta) continue;

            const { dur: defaultDur, maxDur: defaultMaxDur } = meta;

            if (typeof defaultDur !== 'number' && typeof defaultMaxDur !== 'number') continue;
            if (getProp(slotItem, 'dur') !== undefined) continue;

            if (typeof defaultDur === 'number') setProp(slotItem, 'dur', defaultDur);
            if (typeof defaultMaxDur === 'number') setProp(slotItem, 'max_dur', defaultMaxDur);
            inv.setItem(i, slotItem);
        }
    }
}, 20);


// ============================================
// 执行器
// ============================================
function executeEntries(P, item, inv, entries) {
    for (const entry of entries) {
        const [prefix, type, ...rest] = entry.split(':');
        const param = rest.join(':');
        const handler = prefix === 'B' ? FUNCTION_HANDLERS[type]
            : prefix === 'C' ? PROPERTY_HANDLERS[type]
                : null;
        if (handler) handler(P, inv, item, param);
    }
}

// 前置类型
const PRECONDITION_HANDLERS = {
    'has_lighter': (P, inv) => CheckItem(P, inv, 'a:lighter', '打火机'),
    'has_can_opener': (P, inv) => CheckItem(P, inv, 'a:can_opener', '开罐器'),
    'check_water_container': (P, _inv, item) => {
        const view = P.getBlockFromViewDirection({ maxDistance: 5, includeLiquidBlocks: true });
        const isLookingAtWashbasin = (view?.block?.typeId || '') === 'a:washbasin';
        if (isLookingAtWashbasin) return false;

        const dur = getProp(item, 'dur');
        const maxDur = getProp(item, 'max_dur');
        const name = maxDur >= 10 ? '水壶' : '水瓶';

        if (dur <= 0) {
            batchP(P, [['msg', `§e${name}是空的`]]);
            return false;
        }
        return true;
    },
    'check_fuel_bottle': (P, _inv, item) => {
        const dur = getProp(item, 'dur');
        const maxDur = getProp(item, 'max_dur');
        const view = P.getBlockFromViewDirection({ maxDistance: 5, includeLiquidBlocks: true });
        const isLookingAtOilBarrel = (view?.block?.typeId || '') === 'a:oil_barrel';

        if (isLookingAtOilBarrel && dur >= maxDur) {
            return false;
        }
        if (!isLookingAtOilBarrel && dur <= 0) {
            return false;
        }
        return true;
    }
};

// 属性类型
const PROPERTY_HANDLERS = {
    'prop': (P, _inv, _item, param) => {
        const [key, value] = param.split(':');
        const numValue = parseInt(value);

        const playerProps = ['hunger', 'thirst', 'health', 'health2', 'stamina', 'fatigue'];
        if (playerProps.includes(key)) {
            const current = getProp(P, key);
            batchP(P, [['setProp', key, current + numValue]]);
        }
    },
    'eff': (P, _inv, _item, param) => {
        const [effect, duration, amplifier] = param.split(':');
        batchP(P, [['effect', effect, parseInt(duration), parseInt(amplifier)]]);
    },
    'sound': (P, _inv, _item, param) => batchP(P, [['sound', param]]),
    'name': (P, _inv, _item, param) => batchP(P, [['msg', `§a你使用了 ${param}`]]),
    'cc': (P, inv) => {
        const slot = P.selectedSlotIndex;
        const currentItem = inv.getItem(slot);
        if (currentItem.amount === 1) {
            inv.setItem(slot, null);
        } else {
            currentItem.amount -= 1;
            inv.setItem(slot, currentItem);
        }
    },
    'spawn': (P, _inv, _item, param) => {
        const lastColon = param.lastIndexOf(':');
        const itemId = param.substring(0, lastColon);
        const count = parseInt(param.substring(lastColon + 1)) || 1;
        P.dimension.spawnItem(new ItemStack(itemId, count), P.location);
    }
};

// 函数类型
const FUNCTION_HANDLERS = {
    'walkie_talkie_use': (P) => {
        let current = getProp(P, 'a:walkie_title') ?? 1;
        current = current === 1 ? 2 : 1;
        setProp(P, 'a:walkie_title', current);
        batchP(P, [
            ['sound', 'ambient.walkie_talkie']
        ]);
    },
    'fuel_bottle_use': (P, inv) => {
        const currentItem = Pitem(P);
        const dur = getProp(currentItem, 'dur');
        const maxDur = getProp(currentItem, 'max_dur');
        const view = P.getBlockFromViewDirection({ maxDistance: 5, includeLiquidBlocks: true });
        const isLookingAtOilBarrel = (view?.block?.typeId || '') === 'a:oil_barrel';

        switch (true) {
            case isLookingAtOilBarrel && dur >= maxDur:
                batchP(P, [['msg', '§e油桶已满']]);
                break;
            case isLookingAtOilBarrel:
                setProp(currentItem, 'dur', maxDur);
                inv.setItem(P.selectedSlotIndex, currentItem);
                break;
            case dur <= 0:
                batchP(P, [['msg', '§e油桶是空的']]);
                break;
            default:
                batchP(P, [['msg', '§0需要对着油桶装油']]);
                break;
        }
    },
    'water_container_use': (P, inv) => {
        const currentItem = Pitem(P);
        const dur = getProp(currentItem, 'dur');
        const maxDur = getProp(currentItem, 'max_dur');

        const name = maxDur >= 10 ? '水壶' : '水瓶';
        const restoreAmount = maxDur >= 10 ? 25 : 20;

        if (dur <= 0) {
            batchP(P, [['msg', `§e${name}是空的`]]);
            return;
        }

        setProp(currentItem, 'dur', dur - 1);
        inv.setItem(P.selectedSlotIndex, currentItem);
        const thirst = getProp(P, 'thirst');
        batchP(P, [
            ['setProp', 'thirst', thirst + restoreAmount],
            ['msg', `§a你喝了一口水`]
        ]);
    },
    'use_fruit': (P, inv, item) => {
        const base = FRUIT_BASE[item.typeId];
        if (!base) return;

        const lore = item.getLore();
        let quality = 'normal';
        if (base.isBerry) quality = 'berry';
        else if (lore.some(l => l.includes('腐烂'))) quality = 'rotten';
        else if (lore.some(l => l.includes('新鲜'))) quality = 'fresh';

        let hunger = base.hunger, thirst = base.thirst, fatigue = 0, msg = '', effect = null;

        switch (quality) {
            case 'berry': break;
            case 'rotten':
                hunger = -Math.abs(hunger) - 2;
                thirst = -Math.abs(thirst) - 2;
                fatigue = 15;
                msg = '§0吃坏肚子了！';
                effect = ['nausea', 200, 1];
                break;
            case 'fresh':
                hunger = Math.floor(hunger * 1.5);
                thirst = Math.floor(thirst * 1.5);
                fatigue = -Math.floor(Math.random() * 10) - 10;
                msg = '§a美味多汁！';
                break;
            default:
                msg = '§e...还可以';
        }

        const commands = [
            ['setProp', 'hunger', (getProp(P, 'hunger')) + hunger],
            ['setProp', 'thirst', (getProp(P, 'thirst')) + thirst],
            ['setProp', 'fatigue', (getProp(P, 'fatigue')) + fatigue],
            ['sound', 'player.burp']
        ];
        if (msg) commands.push(['msg', msg]);
        if (effect) commands.push(['effect', ...effect]);

        batchP(P, commands);

        if (item.amount === 1) inv.setItem(P.selectedSlotIndex, null);
        else {
            item.amount -= 1;
            inv.setItem(P.selectedSlotIndex, item);
        }
    },
    'survival_book_use': (P) => {
        if (P.hasTag("agreed")) {
            showMainMenu(P);
        } else {
            showAgreement(P);
        }
    },
};


// ============================================
// 生存书菜单
// ============================================

// 主菜单
function showMainMenu(P) {
    new ActionFormData()
        .title("§l生存书")
        .body("§0[ 战术生存指南 - 目录 ]\n\n§0第一章  生存日志 ................ §0P.02\n\n§0第二章  装备图鉴 ................ §0P.15\n\n§0第三章  防护图鉴 ................ §0P.24\n\n§0第四章  制作工艺 ................ §0P.31\n\n\n\n\n\n\n\n\n§0by 哔哩哔哩AsTHEwindX")
        .button("生存日志")
        .button("武器图鉴")
        .button("防护装备图鉴")
        .button("制作工艺")
        .button("§0关闭书籍")
        .show(P)
        .then((res) => {
            if (res.canceled) return;
            switch (res.selection) {
                case 0: return showMenu_A(P); 
                case 1: return showMenu_B(P);
                case 2: return showMenu_C(P);
                case 3: return showMenu_D(P);
                default: return; // 关闭
            }
        });
}

// ============================================
// A：生存日志界面 (第一章)
// ============================================
function showMenu_A(P) {
    const days = world.getDay();
    const time = world.getTimeOfDay();
    
    let timeStatus = "▲";
    if (time >= 13000 && time < 23000) timeStatus = "▼"; 

    const myKills = P.getDynamicProperty('a:kill_count');
    const health = P.getDynamicProperty('health');
    const health2 = P.getDynamicProperty('health2');
    const hunger = P.getDynamicProperty('hunger');
    const thirst = P.getDynamicProperty('thirst');
    const fatigue = P.getDynamicProperty('fatigue');
    const armor = P.getDynamicProperty('armor');
    const temperature = P.getDynamicProperty('temperature');
    
    // 强制转数字
    const infectedTicks = Number(P.getDynamicProperty('infected_ticks')) || 0;
    const immunityTicks = Number(P.getDynamicProperty('immunity_ticks')) || 0;
    
    const season = P.getDynamicProperty('season');
    const seasonMap = { 1: '±', 2: '²', 3: '³', 4: '¶' };
    const seasonChar = seasonMap[season] || '?';

    const makeBar = (val, max, type) => {
        if (val === undefined) return ''; 
        const pct = Math.max(0, Math.min(1, val / max));
        const filled = Math.round(pct * 10);
        
        let color = '§0'; 
        if (type === 'hp') {
            color = pct <= 0.2 ? '§4' : pct <= 0.5 ? '§6' : '§2';
        } else if (type === 'fatigue') {
            color = pct <= 0.5 ? '§2' : pct <= 0.75 ? '§6' : '§4';
        } else if (type === 'blue') {
            color = '§1'; 
        } else if (type === 'temp') {
            color = pct <= 0.2 ? '§b' : pct >= 0.8 ? '§4' : '§2';
        } else if (type === 'red') {
            color = '§4'; 
        } else if (type === 'immune') {
            color = '§9'; 
        }

        return color + '//////////'.slice(0, filled) + `§0 ${Math.round(val)}`;
    };

    let statsText = `§r¢§r§l ${makeBar(health, 100, 'hp')}\n` +
                    `§r£§r§l ${makeBar(hunger, 100, 'hp')}\n` +
                    `§r¤§r§l ${makeBar(thirst, 100, 'hp')}\n` +
                    `§r®§r§l ${makeBar(fatigue, 200, 'fatigue')}\n`;

    if (temperature !== undefined) {
        statsText += `§r±§r§l ${makeBar(temperature, 40, 'temp')}\n`;
    }
    if (health2 !== undefined && health2 > 0) {
        statsText += `§r¦§r§l ${makeBar(health2, 100, 'blue')}\n`;
    }
    if (armor !== undefined && armor > 0) {
        statsText += `§r©§r§l ${makeBar(armor, 100, 'blue')}\n`;
    }

    if (P.hasTag('bleeding')) {
        statsText += `§r½§r§l §4////////// ∞\n`;
    }
    if (infectedTicks > 0 || P.hasTag('a:infected')) {
        const maxInfect = 6000;
        const curInfect = infectedTicks > 0 ? infectedTicks : maxInfect; 
        const infectBar = makeBar(curInfect, maxInfect, 'red');
        statsText += `§r☣§r§l ${infectBar.replace(/\d+$/, Math.ceil(curInfect / 20) + 's')}\n`;
    }
    if (immunityTicks > 0) {
        const maxImmune = 1200;
        const immuneBar = makeBar(immunityTicks, maxImmune, 'immune');
        statsText += `§r✚§r§l ${immuneBar.replace(/\d+$/, Math.ceil(immunityTicks / 20) + 's')}\n`;
    }

    new ActionFormData()
        .title("§l生存日志")
        .body(
            `§l§0【生存天数】\n` +
            `§0第 ${days} 天  ${timeStatus}  §r${seasonChar}\n\n` +
            `§l§0【个人体征】§r\n` +
            statsText + `\n` + 
            `\n\n\n\n§0个人击杀 ${myKills !== undefined ? myKills : ''}\n`
        )
        .button("§0返回目录")
        .button("§0关闭书籍")
        .show(P)
        .then((res) => {
            if (res.canceled) return;
            if (res.selection === 0) return showMainMenu(P);
        });
}

// ============================================
// B：装备图鉴 (第二章)
// ============================================
function showMenu_B(P) {
    new ActionFormData()
        .title("§l装备图鉴")
        .body("\n\n\n\n\n\n\n\n§8---记录着各种常见的武器信息---\n\n")
        .button("手枪类")
        .button("霰弹枪类")
        .button("步枪类")
        .button("§0返回目录")
        .button("§0关闭书籍")
        .show(P)
        .then((res) => {
            if (res.canceled) return;
            switch (res.selection) {
                case 0: return showWeaponList(P, '手枪');
                case 1: return showWeaponList(P, '霰弹枪');
                case 2: return showWeaponList(P, '步枪');
                case 3: return showMainMenu(P);
                case 4: return; // 关闭
            }
        });
}

// ============================================
// B1: 武器列表与详情
// ============================================
function showWeaponList(P, category, currentIndex = 0) {
    const guns = Object.keys(GUN_CODEX).filter(id => GUN_CODEX[id].type === category);
    if (guns.length === 0) return showMenu_B(P); // 这里改回返回上一级分类

    const currentGunId = guns[currentIndex] || guns[0];
    const currentData = GUN_CODEX[currentGunId];

    const form = new ActionFormData()
        .title("§l§0" + category + "图鉴")
        .body(currentData.desc);

    for (let i = 0; i < guns.length; i++) {
        const gunData = GUN_CODEX[guns[i]];
        const prefix = (i === currentIndex) ? "" : "§0";
        form.button(prefix + gunData.title);
    }
    
    form.button("§0返回分类");
    form.button("§0关闭书籍");

    form.show(P).then((res) => {
        if (res.canceled) return;

        if (res.selection === guns.length) {
            return showMenu_B(P); // 返回分类页
        }
        if (res.selection === guns.length + 1) {
            return; // 关闭书籍
        }

        return showWeaponList(P, category, res.selection);
    });
}

// ============================================
// C：防护图鉴 (第三章)
// ============================================
function showMenu_C(P) {
    new ActionFormData()
        .title("§l防护装备图鉴")
        .body("\n\n\n\n\n\n\n\n§8---记录着各种常见的防护装备---\n\n")
        .button("§0返回目录")
        .button("§0关闭书籍")
        .show(P)
        .then((res) => {
            if (res.canceled) return;
            if (res.selection === 0) return showMainMenu(P);
        });
}

// ============================================
// D：制作工艺 (第四章)
// ============================================
function showMenu_D(P) {
    new ActionFormData()
        .title("§l制作工艺")
        .body("\n\n\n\n\n\n\n\n§8---记录着各种常见的应急制作---\n\n")
        .button("§0返回目录")
        .button("§0关闭书籍")
        .show(P)
        .then((res) => {
            if (res.canceled) return;
            if (res.selection === 0) return showMainMenu(P);
        });
}


// ============================================
// 对讲机快捷消息
// ============================================
const walkieCooldown = new Map();
const walkieLastTrigger = new Map();
const walkieLastLook = new Map();

const FOLLOW_POOL = ['跟紧我', '这边走', '跟上', '来这边'];
const STOP_POOL = ['停在这', '停下', '别动', '喂喂喂,在这里停一下朋友'];
const OK_POOL = ['好', '啊 行行行', '我知道了', '是的呢', '好的'];
const NO_POOL = ['不', '不 不 不,不行', '不要', '算了'];
const ZOMBIE_POOL = ['感染者来了', '有感染者！', '小心感染者', '快跑有感染者'];
const THANKS_POOL = ['我的朋友谢谢你', '多谢', '感谢', '谢了'];
const TAUNT_POOL = [
    '哦你长得跟感染者一样',
    '婊子',
    '看看你这衰样',
    '你这操作宛若一坨石',
    '你脑子被僵尸啃了？',
    '你妈看见你这样都得叹气',
    '你比腐肉还恶心',
    '你射击水平跟盲人一样'
];

system.runInterval(() => {
    const currentTick = system.currentTick;
    const allPlayers = world.getPlayers();

    for (const P of allPlayers) {
        const item = Pitem(P);
        if (item?.typeId !== 'a:walkie_talkie') continue;

        const v = P.getVelocity();
        const speed = Math.sqrt(v.x * v.x + v.z * v.z);
        if (speed > 0) {
            walkieLastTrigger.delete(P.id);
            continue;
        }

        const r = P.getRotation();
        const last = walkieLastLook.get(P.id);

        walkieLastLook.set(P.id, { x: r.x, y: r.y });

        const tv = P.getDynamicProperty('a:walkie_title') ?? 1;
        const t1 = tv === 1;
        let direction = '';
        let rawMsg = '';

        if (r.x < -30) {
            direction = 'up';
            rawMsg = t1 ? walkieRandom(FOLLOW_POOL) : walkieStatus(P);
        }
        else if (r.x > 30) {
            direction = 'down';
            rawMsg = t1 ? walkieRandom(STOP_POOL) : walkieRandom(ZOMBIE_POOL);
        }
        else {
            if (last) {
                let d = r.y - last.y;
                if (d > 180) d -= 360;
                if (d < -180) d += 360;
                if (Math.abs(d) > 20) {
                    direction = d > 0 ? 'right' : 'left';
                    rawMsg = d > 0
                        ? (t1 ? walkieRandom(OK_POOL) : walkieRandom(THANKS_POOL))
                        : (t1 ? walkieRandom(NO_POOL) : walkieRandom(TAUNT_POOL));
                }
            }
        }

        if (rawMsg && direction) {
            if (walkieLastTrigger.get(P.id) === direction) continue;
            walkieLastTrigger.set(P.id, direction);

            if (currentTick >= (walkieCooldown.get(P.id) || 0)) {
                world.sendMessage(`§e[对讲机] §0${P.name}: §0${rawMsg}`);
                walkieCooldown.set(P.id, currentTick + 40);
            }
        } else {
            walkieLastTrigger.delete(P.id);
        }
    }
}, 4);

world.afterEvents.playerLeave.subscribe((event) => {
    const id = event.playerId;
    walkieCooldown.delete(id);
    walkieLastTrigger.delete(id);
    walkieLastLook.delete(id);
});

function walkieRandom(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

function walkieStatus(P) {
    const get = (k) => P.getDynamicProperty(k);
    const health = get('health');
    const hunger = get('hunger');
    const thirst = get('thirst');
    const infected = get('infected_ticks');
    const isBleeding = P.hasTag('bleeding');

    const issues = [];
    if (isBleeding) issues.push('§0我流血了');
    if (infected > 0) issues.push('§2我感染了');
    if (hunger <= 20) issues.push('§6我饿了');
    if (thirst <= 20) issues.push('§b我渴了');
    if (health <= 20) issues.push('§4我生命值很低');

    if (issues.length === 0) return '§0我状态不好';
    return issues.join(',');
}