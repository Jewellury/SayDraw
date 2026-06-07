# SayDraw 图标替换说明

> 本文档包含四个核心图标的最终 SVG 代码及实现说明，请直接按文档执行替换，不要改变图标形状。

---

## 一、图标总览

| 图标 | 用途 | 激活背景色 | 激活文字色 |
|------|------|-----------|-----------|
| 爸爸说 | 切换说话人为爸爸 | `#2b5d7e` | `white` |
| 宝宝说 | 切换说话人为宝宝 | `#d9622b` | `white` |
| 接下来呢 | 触发引导提示 | 无（虚线边框） | `#211e18` |
| 画出来 | 提交生成 | `#211e18`（常态就是深色） | `white` |

---

## 二、核心实现原则

所有图标使用 `stroke="currentColor"` + `fill="currentColor"`。  
激活状态**只需改父容器的 `color` 值**，SVG 线条和填充自动跟随，无需 JS 单独修改 SVG 属性。

```css
/* 爸爸说按钮 */
.speaker-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid #211e18;
  color: #211e18;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.speaker-btn.dad.active {
  color: white;
  background: #2b5d7e;
  border-color: #2b5d7e;
}

.speaker-btn.kid.active {
  color: white;
  background: #d9622b;
  border-color: #d9622b;
}
```

---

## 三、四个图标 SVG 代码

### 1. 爸爸说（绅士领带）

```svg
<svg viewBox="0 0 32 32" width="32" height="32" fill="none"
     stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <!-- 头部 -->
  <circle cx="16" cy="12" r="6.5" stroke-width="1.8"/>
  <!-- 眼睛（实心点，跟随 currentColor） -->
  <ellipse cx="13.5" cy="11.5" rx="1.3" ry="1.3" fill="currentColor" stroke="none"/>
  <ellipse cx="18.5" cy="11.5" rx="1.3" ry="1.3" fill="currentColor" stroke="none"/>
  <!-- 微笑 -->
  <path d="M13.5 14.5 Q16 16.2 18.5 14.5" stroke-width="1.6"/>
  <!-- 领带：锯齿形 -->
  <path d="M16 18.5 L14.8 21 L16 23 L14.8 25 L16.2 27" stroke-width="1.6"/>
  <!-- 领带横结 -->
  <path d="M14.5 21 L17.5 21" stroke-width="1.4"/>
  <!-- 肩膀 -->
  <path d="M10 23 Q10 20 14 19" stroke-width="1.8"/>
  <path d="M22 23 Q22 20 18 19" stroke-width="1.8"/>
</svg>
```

### 2. 宝宝说（花苞头）

```svg
<svg viewBox="0 0 32 32" width="32" height="32" fill="none"
     stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <!-- 花瓣发型（5根向外散射的弧线） -->
  <path d="M16 3.5 Q14 6 15.5 8" stroke-width="1.6"/>
  <path d="M10 5.5 Q12.5 7.5 13.5 9.5" stroke-width="1.6"/>
  <path d="M22 5.5 Q19.5 7.5 18.5 9.5" stroke-width="1.6"/>
  <path d="M7.5 11 Q10 9.5 13 11" stroke-width="1.6"/>
  <path d="M24.5 11 Q22 9.5 19 11" stroke-width="1.6"/>
  <!-- 圆圆大头 -->
  <circle cx="16" cy="15.5" r="6" stroke-width="1.8"/>
  <!-- 大眼睛（实心椭圆） -->
  <ellipse cx="13.8" cy="15" rx="1.2" ry="1.3" fill="currentColor" stroke="none"/>
  <ellipse cx="18.2" cy="15" rx="1.2" ry="1.3" fill="currentColor" stroke="none"/>
  <!-- 开心嘴 -->
  <path d="M13.5 18 Q16 19.5 18.5 18" stroke-width="1.6"/>
  <!-- 小身体 -->
  <path d="M11 25.5 Q11.5 22.5 16 22 Q20.5 22.5 21 25.5" stroke-width="1.8"/>
</svg>
```

