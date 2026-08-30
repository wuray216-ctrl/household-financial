# 家庭财务全景规划师 — 规则引擎架构文档 v1.0

> 最后更新：2026年4月  
> 数据来源：国家统计局2025年年度数据、人社部、住建部、银保监会公开数据

---

## 一、数据常量体系（内置大数据底座）

### 1.1 收入基准数据（2025年国家统计局）

| 指标 | 全国 | 城镇 | 农村 |
|------|------|------|------|
| 人均可支配收入 | 43,377元 | 56,502元 | 24,456元 |
| 人均可支配收入中位数 | 36,231元 | 51,115元 | 20,711元 |
| 人均消费支出 | 29,476元 | 35,869元 | 20,259元 |
| 工资性收入占比 | 56.6% | — | — |
| 收入名义增速 | 5.0% | 4.3% | 5.8% |

**收入构成（人均/年）：**
- 工资性收入：24,555元（占56.6%）
- 经营净收入：7,252元（占16.7%）
- 财产净收入：3,490元（占8.0%）
- 转移净收入：8,080元（占18.6%）

### 1.2 消费支出结构（2025年，人均/年）

| 类别 | 金额 | 占比 | 增速 |
|------|------|------|------|
| 食品烟酒 | 8,631元 | 29.3% | 2.6% |
| 居住 | 6,397元 | 21.7% | 2.1% |
| 交通通信 | 4,306元 | 14.6% | 8.3% |
| 教育文化娱乐 | 3,489元 | 11.8% | 9.4% |
| 医疗保健 | 2,573元 | 8.7% | 1.0% |
| 生活用品及服务 | 1,667元 | 5.7% | 7.7% |
| 衣着 | 1,554元 | 5.3% | 2.2% |
| 其他用品及服务 | 859元 | 2.9% | 11.2% |

### 1.3 城市分层数据

```javascript
const CITY_TIERS = {
  "一线": {
    cities: ["北京", "上海", "广州", "深圳"],
    avgHousePrice: 55000,      // 元/㎡ 均价参考
    monthlyLivingCost: 8000,   // 人均月生活成本（不含房贷）
    socialSecurityBase: {
      min: 6326,               // 社保基数下限
      max: 35283,              // 社保基数上限
    },
    avgMonthlyIncome: 12000,   // 人均月可支配收入
    rentPerSqm: 80,            // 元/㎡/月 租金参考
    educationMultiplier: 1.5,  // 教育支出系数（基于全国平均）
    medicalMultiplier: 1.3,    // 医疗支出系数
  },
  "新一线": {
    cities: ["成都","杭州","重庆","武汉","苏州","西安","南京","长沙","郑州","天津","合肥","青岛","东莞","宁波","佛山"],
    avgHousePrice: 20000,
    monthlyLivingCost: 5500,
    socialSecurityBase: { min: 4500, max: 24000 },
    avgMonthlyIncome: 8500,
    rentPerSqm: 40,
    educationMultiplier: 1.2,
    medicalMultiplier: 1.1,
  },
  "二线": {
    cities: ["昆明","沈阳","济南","哈尔滨","温州","石家庄","南昌","大连","贵阳","厦门","珠海","太原","南宁","福州","长春","兰州","常州","徐州","乌鲁木齐"],
    avgHousePrice: 12000,
    monthlyLivingCost: 4500,
    socialSecurityBase: { min: 3800, max: 20000 },
    avgMonthlyIncome: 6500,
    rentPerSqm: 25,
    educationMultiplier: 1.0,
    medicalMultiplier: 1.0,
  },
  "三线及以下": {
    cities: [],  // 其他所有城市
    avgHousePrice: 6500,
    monthlyLivingCost: 3500,
    socialSecurityBase: { min: 3200, max: 16000 },
    avgMonthlyIncome: 4500,
    rentPerSqm: 15,
    educationMultiplier: 0.8,
    medicalMultiplier: 0.85,
  },
};
```

### 1.4 五险一金缴纳比例（2026年最新）

