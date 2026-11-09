// ============================================
// 状态显示系统2026/9/30
// ============================================

import { system } from "@minecraft/server";
import { getAllP, Pitem,Pinv, checkGameMode, showDurTask } from "../Shares/Config_Common.js";
import { GUN_IDS } from "./Item.js";

// ============================================
// 监听接口
// ============================================
system.runInterval(() => {
    for (const P of getAllP()) {
        if (checkGameMode(P)) continue;

        const mobile = P.clientSystemInfo?.platformType === 'Mobile';
        const status = getPlayerStatus(P);
        const heldItem = Pitem(P);
        const walkie = getWalkieLines(P, heldItem);

        const lines = [];
        for (let i = 0; i < 8; i++) {
            lines.push(buildStatusLine(P, status, heldItem, mobile, i, walkie));
        }

        const raw = [
            { text: '' },
            ...lines[0], { text: '\n\n' },
            ...lines[1], { text: '\n\n' },
            ...lines[2], { text: '\n\n' },
            ...lines[3], { text: '\n' },
            ...lines[4], { text: '\n' },
            ...lines[5], { text: '\n' },
            ...lines[6], { text: '\n' },
            ...lines[7],
            { text: '\n\n\n\n\n\n\n\n\n\n\n\n' }
        ];

        P.onScreenDisplay.setActionBar({ rawtext: raw });
    }
}, 8);

// ============================================
// 函数
// ============================================
//A1获取玩家状态
function getPlayerStatus(P) {
    const props = ['health', 'health2', 'thirst', 'hunger', 'temperature', 'season', 'infected_ticks', 'immunity_ticks', 'armor', 'fatigue'];
    const result = {};
    for (const key of props) {
        result[key] = P.getDynamicProperty(key);
    }
    return result;
}

//A2获取耐久文本
function getDurText(P, heldItem) {
    if (!heldItem) return '';
    const isGun = GUN_IDS.includes(heldItem.typeId);

    if (isGun) {
        const showUntil = showDurTask.get(P.id) ?? 0;
        if (system.currentTick > showUntil) return '';
    }

    const dur = heldItem.getDynamicProperty('dur');
    if (typeof dur !== 'number') return '';

    // 基础当前子弹数
    let text = `§l${Math.round(dur)}§r`;

    // 如果是枪械，加上备弹和类型显示
    if (isGun) {
        // 子弹ID -> [显示文本, 对应的枪械ID列表]
        const AMMO_MAP = {
            'a:ammo_22': ['  0.22 LR手枪弹', ['a:ruger_mark4', 'a:walther_p22']],
            'a:ammo_9mm': ['  9mm手枪弹', ['a:glock17', 'a:beretta_92f']],
            'a:ammo_45': ['  .45 ACP手枪弹', ['a:colt_1911', 'a:hk_usp45']],
            'a:ammo_shell': ['  12号霰弹', ['a:mossberg_500a', 'a:remington_870', 'a:m4_shotgun']],
            'a:ammo_556': ['  5.56x45mm步枪弹', ['a:ar15']],
            'a:ammo_762': ['  7.62x39mm步枪弹', ['a:sks', 'a:cz858']]
        };

        let ammoId = null;
        let ammoText = '';

        // 查找当前枪的弹药
        for (const [id, data] of Object.entries(AMMO_MAP)) {
            if (data[1].includes(heldItem.typeId)) {
                ammoId = id;
                ammoText = data[0];
                break;
            }
        }

        if (ammoId) {
            // 统计背包里该子弹的总数
            const inv = Pinv(P);
            let totalAmmo = 0;
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item && item.typeId === ammoId) {
                    totalAmmo += item.amount;
                }
            }

            // 【修改】拼接顺序： 当前子弹 | 备弹 类型
            text += ` §r§l| ${totalAmmo} §7${ammoText}§r`;
        }
    }

    return text;
}

//A3获取视线方块状态文本
function getBlockStatus(P) {
    const hit = P.getBlockFromViewDirection({
        maxDistance: 5,
        includeLiquidBlocks: false,
        includePassableBlocks: false
    });

    if (!hit) return [];

    const block = hit.block;

    // 油桶：只有 a:oil_barrel 才显示油量
    if (block.typeId === 'a:oil_barrel') {
        const oil = block.permutation.getState('a:colour');
        if (typeof oil === 'number' && oil > 0) {
            const percent = Math.round(oil / 5 * 100);
            return [{ text: `          ${percent}  %§r` }];
        }
        return [];
    }

    // 容器：显示可搜索/空
    const empty = block.permutation.getState('a:empty');
    if (typeof empty !== 'number') return [];

    const locKey = block.type.localizationKey;
    const nameComp = locKey ? { translate: locKey } : { text: block.typeId };

    return [
        { text: '§f' },
        nameComp,
        { text: empty === 0 ? ' §b可搜索§r' : ' §4空§r' }
    ];
}


//A4获取对讲机四个方向
function getWalkieLines(P, heldItem) {
    if (heldItem?.typeId !== 'a:walkie_talkie') return { up: '', down: '', left: '', right: '' };

    const tv = P.getDynamicProperty('a:walkie_title');

    return tv === 1
        ? { up: '跟随类', down: '停在这', left: '否定', right: '肯定' }
        : { up: '状态类', down: '感染者', left: '嘲讽', right: '谢谢' };
}

