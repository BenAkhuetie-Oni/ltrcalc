// --- UTILITY FUNCTIONS ---
function parseInput(id) {
    return parseFloat(document.getElementById(id).value) || 0;
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

// Custom IRR Calculation (Newton-Raphson method)
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

// --- GLOBAL CHART VARIABLES (to destroy before redrawing) ---
let chart1 = null;
let chart2 = null;
let chart3 = null;

function calculate() {
    // --- 1. GET INPUTS ---
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

    // --- 2. INITIAL SETUP ---
    const downPayment = pp * downPct;
    const closingCosts = pp * closingCostsPct;
    const totalCashInvested = downPayment + closingCosts + rehab;
    const loanAmount = pp - downPayment;
    
    // 1% Rule
    const onePercentRule = (rentMonthly / (pp + rehab));
    document.getElementById('onePercentRule').textContent = fmtPct(onePercentRule) + (onePercentRule >= 0.01 ? " (Pass)" : " (Fail)");

    // Mortgage Calc
    const monthlyRate = rate / 12;
    const nPayments = term * 12;
    let monthlyPI = 0;
    if (monthlyRate > 0) {
        monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1);
    } else {
        monthlyPI = loanAmount / nPayments;
    }

    // Loop Variables
    let currentHomeValue = arv;
    let currentLoanBalance = loanAmount;
    let currentRentMonthly = rentMonthly;
    
    // Costs that inflate (fixed dollar amounts initially)
    let currentTaxes = taxesAnnual;
    let currentInsurance = pp * insurancePct; // Base input
    let currentHoa = hoaMonthly * 12;
    let currentUtilities = utilitiesMonthly * 12;

    const yearlyData = [];
    const cashFlowStream = [-totalCashInvested]; // Year 0

    // --- 3. 40-YEAR LOOP ---
    for (let year = 1; year <= 40; year++) {
        
        // Income
        const grossAnnualRent = currentRentMonthly * 12;
        const vacancyLoss = grossAnnualRent * vacancyRate;
        const egi = grossAnnualRent - vacancyLoss;

        // Variable Expenses (% of Rent)
        const mgmt = egi * mgmtPct;
        const repairs = grossAnnualRent * repairsPct;
        const capex = grossAnnualRent * capexPct;

        // Fixed Expenses (Summed)
        const opex = currentTaxes + currentInsurance + currentHoa + currentUtilities + mgmt + repairs + capex;
        const noi = egi - opex;

        // Debt Service Loop (Monthly)
        let annualPrincipal = 0;
        let annualInterest = 0;
        let annualPMI = 0;

        for (let m = 1; m <= 12; m++) {
            // PMI Check (Based on Original Purchase Price as per typical rules, or Current Value depending on loan type. 
            // Prompt implied Loan / Purchase Price check)
            let monthlyPMI = 0;
            if ((currentLoanBalance / pp) > 0.8) {
                monthlyPMI = (loanAmount * pmiPct) / 12;
            }

            let interestM = currentLoanBalance * monthlyRate;
            let principalM = monthlyPI - interestM;

            // Payoff logic
            if (currentLoanBalance <= 0) {
                interestM = 0;
                principalM = 0;
                monthlyPMI = 0;
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

        // Sale Logic for Metrics
        const saleProceeds = (currentHomeValue * (1 - saleCostPct)) - currentLoanBalance;
        
        // IRR for this year (Simulate sale)
        const streamCopy = [...cashFlowStream, cashFlow + saleProceeds];
        const irr = calculateIRR(streamCopy);

        // Store pure cash flow for next iteration history
        cashFlowStream.push(cashFlow);

        // Metrics
        const coc = totalCashInvested > 0 ? cashFlow / totalCashInvested : 0;
        const capRate = currentHomeValue > 0 ? noi / currentHomeValue : 0;
        const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
        const equity = currentHomeValue - currentLoanBalance;
        const appreciationValue = currentHomeValue - (currentHomeValue / (1+appHome)); // Growth this specific year
        const roi = totalCashInvested > 0 ? (cashFlow + annualPrincipal + appreciationValue) / totalCashInvested : 0;

        yearlyData.push({
            year,
            irr,
            cashFlow,
            coc,
            capRate,
            dscr,
            principal: annualPrincipal,
            interestPmi: annualInterest + annualPMI,
            opex,
            egi,
            roi,
            homeValue: currentHomeValue,
            loanBalance: currentLoanBalance,
            equity,
            profitIfSold: saleProceeds - totalCashInvested
        });

        // Inflate for next year
        currentRentMonthly *= (1 + appRent);
        currentHomeValue *= (1 + appHome);
        currentTaxes *= (1 + inflation);
        currentInsurance *= (1 + inflation);
        currentHoa *= (1 + inflation);
        currentUtilities *= (1 + inflation);
    }

    // --- 4. RENDER TABLE ---
    renderTable(yearlyData);

    // --- 5. RENDER CHARTS ---
    renderCharts(yearlyData);
}

function renderTable(data) {
    const tableBody = document.querySelector('#resultsTable tbody');
    tableBody.innerHTML = '';

    const yearsOfInterest = [1, 5, 10, 30];
    const metrics = [
        { label: 'IRR', key: 'irr', fmt: fmtPct },
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
            const yearData = data[y-1] || {}; // Handle if loan term < 30
            const cell = document.createElement('td');
            cell.textContent = yearData[m.key] !== undefined ? m.fmt(yearData[m.key]) : '-';
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
}

function renderCharts(data) {
    const years = data.map(d => d.year);
    
    // CHART 1: Cash Flow & CoC
    const ctx1 = document.getElementById('cashFlowChart').getContext('2d');
    if(chart1) chart1.destroy();
    
    chart1 = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Annual Cash Flow ($)',
                    data: data.map(d => d.cashFlow),
                    borderColor: '#2E5638',
                    yAxisID: 'y',
                    type: 'line',
                    tension: 0.4
                },
                {
                    label: 'Cash-on-Cash (%)',
                    data: data.map(d => d.coc * 100),
                    borderColor: '#e7543c',
                    yAxisID: 'y1',
                    type: 'line',
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'Cash Flow ($)'} },
                y1: { type: 'linear', display: true, position: 'right', title: {display: true, text: 'CoC (%)'}, grid: {drawOnChartArea: false} }
            }
        }
    });

    // CHART 2: Stacked Expenses + EGI Line
    // Only showing years 1, 5, 10, 30 to match request "Segmented bar graph"
    const indices = [0, 4, 9, 29];
    const subset = indices.map(i => data[i] || {year: i+1, opex:0, interestPmi:0, principal:0, cashFlow:0, egi:0});
    const subLabels = subset.map(d => 'Year ' + d.year);

    const ctx2 = document.getElementById('stackedChart').getContext('2d');
    if(chart2) chart2.destroy();

    chart2 = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: subLabels,
            datasets: [
                { type: 'line', label: 'EGI', data: subset.map(d => d.egi), borderColor: 'black', borderWidth: 2, fill: false },
                { label: 'OpEx', data: subset.map(d => d.opex), backgroundColor: '#82877d' },
                { label: 'Interest & PMI', data: subset.map(d => d.interestPmi), backgroundColor: '#6b7e59' },
                { label: 'Principal', data: subset.map(d => d.principal), backgroundColor: '#2E5638' },
                { label: 'Cash Flow', data: subset.map(d => d.cashFlow > 0 ? d.cashFlow : 0), backgroundColor: '#e7543c' }
            ]
        },
        options: {
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    // CHART 3: Equity Over Time
    const ctx3 = document.getElementById('equityChart').getContext('2d');
    if(chart3) chart3.destroy();

    chart3 = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label: 'Home Value', data: data.map(d => d.homeValue), borderColor: '#2E5638', fill: false },
                { label: 'Loan Balance', data: data.map(d => d.loanBalance), borderColor: '#e7543c', borderDash: [5,5], fill: false },
                { label: 'Equity', data: data.map(d => d.equity), borderColor: '#6b7e59', backgroundColor: 'rgba(107, 126, 89, 0.2)', fill: true }
            ]
        },
        options: {
            elements: { point: { radius: 0 } }, // Hide points for cleaner look
            interaction: { mode: 'index', intersect: false }
        }
    });
}

// Run once on load
window.onload = calculate;