```javascript
const SOCIAL_INSURANCE = {
  employee: {  // 职工社保
    pension:        { company: 0.16, personal: 0.08 },  // 养老 (部分地区单位已降至14%)
    medical:        { company: 0.06, personal: 0.02 },  // 医疗 (各地6%-8%)
    unemployment:   { company: 0.005, personal: 0.005 },// 失业
    workInjury:     { company: 0.005, personal: 0 },    // 工伤 (0.2%-1.9% 行业不同)
    maternity:      { company: 0.005, personal: 0 },    // 生育 (已并入医疗)
    housingFund:    { company: 0.07, personal: 0.07 },  // 公积金 (5%-12%)
  },
  // 个人合计扣除：8% + 2% + 0.5% + 7% = 17.5%（含公积金）
  // 个人合计扣除（不含公积金）：10.5%
  
  resident: {    // 居民社保（无单位缴纳部分）
    pensionAnnual: 3600,      // 年缴费参考
    medicalAnnual: 380,       // 年缴费参考
  },
  
  // 社保基数 = min(max(实际工资, 基数下限), 基数上限)
};
```

### 1.5 个人所得税（2026年适用）

```javascript
const INCOME_TAX = {
  threshold: 5000,  // 起征点
  specialDeductions: {
    childEducation: 2000,     // 每个子女/月
    continuingEducation: 400, // 学历教育/月
    seriousIllness: 80000,    // 年度限额
    housingLoanInterest: 1000,// 每月
    housingRent: { "一线": 1500, "新一线": 1100, "二线": 800, "三线及以下": 800 },
    elderlySupport: 3000,     // 独生子女/月（非独2000,多人分摊）
    infant: 2000,             // 3岁以下婴幼儿/月
  },
  brackets: [
    { limit: 36000,   rate: 0.03, deduction: 0 },
    { limit: 144000,  rate: 0.10, deduction: 2520 },
    { limit: 300000,  rate: 0.20, deduction: 16920 },
    { limit: 420000,  rate: 0.25, deduction: 31920 },
    { limit: 660000,  rate: 0.30, deduction: 52920 },
    { limit: 960000,  rate: 0.35, deduction: 85920 },
    { limit: Infinity, rate: 0.45, deduction: 181920 },
  ],
};
```

### 1.6 教育支出阶梯（年支出，单位：万元）

```javascript
const EDUCATION_COST = {
  "公立": {
    kindergarten:    { annual: [0.3, 1.5],  ages: [3, 5]   }, // 幼儿园3-5岁
    primary:         { annual: [0.2, 0.8],  ages: [6, 11]  }, // 小学
    middle:          { annual: [0.3, 1.0],  ages: [12, 14] }, // 初中
    high:            { annual: [0.5, 1.5],  ages: [15, 17] }, // 高中
    university:      { annual: [1.5, 3.0],  ages: [18, 21] }, // 大学
  },
  "私立": {
    kindergarten:    { annual: [3, 8],      ages: [3, 5]   },
    primary:         { annual: [3, 10],     ages: [6, 11]  },
    middle:          { annual: [5, 12],     ages: [12, 14] },
    high:            { annual: [6, 15],     ages: [15, 17] },
    university:      { annual: [3, 6],      ages: [18, 21] },
  },
  "国际学校": {
    kindergarten:    { annual: [8, 15],     ages: [3, 5]   },
    primary:         { annual: [10, 20],    ages: [6, 11]  },
    middle:          { annual: [12, 25],    ages: [12, 14] },
    high:            { annual: [15, 30],    ages: [15, 17] },
    university:      { annual: [5, 10],     ages: [18, 21] },  // 国内大学
  },
  "留学": {
    // 前段与国际学校相同，大学阶段出国
    university:      { annual: [25, 50],    ages: [18, 21] },  // 海外大学
    postgrad:        { annual: [30, 60],    ages: [22, 23] },  // 研究生（可选）
  },
  
  // 课外辅导/兴趣班（叠加在上述基础上）
  extracurricular: {
    low:    6000,    // 年支出参考：低投入
    medium: 24000,   // 中等投入
    high:   60000,   // 高投入
  },
  
  // 通胀系数：教育支出年通胀约5-8%
  inflationRate: 0.06,
};
```