//B1颜色工具
function getColor(type, value) {
    switch (type) {
        case 'health':
            return value >= 70 ? '§a' : value >= 30 ? '§e' : '§4';
        case 'thirst':
            return value <= 20 ? '§4' : value <= 50 ? '§e' : '§a';
        case 'hunger':
            return value <= 20 ? '§4' : value <= 50 ? '§e' : '§a';
        case 'temperature':
            return value <= 0 ? '§b' : value <= 10 ? '§3' : value >= 35 ? '§4' : value >= 28 ? '§6' : '§a';
        case 'fatigue':
            return value >= 150 ? '§4' : value >= 100 ? '§e' : value >= 50 ? '§6' : '§a';
        default:
            return '§r';
    }
}

//C1居中工具
function centerText(text, isMobile) {
    const visible = text.replace(/§./g, '');
    // 【修改】：统一改为 46 和 52
    const maxWidth = isMobile ? 46 : 52;
    const pad = Math.max(0, Math.floor((maxWidth - visible.length) / 2));
    return ' '.repeat(pad) + text;
}

//C2构建HUD
function buildStatusLine(P, status, heldItem, isMobile, lineIndex, walkie) {
    const seasonMap = { 1: '±', 2: '²', 3: '³', 4: '¶' };
    const seasonChar = seasonMap[status.season] || '?';

    switch (lineIndex) {
        // 第一行：对讲机 - 上方标签
        case 0:
            return walkie.up ? [{ text: centerText(`§e${walkie.up}`, isMobile) }] : [{ text: '' }];

        // 第二行：对讲机 - 左 + 右标签
        case 1: {
            if (!walkie.left && !walkie.right) return [{ text: '' }];
            const leftText = walkie.left ? `§e${walkie.left}` : '';
            const rightText = walkie.right ? `§e${walkie.right}` : '';
            const leftVisible = leftText.replace(/§./g, '').length;
            const rightVisible = rightText.replace(/§./g, '').length;

            // 【修改】：统一改为 46 和 52
            const maxWidth = isMobile ? 46 : 52;
            const center = Math.floor(maxWidth / 2);

            const leftPad = Math.max(0, center - 12 - leftVisible);
            const gap = Math.max(1, 24 - leftVisible - rightVisible);

            return [{ text: ' '.repeat(leftPad) + leftText + ' '.repeat(gap) + rightText }];
        }

        // 第三行：对讲机 - 下方标签
        case 2:
            return walkie.down ? [{ text: centerText(`§e${walkie.down}`, isMobile) }] : [{ text: '' }];

        // 第四行：搜刮状态
        case 3: {
            const blockStatus = getBlockStatus(P);
            if (blockStatus.length === 0) return [{ text: '' }];
            const visible = blockStatus.map(c => c.text || '').join('').replace(/§./g, '').length;
            // 【修改】：统一改为 46 和 52
            const maxWidth = isMobile ? 46 : 52;
            const pad = Math.max(0, Math.floor((maxWidth - visible) / 2) - 4);
            return [{ text: ' '.repeat(pad) }, ...blockStatus];
        }

        // 第五行：空
        case 4:
            return [{ text: '' }];

        // 第六行：耐久
        case 5:
            return [{ text: centerText(getDurText(P, heldItem), isMobile) }];

        // 第七行：特殊状态
        case 6: {
            const infectedText = status.infected_ticks > 0 ? `¼` : `#`;
            const bleedingText = P.hasTag('bleeding') ? `½` : `%`;
            const immunityText = status.immunity_ticks > 0 ? `¾` : `$`;
            const health2 = Math.round(status.health2);
            const health2Text = health2 > 0 ? `¦` : `&`;

            const line = `${infectedText}         ${bleedingText}         ${immunityText}         ${health2Text}`;
            const visible = line.replace(/§./g, '');
            // 【修改】：统一改为 46 和 52
            const maxWidth = isMobile ? 46 : 52;
            const pad = Math.max(0, Math.floor((maxWidth - visible.length) / 2) - 1);
            return [{ text: ' '.repeat(pad) + line }];
        }

        // 第八行：状态条
        default: {
            const line =
                `¢ ${getColor('health', status.health)}${Math.round(status.health).toString().padStart(3, ' ')} §r` +
                `£${getColor('hunger', status.hunger)}${Math.round(status.hunger).toString().padStart(3, ' ')} §r` +
                `¤${getColor('thirst', status.thirst)}${Math.round(status.thirst).toString().padStart(3, ' ')} §r` +
                `©${Math.round(status.armor).toString().padStart(3, ' ')} §r` +
                `${seasonChar} ${getColor('temperature', status.temperature)}${Math.round(status.temperature).toString().padStart(3, ' ')}°C§r` +
                ` ®${getColor('fatigue', status.fatigue)}${Math.round(status.fatigue).toString().padStart(3, ' ')}§r`;

            return [{ text: centerText(line, isMobile) }];
        }
    }
}