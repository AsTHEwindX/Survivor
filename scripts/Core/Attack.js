// ============================================
// 枪械系统2026.10.7
// ============================================

import { world, system, ItemStack } from '@minecraft/server';
import { ENTITY_HIT, applyGunDamage, getBodyPart, getBodyPartFromPoint } from './Entity.js';
import { Pinv, Pitem, batchP, Ploc, gunState, reloadTask, playerHitCD, showDurTask } from '../Shares/Config_Common.js';

// ============================================
// 变量
// ============================================
const GUN_DATA = {
    // 手枪类 (切枪快，400ms)
    'a:ruger_mark4': { name: '鲁格 Mark IV', ammo: 'a:ammo_22', range: 20, capacity: 11, spread: 0.015, interval: 5, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1200, unloadCooldown: 800, drawCooldown: 400, shakeIntensity: 0.05, shakeDuration: 0.15 },
    'a:walther_p22': { name: '瓦尔特 P22', ammo: 'a:ammo_22', range: 15, capacity: 11, spread: 0.020, interval: 5, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1200, unloadCooldown: 800, drawCooldown: 400, shakeIntensity: 0.05, shakeDuration: 0.15 },
    'a:glock17': { name: '格洛克 17', ammo: 'a:ammo_9mm', range: 20, capacity: 18, spread: 0.018, interval: 4, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1200, unloadCooldown: 800, drawCooldown: 400, shakeIntensity: 0.08, shakeDuration: 0.15 },
    'a:beretta_92f': { name: '伯莱塔 92F', ammo: 'a:ammo_9mm', range: 20, capacity: 16, spread: 0.018, interval: 4, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1200, unloadCooldown: 800, drawCooldown: 400, shakeIntensity: 0.08, shakeDuration: 0.15 },
    'a:colt_1911': { name: '柯尔特 1911', ammo: 'a:ammo_45', range: 20, capacity: 8, spread: 0.018, interval: 4, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1300, unloadCooldown: 900, drawCooldown: 450, shakeIntensity: 0.12, shakeDuration: 0.15 },
    'a:hk_usp45': { name: 'HK USP45', ammo: 'a:ammo_45', range: 20, capacity: 13, spread: 0.018, interval: 4, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1300, unloadCooldown: 900, drawCooldown: 450, shakeIntensity: 0.12, shakeDuration: 0.15 },

    // 霰弹枪类 (切枪重，700ms)
    'a:mossberg_500a': { name: '莫斯伯格 500A', ammo: 'a:ammo_shell', range: 6, capacity: 6, spread: 0.08, interval: 15, pellets: 10, pelletSpread: 0.8, modes: ['SINGLE'], reloadCooldown: 1000, unloadCooldown: 1000, drawCooldown: 750, shakeIntensity: 0.4, shakeDuration: 0.3 },
    'a:remington_870': { name: '雷明顿 870', ammo: 'a:ammo_shell', range: 8, capacity: 9, spread: 0.07, interval: 15, pellets: 10, pelletSpread: 0.5, modes: ['SINGLE'], reloadCooldown: 1000, unloadCooldown: 1000, drawCooldown: 750, shakeIntensity: 0.4, shakeDuration: 0.3 },
    'a:m4_shotgun': { name: 'M4 霰弹枪', ammo: 'a:ammo_shell', range: 12, capacity: 12, spread: 0.05, interval: 8, pellets: 10, pelletSpread: 0.3, modes: ['SINGLE'], reloadCooldown: 1000, unloadCooldown: 1000, drawCooldown: 750, shakeIntensity: 0.35, shakeDuration: 0.25 },

    // 步枪类 (切枪偏慢，600ms)
    'a:ar15': { name: 'AR-15', ammo: 'a:ammo_556', range: 40, capacity: 21, spread: 0.009, interval: 3, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1000, unloadCooldown: 1000, drawCooldown: 600, shakeIntensity: 0.12, shakeDuration: 0.12 },
    'a:sks': { name: 'SKS', ammo: 'a:ammo_762', range: 40, capacity: 11, spread: 0.010, interval: 4, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1500, unloadCooldown: 1000, drawCooldown: 650, shakeIntensity: 0.15, shakeDuration: 0.15 },
    'a:cz858': { name: 'cz858', ammo: 'a:ammo_762', range: 32, capacity: 31, spread: 0.012, interval: 2, pellets: 1, modes: ['SINGLE'], reloadCooldown: 1000, unloadCooldown: 1000, drawCooldown: 650, shakeIntensity: 0.18, shakeDuration: 0.15 },
};
world.afterEvents.playerLeave.subscribe((event) => {
    cooldownMap.delete(event.playerId);
    // 顺手清理一下防止误触记录
    recentBlockBreaks.delete(event.playerId);
});
const fireResetTask = new Map();
// ============================================
// 右键使用
// ============================================
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const gunConfig = GUN_DATA[event.itemStack.typeId];
    if (!gunConfig) return;

    // ============================================
    // 【新增】切枪时不能开枪和检视
    // ============================================
    if (player.getProperty('a:draw') === true) return;

    const v = player.getVelocity();
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);
    if (speed > 0.22) return;

    const id = player.id;

    // 打断装弹 / 拆弹
    const task = reloadTask.get(id);
    if (task?.timeoutId !== undefined) {
        system.clearRun(task.timeoutId);
        showDur(player);
    }
    reloadTask.delete(id);

    const lookDown30 = Math.asin(-player.getViewDirection().y) * (180 / Math.PI) >= 30;
    const st = getGunState(id);
    const now = Date.now();

    // ============================================
    // 右键 + 低头 30° → 检视弹夹（只播 unreload，不拆弹/不装弹）
    // 时长与拆弹一致：unloadCooldown
    // ============================================
    if (lookDown30) {
        const cdMs = gunConfig.unloadCooldown || 800;

        if (st.lastInspect > 0 && now - st.lastInspect < cdMs) {
            return;
        }

        st.lastInspect = now;

        const gunItem = event.itemStack;

        const currentAmmo = getAmmo(gunItem);
        player.setProperty('a:ammo', currentAmmo > 0);
        showDur(player);

        player.setProperty('a:unreload', true);

        const totalTicks = Math.ceil(cdMs / 50);
        system.runTimeout(() => {
            player.setProperty('a:unreload', false);

            const curItem = Pitem(player);
            if (curItem && curItem.typeId === gunItem.typeId) {
                const cur = getAmmo(curItem);
                player.setProperty('a:ammo', cur > 0);
            }
        }, totalTicks);

        getInspectMessage(player, gunConfig, currentAmmo);
        return;
    }

    // ============================================
    // 单发：每次右键开一枪，靠 interval 限制射速
    // ============================================
    const nowTick = system.currentTick;
    if (nowTick - (st.lastClick || 0) < 2) return;
    st.lastClick = nowTick;

    if (nowTick - (st.lastShot || 0) < gunConfig.interval) return;
    if (fire(player, gunConfig, 1.0)) st.lastShot = nowTick;
});
const recentBlockBreaks = new Map();
const recentItemDrops = new Map();