### 1.7 房贷利率（2026年参考）

```javascript
const MORTGAGE = {
  commercialLoan: {
    rate5YPlus: 0.036,   // 5年以上商贷基准利率 3.6%
    rate5YBelow: 0.035,  // 5年以下
  },
  fundLoan: {
    rate5YPlus: 0.0285,  // 公积金贷款5年以上 2.85%
    rate5YBelow: 0.0275, // 5年以下
    maxAmount: {
      "一线": 1200000,    // 北京/上海公积金最高贷款额
      "新一线": 800000,
      "二线": 600000,
      "三线及以下": 500000,
    },
  },
  warningLine: 0.30,     // 月供不超过月收入30%的警戒线
  dangerLine: 0.50,      // 月供超过月收入50%为危险
};
```

### 1.8 通胀与收益率

```javascript
const RATES = {
  cpiGeneral: 0.02,         // 一般CPI通胀
  cpiEducation: 0.06,       // 教育通胀
  cpiMedical: 0.05,         // 医疗通胀
  cpiHousing: 0.03,         // 居住通胀
  
  depositRate: 0.015,       // 活期/货币基金
  deposit1Y: 0.018,         // 一年定期
  deposit3Y: 0.022,         // 三年定期
  bondFund: 0.035,          // 债券基金年化
  indexFund: 0.07,          // 指数基金长期年化（含波动）
  mixedFund: 0.05,          // 混合基金
  
  incomeGrowth: {
    "互联网/科技":    { base: 0.08, peak: 0.12, peakAge: 35, declineRate: 0.03 },
    "金融":           { base: 0.07, peak: 0.10, peakAge: 40, declineRate: 0.02 },
    "制造业":         { base: 0.05, peak: 0.06, peakAge: 45, declineRate: 0.02 },
    "教育/医疗":      { base: 0.05, peak: 0.06, peakAge: 45, declineRate: 0.01 },
    "公务员/事业单位": { base: 0.04, peak: 0.05, peakAge: 50, declineRate: 0.01 },
    "自由职业":       { base: 0.06, peak: 0.10, peakAge: 38, declineRate: 0.04 },
    "其他":           { base: 0.05, peak: 0.06, peakAge: 42, declineRate: 0.02 },
  },
};
```

---

## 二、用户输入模型（完整字段清单）

### 2.1 基础信息
| 字段 | 类型 | 说明 |
|------|------|------|
| age | number | 年龄 |
| gender | enum | 性别（影响退休年龄） |
| cityTier | enum | 一线/新一线/二线/三线及以下 |
| city | string | 具体城市（可选，精确社保基数） |
| jobType | enum | 职业类型（7种） |
| jobStability | enum | 稳定/一般/高风险 |
| maritalStatus | enum | 未婚/已婚/离异 |
| familySize | number | 家庭人口 |
| hasElderly | boolean | 是否需要赡养老人 |
| elderlyCount | number | 赡养老人数量 |
| elderlyHasPension | boolean | 老人是否有退休金 |
| elderlyMonthlyCost | number | 每月赡养费用 |

### 2.2 收入
| 字段 | 类型 | 说明 |
|------|------|------|
| monthlySalary | number | 本人月薪（税前） |
| spouseMonthlySalary | number | 配偶月薪（税前） |
| annualBonus | number | 年终奖 |
| spouseAnnualBonus | number | 配偶年终奖 |
| sideIncome | number | 副业/兼职月收入 |
| investmentIncome | number | 年投资收益 |
| rentalIncome | number | 月租金收入 |
| otherIncome | number | 其他月收入 |

### 2.3 资产
| 字段 | 类型 | 说明 |
|------|------|------|
| cashSavings | number | 银行存款 |
| moneyMarketFund | number | 货币基金/余额宝 |
| fixedDeposit | number | 定期存款 |
| stocks | number | 股票市值 |
| funds | number | 基金市值 |
| bonds | number | 债券 |
| houseValue | number | 自住房市值 |
| investmentProperty | number | 投资性房产市值 |
| fundBalance | number | 公积金账户余额 |
| pensionBalance | number | 养老金个人账户余额 |
| equity | number | 期权/股权估值 |
| otherAssets | number | 其他资产 |

