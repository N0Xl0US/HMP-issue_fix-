document.addEventListener('DOMContentLoaded', async () => {
    // Dark Mode Handling
    const darkModeToggle = document.getElementById('darkModeToggle');
    const applyDarkMode = (isDark) => {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    // Load the saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    applyDarkMode(savedDarkMode);

    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        applyDarkMode(isDark);
    });

    // Logout Button
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                window.location.href = "/login_signup";
            } else {
                console.error('Logout failed:', await response.text());
                alert('Failed to log out. Please try again.');
            }
        } catch (error) {
            console.error('Error during logout:', error);
            alert('An unexpected error occurred.');
        }
    });

    // Chart Configuration
    const darkMode = { backgroundColor: '#18181b', gridColor: '#27272a', textColor: '#9ca3af' };

    // Initialize Charts
    const caloriesChart = new Chart(document.getElementById('caloriesChart'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 2000],
                backgroundColor: ['#3b82f6', '#27272a'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: { legend: { display: false } }
        }
    });

    const mealsChart = new Chart(document.getElementById('mealsChart'), {
        type: 'pie',
        data: {
            labels: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#3b82f6', '#a855f7', '#f59e0b', '#90EE90'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: darkMode.textColor } } }
        }
    });

    const sugarChart = new Chart(document.getElementById('sugarChart'), {
        type: 'line',
        data: {
            labels: Array(7).fill('').map((_, i) => `Day ${i + 1}`),
            datasets: [{
                data: [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#f43f5e',
                tension: 0.4,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: darkMode.textColor } },
                y: { ticks: { color: darkMode.textColor, beginAtZero: true } }
            }
        }
    });

    const macronutrientChart = new Chart(document.getElementById('macronutrientChart'), {
        type: 'bar',
        data: {
            labels: ['Carbs', 'Proteins', 'Fats'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#3b82f6', '#a855f7', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: darkMode.textColor } },
                y: { ticks: { color: darkMode.textColor, beginAtZero: true } }
            }
        }
    });

    // Fetch and populate meals dropdown
    const mealSelect = document.getElementById('meal');
    try {
        const response = await fetch('/get_meals');
        if (!response.ok) {
            console.error('Failed to fetch meals:', response.statusText);
            mealSelect.innerHTML = "<option>Error fetching meals</option>";
            return;
        }

        const meals = await response.json();
        if (meals && meals.length > 0) {
            meals.forEach(meal => {
                const option = document.createElement('option');
                option.value = meal.meal_id;
                option.textContent = meal.meal_name;
                mealSelect.appendChild(option);
            });
        } else {
            mealSelect.innerHTML = "<option>No meals available</option>";
        }
    } catch (error) {
        console.error('Error fetching meals:', error);
        mealSelect.innerHTML = "<option>Failed to load meals</option>";
    }

    // Handle meal form submission
    document.getElementById('mealForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        const mealData = {
            meal_id: document.getElementById('meal').value,
            meal_type: document.getElementById('mealType').value,
            feedback: document.getElementById('feedback').value,
        };

        try {
            const response = await fetch('/add_meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mealData)
            });

            if (response.ok) {
                alert('Meal added successfully!');
                updateStats();
            } else {
                console.error('Failed to add meal:', await response.text());
                alert('Failed to add meal.');
            }
        } catch (error) {
            console.error('Error adding meal:', error);
            alert('An error occurred while adding the meal.');
        }
    });

    // Update dashboard stats
    async function updateStats() {
        try {
            const response = await fetch('/get_updated_stats');
            const stats = await response.json();
            
            if (stats.error) {
                console.error('Error fetching updated stats:', stats.error);
                return;
            }

            // Update calories
            const caloriesConsumed = stats.caloriesConsumed || 0;
            const caloriesRemaining = 2000 - caloriesConsumed;
            document.getElementById('caloriesConsumed').textContent = `${caloriesConsumed} kcal`;
            document.getElementById('caloriesRemaining').textContent = `${caloriesRemaining} kcal`;
            
            // Update charts with new data
            updateCharts(stats);
            
            // Update macronutrient percentages
            updateMacronutrients(stats.macronutrientBreakdown);
        } catch (error) {
            console.error('Error fetching updated stats:', error);
            alert("Unable to fetch updated stats. Please try again later.");
        }
    }

    // Health data view handlers
    document.getElementById('weeklyView').addEventListener('click', () => loadHealthData('weekly'));
    document.getElementById('monthlyView').addEventListener('click', () => loadHealthData('monthly'));
    document.getElementById('yearlyView').addEventListener('click', () => loadHealthData('yearly'));

    async function loadHealthData(view) {
        try {
            const response = await fetch(`/get_health_stats?view=${view}`);
            const data = await response.json();

            if (data.error) {
                console.error('Error fetching health stats:', data.error);
                return;
            }

            const overallHealthChart = Chart.getChart('overallHealthChart');
            if (overallHealthChart) {
                overallHealthChart.data.labels = data.labels;
                overallHealthChart.data.datasets[0].data = data.values;
                overallHealthChart.update();
            }
        } catch (error) {
            console.error('Error loading health data:', error);
        }
    }

    // Notification System
    function displayNotification(notification) {
        let notificationsContainer = document.querySelector('.notifications-container');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.className = 'notifications-container';
            document.body.appendChild(notificationsContainer);
        }

        const notifDiv = document.createElement('div');
        notifDiv.className = `notification ${notification.type}`;
        
        const current = Math.round(notification.current * 10) / 10;
        const limit = Math.round(notification.limit * 10) / 10;
        const percentage = Math.round((current / limit) * 100);
        
        let notifContent = `
            <div class="notification-header">
                <h4>${notification.message}</h4>
                <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">
                <div class="progress-info">
                    <p>Current: ${current} / Limit: ${limit} (${percentage}%)</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </div>
        `;
        
        if (notification.suggestions && notification.suggestions.length > 0) {
            notifContent += `
                <div class="suggestions">
                    <h5>Recommendations:</h5>
                    <ul>
                        ${notification.suggestions.map(suggestion => 
                            `<li><span class="suggestion-icon">💡</span>${suggestion}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
        
        notifContent += '</div>';
        notifDiv.innerHTML = notifContent;
        notifDiv.classList.add('notification-slide-in');
        notificationsContainer.insertBefore(notifDiv, notificationsContainer.firstChild);
        
        setTimeout(() => {
            notifDiv.classList.add('notification-fade-out');
            setTimeout(() => notifDiv.remove(), 500);
        }, 10000);
    }

    function handleNewNotifications(notifications) {
        if (!notifications || !notifications.length) return;
        notifications.forEach(notification => {
            displayNotification(notification);
        });
    }

    // Check for notifications periodically
    async function checkNotifications() {
        try {
            const response = await fetch('/get_notifications');
            const data = await response.json();
            
            if (data.success && data.notifications) {
                handleNewNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
    }

    // Initial setup
    updateStats();
    loadHealthData('weekly');
    checkNotifications();
    
    // Check for notifications every 30 seconds
    setInterval(checkNotifications, 30000);
}); 