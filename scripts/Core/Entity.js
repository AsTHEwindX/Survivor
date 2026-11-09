// ============================================
// 感染者伤害系统 2026.10.7
// ============================================

import { world, system } from '@minecraft/server';
import { PlayerDie } from './Player_Basic.js';
import { batchP, checkGameMode, specialCD, grabbed } from '../Shares/Config_Common.js';

// ============================================
// 缓存
// ============================================
const dmgRecord = new Map();//伤害判定
const attackRecord = new Map();//攻击cd
const attackWindup = new Map();//攻击前摇 entityId -> { type, targetId, endTime, damage }

// ============================================
// 变量
// ============================================
export const ENTITY_HIT = new Map([
    ['a:infected_normal', {
        name: '感染者',
        hitbox: { width: 0.6, height: 1.9, headHeight: 1.5, legHeight: 0.8, isHumanoid: true },
    }],
]);

const HEAD_DAMAGE = {
    easy: { 'a:ammo_22': 100, 'a:ammo_9mm': 100, 'a:ammo_45': 100, 'a:ammo_556': 100, 'a:ammo_762': 100, 'a:ammo_shell': 100 },
    normal: { 'a:ammo_22': 50, 'a:ammo_9mm': 50, 'a:ammo_45': 100, 'a:ammo_556': 100, 'a:ammo_762': 100, 'a:ammo_shell': 100 },
    hard: { 'a:ammo_22': 25, 'a:ammo_9mm': 34, 'a:ammo_45': 50, 'a:ammo_556': 50, 'a:ammo_762': 50, 'a:ammo_shell': 100 },
};

// ============================================
// 监听接口
// ============================================
world.beforeEvents.entityHurt.subscribe((event) => {
    if (event.damageSource.cause === 'selfDestruct') return;
    event.cancel = true;
});