world.afterEvents.playerBreakBlock.subscribe((event) => {
    // 玩家破坏方块后，记录时间，给 5 刻（0.25秒）的防御窗口期
    recentBlockBreaks.set(event.player.id, system.currentTick);
});
world.afterEvents.entityItemDrop.subscribe((event) => {
    // 只处理玩家丢弃物品
    if (event.entity?.typeId === 'minecraft:player') {
        recentItemDrops.set(event.entity.id, system.currentTick);
    }
});
// ============================================
// 左键挥动：推人 / 装弹 / 拆弹
// ============================================
world.afterEvents.playerSwingStart.subscribe((event) => {
    const player = event.player;
    const id = player.id;

    const gunInfo = Pitem(player);
    const gunConfig = gunInfo ? GUN_DATA[gunInfo.typeId] : null;

    const lookDown30 = Math.asin(-player.getViewDirection().y) * (180 / Math.PI) >= 30;

    // 核心逻辑：只要手里有枪，且没低头，就可以推人
    const canPush = !gunInfo || (gunConfig && !lookDown30);

    // ============================================
    // 1. 推开（空手 / 持枪平视且没蹲下）
    // ============================================
    if (canPush) {
        // ============================================
        // 【防御性代码】：拦截挖方块和丢物品的误触
        // ============================================

        // 1. 检查近期是否破坏过方块（防止连击挖方块触发）
        const lastBreakTick = recentBlockBreaks.get(id);
        if (lastBreakTick !== undefined && system.currentTick - lastBreakTick <= 20) {
            return;
        }
        const lastDropTick = recentItemDrops.get(id);
        if (lastDropTick !== undefined && system.currentTick - lastDropTick <= 5) {
            return;
        }
        // 2. 检查准星是否正对着方块（防止长按挖方块的第一下触发）
        const blockHit = player.getBlockFromViewDirection({ maxDistance: 5 });
        if (blockHit && !blockHit.block.isAir) {
            return;
        }

        // ============================================
        // 推人正常逻辑
        // ============================================
        const now = Date.now();
        if (now - (playerHitCD.get(id) || 0) < 2000) return;

        // 打断换弹（因为空手了，如果还在换弹说明是换弹瞬间切了空手）
        if (reloadTask.has(id)) {
            const task = reloadTask.get(id);
            if (task?.timeoutId !== undefined) {
                system.clearRun(task.timeoutId);
            }
            reloadTask.delete(id);
            player.setProperty('a:reload', false);
            player.setProperty('a:unreload', false);
            showDur(player);
        }

        player.setProperty('a:swing', true);
        system.runTimeout(() => player.setProperty('a:swing', false), 15);

        const loc = Ploc(player);
        const viewDir = player.getViewDirection();

        player.camera.addShake({
            intensity: 0.3,
            duration: 0.15,
            type: "Positional"
        });

        const targets = player.dimension.getEntities({
            location: { x: loc.x + viewDir.x * 1.5, y: loc.y + 1, z: loc.z + viewDir.z * 1.5 },
            maxDistance: 1.5,
            excludeTypes: ['minecraft:item', 'minecraft:xp_orb']
        });

        for (const t of targets) {
            const isPlayer = t.typeId === 'minecraft:player';
            if (!isPlayer && (!ENTITY_HIT.has(t.typeId) || t.getProperty('a:stunned') === true)) continue;

            t.applyImpulse({ x: viewDir.x * 0.6, y: 0.15, z: viewDir.z * 0.6 });

            if (!isPlayer) {
                const vv = t.getComponent('minecraft:variant').value;
                t.setProperty('a:stunned', true);
                t.triggerEvent([2, 4, 21, 22].includes(vv) ? 'a:stun_fast' : 'a:stun_slow');
            }

            batchP(player, [['setProp', 'fatigue', (player.getDynamicProperty('fatigue') ?? 0) + 3]]);
            break;
        }

        playerHitCD.set(id, now);
        return;
    }

    if (player.getProperty('a:draw') === true) return;

    if (reloadTask.has(id)) return;
    if (!gunConfig) return;

    const st = getGunState(id);
    const now = Date.now();

    const cur = getAmmo(gunInfo);

    // ============================================
    // 3. 拆弹夹：蹲下 + 左键
    // ============================================
    if (player.isSneaking) {
        if (cur === 0) return;

        const cdMs = gunConfig.unloadCooldown || 1000;
        if (now - (st.lastUnload || 0) < cdMs) return;
        st.lastUnload = now;

        const totalTicks = Math.ceil(cdMs / 50);
        const ammoToDrop = cur;

        player.setProperty('a:ammo', false);
        player.setProperty('a:unreload', true);
        setAmmo(player, gunInfo, 0);

        showDur(player);

        system.runTimeout(() => {
            player.setProperty('a:unreload', false);

            if (ammoToDrop > 0) {
                const dropItem = new ItemStack(gunConfig.ammo, ammoToDrop);
                player.dimension.spawnItem(dropItem, player.location);
            }

            const curItem = Pitem(player);
            if (curItem && curItem.typeId === gunInfo.typeId) {
                player.setProperty('a:ammo', getAmmo(curItem) > 0);
            }
        }, totalTicks);

        return batchP(player, [['msg', '§e拆卸弹夹']]);
    }

    // ============================================
    // 4. 装弹夹：站立 + 左键
    // ============================================
    const inv = Pinv(player);
    const hasAmmo = Array.from({ length: inv.size }, (_, i) => inv.getItem(i)).some(s => s?.typeId === gunConfig.ammo);

    if (!hasAmmo) {
        batchP(player, [['msg', '§e没有对应弹药']]);
        return;
    }

    if (cur === gunConfig.capacity) {
        batchP(player, [['msg', '§e弹匣已满']]);
        return;
    }

    // 如果是霰弹枪，目标容量直接等于弹匣总容量；如果是其他枪，保留你原来的逻辑
    const isShotgun = gunConfig.pellets > 1;
    const targetAmmo = isShotgun ? gunConfig.capacity : ((cur === (gunConfig.capacity - 1)) ? gunConfig.capacity : (gunConfig.capacity - 1));

    if (cur >= targetAmmo) {
        if (cur !== (gunConfig.capacity - 1)) {
            batchP(player, [['msg', '§e弹匣已满']]);
            return;
        }
    }

    showDur(player);


    // ============================================
    // 4.1 手枪 / 步枪（换弹匣）
    // ============================================
    if (!isShotgun) {
        const totalTicks = Math.floor((gunConfig.reloadCooldown || 1200) / 50);

        player.setProperty('a:reload', true);

        // 【新增】：在 0.5 秒（10刻）后，将 a:ammo 设为 true
        system.runTimeout(() => {
            // 检查任务是否还在，防止玩家中途切枪打断了换弹
            if (reloadTask.has(id)) {
                player.setProperty('a:ammo', true);
            }
        }, 10); // 10刻 = 0.5秒

        const timeoutId = system.runTimeout(() => {
            const ctx = getReloadCtx(player, reloadTask.get(id));
            if (!ctx) return;

            const { gInfo, cfg, inv, cur: liveCur } = ctx;
            let need = targetAmmo - liveCur;
            let loaded = 0;

            if (need > 0) {
                for (let j = 0; j < inv.size && need > 0; j++) {
                    const slot = inv.getItem(j);
                    if (!slot || slot.typeId !== cfg.ammo) continue;

                    const take = Math.min(need, slot.amount);
                    slot.amount > take ? (slot.amount -= take, inv.setItem(j, slot)) : inv.setItem(j, undefined);
                    need -= take;
                    loaded += take;
                }
            }

            finishReload(player, id, gInfo, liveCur + loaded, 'ambient.mag_in');

            player.setProperty('a:reload', false);
            broadcastReloadMessage(player, gunConfig);

        }, totalTicks);

        reloadTask.set(id, { type: 'load', gunId: gunInfo.typeId, timeoutId });
        return;
    }

    // ============================================
    // 4.2 霰弹枪（逐发装填）
    // ============================================
    player.setProperty('a:reload', true);

    const reloadIntervalTicks = Math.floor((gunConfig.reloadCooldown || 1200) / 50);


    // 【公共函数】专门负责从背包里扣一发子弹并装进枪里
    const takeOneShot = (ctx) => {
        const { cfg, inv } = ctx;
        if (!cfg) return false;

        let ammoSlotIndex = -1;

        // 找子弹
        for (let j = 0; j < inv.size; j++) {
            const slot = inv.getItem(j);
            if (slot && slot.typeId === cfg.ammo) {
                ammoSlotIndex = j;
                break;
            }
        }

        if (ammoSlotIndex === -1) return false; // 没子弹了

        // 扣子弹
        const slot = inv.getItem(ammoSlotIndex);
        if (slot.amount > 1) {
            slot.amount -= 1;
            inv.setItem(ammoSlotIndex, slot);
        } else {
            inv.setItem(ammoSlotIndex, undefined);
        }

        // 获取主手武器并装填
        const currentGun = Pitem(player);

        if (currentGun) {
            setAmmo(player, currentGun, getAmmo(currentGun) + 1);

            // 塞回主手槽位
            const playerInv = Pinv(player);
            playerInv.setItem(player.selectedSlotIndex, currentGun);
        }

        player.setProperty('a:ammo', true);
        showDur(player);
        return true;
    };

    const startShotgunLoop = () => {
        const timeoutId = system.runInterval(() => {
            const ctx = getReloadCtx(player, reloadTask.get(id));
            if (!ctx) {
                system.clearRun(timeoutId);
                return;
            }

            const { cur: liveCur } = ctx;

            // 如果装满了，或者没子弹了
            if (liveCur >= targetAmmo || !takeOneShot(ctx)) {
                system.clearRun(timeoutId);
                reloadTask.delete(id);

                player.setProperty('a:reload', false);
                player.setProperty('a:ammo', liveCur > 0);

                showDur(player);
                broadcastReloadMessage(player, gunConfig);
                return;
            }

            // 如果装这一发之后正好满了
            if (liveCur + 1 >= targetAmmo) {
                system.clearRun(timeoutId);
                reloadTask.delete(id);

                player.setProperty('a:reload', false);
                showDur(player);
                broadcastReloadMessage(player, gunConfig);
            }

        }, reloadIntervalTicks);

        reloadTask.set(id, { type: 'load', gunId: gunInfo.typeId, timeoutId });
    };
    if (isShotgun && cur === 0) {
        // 空仓：先等 1.5 秒（战术上膛）
        const firstTimeoutId = system.runTimeout(() => {
            if (!reloadTask.has(id)) return;

            const ctx = getReloadCtx(player, reloadTask.get(id));
            if (!ctx) return;

            // 尝试战术上膛第 1 发，并记录结果
            const success = takeOneShot(ctx);

            const expectedAmmo = ctx.cur + (success ? 1 : 0);

            // 去背包里扫一遍，看看还有没有剩余的子弹
            let hasMoreAmmo = false;
            const { inv, cfg } = ctx;
            if (success) {
                for (let j = 0; j < inv.size; j++) {
                    const slot = inv.getItem(j);
                    if (slot && slot.typeId === cfg.ammo) {
                        hasMoreAmmo = true;
                        break;
                    }
                }
            }

            // 未装满 + 战术上膛成功 + 背包里还有子弹，才进循环
            if (success && expectedAmmo < targetAmmo && hasMoreAmmo) {
                startShotgunLoop();
            } else {
                reloadTask.delete(id);
                player.setProperty('a:reload', false);
                player.setProperty('a:ammo', expectedAmmo > 0);
                showDur(player);
                broadcastReloadMessage(player, gunConfig);
            }

        }, 30); // 30刻 = 1.5秒

        reloadTask.set(id, { type: 'load', gunId: gunInfo.typeId, timeoutId: firstTimeoutId });
    } else {
        // 半满：直接进循环
        startShotgunLoop();
    }
});
// ============================================
// 切换物品：清状态
// ============================================
world.afterEvents.playerHotbarSelectedSlotChange.subscribe((e) => {
    // 1. 打断之前所有的状态（换弹、开枪等）
    const task = reloadTask.get(e.player.id);
    if (task?.timeoutId !== undefined) {
        system.clearRun(task.timeoutId);
        // 【删除】这里原本有 if (p) showDur(p); 删掉
    }
    reloadTask.delete(e.player.id);

    const p = world.getAllPlayers().find(x => x.id === e.player.id);
    if (p) {
        p.setProperty('a:reload', false);
        p.setProperty('a:unreload', false);
        p.setProperty('a:draw', false); // 清空之前的切枪状态

        const fTask = fireResetTask.get(p.id);
        if (fTask !== undefined) system.clearRun(fTask);
        fireResetTask.delete(p.id);
        p.setProperty('a:fire', false);

        // 2. 延迟 1 刻，等游戏把新枪彻底塞到玩家手里
        const equippable = p.getComponent('minecraft:equippable');
        const item = equippable?.getEquipment('Mainhand');
        const isGun = item && GUN_DATA[item.typeId] !== undefined;

        if (isGun) {
            // 同步子弹数量
            const ammo = getAmmo(item);
            p.setProperty('a:ammo', ammo > 0);

            // 3. 立刻把切枪状态设为 true
            p.setProperty('a:draw', true);
            // 【删除】这里原本有 showDur(p); 删掉

            // 4. 读取配置里的切枪时间（如果没有配置，默认 750 毫秒）
            const drawTicks = Math.floor((GUN_DATA[item.typeId].drawCooldown) / 50);

            // 5. 时间到了之后，改成 false，结束切枪动画
            system.runTimeout(() => {
                if (p.isValid) {
                    p.setProperty('a:draw', false);
                    // 【删除】这里原本有同步子弹数量的代码，现在删掉，不在切枪结束时更新 HUD
                }
            }, drawTicks);

        } else {
            p.setProperty('a:ammo', false);
        }
    }
});

