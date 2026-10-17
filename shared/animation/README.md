# 工作过程的显示组件

`effects.mjs` 提供少量可复用的流向标记与事件脉冲。实例的纯过程模型决定何时出现、强度、路径及相位；本层没有自己的时钟、随机发火、机械状态或物理求解器。

```js
const flow = createFlowPath(THREE, { points: [[0,0,0],[.05,.02,0],[.1,0,0]], color: '#3986a1' });
scene.add(flow.group);
flow.update({ phase: cyclePhase, intensity: valveOpening });
const spark = createPulse(THREE, { radius: .003, color: '#e59a2b' });
scene.add(spark.group);
spark.group.position.set(...sparkAnchor);
spark.update({ intensity: ignitionEnvelope, scale: 1 });
```

两者返回 `group/update/snapshot/dispose`。坐标与半径为 glTF 米制，调用方先完成坐标转换。`phase` 归一化循环，流动方向沿给定路径；`intensity` 在 0–1 之间。暂停时重复提交相同相位，画面保持同样状态；没有隐式 requestAnimationFrame、时间或随机数。

group 作为单独显示层加入 scene，不标 `part_id`，不加入公共查看器的 parts/meshes，因此不影响机械身份、选择和装配取景。depthTest 保持启用，禁止透过未剖开的外壳强行显示内部效果；实例按剖面、展开或开关隐藏过程层。dispose 只释放组件自身资源。

流迹速度、颜色和脉冲是教学编码，不表示质量流量、温度、压力或真实火焰尺寸。实例需声明相位依据及简化，配色默认少量蓝/橙，保留机械白底黑线。具体阶段及验收参见各实例 process.mjs，不从 STEP 网格自动推断燃烧规律。
