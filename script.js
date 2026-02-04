// --- UTILITY FUNCTIONS ---

// Updated to handle inputs with commas (strings) and standard numbers
function parseInput(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    
    // Get value, remove commas, then parse
    let rawVal = el.value.toString().replace(/,/g, '');
    const val = parseFloat(rawVal);
    
    return isNaN(val) ? 0 : val;
}

// Function to format input fields with commas on Blur
function formatCurrencyInput(input) {
    // Remove existing non-numeric chars except dot
    let val = input.value.replace(/[^0-9.]/g, '');
    let number = parseFloat(val);
    if (isNaN(number)) {
        input.value = "";
        return;
    }
    // Add commas
    input.value = number.toLocaleString('en-US', {maximumFractionDigits: 0});
}

function fmtMoney(num) {
    if (isNaN(num)) return "$0";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function fmtPct(num) {
    if (isNaN(num)) return "0.00%";
    return (num * 100).toFixed(2) + '%';
}

function fmtDec(num) {
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
}

// Custom IRR Calculation
function calculateIRR(cashFlows, guess = 0.1) {
    const maxIter = 1000;
    const precision = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        let npv = 0;
        let dNpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + rate, t);
            dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
        }
        
        if (Math.abs(dNpv) < 1e-10) return rate; // Avoid zero division

        let newRate = rate - npv / dNpv;
        if (Math.abs(newRate - rate) < precision) return newRate;
        rate = newRate;
    }
    return rate;
}

// --- UI LOGIC ---

function switchTab(tabName) {
    // Hide all
    document.getElementById('chart-cashflow').classList.add('hidden');
    document.getElementById('chart-expenses').classList.add('hidden');
    document.getElementById('chart-equity').classList.add('hidden');
    
    // Show target
    const target = document.getElementById(`chart-${tabName}`);
    if(target) target.classList.remove('hidden');

    // Toggle active state
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Find button that triggered this
    const btns = document.getElementsByTagName('button');
    for (let btn of btns) {
        if(btn.textContent.toLowerCase().includes(tabName.replace('cashflow', 'cash flow'))) {
            btn.classList.add('active');
        }
    }
    // Fallback if click event isn't passed directly, just highlight clicked element
    if(event && event.target) event.target.classList.add('active');
}

function toggleAdvanced() {
    const container = document.getElementById('advanced-inputs');
    const arrow = document.getElementById('toggle-arrow');
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        arrow.style.transform = "rotate(180deg)";
    } else {
        container.classList.add('hidden');
        arrow.style.transform = "rotate(0deg)";
    }
}

// --- RESET LOGIC ---
const defaults = {
    'purchasePrice': "300,000",
    'rehabCosts': "20,000",
    'arv': "350,000",
    'closingCostsPct': 3.0,
    'downPaymentPct': 20,
    'mortgageRate': 7.0,
    'loanTerm': 30,
    'pmiPct': 0.6,
    'grossMonthlyRent': "2,500",
    'propertyTaxes': "3,600",
    'insurancePct': 0.6,
    'hoaFees': "0",
    'vacancyRate': 6.0,
    'utilities': "50",
    'repairsPct': 6.0,
    'capexPct': 6.0,
    'managementPct': 10.0,
    'appreciationHome': 3.0,
    'appreciationRent': 3.0,
    'inflationCosts': 3.0,
    'saleClosingCosts': 8.0
};

