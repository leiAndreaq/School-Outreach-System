// ── ANALYTICS STATE ──
let analyticsData       = null;
let analyticsPeriod     = 'weekly';
let leadsChartInstance  = null;
let statusChartInstance = null;
let heardFromChartInstance = null;

// ── LOAD ──
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) throw new Error();
    analyticsData = await res.json();
    renderAnalytics();
  } catch (e) {
    console.error('Could not load analytics');
  }
}

// ── TOGGLE PERIOD ──
function setAnalyticsPeriod(period) {
  analyticsPeriod = period;

  const activeStyle   = 'padding:6px 20px; border-radius:8px; font-size:13px; font-weight:600; background:#1B1F6B; color:#fff; border:none; cursor:pointer; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.2);';
  const inactiveStyle = 'padding:6px 20px; border-radius:8px; font-size:13px; font-weight:600; background:transparent; color:#6b7280; border:none; cursor:pointer; transition:all 0.15s;';

  document.getElementById('btn-weekly').style.cssText  = period === 'weekly'  ? activeStyle : inactiveStyle;
  document.getElementById('btn-monthly').style.cssText = period === 'monthly' ? activeStyle : inactiveStyle;

  if (analyticsData) renderAnalytics();
}

// ── RENDER ──
function renderAnalytics() {
  if (!analyticsData) return;
  const isWeekly = analyticsPeriod === 'weekly';

  // New Leads = schools currently in NEW_LEAD status (matches dashboard definition)
  const newLeads = (analyticsData.status_dist || [])
    .filter(r => !r.status || r.status === 'NEW_LEAD')
    .reduce((s, r) => s + r.count, 0);

  document.getElementById('an-new-leads').textContent  = newLeads;
  document.getElementById('an-leads-label').textContent = 'Awaiting outreach';

  document.getElementById('an-emails').textContent     = isWeekly ? analyticsData.weekly_emails    : analyticsData.monthly_emails;
  document.getElementById('an-meetings').textContent   = isWeekly ? analyticsData.weekly_meetings  : analyticsData.monthly_meetings;
  document.getElementById('an-inquiries').textContent  = isWeekly ? analyticsData.weekly_inquiries : analyticsData.monthly_inquiries;

  const label = isWeekly ? 'Last 7 days' : 'Last 30 days';
  document.getElementById('an-emails-label').textContent   = label;
  document.getElementById('an-meetings-label').textContent = label;
  document.getElementById('an-inquiries-label').textContent = label;

  document.getElementById('leads-chart-title').textContent = isWeekly
    ? 'New Leads — Last 7 Days'
    : 'New Leads — Last 30 Days (by week)';

  renderLeadsChart();
  renderStatusChart();
  renderHeardFromChart();
}

// ── LEADS BAR CHART ──
function renderLeadsChart() {
  const isWeekly = analyticsPeriod === 'weekly';
  let labels, values;

  if (isWeekly) {
    const dayMap = {};
    analyticsData.weekly_leads.forEach(r => { dayMap[r.day] = r.count; });

    labels = [];
    values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
      labels.push(label);
      values.push(dayMap[key] || 0);
    }
  } else {
    const dayMap = {};
    analyticsData.monthly_leads.forEach(r => { dayMap[r.day] = r.count; });

    const weekCounts = [0, 0, 0, 0];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key     = d.toISOString().slice(0, 10);
      const weekIdx = Math.min(Math.floor((29 - i) / 7), 3);
      weekCounts[weekIdx] += (dayMap[key] || 0);
    }

    labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    values = weekCounts;
  }

  const ctx = document.getElementById('leadsChart').getContext('2d');
  if (leadsChartInstance) leadsChartInstance.destroy();

  leadsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'New Leads',
        data: values,
        backgroundColor: '#1B1F6B',
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, stepSize: 1 },
          grid: { color: '#f3f4f6' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// ── HOW DID YOU FIND US — HORIZONTAL BAR ──
function renderHeardFromChart() {
  const dist = (analyticsData && analyticsData.heard_from_dist) || [];
  const emptyEl = document.getElementById('heardFromEmpty');
  const canvas  = document.getElementById('heardFromChart');

  if (!dist.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (canvas)  canvas.style.display  = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (canvas)  canvas.style.display  = 'block';

  const labels = dist.map(r => r.source === 'LinkedIn' ? 'TikTok' : r.source);
  const values = dist.map(r => r.count);
  const total  = values.reduce((s, v) => s + v, 0);

  const palette = [
    '#1B1F6B','#2563eb','#7c3aed','#db2777','#d97706',
    '#16a34a','#0891b2','#374151'
  ];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  const ctx = canvas.getContext('2d');
  if (heardFromChartInstance) heardFromChartInstance.destroy();

  heardFromChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Responses',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total ? Math.round((ctx.parsed.x / total) * 100) : 0;
              return ` ${ctx.parsed.x} response${ctx.parsed.x !== 1 ? 's' : ''} (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, stepSize: 1 },
          grid: { color: '#f3f4f6' }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── STATUS DOUGHNUT CHART ──
function renderStatusChart() {
  const isWeekly = analyticsPeriod === 'weekly';

  const newLeads  = isWeekly
    ? analyticsData.weekly_leads.reduce((s, r) => s + r.count, 0)
    : analyticsData.monthly_leads.reduce((s, r) => s + r.count, 0);
  const emails    = isWeekly ? analyticsData.weekly_emails    : analyticsData.monthly_emails;
  const meetings  = isWeekly ? analyticsData.weekly_meetings  : analyticsData.monthly_meetings;
  const inquiries = isWeekly ? analyticsData.weekly_inquiries : analyticsData.monthly_inquiries;

  const labels = ['New Leads', 'Email Sent', 'Meetings', 'Inquiries'];
  const values = [newLeads, emails, meetings, inquiries];
  const colors = ['#201658', '#1D24CA', '#98ABEE', '#F9E8C9'];

  const ctx = document.getElementById('statusChart').getContext('2d');
  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, padding: 10, boxWidth: 12 }
        }
      }
    }
  });
}