### 2.4 负债
| 字段 | 类型 | 说明 |
|------|------|------|
| mortgageBalance | number | 房贷余额 |
| mortgageMonthly | number | 房贷月供 |
| mortgageYearsLeft | number | 房贷剩余年限 |
| mortgageRate | number | 房贷利率 |
| mortgageType | enum | 商贷/公积金/组合贷 |
| carLoanBalance | number | 车贷余额 |
| carLoanMonthly | number | 车贷月供 |
| otherLoanBalance | number | 其他贷款余额 |
| otherLoanMonthly | number | 其他贷款月供 |
| creditCardDebt | number | 信用卡欠款 |

### 2.5 保障
| 字段 | 类型 | 说明 |
|------|------|------|
| socialSecurityType | enum | 职工社保/居民社保/无社保 |
| socialSecurityYears | number | 已缴社保年限 |
| fundRatio | number | 公积金缴存比例 |
| hasCommercialLife | boolean | 是否有商业寿险 |
| lifeInsuranceCoverage | number | 寿险保额 |
| hasCommercialMedical | boolean | 是否有商业医疗险 |
| medicalInsuranceCoverage | number | 医疗险保额 |
| hasCriticalIllness | boolean | 是否有重疾险 |
| criticalIllnessCoverage | number | 重疾险保额 |
| annualPremium | number | 年保费总支出 |
| healthStatus | enum | 健康/一般/有慢性病 |

### 2.6 子女教育
| 字段 | 类型 | 说明 |
|------|------|------|
| children | array | 子女数组 |
| children[].age | number | 子女年龄 |
| children[].educationPlan | enum | 公立/私立/国际学校/留学 |
| children[].extracurricular | enum | 低/中/高 投入 |

### 2.7 生活方式（影响支出模型）
| 字段 | 类型 | 说明 |
|------|------|------|
| hasCar | boolean | 是否有车 |
| annualCarCost | number | 年养车费用（保险+油+保养+停车） |
| annualTravel | number | 年旅游支出 |
| socialExpense | number | 年人情社交支出（份子钱等） |
| lifestyleLevel | enum | 节俭/适中/品质/奢华 |

---

## 三、计算规则引擎

### 3.1 收入计算模块

```
月总收入（税前）= 本人月薪 + 配偶月薪 + 副业收入 + 租金收入 + 其他收入 + 年终奖/12 + 投资收益/12

五险一金扣除（个人部分）:
  社保基数 = min(max(月薪, 城市基数下限), 城市基数上限)
  个人扣除 = 社保基数 × (养老8% + 医疗2% + 失业0.5% + 公积金比例)

应纳税所得额 = (月薪 - 5000 - 个人社保扣除 - 专项附加扣除) × 12
个税 = 按累进税率计算 / 12

月净收入 = 月总收入（税前）- 个人五险一金 - 个税
```

### 3.2 收入增长预测

```
未来收入(年份N) = 当前收入 × 增长曲线(职业, 当前年龄+N)

增长曲线逻辑:
  if 年龄 < peakAge:
    年增长率 = base + (peak - base) × (年龄 - 22) / (peakAge - 22)
  else:
    年增长率 = max(0, peak - declineRate × (年龄 - peakAge))
  
  // 职业风险调整
  if jobStability == "高风险":
    增长率 *= 0.85  // 风险折扣
    方差 *= 1.5     // 波动加大
```

### 3.3 支出计算模块

