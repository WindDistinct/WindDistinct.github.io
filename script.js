const pieCharts = {};
let rawData = [];
let chartInstance = null;

const filters = {
	Year: [],
	"Player Direction": [],
	"Pass Direction": [],
	"Hop/1-2": [],
	"Defender Distance": [],
	"Make/Miss": [],
	"Offensive Action": [],
	Area: [],
	"Off Dribble Hand": [],
};

// Setup de filtros colapsables
function setupCollapsibleFilter(sectionId, fieldName) {
	const section = document.getElementById(sectionId);
	if (!section) return;

	const allCheckbox = section.querySelector("input.all");
	const itemCheckboxes = section.querySelectorAll("input.item");

	function updateFilter() {
		const selected = Array.from(itemCheckboxes)
			.filter((cb) => cb.checked)
			.map((cb) => cb.value);

		if (allCheckbox) {
			allCheckbox.checked = selected.length === itemCheckboxes.length;
		}

		filters[fieldName] = selected;
		updateChart();
	}

	if (allCheckbox) {
		allCheckbox.addEventListener("change", () => {
			const checked = allCheckbox.checked;
			itemCheckboxes.forEach((cb) => (cb.checked = checked));
			updateFilter();
		});
	}

	itemCheckboxes.forEach((cb) => cb.addEventListener("change", updateFilter));
	updateFilter();
}

// Inicializa todos los filtros en la UI
function initializeFilters() {
	document.querySelectorAll(".filter-section details").forEach((section) => {
		const field = section.dataset.field;
		if (field) {
			setupCollapsibleFilter(section.id, field);
			filters[field] = [];
		}
	});
}

// Carga de datos
function loadData(source = "Buddy-Hield-Shotdata.csv") {
	Papa.parse(source, {
		header: true,
		download: true,
		dynamicTyping: true,
		complete: ({ data }) => {
			if (!data || data.length === 0) {
				console.error("CSV is empty or malformed.");
				return;
			}
			rawData = data;
			filters.Year = ["2024-2025"];
			updateChart();
		},
		error: (err) => {
			console.error("Error loading CSV:", err);
			alert("No se pudo cargar el archivo de datos.");
		},
	});
}

// Filtrado de datos
function getFilteredData(data, filters) {
	return data.filter((row) =>
		Object.entries(filters).every(
			([key, values]) => !values.length || values.includes(row[key]),
		),
	);
}

// Agrupación por acción ofensiva + PPP
function groupByOffensiveActionWithPPP(data) {
	const grouped = {};

	data.forEach(({ ["Offensive Action"]: action, PTS }) => {
		const pts = Number(PTS);
		if (!action || isNaN(pts)) return;

		if (!grouped[action]) grouped[action] = { totalShots: 0, totalPoints: 0 };
		grouped[action].totalShots++;
		grouped[action].totalPoints += pts;
	});

	const labels = Object.keys(grouped);
	const totals = labels.map((action) => grouped[action].totalShots);
	const ppps = labels.map((action) =>
		(grouped[action].totalPoints / grouped[action].totalShots).toFixed(2),
	);

	return { labels, totals, ppps };
}

// Renderiza gráfico mixto
function renderMixedChart(labels, total, ppps) {
	const canvas = document.getElementById("shotChart");
	if (!canvas) {
		console.warn("shotChart canvas not found.");
		return;
	}
	const ctx = canvas.getContext("2d");
	if (chartInstance) chartInstance.destroy();

	chartInstance = new Chart(ctx, {
		type: "bar",
		data: {
			labels,
			datasets: [
				{
					type: "bar",
					label: "Possessions",
					data: total,
					backgroundColor: "rgba(255, 195, 0, 0.6)",
					yAxisID: "y",
					order: 2,
				},
				{
					type: "line",
					label: "PPP",
					data: ppps,
					backgroundColor: "rgba(51, 168, 255, 0.6)",
					borderColor: "rgba(51, 168, 255, 1)",
					fill: false,
					yAxisID: "y1",
					order: 1,
				},
			],
		},
		options: {
			responsive: true,
			interaction: {
				mode: "index",
				intersect: false,
			},
			scales: {
				y: {
					beginAtZero: true,
					title: { display: true, text: "Cantidad de Jugadas" },
				},
				y1: {
					beginAtZero: true,
					suggestedMax: 3.5,
					position: "right",
					grid: { drawOnChartArea: false },
					title: { display: true, text: "PPP" },
				},
			},
		},
	});
}

// Gráfico de pastel
function renderPieChart(canvasId, labels, values, title) {
	const canvas = document.getElementById(canvasId);
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	if (pieCharts[canvasId]) pieCharts[canvasId].destroy();

	pieCharts[canvasId] = new Chart(ctx, {
		type: "pie",
		data: {
			labels,
			datasets: [
				{
					data: values,
					backgroundColor: [
						"#4bc0c0",
						"#ff6384",
						"#ffcd56",
						"#36a2eb",
						"#9966ff",
						"#ff9f40",
						"#c9cbcf",
						"#8bcdcd",
					],
				},
			],
		},
		options: {
			responsive: true,
			plugins: {
				tooltip: {
					callbacks: {
						label: ({ parsed, dataset }) => {
							const total = dataset.data.reduce((a, b) => a + b, 0);
							const percentage = ((parsed / total) * 100).toFixed(1);
							return `${parsed} (${percentage}%)`;
						},
					},
				},
				title: { display: true, text: title },
			},
		},
	});
}

// Actualiza todos los gráficos de pastel
function updateAllPieCharts(filteredData) {
	const configs = [
		{
			field: "Defender Distance",
			title: "Defender Distance",
			canvasId: "pieDD",
		},
		{ field: "Make/Miss", title: "FG%", canvasId: "pieFG" },
		{ field: "Hop/1-2", title: "Footwork", canvasId: "pieFoot" },
		{ field: "Area", title: "Shot Area", canvasId: "pieArea" },
		{ field: "Offensive Action", title: "Action", canvasId: "pieAction" },
		{ field: "Pass Direction", title: "Pass Direction", canvasId: "piePass" },
		{
			field: "Player Direction",
			title: "Player Direction",
			canvasId: "piePlay",
		},
		{
			field: "Off Dribble Hand",
			title: "Off Dribble Hand",
			canvasId: "pieOff",
		},
	];

	configs.forEach(({ field, title, canvasId }) => {
		const countMap = {};
		filteredData.forEach((row) => {
			const key = row[field];
			if (key) countMap[key] = (countMap[key] || 0) + 1;
		});

		const labels = Object.keys(countMap);
		const values = labels.map((k) => countMap[k]);

		renderPieChart(canvasId, labels, values, title);
	});
}

// Actualización general
function updateChart() {
	if (!rawData.length) return;
	const filteredData = getFilteredData(rawData, filters);
	const { labels, totals, ppps } = groupByOffensiveActionWithPPP(filteredData);
	updateAllPieCharts(filteredData);
	renderMixedChart(labels, totals, ppps);
}

// Inicialización cuando DOM está listo
document.addEventListener("DOMContentLoaded", () => {
	initializeFilters();
	loadData();
});
