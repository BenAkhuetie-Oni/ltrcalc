// --- UTILITY FUNCTIONS ---
function parseInput(id) {
    const val = parseFloat(document.getElementById(id).value);
    return isNaN(val) ? 0 : val;
}

function fmtMoney(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function fmtPct(num) {
    return (num * 100).toFixed(2) + '%';
}

function fmtDec(num) {
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
        
        let newRate = rate - npv / dNpv;
        if (Math.abs(newRate - rate) < precision) return newRate;
        rate = newRate;
    }
    return rate;
}

// --- TAB SWITCHING ---
function switchTab(tabName) {
    // Hide all charts
    document.getElementById('chart-cashflow').classList.add('hidden');
    document.getElementById('chart-expenses').classList.add('hidden');
    document.getElementById('chart-equity').classList.add('hidden');
    
    // Show selected
    document.getElementById(`chart-${tabName}`).classList.remove('hidden');

    // Update buttons
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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
    const onePercentVal = (rentMonthly / (pp + rehab));
    const kpiOne = document.getElementById('kpiOnePercent');
    const badgeOne = document.getElementById('badgeOnePercent');
    
    kpiOne.textContent = fmtPct(onePercentVal);
    if (onePercentVal >= 0.01) {
        badgeOne.textContent = "Pass";
        badgeOne.className = "badge pass";
    } else {
        badgeOne.textContent = "Fail";
        badgeOne.className = "badge fail";
    }

    // Mortgage
    const monthlyRate = rate / 12;
    const nPayments = term * 12;
    let monthlyPI = 0;
    if (monthlyRate > 0) {
        monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1);
    } else {
        monthlyPI = loanAmount / nPayments;
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
            if ((currentLoanBalance / pp) > 0.8) {
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

    // 4. Update UI - KPI Cards (Using Year 1 Data)
    const y1 = yearlyData[0];
    document.getElementById('kpiCashFlow').textContent = fmtMoney(y1.cashFlow / 12);
    document.getElementById('kpiCoC').textContent = fmtPct(y1.coc);
    document.getElementById('kpiCapRate').textContent = fmtPct(y1.capRate);
    
    // Colorize Cash Flow
    if(y1.cashFlow < 0) {
        document.getElementById('kpiCashFlow').style.color = '#e7543c';
    } else {
        document.getElementById('kpiCashFlow').style.color = '#2E5638';
    }

    // 5. Render Table
    renderTable(yearlyData);

    // 6. Render Charts
    renderCharts(yearlyData);
}

function renderTable(data) {
    const tableBody = document.querySelector('#resultsTable tbody');
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
    
    // --- Chart 1: Cash Flow & CoC (Matches Image Style) ---
    const ctx1 = document.getElementById('cashFlowChart').getContext('2d');
    if(chart1) chart1.destroy();
    
    chart1 = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Cash Flow ($)',
                    data: data.map(d => d.cashFlow),
                    backgroundColor: '#6b7e59', // Light Green Bars
                    order: 2
                },
                {
                    label: 'CoC Return (%)',
                    data: data.map(d => d.coc * 100),
                    borderColor: '#e7543c', // Red Line
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
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f0f0f0' },
                    ticks: { callback: (val) => '$' + val }
                },
                y1: { 
                    position: 'right', 
                    grid: { display: false },
                    ticks: { callback: (val) => val + '%' }
                },
                x: { grid: { display: false } }
            }
        }
    });

    // --- Chart 2: Stacked Expenses ---
    // Using 5-year intervals for cleanliness
    const intervalData = data.filter((d, i) => (i+1) % 5 === 0 || i === 0);
    const intervalLabels = intervalData.map(d => 'Yr ' + d.year);
    
    const ctx2 = document.getElementById('stackedChart').getContext('2d');
    if(chart2) chart2.destroy();

    chart2 = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: intervalLabels,
            datasets: [
                { type: 'line', label: 'EGI', data: intervalData.map(d => d.egi), borderColor: '#2E5638', borderWidth: 2, tension: 0.3 },
                { label: 'OpEx', data: intervalData.map(d => d.opex), backgroundColor: '#82877d' }, // Grey
                { label: 'Interest+PMI', data: intervalData.map(d => d.interestPmi), backgroundColor: '#6b7e59' }, // Light Green
                { label: 'Principal', data: intervalData.map(d => d.principal), backgroundColor: '#2E5638' }, // Dark Green
                { label: 'Cash Flow', data: intervalData.map(d => d.cashFlow > 0 ? d.cashFlow : 0), backgroundColor: '#e7543c' } // Red
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    // --- Chart 3: Equity ---
    const ctx3 = document.getElementById('equityChart').getContext('2d');
    if(chart3) chart3.destroy();

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