```
月固定支出:
  房贷月供
  车贷月供
  其他贷款月供
  保险月费 = 年保费 / 12

月生活支出:
  基础生活 = 城市人均消费支出 × 生活方式系数 × 家庭人数
  生活方式系数: 节俭=0.7, 适中=1.0, 品质=1.3, 奢华=1.8
  
月教育支出:
  Σ(每个孩子的当前阶段年支出中位数 × 城市教育系数) / 12 + 课外班/12

月赡养支出:
  赡养老人费用

月养车支出:
  年养车成本 / 12（默认参考: 2-5万/年）

月社交支出:
  年人情支出 / 12（默认参考: 2-5万/年）

月旅游支出:
  年旅游预算 / 12

月总支出 = 固定支出 + 生活支出 + 教育支出 + 赡养支出 + 养车 + 社交 + 旅游
月结余 = 月净收入 - 月总支出
```

### 3.4 资产负债分析

```
总流动资产 = 存款 + 货币基金 + 定期存款
总投资资产 = 股票 + 基金 + 债券 + 投资性房产
总固定资产 = 自住房市值 + 公积金余额 + 养老金余额 + 期权
总资产 = 流动资产 + 投资资产 + 固定资产 + 其他

总负债 = 房贷余额 + 车贷余额 + 其他贷款 + 信用卡欠款
净资产 = 总资产 - 总负债

关键比率:
  负债率 = 总负债 / 总资产
  月供收入比 = (所有月供之和) / 月净收入
  流动性比率 = 流动资产 / (月总支出 × 6)  // 能否覆盖6个月
  储蓄率 = 月结余 / 月净收入
  投资率 = 投资资产 / (总资产 - 自住房)
```

### 3.5 财务健康度评分（雷达图五维度）

```
1. 流动性评分（0-100）:
   紧急储备月数 = 流动资产 / 月总支出
   if >= 12个月: 100
   if >= 6个月:  60 + (月数 - 6) / 6 × 40
   if >= 3个月:  30 + (月数 - 3) / 3 × 30
   if < 3个月:   月数 / 3 × 30

2. 负债率评分（0-100，越低越好）:
   if 负债率 <= 0.3:   100
   if 负债率 <= 0.5:   60 + (0.5 - 负债率) / 0.2 × 40
   if 负债率 <= 0.7:   30 + (0.7 - 负债率) / 0.2 × 30
   if > 0.7:           max(0, (1 - 负债率) / 0.3 × 30)
   
   月供收入比惩罚:
   if 月供收入比 > 0.5: 评分 × 0.7
   if 月供收入比 > 0.3: 评分 × 0.9

3. 保障度评分（0-100）:
   社保分 = 职工社保40分, 居民社保20分, 无社保0分
   商业保险分:
     寿险: 保额 >= 年收入×10 → 20分, 按比例递减
     医疗险: 有 → 15分
     重疾险: 保额 >= 50万 → 15分, 按比例递减
   保费合理性: 年保费/年收入 在5-15%区间 → 10分加成

4. 储蓄率评分（0-100）:
   if 储蓄率 >= 0.30:  100
   if 储蓄率 >= 0.20:  70 + (储蓄率 - 0.20) / 0.10 × 30
   if 储蓄率 >= 0.10:  40 + (储蓄率 - 0.10) / 0.10 × 30
   if < 0.10:          储蓄率 / 0.10 × 40

5. 投资率评分（0-100）:
   目标投资率 = 根据年龄：(100 - 年龄)% 用于权益类
   实际投资率 = 投资资产 / (总资产 - 自住房)
   评分基于实际与目标的匹配度
   
   // 分散度加分
   if 投资类型 >= 3种: +10分
   if 只有存款: -20分

综合评分 = 五维度加权平均（权重可调，默认各20%）
```

### 3.6 养老缺口计算

```
退休年龄:
  男性: 63岁（延迟退休政策，至2035年逐步到位）
  女性(干部): 58岁
  女性(工人): 55岁

工作剩余年数 = 退休年龄 - 当前年龄
预期寿命 = 80岁（可调）

退休前累计储蓄（FV）:
  每年储蓄 = 月结余 × 12
  考虑收入增长和通胀
  FV = Σ(每年储蓄 × (1 + 投资收益率)^(退休年龄 - 当前年 - i))

退休后年支出:
  = 当前年支出 × (1 + 通胀率)^工作剩余年数 × 0.7  // 退休后支出约为工作期70%
  
社保养老金估算:
  基础养老金 ≈ 当地社平工资 × (1 + 个人缴费指数) / 2 × 缴费年限 × 1%
  个人账户养老金 ≈ 个人账户余额 / 计发月数(60岁139个月, 55岁170个月, 65岁101个月)

养老缺口:
  退休后总支出 = 年支出 × (预期寿命 - 退休年龄)（经通胀折现）
  退休后总收入 = 社保养老金 × 12 × (预期寿命 - 退休年龄)
  需要自备 = 退休后总支出 - 退休后总收入
  缺口 = max(0, 需要自备 - 退休前累计储蓄)
```

