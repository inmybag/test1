document.addEventListener('DOMContentLoaded', () => {
    const defaultDate = new Date();
    // 올리브영 서버 기준 시간 고려하여 YYYY-MM-DD 포맷
    const timezoneOffset = defaultDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(defaultDate - timezoneOffset)).toISOString().split('T')[0];
    
    const datePicker = document.getElementById('date-picker');
    const rankingContainer = document.getElementById('ranking-container');
    const loadingState = document.getElementById('loading');
    const errorState = document.getElementById('error');
    const noDataState = document.getElementById('no-data');
    
    // Modal Setup
    const chartModal = document.getElementById('chart-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    let rankingChart = null;
    
    closeModalBtn.addEventListener('click', closeChartModal);
    chartModal.addEventListener('click', (e) => {
        if (e.target === chartModal) {
            closeChartModal();
        }
    });

    function closeChartModal() {
        chartModal.classList.add('hidden');
    }

    rankingContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.view-chart-btn');
        if (btn) {
            const title = btn.getAttribute('data-title');
            await openChartModal(title);
        }
    });

    async function openChartModal(title) {
        modalTitle.textContent = title;
        chartModal.classList.remove('hidden');
        
        try {
            const dateStr = datePicker.value.replace(/-/g, '');
            const response = await fetch(`/api/history?title=${encodeURIComponent(title)}&date=${dateStr}`);
            const result = await response.json();
            
            if (result.error) {
                alert('데이터를 불러오는데 실패했습니다.');
                return;
            }
            
            renderChart(result.history);
        } catch (error) {
            console.error(error);
            alert('데이터 로드 중 오류가 발생했습니다.');
        }
    }
    
    function renderChart(history) {
        const ctx = document.getElementById('ranking-chart').getContext('2d');
        
        if (rankingChart) {
            rankingChart.destroy();
        }
        
        if (!history || history.length === 0) {
            return;
        }

        const labels = history.map(item => {
            const m = item.date_str.substring(4, 6);
            const d = item.date_str.substring(6, 8);
            return `${m}.${d}`;
        });
        
        const rankData = history.map(item => item.rank);
        const priceData = history.map(item => {
            if (item.price) {
                return parseInt(item.price.toString().replace(/,/g, ''), 10) || 0;
            }
            return 0;
        });
        
        const gradientRank = ctx.createLinearGradient(0, 0, 0, 400);
        gradientRank.addColorStop(0, 'rgba(157, 206, 99, 0.5)');
        gradientRank.addColorStop(1, 'rgba(15, 23, 42, 0)');

        const gradientPrice = ctx.createLinearGradient(0, 0, 0, 400);
        gradientPrice.addColorStop(0, 'rgba(99, 157, 206, 0.5)');
        gradientPrice.addColorStop(1, 'rgba(15, 23, 42, 0)');

        rankingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '순위',
                        data: rankData,
                        yAxisID: 'y',
                        borderColor: '#9dce63',
                        backgroundColor: gradientRank,
                        borderWidth: 3,
                        pointBackgroundColor: '#f8fafc',
                        pointBorderColor: '#9dce63',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: '가격',
                        data: priceData,
                        yAxisID: 'y1',
                        borderColor: '#639dce',
                        backgroundColor: gradientPrice,
                        borderWidth: 3,
                        pointBackgroundColor: '#f8fafc',
                        pointBorderColor: '#639dce',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: true,
                        labels: { color: '#94a3b8' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        titleColor: '#94a3b8',
                        bodyColor: '#f8fafc',
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === '순위') {
                                    return `순위: ${context.parsed.y}위`;
                                } else {
                                    return `가격: ${context.parsed.y.toLocaleString()}원`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        reverse: true,
                        min: 1,
                        suggestedMax: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 20
                        },
                        title: {
                            display: true,
                            text: '순위',
                            color: '#94a3b8'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        },
                        title: {
                            display: true,
                            text: '가격(원)',
                            color: '#639dce'
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }

    // Set initial date
    datePicker.value = localISOTime;
    datePicker.max = localISOTime; // Can't pick future dates
    
    // Fetch initial data
    fetchRankings(localISOTime.replace(/-/g, ''));
    
    // Handle date change
    datePicker.addEventListener('change', (e) => {
        const dateStr = e.target.value.replace(/-/g, '');
        if (dateStr) {
            fetchRankings(dateStr);
        }
    });
    
    async function fetchRankings(dateStr) {
        // Update UI states
        rankingContainer.innerHTML = '';
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        noDataState.classList.add('hidden');
        
        try {
            const response = await fetch(`/api/rankings?date=${dateStr}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            loadingState.classList.add('hidden');
            
            if (result.count === 0 || !result.data || result.data.length === 0) {
                noDataState.classList.remove('hidden');
                return;
            }
            
            renderRankings(result.data);
            
            // Re-initialize lucide icons if any were added
            lucide.createIcons();
            
        } catch (error) {
            console.error('Failed to fetch rankings:', error);
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
        }
    }
    
    function renderRankings(rankings) {
        rankingContainer.innerHTML = '';
        
        rankings.forEach((item, index) => {
            const delay = index * 0.05; // Staggered animation
            
            const card = document.createElement('div');
            card.className = `product-card rank-${item.rank}`;
            card.style.animationDelay = `${delay}s`;
            
            card.innerHTML = `
                <div class="rank-badge">${item.rank}</div>
                <div class="image-container">
                    <img src="${item.image_url}" alt="${item.title}" class="product-image" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">
                </div>
                <div class="product-info">
                    <div class="brand-name">${item.brand}</div>
                    <h3 class="product-title">${item.title}</h3>
                    <div class="price-container">
                        <span class="price-number">${formatNumber(item.price)}</span>
                        <span class="price-currency">원</span>
                    </div>
                    <button class="view-chart-btn" data-title="${item.title.replace(/"/g, '&quot;')}">
                        <i data-lucide="line-chart"></i> 차트 보기
                    </button>
                </div>
            `;
            
            rankingContainer.appendChild(card);
        });
    }
    
    function formatNumber(numStr) {
        if (!numStr) return '0';
        return numStr; 
    }
});
