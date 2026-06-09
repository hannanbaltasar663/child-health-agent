const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const form = document.querySelector("#assessmentForm");
const loadDemo = document.querySelector("#loadDemo");
const askAgent = document.querySelector("#askAgent");
const chatPanel = document.querySelector(".chat-panel");
const reportText = document.querySelector("#reportText");
const adviceList = document.querySelector("#adviceList");
const riskLevel = document.querySelector("#riskLevel");
const completeness = document.querySelector("#completeness");
const eyeLevel = document.querySelector("#eyeLevel");
const followCycle = document.querySelector("#followCycle");
const timeline = document.querySelector("#timeline");

const requiredFields = [
  "age",
  "sex",
  "height",
  "weight",
  "growthVelocity",
  "exercise",
  "sleep",
  "screen",
  "outdoor",
  "nearWork",
  "vision",
  "myopia",
  "concern",
];

const demoCase = {
  age: "9.2",
  sex: "girl",
  height: "135",
  weight: "38",
  fatherHeight: "173",
  motherHeight: "160",
  growthVelocity: "7.2",
  exercise: "25",
  sleep: "8.2",
  screen: "2.5",
  outdoor: "0.8",
  nearWork: "4.2",
  vision: "4.7",
  myopia: "150",
  concern: "孩子体重偏高，最近乳房发育，视力也下降，担心是不是生活方式和发育风险叠加。",
  signals: ["puberty", "severeObesity", "visionDrop"],
};

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const viewName = item.dataset.view;
    navItems.forEach((nav) => nav.classList.toggle("active", nav === item));
    views.forEach((view) => view.classList.toggle("active", view.id === viewName));
  });
});

loadDemo.addEventListener("click", () => {
  Object.entries(demoCase).forEach(([key, value]) => {
    if (key === "signals") return;
    const field = form.elements[key];
    if (field) field.value = value;
  });
  document.querySelectorAll("input[name='signals']").forEach((item) => {
    item.checked = demoCase.signals.includes(item.value);
  });
  updateCompleteness();
});

form.addEventListener("input", updateCompleteness);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = readForm();
  const assessment = assessRisk(data);
  renderAssessment(data, assessment);
  switchView("agent");
});

askAgent.addEventListener("click", () => {
  const data = readForm();
  const missing = requiredFields.filter((field) => !data[field]);
  addMessage("user", data.concern || "孩子生长发育情况不太确定，想先了解风险。");
  if (missing.length) {
    addMessage("agent", `为了避免误导，我需要先补充：${missing.map(labelFor).join("、")}。补全后再生成风险沟通建议。`);
  } else {
    const assessment = assessRisk(data);
    addMessage("agent", `信息已基本完整。当前建议为“${assessment.label}”，眼健康提示为“${assessment.eyeLabel}”。我会基于指南知识库生成科普解释，并提示是否需要基层儿保或眼保健评估。`);
  }
});

function switchView(viewName) {
  navItems.forEach((nav) => nav.classList.toggle("active", nav.dataset.view === viewName));
  views.forEach((view) => view.classList.toggle("active", view.id === viewName));
}

function readForm() {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  data.signals = formData.getAll("signals");
  requiredFields.forEach((field) => {
    data[field] = data[field] || "";
  });
  return data;
}

function updateCompleteness() {
  const data = readForm();
  const complete = requiredFields.filter((field) => Boolean(data[field])).length;
  const score = Math.round((complete / requiredFields.length) * 100);
  completeness.textContent = `${score}%`;
}

function assessRisk(data) {
  const age = Number(data.age || 0);
  const height = Number(data.height || 0) / 100;
  const weight = Number(data.weight || 0);
  const bmi = height > 0 ? weight / (height * height) : 0;
  const growthVelocity = Number(data.growthVelocity || 0);
  const exercise = Number(data.exercise || 0);
  const sleep = Number(data.sleep || 0);
  const screen = Number(data.screen || 0);
  const outdoor = Number(data.outdoor || 0);
  const nearWork = Number(data.nearWork || 0);
  const vision = Number(data.vision || 0);
  const myopia = Number(data.myopia || 0);
  const signals = data.signals || [];

  let score = 0;
  if (bmi >= 24) score += 3;
  else if (bmi >= 21) score += 2;
  else if (bmi >= 18.5) score += 1;

  if (signals.includes("puberty")) score += age < 8 && data.sex === "girl" ? 4 : 2;
  if (signals.includes("rapidPuberty")) score += 3;
  if (signals.includes("shortGrowth") || growthVelocity < 5) score += 2;
  if (signals.includes("severeObesity")) score += 2;
  if (exercise < 60) score += 1;
  if (sleep < 9 && age <= 12) score += 1;
  if (screen > 2) score += 1;

  let eyeScore = 0;
  if (outdoor > 0 && outdoor < 2) eyeScore += 2;
  if (nearWork > 3) eyeScore += 2;
  if (screen > 2) eyeScore += 1;
  if (vision > 0 && vision < 4.9) eyeScore += 2;
  if (myopia >= 300) eyeScore += 3;
  else if (myopia > 0) eyeScore += 2;
  if (signals.includes("visionDrop")) eyeScore += 2;
  if (signals.includes("eyeFatigue")) eyeScore += 1;

  const eyeAssessment =
    eyeScore >= 6
      ? { eyeLabel: "建议眼保健评估", eyeClassName: "risk-evaluate" }
      : eyeScore >= 3
        ? { eyeLabel: "建议强化近视防控", eyeClassName: "risk-watch" }
        : { eyeLabel: "常规护眼科普", eyeClassName: "risk-low" };

  if (score >= 7) {
    return {
      level: "specialist",
      label: "建议专科就诊",
      className: "risk-specialist",
      cycle: "尽快评估",
      bmi,
      ...eyeAssessment,
    };
  }
  if (score >= 5) {
    return {
      level: "evaluate",
      label: "建议基层评估",
      className: "risk-evaluate",
      cycle: "2-4 周",
      bmi,
      ...eyeAssessment,
    };
  }
  if (score >= 3) {
    return {
      level: "watch",
      label: "建议观察随访",
      className: "risk-watch",
      cycle: "1-3 个月",
      bmi,
      ...eyeAssessment,
    };
  }
  return {
    level: "low",
    label: "一般科普",
    className: "risk-low",
    cycle: "3 个月",
    bmi,
    ...eyeAssessment,
  };
}