function resetInputs() {
    for (const [id, val] of Object.entries(defaults)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    calculate();
}

// --- CHART VARIABLES ---
let chart1 = null;
let chart2 = null;
let chart3 = null;

// --- MAIN CALCULATION ---
function calculate() {
    // 1. Inputs
    const pp = parseInput('purchasePrice');
    const rehab = parseInput('rehabCosts');
    const arv = parseInput('arv');
    const closingCostsPct = parseInput('closingCostsPct') / 100;
    
    const downPct = parseInput('downPaymentPct') / 100;
    const rate = parseInput('mortgageRate') / 100;
    const term = parseInput('loanTerm');
    const pmiPct = parseInput('pmiPct') / 100;
    
    const rentMonthly = parseInput('grossMonthlyRent');
    const taxesAnnual = parseInput('propertyTaxes');
    const insurancePct = parseInput('insurancePct') / 100;
    const hoaMonthly = parseInput('hoaFees');
    const vacancyRate = parseInput('vacancyRate') / 100;
    const utilitiesMonthly = parseInput('utilities');
    
    const repairsPct = parseInput('repairsPct') / 100;
    const capexPct = parseInput('capexPct') / 100;
    const mgmtPct = parseInput('managementPct') / 100;
    
    const appHome = parseInput('appreciationHome') / 100;
    const appRent = parseInput('appreciationRent') / 100;
    const inflation = parseInput('inflationCosts') / 100;
    const saleCostPct = parseInput('saleClosingCosts') / 100;

    // 2. Setup
    const downPayment = pp * downPct;
    const closingCosts = pp * closingCostsPct;
    const totalCashInvested = downPayment + closingCosts + rehab;
    const loanAmount = pp - downPayment;
    
    // 1% Rule Logic
    const totalCost = pp + rehab;
    const onePercentVal = totalCost > 0 ? (rentMonthly / totalCost) : 0;
    
    const kpiOne = document.getElementById('kpiOnePercent');
    const badgeOne = document.getElementById('badgeOnePercent');
    
    if(kpiOne) kpiOne.textContent = fmtPct(onePercentVal);
    
    if(badgeOne) {
        if (onePercentVal >= 0.01) {
            badgeOne.textContent = "Pass";
            badgeOne.className = "badge pass";
        } else {
            badgeOne.textContent = "Fail";
            badgeOne.className = "badge fail";
        }
    }

    // Mortgage
    const monthlyRate = rate / 12;
    const nPayments = term * 12;
    let monthlyPI = 0;
    
    if (loanAmount > 0) {
        if (monthlyRate > 0) {
            monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1);
        } else {
            monthlyPI = loanAmount / nPayments;
        }
    }

    // Loop Vars
    let currentHomeValue = arv;
    let currentLoanBalance = loanAmount;
    let currentRentMonthly = rentMonthly;
    
    let currentTaxes = taxesAnnual;
    let currentInsurance = pp * insurancePct; 
    let currentHoa = hoaMonthly * 12;
    let currentUtilities = utilitiesMonthly * 12;

    const yearlyData = [];
    const cashFlowStream = [-totalCashInvested];

    // 3. 40-Year Loop
    for (let year = 1; year <= 40; year++) {
        const grossAnnualRent = currentRentMonthly * 12;
        const vacancyLoss = grossAnnualRent * vacancyRate;
        const egi = grossAnnualRent - vacancyLoss;

        const mgmt = egi * mgmtPct;
        const repairs = grossAnnualRent * repairsPct;
        const capex = grossAnnualRent * capexPct;

        const opex = currentTaxes + currentInsurance + currentHoa + currentUtilities + mgmt + repairs + capex;
        const noi = egi - opex;

        let annualPrincipal = 0;
        let annualInterest = 0;
        let annualPMI = 0;

        for (let m = 1; m <= 12; m++) {
            let monthlyPMI = 0;
            // PMI usually applies if Loan/OriginalPrice > 0.8. 
            // We use PP here as prompt specified "home purchase price".
            if (pp > 0 && (currentLoanBalance / pp) > 0.8) {
                monthlyPMI = (loanAmount * pmiPct) / 12;
            }

            let interestM = currentLoanBalance * monthlyRate;
            let principalM = monthlyPI - interestM;

            if (currentLoanBalance <= 0) {
                interestM = 0; principalM = 0; monthlyPMI = 0;
            } else if (currentLoanBalance < principalM) {
                principalM = currentLoanBalance;
            }

            currentLoanBalance -= principalM;
            annualPrincipal += principalM;
            annualInterest += interestM;
            annualPMI += monthlyPMI;
        }

        const annualDebtService = annualPrincipal + annualInterest + annualPMI;
        const cashFlow = noi - annualDebtService;

        // Exit Logic
        const saleProceeds = (currentHomeValue * (1 - saleCostPct)) - currentLoanBalance;
        const streamCopy = [...cashFlowStream, cashFlow + saleProceeds];
        const irr = calculateIRR(streamCopy);

        cashFlowStream.push(cashFlow);

        // Metrics
        const coc = totalCashInvested > 0 ? cashFlow / totalCashInvested : 0;
        const capRate = currentHomeValue > 0 ? noi / currentHomeValue : 0;
        const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
        const equity = currentHomeValue - currentLoanBalance;
        const appreciationValue = currentHomeValue - (currentHomeValue / (1+appHome));
        const roi = totalCashInvested > 0 ? (cashFlow + annualPrincipal + appreciationValue) / totalCashInvested : 0;

        yearlyData.push({
            year, irr, cashFlow, coc, capRate, dscr,
            principal: annualPrincipal,
            interestPmi: annualInterest + annualPMI,
            opex, egi, roi,
            homeValue: currentHomeValue,
            loanBalance: currentLoanBalance,
            equity,
            profitIfSold: saleProceeds - totalCashInvested
        });

        // Inflate
        currentRentMonthly *= (1 + appRent);
        currentHomeValue *= (1 + appHome);
        currentTaxes *= (1 + inflation);
        currentInsurance *= (1 + inflation);
        currentHoa *= (1 + inflation);
        currentUtilities *= (1 + inflation);
    }

    // 4. Update UI
    const y1 = yearlyData[0];
    document.getElementById('kpiCashFlow').textContent = fmtMoney(y1.cashFlow / 12);
    document.getElementById('kpiCoC').textContent = fmtPct(y1.coc);
    document.getElementById('kpiCapRate').textContent = fmtPct(y1.capRate);
    
    document.getElementById('kpiCashFlow').style.color = y1.cashFlow < 0 ? '#e7543c' : '#2E5638';

    // 5. Render
    renderTable(yearlyData);
    renderCharts(yearlyData);
}

