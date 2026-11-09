// ============================================
// 手持光源系统2026/9/30
// ============================================
import { world, system, ItemStack } from '@minecraft/server';
import { getAllP, Pinv, Pitem, batchP, Ploc, getProp, setProp, CheckItem } from '../Shares/Config_Common.js';
import { GUN_IDS } from './Item.js';
import { currentWeather } from '../Core/Temp.js';

// ============================================
// 配置
// ============================================
const LIGHT_LEVEL = {
    'a:lighter':          { level: 8,  distance: 0  },
    'a:flashlight':       { level: 15, distance: 20 },
    'a:wooden_torch_lit': { level: 15, distance: 0  }
};

const LIGHT_ITEMS = ['a:lighter', 'a:flashlight', 'a:wooden_torch_lit'];

// ============================================
// 函数
// ============================================
//A1放光源方块
function setLightBlock(dimension, pos, level) {
    dimension.setBlockType(pos, `light_block_${level}`);
    return { x: pos.x, y: pos.y, z: pos.z, dim: dimension.id };
}
//A1卸载光源方块
function removeLightBlock(pos) {
    if (!pos) return;

    const dim = world.getDimension(pos.dim);
    const block = dim.getBlock({ x: pos.x, y: pos.y, z: pos.z });
    if (block?.typeId.startsWith('minecraft:light_block')) {
        dim.setBlockType({ x: pos.x, y: pos.y, z: pos.z }, 'minecraft:air');
    }
}

// ============================================
// 监听接口
// ============================================
world.afterEvents.itemStartUse.subscribe((event) => {
    const item = event.itemStack;
    if (!item) return;
    if (!['a:lighter', 'a:flashlight', 'a:wooden_torch'].includes(item.typeId)) return;

    const P = event.source;
    const inv = Pinv(P);

    const dur = getProp(item, 'dur');
    if (dur === 0) return;

    // 木火把点燃
    if (item.typeId === 'a:wooden_torch') {
        const lighter = CheckItem(P, inv, 'a:lighter', '打火机');
        if (!lighter) return;

        if (lighter.dur !== undefined) {
            if (lighter.dur <= 1) {
                inv.setItem(lighter.slot, null);
            } else {
                setProp(lighter.item, 'dur', lighter.dur - 1);
                inv.setItem(lighter.slot, lighter.item);
            }
        }

        const litTorch = new ItemStack('a:wooden_torch_lit', 1);
        setProp(litTorch, 'dur', dur);
        setProp(litTorch, 'light_on', true);
        inv.setItem(P.selectedSlotIndex, litTorch);
        return;
    }

    // 切换开/关
    const on = !getProp(item, 'light_on');
    setProp(item, 'light_on', on);
    inv.setItem(P.selectedSlotIndex, item);
});

// ============================================
// 主计时器（20 tick）：枪灯耐久 + 主手光源耐久 + 进水关灯
// ============================================
system.runInterval(() => {
    for (const player of getAllP()) {
        const inv = Pinv(player);

        // ===== 枪械手电筒：扣耐久（第 1 格枪 + 第 2 格手电筒）=====
        if (player.selectedSlotIndex === 0 && GUN_IDS.includes(Pitem(player)?.typeId)) {
            const held = inv.getItem(1);
            if (held && held.typeId === 'a:flashlight') {
                const dur = getProp(held, 'dur');
                if (dur > 0) {
                    if (dur <= 1) {
                        inv.setItem(1, undefined);
                    } else {
                        setProp(held, 'dur', dur - 1);
                        inv.setItem(1, held);
                    }
                }
            }
        }

        // ===== 主手光源：扣耐久 + 进水关灯 =====
        const item = Pitem(player);
        if (item && LIGHT_ITEMS.includes(item.typeId)) {
            if (getProp(item, 'light_on')) {
                const isFlashlight = item.typeId === 'a:flashlight';

                // 进水 / 下雨 → 关灯（手电筒除外）
                if (!isFlashlight &&
                    (player.isInWater || currentWeather === 'Rain' || currentWeather === 'Thunder')) {
                    setProp(item, 'light_on', false);

                    if (item.typeId === 'a:wooden_torch_lit') {
                        const d = getProp(item, 'dur');
                        const normalTorch = new ItemStack('a:wooden_torch', 1);
                        setProp(normalTorch, 'dur', d);
                        inv.setItem(player.selectedSlotIndex, normalTorch);
                    } else {
                        inv.setItem(player.selectedSlotIndex, item);
                    }

                } else {
                    // 扣耐久
                    const currentDur = getProp(item, 'dur');
                    if (currentDur <= 1) {
                        inv.setItem(player.selectedSlotIndex, null);
                        batchP(player, [['sound', 'random.fizz']]);
                    } else {
                        setProp(item, 'dur', currentDur - 1);
                        inv.setItem(player.selectedSlotIndex, item);
                    }
                }
            }
        }
    }
}, 20);

// ============================================
// 放光 / 清光（2 tick）
// ============================================
system.runInterval(() => {
    for (const player of getAllP()) {
        const name = player.name;
        const key = `light_${name}`;

        const item = Pitem(player);
        let cfg = null;

        if (LIGHT_LEVEL[item?.typeId]) {
            cfg = getProp(item, 'light_on') ? LIGHT_LEVEL[item.typeId] : null;
        } else if (player.selectedSlotIndex === 0 &&
                   GUN_IDS.includes(item?.typeId) &&
                   Pinv(player).getItem(1)?.typeId === 'a:flashlight') {
            cfg = LIGHT_LEVEL['a:flashlight'];
        }

        const cfgKey = cfg ? `${item.typeId}:${getProp(item, 'light_on')}` : '';

        const { x, y, z } = Ploc(player);
        const dir = player.getViewDirection();
        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);

        const saved = world.getDynamicProperty(key);
        const last = typeof saved === 'string' ? JSON.parse(saved) : null;

        if (last &&
            last.bx === bx && last.by === by && last.bz === bz &&
            last.dx === dir.x && last.dy === dir.y && last.dz === dir.z &&
            last.cfgKey === cfgKey) {
            continue;
        }

        if (last) {
            for (const v of last.views) removeLightBlock(v);
        }

        if (!cfg) {
            world.setDynamicProperty(key, undefined);
            continue;
        }

        const eyePos = { x, y: y + 1.6, z };
        const seen = new Set();
        const views = [];

        for (let d = 0; d <= cfg.distance; d += 1) {
            const lx = Math.floor(eyePos.x + dir.x * d);
            const ly = Math.floor(eyePos.y + dir.y * d);
            const lz = Math.floor(eyePos.z + dir.z * d);

            const k = `${lx},${ly},${lz}`;
            if (seen.has(k)) continue;
            seen.add(k);

            const block = player.dimension.getBlock({ x: lx, y: ly, z: lz });
            if (block?.typeId !== 'minecraft:air') break;

            const light = setLightBlock(player.dimension, { x: lx, y: ly, z: lz }, cfg.level);
            if (light) views.push(light);
        }

        world.setDynamicProperty(key, JSON.stringify({
            views,
            bx, by, bz,
            dx: dir.x, dy: dir.y, dz: dir.z,
            cfgKey
        }));
    }
}, 2);