system.runInterval(() => {
    const players = world.getAllPlayers();

    // ===== 处理攻击前摇 =====
    for (const [entityId, info] of attackWindup) {
        const player = world.getAllPlayers().find(p => p.id === info.targetId);

        if (!player) {
            attackWindup.delete(entityId);
            continue;
        }

        const entity = player.dimension.getEntities({ families: ['infected'] })
            .find(e => e.id === entityId);

        if (!entity) {
            attackWindup.delete(entityId);
            continue;
        }

        if (entity.hasTag('dead') || entity.getProperty('a:stunned') === true) {
            attackWindup.delete(entityId);
            continue;
        }

        // 前摇打断距离（调大到 1.8）
        if (getCollisionGap(entity, player) > 1.8) {
            attackWindup.delete(entityId);
            continue;
        }

        if (Date.now() >= info.endTime) {
            attackWindup.delete(entityId);

            // 前摇结束结算距离（调大到 1.1）
            if (getCollisionGap(entity, player) <= 1.1) {
                hurtPlayer(player, info.damage, entity);
            }
        }
    }

    for (const player of players) {
        if (checkGameMode(player)) continue;

        const grabInfo = grabbed.get(player.id);

        const nearby = player.dimension.getEntities({
            location: player.location,
            maxDistance: 3.0, // 索敌范围加大到 3.0
            families: ['infected']
        });

        for (const entity of nearby) {
            const variant = entity.getComponent('minecraft:variant')?.value;
            if (variant !== 1 && variant !== 2) continue;
            if (entity.getProperty('a:stunned') === true) continue;

            if (grabInfo && grabInfo.entityId === entity.id) continue;

            const now = Date.now();
            if (now - (attackRecord.get(entity.id) || 0) < 2000) continue;

            // 【修改】普攻判定距离拉大到 1.1（原来 0.65）
            const gap = getCollisionGap(entity, player);
            if (gap > 1.1) continue;

            const isFast = variant === 2;

            const toEntity = normalize({
                x: entity.location.x - player.location.x,
                y: entity.location.y - player.location.y,
                z: entity.location.z - player.location.z
            });
            const view = normalize(player.getViewDirection());
            const facing = (toEntity.x * view.x + toEntity.y * view.y + toEntity.z * view.z) > 0.7;

            const playerCD = now - (specialCD.get(player.id) || 0) < 30000;
            const diff = world.getDifficulty().toLowerCase();
            const hp = player.getDynamicProperty('health');

            // ===== 咬判定 =====
            // 【修改】咬的触发距离拉大到 0.8（原来 0.45）
            if (gap <= 0.8 && !isFast && !facing && !playerCD) {
                entity.triggerEvent('a:bite');
                specialCD.set(player.id, now);

                grabbed.set(player.id, {
                    entityId: entity.id,
                    lastAttack: now
                });

                if (!player.hasTag('bleeding')) {
                    const bleedChance = diff === 'hard' ? 1.0
                        : diff === 'normal' ? 0.4
                            : 0.1;
                    if (Math.random() < bleedChance) player.addTag('bleeding');
                }

                if (!player.hasTag('a:infected')) {
                    if (diff === 'hard') {
                        player.addTag('a:infected');
                    } else if (diff !== 'easy') {
                        const chance = 0.3 + (1 - hp / 100) * 0.7;
                        if (Math.random() < chance) player.addTag('a:infected');
                    }
                }

                if (!attackWindup.has(entity.id)) {
                    attackWindup.set(entity.id, {
                        type: 'bite',
                        targetId: player.id,
                        endTime: now + 2000,
                        damage: 15
                    });
                }

                attackRecord.set(entity.id, now);
                continue;
            }
            // ===== 重击判定 =====
            else if (!playerCD && Math.random() < 0.35) {
                entity.triggerEvent(isFast ? 'a:melee_heavy_fast' : 'a:melee_heavy_slow');

                if (!attackWindup.has(entity.id)) {
                    attackWindup.set(entity.id, {
                        type: 'heavy',
                        targetId: player.id,
                        endTime: now + 1000,
                        damage: 35
                    });
                }

                if (!player.hasTag('bleeding')) {
                    if (diff === 'hard') {
                        player.addTag('bleeding');
                    } else if (diff !== 'easy' && Math.random() < 0.2) {
                        player.addTag('bleeding');
                    }
                }

                specialCD.set(player.id, now);
            }
            // ===== 轻击判定 =====
            else {
                entity.triggerEvent(isFast ? 'a:melee_light_fast' : 'a:melee_light_slow');

                if (!attackWindup.has(entity.id)) {
                    attackWindup.set(entity.id, {
                        type: 'light',
                        targetId: player.id,
                        endTime: now + 600,
                        damage: 15
                    });
                }
            }

            attackRecord.set(entity.id, now);
        }
    }

    // ===== 处理被困玩家 =====
    for (const [playerId, info] of grabbed) {
        const player = world.getAllPlayers().find(p => p.id === playerId);
        if (!player) {
            grabbed.delete(playerId);
            continue;
        }

        const entity = player.dimension.getEntities({ families: ['infected'] })
            .find(e => e.id === info.entityId);

        // 脱离被困的距离也加大到 1.8
        if (!entity || getCollisionGap(entity, player) > 1.8) {
            grabbed.delete(playerId);
            continue;
        }

        const v = player.getVelocity();
        if (Math.abs(v.x) > 0.01 || Math.abs(v.z) > 0.01) {
            player.applyImpulse({ x: -v.x * 0.9, y: 0, z: -v.z * 0.9 });
        }

        const elapsed = Date.now() - info.lastAttack;
        if (elapsed >= 2000) {
            const diff = world.getDifficulty().toLowerCase();

            if (diff !== 'easy' && !player.hasTag('a:infected')) {
                const hp = player.getDynamicProperty('health') ?? 100;
                const chance = diff === 'hard' ? 1.0 : (0.3 + (1 - hp / 100) * 0.7);
                if (Math.random() < chance) player.addTag('a:infected');
            }

            hurtPlayer(player, 15, entity);

            info.lastAttack = Date.now();
        }
    }
}, 5);

// ============================================
// 函数
// ============================================
//A1获取击中位置
export function getBodyPart(entity, hitY) {
    const cfg = ENTITY_HIT.get(entity.typeId);
    if (!cfg) return 'body';

    const h = hitY - entity.location.y;
    if (cfg.hitbox.isHumanoid) {
        if (cfg.hitbox.headHeight && h >= cfg.hitbox.headHeight) return 'head';
        if (cfg.hitbox.legHeight && h <= cfg.hitbox.legHeight) return 'leg';
    }
    return 'body';
}
//A2霰弹枪判定
export function getBodyPartFromPoint(entity, point) {
    const cfg = ENTITY_HIT.get(entity.typeId);
    if (!cfg) return null;

    const loc = entity.location;
    const hw = cfg.hitbox.width / 2;

    if (point.x < loc.x - hw || point.x > loc.x + hw) return null;
    if (point.z < loc.z - hw || point.z > loc.z + hw) return null;
    if (point.y < loc.y || point.y > loc.y + cfg.hitbox.height) return null;

    const h = point.y - loc.y;
    if (cfg.hitbox.isHumanoid) {
        if (cfg.hitbox.headHeight && h >= cfg.hitbox.headHeight) return 'head';
        if (cfg.hitbox.legHeight && h <= cfg.hitbox.legHeight) return 'leg';
    }
    return 'body';
}