### 3.7 教育支出时间轴

```
for each child:
  当前阶段 = 根据年龄确定（幼儿园/小学/初中/高中/大学）
  
  for year in (当前年份 to 孩子22岁):
    阶段 = 根据孩子当年年龄
    年支出 = 教育路线[阶段].annual中位数 × 城市教育系数 × (1 + 教育通胀率)^(year - 当前年份)
    年支出 += 课外班支出 × (1 + 通胀率)^(year - 当前年份)
    
输出: 教育支出时间轴 [{year, amount, stage, child}]
```

### 3.8 资产配置建议规则

```
标准普尔四象限法则（调整版）:
  1. 日常开销账户（10%）: 3-6个月生活费
  2. 保障账户（20%）: 保险配置
  3. 稳健增值账户（40%）: 固定收益+债券基金
  4. 生钱账户（30%）: 权益类投资

年龄调整:
  权益类比例 = max(20%, min(60%, 100 - 年龄))
  固定收益比例 = 100% - 权益类 - 日常 - 保障

风险调整:
  if 职业高风险 or 收入不稳定:
    紧急储备金 = 9-12个月（而非6个月）
    权益类下调10%
  
  if 有房贷且月供收入比 > 0.3:
    保守化配置，权益类下调15%

保险配置规则:
  寿险保额 = max(年收入 × 10, 房贷余额 + 子女教育总支出)
  重疾险保额 = max(50万, 年收入 × 3)
  医疗险: 百万医疗必配
  年保费预算 = 年收入 × 5-10%
  
  if 年保费 > 年收入 × 15%: 警告"保费过高"
  if 无任何商业保险 and 有家庭负担: 警告"保障缺失"
```

### 3.9 风险预警规则