// ============================================
// 函数
// ============================================
function getGunState(id) {
    if (!gunState.has(id)) gunState.set(id, {
        lastShot: 0,
        lastClick: 0,
        lastInspect: 0,
        isInspecting: false
    });
    return gunState.get(id);
}

function getAmmo(gunInfo) {
    return gunInfo.getDynamicProperty('dur') || 0;
}

function setAmmo(player, gunInfo, value) {
    const cfg = GUN_DATA[gunInfo.typeId];
    gunInfo.setDynamicProperty('dur', Math.max(0, Math.min(value, cfg.capacity)));
    gunInfo.setDynamicProperty('max_dur', cfg.capacity);
    Pinv(player).setItem(player.selectedSlotIndex, gunInfo);
}

function showDur(player) {
    showDurTask.set(player.id, system.currentTick + 40);
}

function getReloadCtx(player, task) {
    if (!task) return null;

    const gInfo = Pitem(player);
    if (!gInfo || gInfo.typeId !== task.gunId) {
        reloadTask.delete(player.id);
        return null;
    }

    const cfg = GUN_DATA[task.gunId];
    const inv = Pinv(player);
    const cur = getAmmo(gInfo);

    return { gInfo, cfg, inv, cur };
}

function finishReload(player, id, gunInfo, value, sound) {
    setAmmo(player, gunInfo, value);
    batchP(player, [['sound', sound]]);
    showDur(player);
    reloadTask.delete(id);
}