function renderAssessment(data, assessment) {
  riskLevel.textContent = assessment.label;
  riskLevel.className = assessment.className;
  eyeLevel.textContent = assessment.eyeLabel;
  eyeLevel.className = assessment.eyeClassName;
  followCycle.textContent = assessment.cycle;

  const bmiText = assessment.bmi ? assessment.bmi.toFixed(1) : "未计算";
  reportText.textContent = `系统根据年龄、性别、身高体重、发育信号、用眼行为和生活方式信息生成风险沟通建议。当前 BMI 约为 ${bmiText}，综合提示为“${assessment.label}”，眼健康提示为“${assessment.eyeLabel}”。该结果仅用于科普和就医提示，不作为诊断。`;

  const advice = buildAdvice(data, assessment);
  adviceList.innerHTML = advice.map((item) => `<li>${item}</li>`).join("");
  renderTimeline(assessment);
}

function buildAdvice(data, assessment) {
  const advice = [
    "建议记录近 3 个月身高、体重和发育变化，避免只凭单次测量判断。",
    "饮食建议优先调整含糖饮料、夜宵和高能量零食，保持规律三餐。",
    "运动建议以每日累计 60 分钟中高强度活动为目标，循序渐进。",
    "近视防控建议增加白天户外活动，减少连续近距离用眼，保持阅读距离和照明。",
  ];

  if (Number(data.sleep || 0) < 9) {
    advice.push("当前睡眠时长偏少，建议固定入睡时间，减少睡前屏幕暴露。");
  }
  if ((data.signals || []).includes("puberty")) {
    advice.push("若第二性征出现年龄偏早或进展较快，建议到儿保或儿童内分泌门诊进一步评估。");
  }
  if ((data.signals || []).includes("visionDrop") || Number(data.vision || 0) < 4.9 || Number(data.myopia || 0) > 0) {
    advice.push("若视力下降、眯眼或已有近视度数，建议进行规范视力和屈光检查，避免只靠线上判断。");
  }
  if (assessment.level === "specialist") {
    advice.push("如伴随明显发育进展、身高增长异常或严重肥胖，请优先线下就医，避免依赖线上判断。");
  } else if (assessment.level === "evaluate") {
    advice.push("建议携带近期身高体重记录，到社区儿保或妇幼机构完成初步评估。");
  }
  return advice;
}

function renderTimeline(assessment) {
  const specialist = assessment.level === "specialist";
  timeline.innerHTML = `
    <article>
      <span>今天</span>
      <p>完成自测，保存风险沟通报告，并补充缺失信息。</p>
    </article>
    <article>
      <span>${specialist ? "尽快" : assessment.cycle}</span>
      <p>${specialist ? "建议预约儿保、儿童内分泌或眼保健门诊评估。" : "记录饮食、运动、睡眠、屏幕时间、户外活动和近距离用眼，观察变化趋势。"}</p>
    </article>
    <article>
      <span>3 个月</span>
      <p>复测身高、体重和视力；如发育信号进展、增长速度异常或视力继续下降，进入基层评估或专科转诊。</p>
    </article>
  `;
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  chatPanel.appendChild(message);
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

function labelFor(field) {
  const labels = {
    age: "年龄",
    sex: "性别",
    height: "身高",
    weight: "体重",
    growthVelocity: "近一年长高",
    exercise: "每日运动",
    sleep: "睡眠",
    screen: "屏幕时间",
    outdoor: "每日户外时间",
    nearWork: "近距离用眼时间",
    vision: "裸眼视力",
    myopia: "近视度数",
    concern: "主要担忧",
  };
  return labels[field] || field;
}

updateCompleteness();