export function applyGunDamage(_player, entity, bodyPart, gunConfig, distance, hitPoint, dir) {
    const diff = world.getDifficulty().toLowerCase();
    if (diff === 'peaceful') return;
    if (entity.hasTag('dead')) return;

    const dmg = gunConfig.pellets <= 1 || distance < gunConfig.range
        ? Math.max(1, Math.floor(
            (HEAD_DAMAGE[diff][gunConfig.ammo] ?? 100)
            * (gunConfig.pellets <= 1 ? 1 : (1 - distance / gunConfig.range))
        ))
        : 0;

    const resolveHit = (target, part, dmgAmount, point) => {
        if (target.hasTag('dead')) return;

        if (!dmgRecord.has(target.id)) {
            dmgRecord.set(target.id, { head: 0, bodyHits: 0, rifleBodyHits: 0, legHits: 0 });
        }
        const rec = dmgRecord.get(target.id);

        const spawnBlood = (isHead) => {
            target.dimension.spawnParticle(isHead ? 'a:bomb_blood' : 'a:hurt_blood', point || target.location);
            target.dimension.playSound('hostile.blood_fly', target.location);
        };
        const killEntity = (delay = 5) => {
            target.addTag('dead');
            const dim = target.dimension;
            target.triggerEvent('a:death');
            dmgRecord.delete(target.id);

            if (_player) {
                const currentKills = _player.getDynamicProperty('a:kill_count') || 0;
                _player.setDynamicProperty('a:kill_count', currentKills + 1);
            }

            const dropBlood = () => {
                const loc = dir
                    ? { x: target.location.x + dir.x * 2, y: target.location.y + 0.1, z: target.location.z + dir.z * 2 }
                    : { x: target.location.x, y: target.location.y + 0.1, z: target.location.z };
                dim.spawnParticle('a:death_pool', loc);
            };

            delay > 0 ? system.runTimeout(dropBlood, delay) : dropBlood();
        };

        if (part === 'head') {
            rec.head = (rec.head || 0) + dmgAmount;

            const v = target.getComponent('minecraft:variant').value;
            const threshold = [2, 4, 21, 22, 51].includes(v) ? 75 : 100;

            if (rec.head >= threshold) {
                spawnBlood(true);
                target.triggerEvent('a:head_off');
                killEntity();
            }
        }
        else if (part === 'body') {
            const isRifle = gunConfig.ammo === 'a:ammo_556' || gunConfig.ammo === 'a:ammo_762';

            if (isRifle) {
                if (dir) {
                    target.applyImpulse({ x: dir.x * 0.15, y: 0.02, z: dir.z * 0.15 });
                }

                rec.rifleBodyHits = (rec.rifleBodyHits || 0) + 1;

                const bodyThreshold = diff === 'easy' ? 1
                    : diff === 'hard' ? 3
                        : 2;

                if (rec.rifleBodyHits >= bodyThreshold) {
                    spawnBlood(false);
                    killEntity();
                }
                return;
            }

            if (gunConfig.pellets > 1) {
                rec.bodyHits = (rec.bodyHits || 0) + 1;

                if (distance < 3) {
                    target.applyImpulse({ x: dir.x * 0.1, y: 0.03, z: dir.z * 0.08 });
                }

                if (rec.bodyHits === 1) {
                    spawnBlood(false);
                    target.triggerEvent('a:left_arm_off');
                } else if (rec.bodyHits >= 2) {
                    spawnBlood(false);
                    target.triggerEvent('a:right_arm_off');
                    killEntity();
                }
                return;
            }

            rec.bodyHits = (rec.bodyHits || 0) + 1;
        }
        else if (part === 'leg') {
            const isRifle = gunConfig.ammo === 'a:ammo_556' || gunConfig.ammo === 'a:ammo_762';

            if (gunConfig.pellets > 1) {
                spawnBlood(false);
                return killEntity();
            }

            if (isRifle) {
                rec.legHits = (rec.legHits || 0) + 1;

                if (rec.legHits === 1) {
                    const isLeft = Math.random() < 0.5;
                    rec.firstLeg = isLeft ? 'left' : 'right';

                    spawnBlood(false);
                    target.addEffect('slowness', 20000000, { amplifier: 1, showParticles: false });
                } else if (rec.legHits >= 2) {
                    spawnBlood(false);
                    killEntity();
                }
                return;
            }
            
            rec.legHits = (rec.legHits || 0) + 1;
        }
    };

    resolveHit(entity, bodyPart, dmg, hitPoint);

    const pen = gunConfig.pellets > 1 ? { type: 'shotgun', max: 3 }
        : gunConfig.ammo === 'a:ammo_556' ? { type: 'rifle', max: diff === 'hard' ? 0 : 1 }
            : gunConfig.ammo === 'a:ammo_762' ? { type: 'rifle', max: diff === 'hard' ? 1 : 2 }
                : { type: 'none', max: 0 };

    if (pen.max <= 0 || !dir) return;

    const maxPenDist = gunConfig.pellets > 1 ? 3.0
        : gunConfig.ammo === 'a:ammo_556' ? 3.0
            : gunConfig.ammo === 'a:ammo_762' ? 4.0
                : 0;

    let cur = entity;
    let curDmg = dmg;
    let penCount = 0;
    let totalDist = 0;
    const hitIds = new Set([entity.id]);

    while (penCount < pen.max) {
        if (pen.type === 'shotgun') {
            const allowed = Math.max(0, 5 - Math.floor(distance));
            if (penCount >= Math.min(allowed, pen.max)) break;
        }

        const remain = maxPenDist - totalDist;
        if (remain <= 0) break;

        const rayStart = {
            x: cur.location.x,
            y: cur.location.y + ENTITY_HIT.get(cur.typeId).hitbox.height / 2,
            z: cur.location.z
        };

        const hits = entity.dimension.getEntitiesFromRay(rayStart, dir, {
            maxDistance: remain,
            families: ['infected']
        });

        let next = null;
        let nextDist = 0;
        for (const h of hits) {
            const e = h.entity;
            if (hitIds.has(e.id)) continue;
            if (e.hasTag('dead')) continue;
            if (e.getComponent('minecraft:variant').value === 100) continue;
            if (!ENTITY_HIT.has(e.typeId)) continue;
            next = e;
            nextDist = h.distance;
            break;
        }

        if (!next) break;

        hitIds.add(next.id);
        totalDist += nextDist;

        curDmg = Math.floor(curDmg * 0.85);

        const hitY = next.location.y + ENTITY_HIT.get(next.typeId).hitbox.height / 2;

        resolveHit(next, 'head', curDmg, { x: next.location.x, y: hitY, z: next.location.z });

        cur = next;
        penCount++;
    }
}
//C1归一化向量
function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 0, y: 0, z: 0 };
}
//C2碰撞箱判定
function getCollisionGap(entity, player) {
    const dx = Math.max(0, Math.abs(entity.location.x - player.location.x) - 0.6);
    const dz = Math.max(0, Math.abs(entity.location.z - player.location.z) - 0.6);
    const dy = Math.max(0, Math.abs(entity.location.y - player.location.y) - 0.95);
    return Math.sqrt(dx * dx + dz * dz + dy * dy);
}
//C3感染者攻击后数值判定
function hurtPlayer(player, amount, entity) {
    const hp = player.getDynamicProperty('health');
    const newHp = Math.max(0, hp - amount);

    const sound = amount >= 30 ? 'player.hurt_major' : 'player.hurt_minor';
    if (newHp <= 0) {
        batchP(player, [['setProp', 'health', 0]]);

        if (entity) {
            const variant = entity.getComponent('minecraft:variant')?.value;
            const isFast = variant === 2 || variant === 21 || variant === 22;
            entity.triggerEvent(isFast ? 'a:kill_eat_fast' : 'a:kill_eat_slow');
        }

        if (player.hasTag('a:infected')) {
            player.dimension.spawnEntity('a:infected_normal', player.location);
        }

        PlayerDie(player);
    } else {
        batchP(player, [
            ['setProp', 'health', newHp],
            ['sound', sound]
        ]);
    }
}

// ============================================
// 清理
// ============================================
world.afterEvents.playerLeave.subscribe((e) => {
    specialCD.delete(e.playerId);
    grabbed.delete(e.playerId);
    attackWindup.clear();
});