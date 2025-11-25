document.addEventListener("DOMContentLoaded", () => {
  const state = {
    job: {
      title: "",
      location: "",
      description: "",
      keywords: [],
      softProfile: null
    },
    candidates: [],
    settings: {
      brandName: "LYNXhire",
      ownerName: ""
    }
  };

  let radarChart = null;

  function tokenize(text){
    if(!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-zàèéìòóù0-9\s]/g," ")
      .split(/\s+/)
      .filter(w=>w.length>2);
  }

  const stopwords = new Set([
    "il","lo","la","i","gli","le","un","una","uno","di","a","da","in","con","su","per","tra","fra",
    "e","o","ma","anche","come","solo","molto","poco","più","meno","molti","molte","dei","degli","delle",
    "questo","questa","questi","queste","quello","quella","quelli","quelle",
    "sono","siamo","siete","essere","avere","fare","fatto","tutto","tutti","tutte","ogni","alcuni","alcune",
    "the","and","for","from","with","that","this","these","those","very","just","here","there","then","than",
    "into","onto","your","their","about","over","under","between","within","each","other","which",
    "was","were","will","would","can","could","should","our","his","her","they","them","on","at","to",
    "lavoro","annuncio","ricerca","ricerchiamo","cerchiamo","figura","persona","ruolo","azienda","società",
    "mansione","mansioni","attività","responsabilità","requisiti","offerta","contratto","settore"
  ]);

  function canonicalizeToken(t){
    const map = {
      "sviluppatore":"developer",
      "sviluppatori":"developer",
      "programmatore":"developer",
      "programmatori":"developer",
      "developer":"developer",
      "frontend":"frontend",
      "front-end":"frontend",
      "backend":"backend",
      "back-end":"backend",
      "fullstack":"fullstack",
      "full-stack":"fullstack",
      "risorse":"hr",
      "umane":"hr",
      "hr":"hr",
      "recruiter":"recruiter",
      "selezione":"recruitment",
      "selezioni":"recruitment",
      "magazziniere":"magazzino",
      "magazzino":"magazzino",
      "logistica":"logistica",
      "saldatore":"saldatore",
      "saldatura":"saldatore",
      "welder":"saldatore",
      "acciaieria":"acciaio",
      "acciaio":"acciaio",
      "cnc":"cnc",
      "torni":"cnc",
      "fresa":"cnc",
      "javascript":"javascript",
      "typescript":"typescript",
      "java":"java",
      "python":"python",
      "csharp":"c#",
      "dotnet":".net",
      "amministrazione":"amministrazione",
      "contabile":"contabile",
      "contabilità":"contabile"
    };
    return map[t] || t;
  }

  function extractKeywords(text,max=18){
    if(!text) return [];
    const lower = text.toLowerCase();

    const lines = lower.split(/\n+/).map(l=>l.trim()).filter(Boolean);
    let roleTokens = [];
    if(lines.length){
      let first = lines[0];
      first = first.split(/[–\-:|]/)[0];
      const genericFirst = new Set(["annuncio","ricerca","ricerchiamo","cerchiamo","posizione","ruolo"]);
      roleTokens = first
        .split(/\s+/)
        .map(t=>t.trim())
        .filter(t=>t.length>2 && !stopwords.has(t) && !genericFirst.has(t))
        .map(canonicalizeToken);
    }

    const tokens = tokenize(text).map(canonicalizeToken);
    const counts = {};
    for(const t of tokens){
      if(stopwords.has(t)) continue;
      counts[t] = (counts[t] || 0) + 1;
    }

    for(const rt of roleTokens){
      if(!rt) continue;
      counts[rt] = (counts[rt] || 0) + 2.5;
    }

    const sorted = Object.entries(counts)
      .sort((a,b)=>b[1]-a[1])
      .map(([w])=>w);

    const seen = new Set();
    const result = [];
    for(const w of sorted){
      if(seen.has(w)) continue;
      seen.add(w);
      result.push(w);
      if(result.length>=max) break;
    }
    return result;
  }

  function detectSoftSkills(text){
    const lower = (text||"").toLowerCase();
    const skillMap = {
      communication: [
        "comunicazione","communication","presentazione","public speaking","scrittura",
        "relazione con i clienti","relazioni interpersonali","relazionali","chiara comunicazione"
      ],
      leadership: [
        "leadership","guidare il team","responsabile team","team leader","coordinamento",
        "gestivo un team","ho gestito un team","coordinavo","coordinare persone","supervisore"
      ],
      problemSolving: [
        "problem solving","risoluzione problemi","risolvere problemi","analitico","analisi dati",
        "troubleshoot","root cause","individuare soluzioni","gestione imprevisti"
      ],
      detail: [
        "attenzione al dettaglio","attenzione ai dettagli","precisione","accuratezza","meticoloso",
        "meticolosa","controllo qualità","quality check","alta precisione","lavoro accurato"
      ],
      teamwork: [
        "teamwork","lavoro di squadra","collaborazione","collaborare","cross-functional",
        "in sinergia con","supporto al team","ambiente di squadra"
      ],
      adaptability: [
        "adattabilità","flessibile","flessibilità","resilienza","cambiamento","ambiente dinamico",
        "gestione del cambiamento","rapido apprendimento","imparo velocemente"
      ],
      independence: [
        "autonomia","indipendente","self-starter","proattivo","proattiva","ownership","accountability",
        "lavoro in autonomia","gestione autonoma","responsabilità diretta"
      ]
    };
    const scores = {};
    for(const [k,patterns] of Object.entries(skillMap)){
      let score = 0;
      for(const p of patterns){
        const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi");
        const m = lower.match(re);
        if(m) score += m.length * 14;
      }
      scores[k] = Math.max(0,Math.min(100,score));
    }
    if(!Object.values(scores).some(v=>v>0)){
      for(const k of Object.keys(scores)) scores[k] = 40;
    }
    return scores;
  }

  function detectJobSoftSkills(text){
    const lower = (text||"").toLowerCase();
    const map = {
      communication: [
        "comunicazione","communication","interfaccia con i clienti","presentazioni",
        "reportistica chiara","capacità relazionali","gestione clienti"
      ],
      leadership: [
        "coordinamento","responsabile","gestione team","leadership","supervisione",
        "coordinare le risorse","guidare un team"
      ],
      problemSolving: [
        "problem solving","autonomia decisionale","analisi","risolvere problemi",
        "capacità analitiche","gestione delle criticità"
      ],
      detail: [
        "precisione","attenzione al dettaglio","attenzione ai dettagli","qualità","accuratezza",
        "controllo qualità","rispetto delle procedure"
      ],
      teamwork: [
        "lavoro di squadra","teamwork","collaborazione","team di lavoro","team multidisciplinare"
      ],
      adaptability: [
        "flessibilità","adattabilità","gestione cambiamento","dinamico","ambiente dinamico",
        "capacità di adattamento"
      ],
      independence: [
        "autonomia","responsabilità","ownership","gestione autonoma","operare in autonomia"
      ]
    };
    const scores = {};
    for(const [k,patterns] of Object.entries(map)){
      let found = false;
      for(const p of patterns){
        if(lower.includes(p)){found = true; break;}
      }
      scores[k] = found ? 85 : 0;
    }
    return scores;
  }

  function computeFitScore(text,jobKeywords){
    if(!jobKeywords || !jobKeywords.length) return 0;
    const candTokens = tokenize(text).map(canonicalizeToken);
    const tokenSet = new Set(candTokens);
    let weightedHits = 0;
    jobKeywords.forEach((kw,idx)=>{
      const hit = tokenSet.has(kw) ? 1 : 0;
      let weight = 1;
      if(idx < 3) weight = 2.2;
      else if(idx < 8) weight = 1.4;
      weightedHits += hit * weight;
    });
    const maxWeight =
      jobKeywords.slice(0,3).length * 2.2 +
      Math.max(0, jobKeywords.length-3) * 1.4;
    const coverage = maxWeight>0 ? (weightedHits / maxWeight) : 0;
    const len = candTokens.length;
    let densityBonus = 0;
    if(len > 80 && len < 1200){
      densityBonus = 0.08;
    }else if(len >= 1200){
      densityBonus = 0.12;
    }
    const raw = coverage + densityBonus;
    return Math.round(Math.max(0,Math.min(1,raw))*100);
  }

  function softSkillLabel(key){
    const map = {
      communication: "Communication",
      leadership: "Leadership",
      problemSolving: "Problem solving",
      detail: "Attention to detail",
      teamwork: "Teamwork",
      adaptability: "Adaptability & resilience",
      independence: "Autonomy & ownership"
    };
    return map[key] || key;
  }

  function classifyScore(score){
    if(score>=75) return "good";
    if(score>=55) return "mid";
    return "low";
  }

  function getScorePillClass(score){
    const lvl = classifyScore(score);
    if(lvl==="good") return "score-pill score-good";
    if(lvl==="mid") return "score-pill score-mid";
    return "score-pill score-low";
  }

  function sentenceCase(t){
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function computeFuturePerformanceScore(fitScore,softSkills,stabilityScore){
    const values = Object.values(softSkills || {});
    const avgSoft = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 50;
    let combined = avgSoft*0.45 + fitScore*0.4 + stabilityScore*0.15;
    if(fitScore>=80 && avgSoft>=75) combined += 5;
    if(fitScore>=80 && avgSoft<50) combined -= 8;
    if(avgSoft>=80 && fitScore<50) combined -= 8;
    return Math.round(Math.max(0,Math.min(100,combined)));
  }

  const cityToRegion = {
    "roma":"lazio","pomezia":"lazio","frosinone":"lazio",
    "milano":"lombardia","bergamo":"lombardia","brescia":"lombardia","monza":"lombardia",
    "napoli":"campania","salerno":"campania","caserta":"campania",
    "torino":"piemonte","cuneo":"piemonte","novara":"piemonte",
    "bologna":"emilia-romagna","modena":"emilia-romagna","parma":"emilia-romagna","rimini":"emilia-romagna",
    "firenze":"toscana","pisa":"toscana","livorno":"toscana","prato":"toscana",
    "bari":"puglia","lecce":"puglia",
    "palermo":"sicilia","catania":"sicilia","messina":"sicilia",
    "cagliari":"sardegna","sassari":"sardegna",
    "verona":"veneto","venezia":"veneto","padova":"veneto","treviso":"veneto",
    "genova":"liguria"
  };

  function normalizeLocation(raw){
    if(!raw) return {city:"",region:"",isRemote:false};
    const lower = raw.toLowerCase().trim();
    const remoteWords = ["remoto","da remoto","full remote","remote","smart working","ibrido","hybrid"];
    const isRemote = remoteWords.some(w=>lower.includes(w));
    let city = lower.split(/[,|-]/)[0].trim();
    let region = cityToRegion[city] || "";
    return {city,region,isRemote};
  }

  function computeGeoMatch(jobLoc,candLoc,text){
    const lower = (text||"").toLowerCase();
    const job = normalizeLocation(jobLoc||"");
    const cand = normalizeLocation(candLoc||"");

    let base = 50;

    if(job.isRemote || /remoto|da remoto|full remote|smart working|ibrido|hybrid/.test(jobLoc||"")){
      base = 90;
    }
    if(cand.isRemote){
      base = Math.max(base,80);
    }

    if(job.city && cand.city){
      if(job.city === cand.city){
        base = 96;
      }else if(job.region && cand.region && job.region === cand.region){
        base = Math.max(base,82);
      }else{
        base = Math.min(base,55);
      }
    }

    if(lower.includes("disponibile a trasferirsi") || lower.includes("disposto a trasferirsi") ||
       lower.includes("disponibile al trasferimento")){
      base = Math.max(base,78);
    }
    if(lower.includes("automunito") || lower.includes("mezzo proprio") || lower.includes("patente b")){
      base = Math.max(base,65);
    }

    if(lower.includes("non disponibile a trasferte") ||
       lower.includes("non disponibile a trasferimenti") ||
       lower.includes("solo lavoro vicino casa")){
      base = Math.min(base,30);
    }

    return Math.round(Math.max(0,Math.min(100,base)));
  }

  function computeSoftAlignment(jobSoft,candSoft){
    const wantedKeys = Object.keys(jobSoft||{}).filter(k=>jobSoft[k]>0);
    if(!wantedKeys.length) return {score:0,matched:[],missing:[]};
    const matched = [];
    const missing = [];
    wantedKeys.forEach(k=>{
      const v = (candSoft||{})[k] || 0;
      if(v>=60) matched.push(softSkillLabel(k));
      else missing.push(softSkillLabel(k));
    });
    const score = Math.round(100*matched.length/wantedKeys.length);
    return {score,matched,missing};
  }

  function estimateSeniority(text){
    const lower = (text||"").toLowerCase();
    if(lower.includes("senior") || lower.includes("lead ") || lower.includes("head of")) return "Senior";
    if(lower.includes("junior")) return "Junior";
    if(lower.includes("middle") || lower.includes("mid-level") || lower.includes("mid level")) return "Mid";
    const anniMatch = lower.match(/(\d+)\s+anni?/);
    if(anniMatch){
      const n = parseInt(anniMatch[1],10);
      if(!isNaN(n)){
        if(n>=7) return "Senior";
        if(n>=3) return "Mid";
        return "Junior";
      }
    }
    return "Unspecified";
  }

  function estimateStabilityScore(text){
    const lower = (text||"").toLowerCase();
    let risk = 0;
    const yearRanges = lower.match(/20[0-9]{2}\s*[-–]\s*20[0-9]{2}/g) || [];
    const shortTerms = (lower.match(/mesi|mese/g) || []).length;
    const tempWords = (lower.match(/tempo determinato|stagionale|contratto breve|somministrazione/g) || []).length;

    if(yearRanges.length>=5) risk += 15;
    if(shortTerms>3) risk += 20;
    if(tempWords>1) risk += 15;

    let score = 100 - risk;
    return Math.max(35,Math.min(100,score));
  }

  function estimateStabilityLabel(score){
    if(score>=80) return "Stable";
    if(score>=60) return "Mixed";
    return "Risky";
  }

  function detectLinguisticRisks(text){
    const lower = (text||"").toLowerCase();
    const risks = [];
    const manyDates = (lower.match(/20[0-9]{2}/g) || []).length;
    if(manyDates>=6) risks.push("Multiple short-term roles or frequent job changes.");
    if((lower.match(/stagionale/g) || []).length>=2) risks.push("Frequent seasonal or temporary contracts.");
    if(lower.includes("vari lavoretti") || lower.includes("diverse esperienze brevi"))
      risks.push("Self-described history of short sporadic jobs.");
    if(!text || text.length<400)
      risks.push("Profile description is relatively short: low information density.");
    return risks;
  }

  const tabButtons = Array.from(document.querySelectorAll(".nav-item"));
  const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

  const brandTitle = document.getElementById("brandTitle");
  const brandSubtitle = document.getElementById("brandSubtitle");
  const ownerBadge = document.getElementById("ownerBadge");

  const metricCandidates = document.getElementById("metricCandidates");
  const metricCandidatesNote = document.getElementById("metricCandidatesNote");
  const metricAvgFit = document.getElementById("metricAvgFit");
  const metricAvgFitNote = document.getElementById("metricAvgFitNote");
  const metricTopFPS = document.getElementById("metricTopFPS");
  const metricTopFPSNote = document.getElementById("metricTopFPSNote");
  const dashboardRoleBlock = document.getElementById("dashboardRoleBlock");
  const dashboardInsights = document.getElementById("dashboardInsights");
  const dashboardCandidates = document.getElementById("dashboardCandidates");

  const jobTitleInput = document.getElementById("jobTitleInput");
  const jobLocationInput = document.getElementById("jobLocationInput");
  const jobDescriptionInput = document.getElementById("jobDescriptionInput");
  const analyzeRoleBtn = document.getElementById("analyzeRoleBtn");
  const roleKeywordsBlock = document.getElementById("roleKeywordsBlock");

  const candidateNameInput = document.getElementById("candidateNameInput");
  const candidateLocationInput = document.getElementById("candidateLocationInput");
  const candidateCvInput = document.getElementById("candidateCvInput");
  const analyzeCandidateBtn = document.getElementById("analyzeCandidateBtn");
  const candidateAnalyzerMessage = document.getElementById("candidateAnalyzerMessage");
  const analyzerCandidatesList = document.getElementById("analyzerCandidatesList");

  const candidateDetailCard = document.getElementById("candidateDetailCard");
  const candidateDetailTitle = document.getElementById("candidateDetailTitle");
  const detailFitScore = document.getElementById("detailFitScore");
  const detailFpsScore = document.getElementById("detailFpsScore");
  const detailGeoScore = document.getElementById("detailGeoScore");
  const detailSummaryText = document.getElementById("detailSummaryText");
  const detailTags = document.getElementById("detailTags");
  const detailNotesInput = document.getElementById("detailNotesInput");
  const saveNotesBtn = document.getElementById("saveNotesBtn");
  const copySummaryBtn = document.getElementById("copySummaryBtn");
  const detailStrengths = document.getElementById("detailStrengths");
  const detailRisks = document.getElementById("detailRisks");
  const detailLinguisticRisks = document.getElementById("detailLinguisticRisks");
  const detailQuestions = document.getElementById("detailQuestions");
  const radarCanvas = document.getElementById("softSkillRadar");

  const simCandidateSelect = document.getElementById("simCandidateSelect");
  const simFocusInput = document.getElementById("simFocusInput");
  const runSimulationBtn = document.getElementById("runSimulationBtn");
  const simulationOutput = document.getElementById("simulationOutput");

  const srcRoleInput = document.getElementById("srcRoleInput");
  const srcExtraInput = document.getElementById("srcExtraInput");
  const buildJobSearchBtn = document.getElementById("buildJobSearchBtn");
  const jobSearchLinks = document.getElementById("jobSearchLinks");

  const srcCandidateInput = document.getElementById("srcCandidateInput");
  const buildCandidateSearchBtn = document.getElementById("buildCandidateSearchBtn");
  const candidateSearchLinks = document.getElementById("candidateSearchLinks");

  const feedbackInput = document.getElementById("feedbackInput");
  const generateFeedbackLinkBtn = document.getElementById("generateFeedbackLinkBtn");
  const feedbackLinkOutput = document.getElementById("feedbackLinkOutput");
  const feedbackDecodedBlock = document.getElementById("feedbackDecodedBlock");

  const reportCandidateSelect = document.getElementById("reportCandidateSelect");
  const reportContextInput = document.getElementById("reportContextInput");
  const generateReportBtn = document.getElementById("generateReportBtn");

  const brandNameInput = document.getElementById("brandNameInput");
  const ownerNameInput = document.getElementById("ownerNameInput");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");

  tabButtons.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = btn.dataset.tab;
      tabButtons.forEach(b=>b.classList.toggle("active", b===btn));
      tabPanels.forEach(p=>p.classList.toggle("active", p.id===target));
    });
  });

  function loadSettings(){
    try{
      const raw = localStorage.getItem("lynxhire_settings_v3");
      if(!raw) return;
      const parsed = JSON.parse(raw);
      if(parsed.brandName) state.settings.brandName = parsed.brandName;
      if(parsed.ownerName) state.settings.ownerName = parsed.ownerName;
    }catch(e){}
  }

  function saveSettings(){
    const payload = {
      brandName: state.settings.brandName,
      ownerName: state.settings.ownerName
    };
    localStorage.setItem("lynxhire_settings_v3", JSON.stringify(payload));
  }

  function applyBranding(){
    brandTitle.textContent = state.settings.brandName || "LYNXhire";
    if(state.settings.ownerName){
      brandSubtitle.textContent = "Tailored for " + state.settings.ownerName;
      ownerBadge.textContent = state.settings.ownerName;
    }else{
      brandSubtitle.textContent = "Intelligent shortlisting for staffing agencies";
      ownerBadge.textContent = "Unassigned owner";
    }
    brandNameInput.value = state.settings.brandName;
    ownerNameInput.value = state.settings.ownerName;
  }

  saveSettingsBtn.addEventListener("click", ()=>{
    state.settings.brandName = brandNameInput.value.trim() || "LYNXhire";
    state.settings.ownerName = ownerNameInput.value.trim();
    saveSettings();
    applyBranding();
  });

  analyzeRoleBtn.addEventListener("click", ()=>{
    const title = jobTitleInput.value.trim();
    const location = jobLocationInput.value.trim();
    const desc = jobDescriptionInput.value.trim();
    if(!desc){
      roleKeywordsBlock.textContent = "Please paste a job description before running the analysis.";
      return;
    }
    const keywords = extractKeywords(desc, 18);
    const softProfile = detectJobSoftSkills(desc);
    state.job.title = title || "Unspecified role";
    state.job.location = location || "";
    state.job.description = desc;
    state.job.keywords = keywords;
    state.job.softProfile = softProfile;

    const kwHtml = keywords.length
      ? "Key technical/role keywords: " + keywords.map(k=>`<code>${k}</code>`).join(" ")
      : "No strong keywords detected.";
    roleKeywordsBlock.innerHTML = kwHtml;

    syncDashboardRoles();
    syncDashboard();
  });

  function addCandidateFromInputs(){
    if(!state.job.description){
      candidateAnalyzerMessage.textContent = "Analyze the role first: paste the job description and click 'Analyze role'.";
      return;
    }
    const name = candidateNameInput.value.trim();
    const loc = candidateLocationInput.value.trim();
    const cv = candidateCvInput.value.trim();
    if(!name || !cv){
      candidateAnalyzerMessage.textContent = "Name and CV/profile text are required.";
      return;
    }
    const id = "cand_" + Date.now() + "_" + Math.floor(Math.random()*9999);

    const softSkills = detectSoftSkills(cv);
    const fitScore = computeFitScore(cv, state.job.keywords);
    const stabilityScore = estimateStabilityScore(cv);
    const stabilityLabel = estimateStabilityLabel(stabilityScore);
    const geoMatch = computeGeoMatch(state.job.location, loc, cv);
    const fps = computeFuturePerformanceScore(fitScore, softSkills, stabilityScore);
    const softAlignment = computeSoftAlignment(state.job.softProfile||{}, softSkills);
    const seniority = estimateSeniority(cv);
    const risks = detectLinguisticRisks(cv);

    const candidate = {
      id,
      name,
      location: loc,
      text: cv,
      softSkills,
      fitScore,
      fps,
      geoMatch,
      stabilityScore,
      stabilityLabel,
      softAlignment,
      seniority,
      tags: [],
      notes: "",
      risks
    };
    state.candidates.push(candidate);

    candidateNameInput.value = "";
    candidateLocationInput.value = "";
    candidateCvInput.value = "";
    candidateAnalyzerMessage.textContent = "Candidate analysed and added to the session.";

    renderCandidateList();
    syncSecondarySelectors();
    syncDashboard();
  }

  analyzeCandidateBtn.addEventListener("click", addCandidateFromInputs);

  function renderCandidateList(){
    if(!state.candidates.length){
      analyzerCandidatesList.classList.add("empty-block");
      analyzerCandidatesList.innerHTML = "<p>No candidates analysed yet.</p>";
      return;
    }
    analyzerCandidatesList.classList.remove("empty-block");
    analyzerCandidatesList.innerHTML = "";
    state.candidates.forEach(c=>{
      const div = document.createElement("div");
      div.className = "candidate-item";
      div.innerHTML = `
        <div class="candidate-header">
          <div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-location">${c.location || "Location not specified"}</div>
          </div>
          <button class="btn ghost btn-sm" data-cid="${c.id}">View</button>
        </div>
        <div class="score-badges">
          <span class="${getScorePillClass(c.fitScore)}">Fit: ${c.fitScore}</span>
          <span class="${getScorePillClass(c.fps)}">FPS: ${c.fps}</span>
          <span class="${getScorePillClass(c.geoMatch)}">Geo: ${c.geoMatch}</span>
          <span class="${getScorePillClass(c.softAlignment.score)}">Soft align: ${c.softAlignment.score}</span>
        </div>
      `;
      analyzerCandidatesList.appendChild(div);
    });

    analyzerCandidatesList.querySelectorAll("button[data-cid]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const cid = btn.dataset.cid;
        const cand = state.candidates.find(c=>c.id===cid);
        if(cand) renderCandidateDetail(cand);
      });
    });
  }

  function renderCandidateDetail(candidate){
    candidateDetailCard.classList.remove("hidden");
    candidateDetailTitle.textContent = candidate.name + (candidate.seniority ? " · " + candidate.seniority : "");

    detailFitScore.textContent = candidate.fitScore;
    detailFpsScore.textContent = candidate.fps;
    detailGeoScore.textContent = candidate.geoMatch;

    const salign = candidate.softAlignment;
    const stabilityLabel = candidate.stabilityLabel;
    const stabilityScore = candidate.stabilityScore;
    const locText = candidate.location ? `Based in ${candidate.location}. ` : "";
    detailSummaryText.textContent =
      `${locText}Overall fit ${candidate.fitScore}/100, projected performance ${candidate.fps}/100, geo-match ${candidate.geoMatch}/100. ` +
      `Soft-skill alignment ${salign.score}/100. Stability profile: ${stabilityLabel} (${stabilityScore}/100).`;

    renderTagChips(candidate);
    detailNotesInput.value = candidate.notes || "";

    detailStrengths.innerHTML = "";
    const strengths = [];
    if(candidate.fitScore>=75) strengths.push("Strong match with the technical/role keywords from the job description.");
    if(candidate.fps>=75) strengths.push("High projected future performance in the role.");
    if(candidate.softAlignment.score>=70) strengths.push("Soft-skill profile well aligned with the role’s expectations.");
    if(candidate.geoMatch>=80) strengths.push("Location and mobility fit the hiring context well.");
    if(Object.values(candidate.softSkills).some(v=>v>=80)) strengths.push("One or more soft skills stand out as a particular strength.");
    if(strengths.length===0) strengths.push("No standout strengths detected automatically – manual review recommended.");
    strengths.forEach(s=>{
      const li = document.createElement("li");
      li.textContent = s;
      detailStrengths.appendChild(li);
    });

    detailRisks.innerHTML = "";
    const risks = [];
    if(candidate.fitScore<55) risks.push("Low direct match with the key technical/role keywords in the posting.");
    if(candidate.softAlignment.score<55 && state.job.softProfile && Object.keys(state.job.softProfile).length){
      risks.push("Soft-skill profile only partially aligned with the role’s expectations.");
    }
    if(candidate.geoMatch<50) risks.push("Geo-match is weak; location/mobility may be a concern.");
    if(candidate.stabilityLabel==="Risky") risks.push("Stability flag: multiple short-term assignments or potential volatility.");
    if(risks.length===0) risks.push("No critical risk flags detected automatically.");
    risks.forEach(r=>{
      const li = document.createElement("li");
      li.textContent = r;
      detailRisks.appendChild(li);
    });

    detailLinguisticRisks.innerHTML = "";
    (candidate.risks || []).forEach(r=>{
      const li = document.createElement("li");
      li.textContent = r;
      detailLinguisticRisks.appendChild(li);
    });

    detailQuestions.innerHTML = "";
    const questions = [];
    questions.push("Walk me through your most relevant experience for this role and the concrete results you achieved.");
    if(candidate.stabilityLabel!=="Stable"){
      questions.push("Can you explain the changes between roles in the last years and what you were looking for each time?");
    }
    if(candidate.softAlignment.missing && candidate.softAlignment.missing.length){
      questions.push("In this role we value " + candidate.softAlignment.missing.join(", ") + ". Can you share examples where you demonstrated these?");
    }
    questions.push("How do you prefer to receive feedback and collaborate with your manager and peers?");
    questions.forEach(q=>{
      const li = document.createElement("li");
      li.textContent = q;
      detailQuestions.appendChild(li);
    });

    updateRadarChart(candidate.softSkills, state.job.softProfile || {});
  }

  function renderTagChips(candidate){
    const tagOptions = ["Top pick","Reserve","To call","No-go"];
    detailTags.innerHTML = "";
    tagOptions.forEach(tag=>{
      const chip = document.createElement("span");
      chip.className = "tag-chip" + (candidate.tags.includes(tag) ? " selected" : "");
      chip.textContent = tag;
      chip.addEventListener("click", ()=>{
        if(candidate.tags.includes(tag)){
          candidate.tags = candidate.tags.filter(t=>t!==tag);
          chip.classList.remove("selected");
        }else{
          candidate.tags.push(tag);
          chip.classList.add("selected");
        }
        syncDashboard();
      });
      detailTags.appendChild(chip);
    });
  }

  saveNotesBtn.addEventListener("click", ()=>{
    const text = detailNotesInput.value.trim();
    const candName = candidateDetailTitle.textContent.split(" · ")[0];
    const cand = state.candidates.find(c=>c.name===candName);
    if(cand){
      cand.notes = text;
    }
  });

  copySummaryBtn.addEventListener("click", ()=>{
    const text = detailSummaryText.textContent || "";
    if(!text) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).catch(()=>{ alert("Copy failed, please copy manually."); });
    }else{
      alert(text);
    }
  });

  function updateRadarChart(softSkills, jobSoft){
    const labels = [
      softSkillLabel("communication"),
      softSkillLabel("leadership"),
      softSkillLabel("problemSolving"),
      softSkillLabel("detail"),
      softSkillLabel("teamwork"),
      softSkillLabel("adaptability"),
      softSkillLabel("independence")
    ];
    const keys = ["communication","leadership","problemSolving","detail","teamwork","adaptability","independence"];
    const candData = keys.map(k=>softSkills[k] || 0);
    const jobData = keys.map(k=>(jobSoft && jobSoft[k]) ? jobSoft[k] : 0);

    if(radarChart){
      radarChart.destroy();
      radarChart = null;
    }
    radarChart = new Chart(radarCanvas, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Candidate",
            data: candData,
            fill: true
          },
          {
            label: "Role expectations",
            data: jobData,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            angleLines: { display: false },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: {
              showLabelBackdrop: false,
              stepSize: 20
            },
            grid: {
              circular: true
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: "#f5f5f7",
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  runSimulationBtn.addEventListener("click", ()=>{
    const cid = simCandidateSelect.value;
    if(!cid){
      simulationOutput.textContent = "Select a candidate first.";
      return;
    }
    const cand = state.candidates.find(c=>c.id===cid);
    if(!cand){
      simulationOutput.textContent = "Candidate not found in current session.";
      return;
    }
    const focus = simFocusInput.value.trim();
    const lines = [];
    lines.push("Day 1–30: onboarding and role framing.");
    if(cand.fitScore>=75){
      lines.push("- The candidate quickly understands the scope of the role and connects their past experience to the new context.");
    }else{
      lines.push("- The candidate needs extra clarification on expectations and priorities.");
    }
    if(cand.softAlignment.score>=70){
      lines.push("- Soft-skill alignment supports a smooth integration with the team and with the line manager.");
    }else{
      lines.push("- Some behaviours may need explicit feedback and alignment, especially around soft expectations.");
    }
    lines.push("");
    lines.push("Day 31–60: contribution and ownership.");
    if(cand.fps>=75){
      lines.push("- The candidate starts owning processes and delivers visible results with limited supervision.");
    }else{
      lines.push("- Contribution is present but still somewhat dependent on guidance and check-ins.");
    }
    if(cand.stabilityLabel==="Risky"){
      lines.push("- Monitor engagement and early signs of frustration or misalignment.");
    }
    lines.push("");
    lines.push("Day 61–90: consolidation and signals for the future.");
    if(cand.fps>=80 && cand.fitScore>=80){
      lines.push("- Signals suggest this person can become a key reference for the role in the medium term.");
    }else if(cand.fps>=60){
      lines.push("- The candidate is on track, with potential to grow if supported with clear goals.");
    }else{
      lines.push("- After 90 days, there might still be question marks about long-term fit or impact.");
    }
    if(focus){
      lines.push("");
      lines.push("Focus note (" + focus + "):");
      lines.push("- Consider discussing expectations explicitly during the first 1:1 and aligning metrics of success.");
    }
    simulationOutput.textContent = lines.join("\n");
  });

  function buildGoogleLink(query){
    const q = encodeURIComponent(query);
    return "https://www.google.com/search?q=" + q;
  }

  buildJobSearchBtn.addEventListener("click", ()=>{
    const role = srcRoleInput.value.trim();
    const extra = srcExtraInput.value.trim();
    if(!role){
      jobSearchLinks.innerHTML = "<p class='muted-text'>Enter at least some role keywords.</p>";
      return;
    }
    const baseQuery = `"${role}" ${extra}`.trim();
    const generic = baseQuery + " lavoro OR job";
    const jobBoards = baseQuery + " site:indeed.com OR site:infojobs.it OR site:monster.it";
    const linkedin = baseQuery + " site:linkedin.com/jobs";
    const apl = baseQuery + " \"agenzia per il lavoro\"";

    jobSearchLinks.innerHTML = `
      <a href="${buildGoogleLink(generic)}" target="_blank" rel="noopener">General job ads</a>
      <a href="${buildGoogleLink(jobBoards)}" target="_blank" rel="noopener">Indeed / InfoJobs / Monster</a>
      <a href="${buildGoogleLink(linkedin)}" target="_blank" rel="noopener">LinkedIn Jobs</a>
      <a href="${buildGoogleLink(apl)}" target="_blank" rel="noopener">Agencies (APL)</a>
    `;
  });

  buildCandidateSearchBtn.addEventListener("click", ()=>{
    const profile = srcCandidateInput.value.trim();
    if(!profile){
      candidateSearchLinks.innerHTML = "<p class='muted-text'>Enter at least some profile keywords.</p>";
      return;
    }
    const generic = profile + " cv OR curriculum";
    const linkedin = profile + " site:linkedin.com/in";
    const pdf = profile + " filetype:pdf";
    const portfolio = profile + " portfolio OR github OR behance";

    candidateSearchLinks.innerHTML = `
      <a href="${buildGoogleLink(generic)}" target="_blank" rel="noopener">Generic CV search</a>
      <a href="${buildGoogleLink(linkedin)}" target="_blank" rel="noopener">LinkedIn profiles</a>
      <a href="${buildGoogleLink(pdf)}" target="_blank" rel="noopener">PDF CVs</a>
      <a href="${buildGoogleLink(portfolio)}" target="_blank" rel="noopener">Portfolio / GitHub / others</a>
    `;
  });

  function encodeFeedback(text){
    return btoa(unescape(encodeURIComponent(text)));
  }
  function decodeFeedback(encoded){
    try{
      return decodeURIComponent(escape(atob(encoded)));
    }catch(e){
      return "";
    }
  }

  generateFeedbackLinkBtn.addEventListener("click", ()=>{
    const txt = feedbackInput.value.trim();
    if(!txt){
      feedbackLinkOutput.textContent = "Write something first.";
      return;
    }
    const encoded = encodeFeedback(txt);
    const base = window.location.href.split("#")[0];
    const link = base + "#feedback=" + encoded;
    feedbackLinkOutput.innerHTML = `Sharable link (no server, just URL hash):<br><a href="${link}" target="_blank">${link}</a>`;
  });

  function readFeedbackFromHash(){
    const hash = window.location.hash || "";
    if(!hash.startsWith("#feedback=")){
      feedbackDecodedBlock.textContent = "(No feedback encoded in URL.)";
      return;
    }
    const encoded = hash.replace("#feedback=","");
    const text = decodeFeedback(encoded);
    if(text){
      feedbackDecodedBlock.textContent = text;
    }else{
      feedbackDecodedBlock.textContent = "(Could not decode feedback content.)";
    }
  }

  window.addEventListener("hashchange", readFeedbackFromHash);

  generateReportBtn.addEventListener("click", ()=>{
    const cid = reportCandidateSelect.value;
    if(!cid) return;
    const cand = state.candidates.find(c=>c.id===cid);
    if(!cand) return;

    const context = reportContextInput.value.trim();
    const jobTitle = state.job.title || "Unspecified role";
    const owner = state.settings.ownerName || "Your agency";

    const salign = cand.softAlignment;
    const risks = cand.risks || [];

    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Candidate report – ${cand.name}</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:16px 20px;color:#111;background:#f5f5f7;}
    h1,h2,h3{margin:0 0 6px;}
    .muted{color:#555;font-size:0.9rem;}
    .section{margin-top:18px;}
    .pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:0.7rem;border:1px solid #ccc;margin-right:4px;}
    .score{font-weight:600;}
    ul{margin:4px 0 0 20px;}
  </style>
</head>
<body>
  <h1>${cand.name}</h1>
  <div class="muted">${jobTitle} · ${owner}</div>
  <div class="muted">${context || ""}</div>

  <div class="section">
    <h2>1. Executive summary</h2>
    <p>${candidateSummarySentence(cand)}</p>
  </div>

  <div class="section">
    <h2>2. Core metrics</h2>
    <p>
      <span class="score">Fit:</span> ${cand.fitScore}/100 ·
      <span class="score">Future performance:</span> ${cand.fps}/100 ·
      <span class="score">Geo match:</span> ${cand.geoMatch}/100 ·
      <span class="score">Soft alignment:</span> ${salign.score}/100 ·
      <span class="score">Stability:</span> ${cand.stabilityLabel} (${cand.stabilityScore}/100)
    </p>
  </div>

  <div class="section">
    <h2>3. Soft skills & role alignment</h2>
    <p><strong>Strengths:</strong></p>
    <ul>
      ${buildStrengthsListHtml(cand)}
    </ul>
    <p><strong>Watchpoints:</strong></p>
    <ul>
      ${buildRisksListHtml(cand)}
      ${risks.map(r=>"<li>"+r+"</li>").join("")}
    </ul>
  </div>

  <div class="section">
    <h2>4. Suggested interview angles</h2>
    <ul>
      ${buildQuestionsHtml(cand)}
    </ul>
  </div>

  <script>
    window.print();
  </script>
</body>
</html>
    `;

    const w = window.open("", "_blank");
    if(!w) return;
    w.document.write(reportHtml);
    w.document.close();
  });

  function candidateSummarySentence(cand){
    const parts = [];
    parts.push("Overall fit " + cand.fitScore + "/100 with projected future performance " + cand.fps + "/100.");
    parts.push("Geo-match " + cand.geoMatch + "/100 and stability profile " + cand.stabilityLabel + " (" + cand.stabilityScore + "/100).");
    if(cand.softAlignment && cand.softAlignment.score){
      parts.push("Soft-skill alignment with the role at " + cand.softAlignment.score + "/100.");
    }
    return parts.join(" ");
  }

  function buildStrengthsListHtml(cand){
    const items = [];
    if(cand.fitScore>=75) items.push("<li>Strong match with core keywords of the job posting.</li>");
    if(cand.fps>=75) items.push("<li>High projected performance in the first 6–12 months.</li>");
    if(cand.softAlignment.score>=70) items.push("<li>Soft-skill profile well aligned with the role’s requirements.</li>");
    if(cand.geoMatch>=80) items.push("<li>Location and mobility are fully compatible with the role.</li>");
    if(Object.values(cand.softSkills).some(v=>v>=80)) items.push("<li>One or more behavioural dimensions stand out as a strong asset.</li>");
    if(!items.length) items.push("<li>No standout strengths highlighted by the engine; manual assessment recommended.</li>");
    return items.join("");
  }

  function buildRisksListHtml(cand){
    const items = [];
    if(cand.fitScore<55) items.push("<li>Low alignment with core technical/role keywords.</li>");
    if(cand.softAlignment.score<55 && state.job.softProfile && Object.keys(state.job.softProfile).length){
      items.push("<li>Soft-skill alignment with the role appears partial and should be validated in interview.</li>");
    }
    if(cand.geoMatch<50) items.push("<li>Weak geographic alignment or mobility concerns.</li>");
    if(cand.stabilityLabel==="Risky") items.push("<li>Stability risk based on work history; explore motivations and expectations.</li>");
    if(!items.length) items.push("<li>No critical risk flags from the engine’s perspective.</li>");
    return items.join("");
  }

  function buildQuestionsHtml(cand){
    const questions = [];
    questions.push("<li>Walk me through your most relevant experience for this role and the concrete results you achieved.</li>");
    if(cand.stabilityLabel!=="Stable"){
      questions.push("<li>Can you explain the changes between roles in the last years and what you were looking for each time?</li>");
    }
    if(cand.softAlignment.missing && cand.softAlignment.missing.length){
      questions.push("<li>In this role we value " + cand.softAlignment.missing.join(", ") + ". Can you share concrete examples where you demonstrated these?</li>");
    }
    questions.push("<li>How do you prefer to receive feedback and collaborate with your manager and peers?</li>");
    return questions.join("");
  }

  function syncDashboardRoles(){
    if(!state.job.description){
      dashboardRoleBlock.classList.add("empty-block");
      dashboardRoleBlock.innerHTML = "<p>No role analysed yet. Paste a job description in the Analyzer tab.</p>";
      return;
    }
    dashboardRoleBlock.classList.remove("empty-block");
    const kw = state.job.keywords || [];
    const soft = state.job.softProfile || {};
    const softWanted = Object.keys(soft).filter(k=>soft[k]>0).map(softSkillLabel);
    dashboardRoleBlock.innerHTML = `
      <p><strong>${state.job.title || "Unspecified role"}</strong></p>
      <p class="muted-text">Location: ${state.job.location || "Not specified"}</p>
      <p class="muted-text">Key keywords: ${kw.slice(0,10).map(k=>"<code>"+k+"</code>").join(" ") || "n/a"}</p>
      <p class="muted-text">Soft-skill focus: ${softWanted.join(", ") || "Not explicitly stated."}</p>
    `;
  }

  function syncDashboard(){
    const total = state.candidates.length;
    metricCandidates.textContent = total;
    metricCandidatesNote.textContent = total
      ? "Total candidates analysed in this session."
      : "Add candidates from the Analyzer tab.";

    if(!total){
      metricAvgFit.textContent = "–";
      metricAvgFitNote.textContent = "No data yet.";
      metricTopFPS.textContent = "–";
      metricTopFPSNote.textContent = "No candidate analysed.";
      dashboardInsights.innerHTML = "<li>No candidates yet. Once you add profiles, key insights will appear here.</li>";
      dashboardCandidates.classList.add("empty-block");
      dashboardCandidates.innerHTML = "<p>As you add candidates from the Analyzer, they will appear here with key metrics.</p>";
      return;
    }

    const fits = state.candidates.map(c=>c.fitScore);
    const fpsList = state.candidates.map(c=>c.fps);
    const avgFit = Math.round(fits.reduce((a,b)=>a+b,0)/total);
    metricAvgFit.textContent = avgFit;
    if(avgFit>=75) metricAvgFitNote.textContent = "Overall pool is strongly aligned with the role.";
    else if(avgFit>=55) metricAvgFitNote.textContent = "Mixed pool; shortlist and interview will be important.";
    else metricAvgFitNote.textContent = "Low alignment pool; consider re-opening sourcing.";

    const topFPS = Math.max(...fpsList);
    metricTopFPS.textContent = topFPS;
    const topCand = state.candidates.find(c=>c.fps===topFPS);
    metricTopFPSNote.textContent = topCand ? ("Top FPS: " + topCand.name) : "No candidate analysed.";

    const strongCount = state.candidates.filter(c=>c.fitScore>=75 && c.fps>=75).length;
    const geoCritical = state.candidates.filter(c=>c.geoMatch<50).length;
    const riskyStability = state.candidates.filter(c=>c.stabilityLabel==="Risky").length;

    const insights = [];
    insights.push(`<li>${strongCount} candidate(s) flagged as strong potential hires (high Fit & FPS).</li>`);
    if(geoCritical>0) insights.push(`<li>${geoCritical} candidate(s) show weak geographic alignment or mobility concerns.</li>`);
    if(riskyStability>0) insights.push(`<li>${riskyStability} candidate(s) have a Risky stability profile – validate motivations carefully.</li>`);
    if(insights.length===0) insights.push("<li>No particular risks flagged. Manual review still recommended.</li>");
    dashboardInsights.innerHTML = insights.join("");

    dashboardCandidates.classList.remove("empty-block");
    dashboardCandidates.innerHTML = "";
    state.candidates.forEach(c=>{
      const div = document.createElement("div");
      div.className = "candidate-item";
      const tags = (c.tags || []).map(t=>`<span class="pill pill-outline">${t}</span>`).join(" ");
      div.innerHTML = `
        <div class="candidate-header">
          <div>
            <div class="candidate-name">${c.name}</div>
            <div class="candidate-location">${c.location || ""}</div>
          </div>
          <div>${tags}</div>
        </div>
        <div class="score-badges">
          <span class="${getScorePillClass(c.fitScore)}">Fit: ${c.fitScore}</span>
          <span class="${getScorePillClass(c.fps)}">FPS: ${c.fps}</span>
          <span class="${getScorePillClass(c.geoMatch)}">Geo: ${c.geoMatch}</span>
          <span class="${getScorePillClass(c.softAlignment.score)}">Soft align: ${c.softAlignment.score}</span>
        </div>
      `;
      dashboardCandidates.appendChild(div);
    });
  }

  function syncSecondarySelectors(){
    const opts = state.candidates.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
    const base = '<option value="">Select a candidate…</option>';
    simCandidateSelect.innerHTML = base + opts;
    reportCandidateSelect.innerHTML = base + opts;
  }

  function encodeFeedback(text){
    return btoa(unescape(encodeURIComponent(text)));
  }
  function decodeFeedback(encoded){
    try{
      return decodeURIComponent(escape(atob(encoded)));
    }catch(e){
      return "";
    }
  }

  generateFeedbackLinkBtn.addEventListener("click", ()=>{
    const txt = feedbackInput.value.trim();
    if(!txt){
      feedbackLinkOutput.textContent = "Write something first.";
      return;
    }
    const encoded = encodeFeedback(txt);
    const base = window.location.href.split("#")[0];
    const link = base + "#feedback=" + encoded;
    feedbackLinkOutput.innerHTML = `Sharable link (no server, just URL hash):<br><a href="${link}" target="_blank">${link}</a>`;
  });

  function readFeedbackFromHash(){
    const hash = window.location.hash || "";
    if(!hash.startsWith("#feedback=")){
      feedbackDecodedBlock.textContent = "(No feedback encoded in URL.)";
      return;
    }
    const encoded = hash.replace("#feedback=","");
    const text = decodeFeedback(encoded);
    if(text){
      feedbackDecodedBlock.textContent = text;
    }else{
      feedbackDecodedBlock.textContent = "(Could not decode feedback content.)";
    }
  }

  window.addEventListener("hashchange", readFeedbackFromHash);

  function loadSettingsAndInit(){
    loadSettings();
    applyBranding();
    syncDashboardRoles();
    syncDashboard();
    syncSecondarySelectors();
    readFeedbackFromHash();
  }

  loadSettingsAndInit();
});