function renderTable(data) {
    const tableBody = document.querySelector('#resultsTable tbody');
    if(!tableBody) return;
    tableBody.innerHTML = '';
    
    const yearsOfInterest = [1, 5, 10, 30];
    const metrics = [
        { label: 'IRR (if Sold)', key: 'irr', fmt: fmtPct },
        { label: 'Monthly Cash Flow', key: 'cashFlow', fmt: (v) => fmtMoney(v/12) },
        { label: 'Annual Cash Flow', key: 'cashFlow', fmt: fmtMoney },
        { label: 'Cash-on-Cash', key: 'coc', fmt: fmtPct },
        { label: 'Cap Rate', key: 'capRate', fmt: fmtPct },
        { label: 'DSCR', key: 'dscr', fmt: fmtDec },
        { label: 'Principal Paydown', key: 'principal', fmt: fmtMoney },
        { label: 'ROI', key: 'roi', fmt: fmtPct },
        { label: 'Profit if Sold', key: 'profitIfSold', fmt: fmtMoney },
    ];

    metrics.forEach(m => {
        const row = document.createElement('tr');
        const th = document.createElement('td');
        th.textContent = m.label;
        row.appendChild(th);

        yearsOfInterest.forEach(y => {
            const d = data[y-1] || {}; 
            const cell = document.createElement('td');
            cell.textContent = d[m.key] !== undefined ? m.fmt(d[m.key]) : '-';
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
}

function renderCharts(data) {
    const years = data.map(d => d.year);
    
    // CHART 1
    const ctx1 = document.getElementById('cashFlowChart').getContext('2d');
    if(chart1) { chart1.destroy(); chart1 = null; }
    
    chart1 = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Cash Flow ($)',
                    data: data.map(d => d.cashFlow),
                    backgroundColor: '#6b7e59', 
                    order: 2
                },
                {
                    label: 'CoC Return (%)',
                    data: data.map(d => d.coc * 100),
                    borderColor: '#e7543c', 
                    type: 'line',
                    yAxisID: 'y1',
                    order: 1,
                    borderDash: [5,5],
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { callback: (val) => '$' + val } },
                y1: { position: 'right', grid: { display: false }, ticks: { callback: (val) => val + '%' } },
                x: { grid: { display: false } }
            }
        }
    });

    // CHART 2
    const intervalData = data.filter((d, i) => (i+1) % 5 === 0 || i === 0);
    const intervalLabels = intervalData.map(d => 'Yr ' + d.year);
    const ctx2 = document.getElementById('stackedChart').getContext('2d');
    if(chart2) { chart2.destroy(); chart2 = null; }

    chart2 = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: intervalLabels,
            datasets: [
                { type: 'line', label: 'EGI', data: intervalData.map(d => d.egi), borderColor: '#2E5638', borderWidth: 2, tension: 0.3 },
                { label: 'OpEx', data: intervalData.map(d => d.opex), backgroundColor: '#82877d' }, 
                { label: 'Interest+PMI', data: intervalData.map(d => d.interestPmi), backgroundColor: '#6b7e59' }, 
                { label: 'Principal', data: intervalData.map(d => d.principal), backgroundColor: '#2E5638' }, 
                { label: 'Cash Flow', data: intervalData.map(d => d.cashFlow > 0 ? d.cashFlow : 0), backgroundColor: '#e7543c' } 
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    // CHART 3
    const ctx3 = document.getElementById('equityChart').getContext('2d');
    if(chart3) { chart3.destroy(); chart3 = null; }

    chart3 = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label: 'Home Value', data: data.map(d => d.homeValue), borderColor: '#2E5638', fill: false },
                { label: 'Loan Balance', data: data.map(d => d.loanBalance), borderColor: '#e7543c', borderDash: [5,5], fill: false },
                { label: 'Equity', data: data.map(d => d.equity), borderColor: '#6b7e59', backgroundColor: 'rgba(107, 126, 89, 0.1)', fill: true }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: { point: { radius: 0 } },
            scales: { y: { ticks: { callback: (val) => '$' + val/1000 + 'k' } } }
        }
    });
}

// Initial Calc
window.onload = calculate;