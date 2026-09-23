/**
 * Clay Studio voice — plain language first, jargon as secondary labels.
 * English is default; Chinese matches the same playful tone.
 */

export type Lang = 'en' | 'zh';

export const STRINGS = {
  en: {
    brand: 'Clay Studio',
    subtitle: 'Class 04 · Make a world you can dig into',
    langToggle: '中文',

    welcome: {
      title: 'Welcome to the studio',
      body: 'You have a block of clay. First pinch a shape, then cut it, glaze the surface, and only fire the piece near you. Four small stations — take them in order if you like.',
      start: 'Start pinching',
      dismiss: 'Skip intro',
    },

    tour: {
      stepOf: 'Station {n} of 4',
      next: 'Next station →',
      prev: '← Back',
      done: 'You’ve walked the studio',
      again: 'Replay intro',
    },

    tabs: {
      density: { label: '1 · Pinch', jargon: 'Density' },
      csg: { label: '2 · Cut', jargon: 'CSG' },
      meshing: { label: '3 · Glaze', jargon: 'Meshing' },
      chunking: { label: '4 · Fire nearby', jargon: 'Chunking' },
    },

    outcomes: {
      title: 'What you’ll leave with',
      items: [
        {
          title: 'Pinch = ask every point',
          body: 'At each spot in space: clay or air? Different recipes make hills, sponges, islands, or planets.',
          jargon: 'Density field',
        },
        {
          title: 'Cut = stick, trim, dig',
          body: 'Two shapes can glue together, keep only the overlap, or dig one out of the other — like clay tools.',
          jargon: 'CSG / SDF',
        },
        {
          title: 'Glaze = how it looks',
          body: 'The computer draws triangles. Blocky glaze feels like Minecraft; smooth glaze feels organic.',
          jargon: 'Meshing',
        },
        {
          title: 'Fire nearby = don’t cook the whole kiln',
          body: 'A huge world is too heavy. Only generate and draw the chunks around the player.',
          jargon: 'Chunking',
        },
      ],
    },

    density: {
      title: 'Pinch the clay',
      jargon: 'Density shapes',
      hint: 'Pick a clay recipe. Here you see solid bricks with sides — not a paper skin. Drag to spin.',
      tryThis: 'Try: Hills → Sky islands → Little planet. Want a smooth skin? That’s Station 3 · Glaze.',
      params: 'Feel knobs',
      shapes: {
        ground: {
          label: 'Rolling hills',
          jargon: 'Ground plane',
          desc: 'Solid under a wiggly surface — like outdoor ground in most games.',
          gives: 'Hills you can walk on',
        },
        fbm3d: {
          label: 'Sea sponge',
          jargon: '3D fBm',
          desc: 'Clay everywhere in a soft, holey blob. Great for carving later.',
          gives: 'A diggable sponge',
        },
        ridged: {
          label: 'Paper walls',
          jargon: 'Ridged 3D',
          desc: 'Pushes the clay into thin sheets and walls instead of a fat blob.',
          gives: 'Thin sheets & walls',
        },
        terraced: {
          label: 'Rice terraces',
          jargon: 'Terraced',
          desc: 'Heights snap into steps — mesas and cliff bands.',
          gives: 'Stepped cliffs',
        },
        islands: {
          label: 'Sky islands',
          jargon: 'Floating islands',
          desc: 'Clay only in a band of height — floating chunks in the air.',
          gives: 'Floating islands',
        },
        planet: {
          label: 'Little planet',
          jargon: 'Planet',
          desc: 'A ball of clay with bumpy crust. Diggable all the way around.',
          gives: 'A spherical world',
        },
        strata: {
          label: 'Layer cake',
          jargon: 'Strata',
          desc: 'Hills with striped layers inside — like a cut cake of rock.',
          gives: 'Sediment stripes',
        },
      },
      resolution: 'How fine the clay grid is',
      threshold: 'Where “air” starts',
      scale: 'How zoomed-in the wiggles are',
      height: 'How tall the bumps are',
    },

    csg: {
      title: 'Pick up the knife',
      jargon: 'CSG operations',
      hint: 'Two clay pieces + one tool. Watch the right side change.',
      tryThis: 'Try Subtract first (dig a hole), then Smooth stick (melt them together).',
      shapeA: 'Clay A',
      shapeB: 'Clay B',
      operation: 'Which tool?',
      ops: {
        union: {
          label: 'Stick together',
          jargon: 'Union',
          formula: 'min(a, b)',
          use: 'Add a rock onto another volume',
        },
        intersect: {
          label: 'Keep the overlap',
          jargon: 'Intersection',
          formula: 'max(a, b)',
          use: 'Keep only where both shapes meet',
        },
        subtract: {
          label: 'Dig a hole',
          jargon: 'Subtraction',
          formula: 'max(a, −b)',
          use: 'Carve a tunnel or room',
        },
        smoothUnion: {
          label: 'Melt together',
          jargon: 'Smooth union',
          formula: 'smin(a, b, k)',
          use: 'Organic join — no hard crease',
        },
        shell: {
          label: 'Hollow it out',
          jargon: 'Shell',
          formula: 'abs(a) − t',
          use: 'Make walls / a hollow shell',
        },
      },
      primitives: {
        sphere: 'Ball',
        box: 'Box',
        torus: 'Donut',
        cylinder: 'Tube',
      },
      smoothK: 'How melty',
      thickness: 'Wall thickness',
    },

    meshing: {
      title: 'Choose a glaze',
      jargon: 'Meshing',
      hint: 'Same clay underneath — two finishes. Flip and compare the look.',
      tryThis: 'Toggle Blocky vs Smooth. Watch triangle count jump.',
      method: 'Finish',
      methods: {
        culled: {
          label: 'Blocky glaze',
          jargon: 'Culled faces',
          look: 'Minecraft-y',
          input: 'On / off cells',
          faces: 'Medium',
          sharp: 'Only straight edges',
          topology: 'Watertight-ish',
          cost: 'Cheapest',
          why: 'Only draw faces between clay and air. Perfect for blocky worlds.',
        },
        marching: {
          label: 'Smooth glaze',
          jargon: 'Marching Cubes',
          look: 'Soft & rounded',
          input: 'Soft density',
          faces: 'Lots of triangles',
          sharp: 'No sharp corners',
          topology: 'Usually clean',
          cost: 'Medium',
          why: 'Walks every little cell and stitches a smooth skin. Classic organic look.',
        },
      },
      compareTitle: 'Other glazes (peek later)',
      compare: [
        { method: 'Greedy', look: 'Blocky', faces: 'Fewest', sharp: 'Straight only', cost: 'Low–med', note: 'Merges flat neighbors into big faces — faster Minecraft-style.' },
        { method: 'Marching Tetrahedra', look: 'Smooth', faces: 'Even more', sharp: 'No', cost: 'Med–high', note: 'Like Marching Cubes but fewer weird edge cases.' },
        { method: 'Surface Nets', look: 'Smooth', faces: 'Fewer', sharp: 'No', cost: 'Low–med', note: 'Often fewer faces than Marching Cubes.' },
        { method: 'Dual Contouring', look: 'Smooth + sharp', faces: 'Few', sharp: 'Yes!', cost: 'High', note: 'Can keep crisp cuts — needs extra normal data.' },
      ],
      faceCount: 'Triangles drawn',
      timeMs: 'Time to glaze',
    },

    chunking: {
      title: 'Only fire what’s nearby',
      jargon: 'Chunking',
      hint: 'The kiln can’t bake the whole planet at once. Load a small neighborhood.',
      tryThis: 'Push world size up, keep view radius small — watch the two counters diverge.',
      worldSize: 'How big the world is',
      chunkSize: 'Size of one tile',
      loaded: 'Tiles cooking now',
      costTitle: 'Kiln bill',
      without: 'Bake everything',
      with: 'Bake nearby only',
      voxels: 'bits of clay to store',
      explain: [
        'A 512×512×512 world is ~134 million little cells. That eats memory before you even draw.',
        'Players only see a small bubble. Tiles (chunks) load, draw, and unload on their own.',
        'Some cave diggers need to peek into neighbor tiles — that’s why borders get tricky.',
      ],
      cavesTitle: 'Ways to dig caves (later)',
      caves: [
        { method: 'Threshold', look: 'Roomy caves', eval: 'Easy', cost: '1 noise check', control: 'How full of holes' },
        { method: 'Intersection', look: 'Tunnel-ish', eval: 'Easy', cost: '2 noise checks', control: 'How thick' },
        { method: 'Worms', look: 'Planned tunnels', eval: 'Harder', cost: 'Follow a path', control: 'Length & direction' },
        { method: '3D CA', look: 'Organic pockets', eval: 'Harder', cost: 'Ask 26 neighbors', control: 'Less direct' },
      ],
    },

    shared: {
      wireframe: 'See the wire frame',
      info: 'Huh?',
      dragOrbit: 'Drag to spin · Scroll to zoom',
      apply: 'Feels like',
      jargonTag: 'Also called',
      showJargon: 'Show textbook names',
      hideJargon: 'Hide textbook names',
    },
  },

  zh: {
    brand: '黏土工作室',
    subtitle: '第 04 课 · 捏一个能挖洞的世界',
    langToggle: 'EN',

    welcome: {
      title: '欢迎来到工作室',
      body: '桌上有一块黏土。先捏形状，再动刀子，然后上釉，最后只烧你附近那一块。四个小站——喜欢的话按顺序走。',
      start: '开始捏',
      dismiss: '跳过介绍',
    },

    tour: {
      stepOf: '第 {n} / 4 站',
      next: '下一站 →',
      prev: '← 上一站',
      done: '工作室走完啦',
      again: '再看一遍介绍',
    },

    tabs: {
      density: { label: '1 · 捏', jargon: '密度' },
      csg: { label: '2 · 切', jargon: 'CSG' },
      meshing: { label: '3 · 上釉', jargon: '网格化' },
      chunking: { label: '4 · 只烧附近', jargon: '分块' },
    },

    outcomes: {
      title: '走完你会带走',
      items: [
        {
          title: '捏 = 问每一个点',
          body: '空间里每个位置：是土还是空气？不同配方变成山、海绵、浮岛或小行星。',
          jargon: '密度场',
        },
        {
          title: '切 = 粘、裁、挖',
          body: '两块黏土可以粘在一起、只留重叠，或从一块里挖掉另一块——像陶艺工具。',
          jargon: 'CSG / SDF',
        },
        {
          title: '上釉 = 外表长什么样',
          body: '电脑用三角形画画。方块釉像 Minecraft；光滑釉更有机。',
          jargon: '网格化',
        },
        {
          title: '只烧附近 = 别把整座窑烧爆',
          body: '世界太大装不下。只生成、只画玩家身边的小块。',
          jargon: '分块',
        },
      ],
    },

    density: {
      title: '捏这块黏土',
      jargon: '密度形状',
      hint: '选一个配方。这里画的是带着侧面的实心砖块，不是一张纸皮。拖拽旋转看看。',
      tryThis: '试试：丘陵 → 天空岛 → 小行星。想看光滑表面？去第 3 站「上釉」。',
      params: '手感旋钮',
      shapes: {
        ground: {
          label: '起伏丘陵',
          jargon: '地面平面',
          desc: '起伏表面下面是实心土——大多数游戏里的户外地面。',
          gives: '能走的山丘',
        },
        fbm3d: {
          label: '海绵',
          jargon: '三维 fBm',
          desc: '软软的、到处是洞的一团黏土。后面很好挖。',
          gives: '可挖的海绵',
        },
        ridged: {
          label: '薄墙纸',
          jargon: '脊状三维',
          desc: '把黏土挤成薄片和墙，而不是胖乎乎的一团。',
          gives: '薄片和墙',
        },
        terraced: {
          label: '梯田',
          jargon: '阶地',
          desc: '高度一格一格卡住——台地和悬崖带。',
          gives: '阶梯悬崖',
        },
        islands: {
          label: '天空岛',
          jargon: '浮空岛',
          desc: '黏土只出现在某一段高度——漂在空中的岛。',
          gives: '浮空岛',
        },
        planet: {
          label: '小行星',
          jargon: '星球',
          desc: '一颗带起伏外壳的黏土球，四面都能挖。',
          gives: '球状世界',
        },
        strata: {
          label: '千层蛋糕',
          jargon: '岩层',
          desc: '山里有一层层条纹——像切开的岩层蛋糕。',
          gives: '沉积条纹',
        },
      },
      resolution: '黏土格子有多细',
      threshold: '从哪开始算「空气」',
      scale: '起伏放大缩小',
      height: '鼓包有多高',
    },

    csg: {
      title: '拿起刀子',
      jargon: 'CSG 运算',
      hint: '两块黏土 + 一种工具。看右边怎么变。',
      tryThis: '先试「挖个洞」，再试「融化粘合」。',
      shapeA: '黏土 A',
      shapeB: '黏土 B',
      operation: '用哪把刀？',
      ops: {
        union: {
          label: '粘在一起',
          jargon: '并集',
          formula: 'min(a, b)',
          use: '往体积上再加一块石头',
        },
        intersect: {
          label: '只留重叠',
          jargon: '交集',
          formula: 'max(a, b)',
          use: '两块都碰到的地方才留下',
        },
        subtract: {
          label: '挖个洞',
          jargon: '差集',
          formula: 'max(a, −b)',
          use: '挖隧道或房间',
        },
        smoothUnion: {
          label: '融化粘合',
          jargon: '平滑并集',
          formula: 'smin(a, b, k)',
          use: '有机接缝——没有硬折痕',
        },
        shell: {
          label: '掏空成壳',
          jargon: '壳体',
          formula: 'abs(a) − t',
          use: '做墙 / 空心壳',
        },
      },
      primitives: {
        sphere: '球',
        box: '方块',
        torus: '甜甜圈',
        cylinder: '管子',
      },
      smoothK: '有多融化',
      thickness: '墙有多厚',
    },

    meshing: {
      title: '选一种釉',
      jargon: '网格化',
      hint: '底下是同一块黏土——两种表面。切换着看。',
      tryThis: '在「方块釉」和「光滑釉」之间切换，看三角形数量怎么跳。',
      method: '釉面',
      methods: {
        culled: {
          label: '方块釉',
          jargon: '面剔除',
          look: '像 Minecraft',
          input: '有 / 无格子',
          faces: '中等',
          sharp: '只有直角边',
          topology: '基本封得住',
          cost: '最省',
          why: '只画土和空气交界的面。方块世界的好朋友。',
        },
        marching: {
          label: '光滑釉',
          jargon: '移动立方体',
          look: '软、圆',
          input: '软密度',
          faces: '很多三角形',
          sharp: '没有尖角',
          topology: '通常干净',
          cost: '中等',
          why: '走过每个小格子，缝出一张光滑皮。经典有机外观。',
        },
      },
      compareTitle: '别的釉（以后再看）',
      compare: [
        { method: '贪心合并', look: '方块', faces: '最少', sharp: '直角', cost: '低–中', note: '把平的邻居合成大面——更快的方块风。' },
        { method: '移动四面体', look: '光滑', faces: '更多', sharp: '否', cost: '中–高', note: '像移动立方体，怪边界情况更少。' },
        { method: '表面网络', look: '光滑', faces: '更少', sharp: '否', cost: '低–中', note: '面数常常比移动立方体少。' },
        { method: '对偶轮廓', look: '光滑+锐边', faces: '少', sharp: '能！', cost: '高', note: '能保住锋利切口——需要额外法线数据。' },
      ],
      faceCount: '画了多少三角',
      timeMs: '上釉花了多久',
    },

    chunking: {
      title: '只烧附近那一块',
      jargon: '分块',
      hint: '窑烧不了整颗星球。只加载身边一小圈。',
      tryThis: '把世界调大、视线半径调小——看两个数字差多少。',
      worldSize: '世界有多大',
      chunkSize: '一块砖多大',
      loaded: '正在烧的砖',
      costTitle: '窑的账单',
      without: '整炉全烧',
      with: '只烧附近',
      voxels: '要存的黏土粒',
      explain: [
        '512×512×512 的世界大约 1.34 亿个小格子。还没画画就吃掉很多内存。',
        '玩家只能看见一小泡泡。砖块（分块）可以单独加载、绘制、卸载。',
        '有些挖洞方式要偷看隔壁砖——所以边界会麻烦。',
      ],
      cavesTitle: '挖洞的几种办法（以后）',
      caves: [
        { method: '阈值', look: '宽洞穴', eval: '简单', cost: '查 1 次噪声', control: '洞有多密' },
        { method: '交集', look: '有点像隧道', eval: '简单', cost: '查 2 次噪声', control: '有多粗' },
        { method: '蠕虫', look: '有规划的隧道', eval: '难一点', cost: '跟着路径走', control: '长度和方向' },
        { method: '三维元胞', look: '有机空腔', eval: '难一点', cost: '问 26 个邻居', control: '不太直接' },
      ],
    },

    shared: {
      wireframe: '看看骨架线',
      info: '这是啥？',
      dragOrbit: '拖拽旋转 · 滚轮缩放',
      apply: '感觉像',
      jargonTag: '学名',
      showJargon: '显示课本名',
      hideJargon: '隐藏课本名',
    },
  },
} as const;

export type Strings = (typeof STRINGS)['en'];