```javascript
const RISK_RULES = [
  {
    id: "debt_ratio_high",
    condition: (data) => data.debtRatio > 0.5,
    level: "warning",  // info / warning / danger
    title: "负债率偏高",
    message: (data) => `当前负债率${(data.debtRatio*100).toFixed(1)}%，建议控制在50%以下`,
    suggestion: "考虑提前还贷或增加资产端投入",
  },
  {
    id: "mortgage_ratio_danger",
    condition: (data) => data.mortgageRatio > 0.5,
    level: "danger",
    title: "月供压力过大",
    message: (data) => `月供占收入${(data.mortgageRatio*100).toFixed(1)}%，超过50%警戒线`,
    suggestion: "考虑延长贷款年限或提前部分还贷以降低月供",
  },
  {
    id: "no_emergency_fund",
    condition: (data) => data.emergencyMonths < 3,
    level: "danger",
    title: "紧急储备金严重不足",
    message: (data) => `流动资产仅覆盖${data.emergencyMonths.toFixed(1)}个月支出`,
    suggestion: "优先建立至少3-6个月的紧急储备金",
  },
  {
    id: "no_pension_plan",
    condition: (data) => data.age > 30 && data.pensionGap > 0 && !data.hasPensionInvestment,
    level: "warning",
    title: "养老储备未启动",
    message: "距离退休不足30年，尚未开始养老专项储蓄",
    suggestion: "建议每月拿出收入10%定投养老基金",
  },
  {
    id: "insurance_missing",
    condition: (data) => data.hasFamily && !data.hasAnyCommercialInsurance,
    level: "warning",
    title: "家庭保障缺失",
    message: "有家庭负担但无任何商业保险",
    suggestion: "优先配置百万医疗险和定期寿险",
  },
  {
    id: "insurance_overspend",
    condition: (data) => data.insuranceRatio > 0.15,
    level: "info",
    title: "保费支出偏高",
    message: (data) => `年保费占收入${(data.insuranceRatio*100).toFixed(1)}%，超过15%`,
    suggestion: "检查是否有重复保障或可优化的保单",
  },
  {
    id: "single_income_risk",
    condition: (data) => data.isMarried && data.spouseIncome === 0 && data.hasChildren,
    level: "warning",
    title: "单收入家庭风险",
    message: "家庭仅一人有收入来源，抗风险能力较弱",
    suggestion: "加强紧急储备金（建议9-12个月），并增加寿险保额",
  },
  {
    id: "investment_too_low",
    condition: (data) => data.investmentRatio < 0.1 && data.age < 50,
    level: "info",
    title: "投资配置比例偏低",
    message: "流动资产中投资占比不足10%，资产增值缓慢",
    suggestion: "考虑将部分定期存款转为指数基金定投",
  },
  {
    id: "tech_career_35_warning",
    condition: (data) => data.jobType === "互联网/科技" && data.age >= 32 && data.age <= 38,
    level: "info",
    title: "职业转型窗口期",
    message: "互联网行业35岁后收入增长可能放缓",
    suggestion: "建议积极储蓄和发展副业收入来源",
  },
  {
    id: "education_budget_gap",
    condition: (data) => data.educationFutureTotal > data.projectedSavings * 0.3,
    level: "warning",
    title: "教育支出占未来储蓄比例过高",
    message: "预计教育总支出超过可预见储蓄的30%",
    suggestion: "重新评估教育路线选择或增加教育专项储蓄",
  },
  {
    id: "good_emergency_fund",
    condition: (data) => data.emergencyMonths >= 6,
    level: "good",
    title: "应急储备充足",
    message: (data) => `流动资产可覆盖${data.emergencyMonths.toFixed(1)}个月支出`,
  },
  {
    id: "good_savings_rate",
    condition: (data) => data.savingsRate >= 0.3,
    level: "good",
    title: "储蓄率健康",
    message: (data) => `月结余率${(data.savingsRate*100).toFixed(1)}%，达到优秀水平`,
  },
];
```

---

## 四、输出报告结构

### 4.1 核心指标卡片
- 家庭月收入（税后）
- 家庭净资产
- 负债率（带红绿灯）
- 月结余率（带红绿灯）

### 4.2 资产负债表
- 资产端：流动/投资/固定 分类明细
- 负债端：按类型明细
- 净资产

### 4.3 月度现金流瀑布图
- 收入 → 五险一金 → 个税 → 房贷 → 生活 → 教育 → 赡养 → 保险 → 养车 → 社交 → 结余

### 4.4 人生阶段时间轴
- 标注教育里程碑（每个孩子）
- 房贷还清时间
- 退休时间
- 各节点预估支出金额（通胀调整后）

### 4.5 财务健康雷达图
- 五维度评分 + 综合评分

### 4.6 资产配置建议
- 当前 vs 建议比例
- 各账户具体调整建议
- 保险缺口分析

### 4.7 养老缺口分析
- 退休倒计时
- 预估退休月支出
- 社保养老金预估
- 缺口金额
- 弥补方案

### 4.8 风险预警 & 优化建议
- 按严重程度排序
- 每条含：问题描述 + 量化数据 + 可操作建议

---

## 五、后续扩展（Phase 2）

### 5.1 AI增强
- 接入Claude API，根据用户完整数据生成个性化文字解读
- 针对性问答："我应该提前还贷还是投资？"
- 方案模拟："如果换到三线城市，财务状况会怎样？"

### 5.2 盈利模块
- 保险比价推荐（CPS佣金）
- 基金产品导流（合规标注）
- 付费深度报告（养老规划、教育规划专项）
- B端SaaS（银行/保险公司理财经理工具）

### 5.3 数据源升级
- 接入实时社保基数API
- 接入房价数据API
- 用户历史数据对比（年度跟踪）