function raycast(player, gunConfig, spreadMult = 1.0) {
    const norm = (v) => {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : v;
    };

    const dim = player.dimension;
    const eyeY = player.isSneaking ? 1.27 : 1.6;
    const start = { x: player.location.x, y: player.location.y + eyeY, z: player.location.z };

    let dir = norm(player.getViewDirection());
    const sp = gunConfig.spread * spreadMult;
    if (sp > 0) dir = norm({ x: dir.x + (Math.random() - 0.5) * sp, y: dir.y + (Math.random() - 0.5) * sp, z: dir.z + (Math.random() - 0.5) * sp });

    const entityHits = dim.getEntitiesFromRay(start, dir, { maxDistance: gunConfig.range });
    const blockHit = dim.getBlockFromRay(start, dir, { maxDistance: gunConfig.range });

    let closest = null;
    let closestDist = Infinity;

    for (const hit of entityHits) {
        const e = hit.entity;
        if (!ENTITY_HIT.has(e.typeId)) continue;
        if (e.id === player.id) continue;
        if (e.hasTag('dead')) continue;
        if (hit.distance < closestDist) {
            closestDist = hit.distance;
            closest = e;
        }
    }

    let blockDist = Infinity;
    if (blockHit) blockDist = Math.sqrt((blockHit.block.location.x + 0.5 - start.x) ** 2 + (blockHit.block.location.y + 0.5 - start.y) ** 2 + (blockHit.block.location.z + 0.5 - start.z) ** 2);

    if (closest && closestDist < blockDist) {
        const loc = closest.location;
        const hitY = start.y + dir.y * closestDist;
        return { entity: closest, block: null, distance: closestDist, hitPoint: { x: loc.x, y: hitY, z: loc.z }, bodyPart: getBodyPart(closest, hitY), dir };
    }

    if (blockHit) return { entity: null, block: blockHit.block, distance: blockDist, hitPoint: blockHit.block.location, bodyPart: 'none', dir };

    return null;
}
function getInspectMessage(player, gunConfig, currentAmmo) {
    const cap = gunConfig.capacity;
    const bulletName = gunConfig.ammo === 'a:ammo_shell' ? '发霰弹' : '发子弹';
    const name = player.nameTag || player.name; // 获取玩家名字

    let msg = "";

    // 【新增】：空仓专属台词
    if (currentAmmo === 0) {
        msg = `该死，我没子弹了！`;
    } else if (currentAmmo === cap) {
        msg = `好极了,弹匣是满的。`;
    } else if (currentAmmo >= cap * 0.8) {
        msg = `弹匣几乎是满的。`;
    } else if (currentAmmo === 1) {
        msg = `妈的,就剩一发了`;
    } else if (currentAmmo >= 2 && currentAmmo <= 4) {
        msg = `只剩 ${currentAmmo} 发了。`;
    } else {
        msg = `弹匣里还有 ${currentAmmo} ${bulletName}。`;
    }

    // 拼装完整文本：黄色名字 + 白色台词
    const finalMsg = `§7${name}§f: ${msg}`;

    // 获取周围 5 格内的所有玩家
    const nearbyPlayers = player.dimension.getPlayers({
        location: player.location,
        maxDistance: 5
    });

    // 给周围的玩家发送消息
    for (const p of nearbyPlayers) {
        p.sendMessage(finalMsg);
    }

    return null;
}
function broadcastReloadMessage(player, gunConfig) {
    const inv = Pinv(player);
    let reserveAmmo = 0;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item && item.typeId === gunConfig.ammo) {
            reserveAmmo += item.amount;
        }
    }

    const mags = Math.floor(reserveAmmo / gunConfig.capacity);
    let reloadMsg = "";

    // 直接用 player.name
    if (reserveAmmo === 0) {
        reloadMsg = `§7${player.name} §f我没备弹了!`;
    } else if (reserveAmmo > 100) {
        reloadMsg = `§7${player.name} §f是的,还有很多子弹`;
    } else if (mags > 0) {
        reloadMsg = `§7${player.name} §f还剩大约 ${mags} 个满弹匣。`;
    } else {
        reloadMsg = `§7${player.name} §f就剩 ${reserveAmmo} 发备弹了。`;
    }

    player.dimension.getPlayers({
        location: player.location,
        maxDistance: 5
    }).forEach(p => p.sendMessage(reloadMsg));
}
// 开火
function fire(player, gunConfig, spreadMult = 1.0) {
    const gunInfo = Pitem(player);
    if (!gunInfo) return false;

    const ammo = getAmmo(gunInfo);
    if (ammo <= 0) {
        player.setProperty('a:ammo', false);
        batchP(player, [['sound', 'ambient.ammo_empty']]);
        return false;
    }

    player.setProperty('a:ammo', ammo - 1 > 0);

    if (gunConfig.ammo === 'a:ammo_556') {
        player.dimension.playSound('ambient.ar5.56', player.location);
    } else if (gunConfig.ammo === 'a:ammo_762') {
        player.dimension.playSound('ambient.ar7.62', player.location);
    } else if (gunConfig.ammo === 'a:ammo_shell') {
        player.dimension.playSound('ambient.shotgun', player.location, { volume: 1.5, pitch: 0.9 + (Math.random() * 0.1 - 0.05) });
    }

    if (fireResetTask.has(player.id)) {
        system.clearRun(fireResetTask.get(player.id));
        fireResetTask.delete(player.id);
    }

    player.setProperty('a:fire', true);

    const resetTicks = Math.max(1, gunConfig.interval || 5);

    const taskId = system.runTimeout(() => {
        player.setProperty('a:fire', false);
        fireResetTask.delete(player.id);
    }, resetTicks);

    fireResetTask.set(player.id, taskId);

    system.runTimeout(() => {
        player.camera.addShake({
            intensity: gunConfig.shakeIntensity || 0.1,
            duration: gunConfig.shakeDuration || 0.2,
            type: "Positional"
        });
    }, 2);

    const dir = player.getViewDirection();
    const headLoc = player.getHeadLocation();

    const muzzleX = Math.floor(headLoc.x + dir.x * 1.5);
    const muzzleY = Math.floor(headLoc.y + dir.y * 1.5);
    const muzzleZ = Math.floor(headLoc.z + dir.z * 1.5);
    const dimId = player.dimension.id;

    const block = player.dimension.getBlock({ x: muzzleX, y: muzzleY, z: muzzleZ });

    if (block && block.typeId === 'minecraft:air') {
        player.dimension.runCommand(`setblock ${muzzleX} ${muzzleY} ${muzzleZ} light_block_15`);

        system.runTimeout(() => {
            world.getDimension(dimId).runCommand(`setblock ${muzzleX} ${muzzleY} ${muzzleZ} air`);
        }, 2);
    }

    const hit = raycast(player, gunConfig, spreadMult);

    if (hit?.entity) {
        player.dimension.spawnParticle('a:hurt_blood', hit.hitPoint);
        if (gunConfig.pellets > 1) {
            const { entity, distance, hitPoint, dir } = hit;
            const spreadRadius = gunConfig.pelletSpread * Math.min(distance / gunConfig.range, 1.0);

            for (let i = 0; i < gunConfig.pellets; i++) {
                const vp = { x: hitPoint.x + (Math.random() - 0.5) * spreadRadius, y: hitPoint.y + (Math.random() - 0.5) * spreadRadius, z: hitPoint.z + (Math.random() - 0.5) * spreadRadius };
                const part = getBodyPartFromPoint(entity, vp);
                if (part) applyGunDamage(player, entity, part, gunConfig, distance, vp, dir);
            }
        } else {
            applyGunDamage(player, hit.entity, hit.bodyPart, gunConfig, hit.distance, hit.hitPoint, hit.dir);
        }
    } else if (hit?.block) {
        player.dimension.spawnParticle('a:smoke_muzzle', hit.hitPoint);
    }

    setAmmo(player, gunInfo, ammo - 1);
    return true;
}