### 3. 接下来呢（问号对话气泡）

按钮容器规格：`width:48px; height:48px; border-radius:50%; border:2px dashed #211e18; background:transparent`

```svg
<svg viewBox="0 0 32 32" width="28" height="28" fill="none"
     stroke="#211e18" stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <!-- 对话气泡主体 -->
  <path d="M5 5 Q5 3.5 6.5 3.5 L25.5 3.5 Q27 3.5 27 5 L27 18
           Q27 19.5 25.5 19.5 L18 19.5 L14.5 24 L14.5 19.5
           L6.5 19.5 Q5 19.5 5 18 Z" stroke-width="1.8"/>
  <!-- 问号弯钩 -->
  <path d="M13.5 9.5 Q13.5 7 16 7 Q18.5 7 18.5 9.5
           Q18.5 12 16 13 L16 14.5" stroke-width="1.8"/>
  <!-- 问号点 -->
  <circle cx="16" cy="17" r="1" fill="#211e18" stroke="none"/>
</svg>
```

### 4. 画出来（铅笔）

按钮容器规格：`width:56px; height:56px; border-radius:50%; background:#211e18; border:none`

```svg
<svg viewBox="0 0 32 32" width="32" height="32" fill="none"
     stroke="white" stroke-linecap="round" stroke-linejoin="round"
     xmlns="http://www.w3.org/2000/svg">
  <!-- 笔身 -->
  <path d="M8 23 L19 8 L24 13 L13 26 Z" stroke-width="1.8"/>
  <!-- 笔尖 -->
  <path d="M13 26 L8 29 L10 24" stroke-width="1.8"/>
  <!-- 铅芯点 -->
  <path d="M10 26.5 L10.5 27.5" stroke-width="2"/>
  <!-- 笔尾橡皮端 -->
  <path d="M19 8 L21.5 5.5 L26.5 10.5 L24 13" stroke-width="1.8"/>
  <path d="M21.5 5.5 L24 8" stroke-width="1.5"/>
  <!-- 笔杆中线（手绘感） -->
  <path d="M13 12 L20 19" stroke-width="1.2"/>
</svg>
```

---

## 四、按钮尺寸规范

| 图标 | 容器尺寸 | 容器形状 | SVG 渲染尺寸 |
|------|---------|---------|------------|
| 爸爸说 | 56×56px | 圆形 | 32×32 |
| 宝宝说 | 56×56px | 圆形 | 32×32 |
| 接下来呢 | 48×48px | 圆形 | 28×28 |
| 画出来 | 56×56px | 圆形 | 32×32 |

---

## 五、实现要求

1. **不引入任何图标库**（lucide、heroicons 等），全部使用内联 SVG。
2. **不新增 npm 依赖**。
3. 爸爸说/宝宝说使用 `currentColor` 方案，激活只改父容器 `color`。
4. 接下来呢和画出来图标颜色写死（分别为 `#211e18` 和 `white`），不用 `currentColor`。
5. 生成中状态（画出来按钮 loading）：可将铅笔图标替换为 3 根短线随机抖动的动效占位，或直接禁用按钮 + 降低透明度，保持铅笔图标不变。
6. `npm run typecheck && npm run build` 通过，不新增 lint 警告。

---

## 六、验收标准

1. 爸爸说激活：背景变 `#2b5d7e`，图标线条变白。
2. 宝宝说激活：背景变 `#d9622b`，图标线条变白。
3. 两个说话人互斥：点一个，另一个自动取消激活。
4. 接下来呢：虚线圆形边框，气泡+问号图标，无激活态背景色变化。
5. 画出来：深色圆形按钮，铅笔图标白色，生成中有 loading 状态。
6. 所有图标线条有手绘圆润感（`stroke-linecap="round"`），与画板 SVG 风格统一。
