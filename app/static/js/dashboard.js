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
            meal_id : document.getElementById('meal').value,
            meal_type : document.getElementById('mealType').value,
            feedback : document.getElementById('feedback').value,
            quantity : 1
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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            updateCharts(data);
        } catch (error) {
            console.error('Error fetching updated stats:', error);
        }
    }

    // Health data view handlers
    document.getElementById('weeklyView').addEventListener('click', () => loadHealthData('weekly'));
    document.getElementById('monthlyView').addEventListener('click', () => loadHealthData('monthly'));
    document.getElementById('yearlyView').addEventListener('click', () => loadHealthData('yearly'));

    async function loadHealthData(view = 'daily') {
        try {
            const response = await fetch(`/health_stats?period=${view}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            updateCharts(data.data);
            return data;
        } catch (error) {
            console.error('Error loading health data:', error);
        }
    }

    async function updateCharts(data) {
        try {
            // Destroy existing charts if they exist
            if (window.calorieChart) window.calorieChart.destroy();
            if (window.sleepChart) window.sleepChart.destroy();
            if (window.macroChart) window.macroChart.destroy();

            // Format dates and extract data
            const dates = data.map(entry => new Date(entry.date).toLocaleDateString());
            const calories = data.map(entry => entry.total_calories || 0);
            const sleepDuration = data.map(entry => entry.avg_sleep || 0);
            const sleepQuality = data.map(entry => entry.avg_sleep_quality || 0);

            // Calorie Chart
            const calorieCtx = document.getElementById('calorieChart').getContext('2d');
            window.calorieChart = new Chart(calorieCtx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Calories Consumed',
                        data: calories,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Calories'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Daily Calorie Intake'
                        }
                    }
                }
            });

            // Sleep Chart
            const sleepCtx = document.getElementById('sleepChart').getContext('2d');
            window.sleepChart = new Chart(sleepCtx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Sleep Duration (hours)',
                        data: sleepDuration,
                        borderColor: 'rgb(54, 162, 235)',
                        yAxisID: 'duration',
                        tension: 0.1
                    }, {
                        label: 'Sleep Quality (1-10)',
                        data: sleepQuality,
                        borderColor: 'rgb(255, 99, 132)',
                        yAxisID: 'quality',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        duration: {
                            type: 'linear',
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Hours'
                            }
                        },
                        quality: {
                            type: 'linear',
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Quality (1-10)'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Sleep Tracking'
                        }
                    }
                }
            });

            // Update summary statistics
            if (data.length > 0) {
                const avgCalories = calories.reduce((a, b) => a + b, 0) / calories.length;
                const avgSleep = sleepDuration.reduce((a, b) => a + b, 0) / sleepDuration.length;
                const avgQuality = sleepQuality.reduce((a, b) => a + b, 0) / sleepQuality.length;

                // Update summary elements if they exist
                const summaryElements = {
                    'avg-calories': Math.round(avgCalories),
                    'avg-sleep': avgSleep.toFixed(1),
                    'avg-quality': avgQuality.toFixed(1)
                };

                for (const [id, value] of Object.entries(summaryElements)) {
                    const element = document.getElementById(id);
                    if (element) element.textContent = value;
                }
            }

            // If macronutrient data is available
            if (data.macronutrientBreakdown) {
                const macroCtx = document.getElementById('macroChart').getContext('2d');
                window.macroChart = new Chart(macroCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Proteins', 'Carbs', 'Fats'],
                        datasets: [{
                            data: [
                                data.macronutrientBreakdown.proteins || 0,
                                data.macronutrientBreakdown.carbs || 0,
                                data.macronutrientBreakdown.fats || 0
                            ],
                            backgroundColor: [
                                'rgb(255, 99, 132)',
                                'rgb(54, 162, 235)',
                                'rgb(255, 205, 86)'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Macronutrient Distribution'
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error updating charts:', error);
            // Show user-friendly error message
            displayNotification({
                type: 'error',
                message: 'Failed to update charts',
                suggestions: ['Please refresh the page and try again']
            });
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

    // Function to fetch and display notifications
    function loadNotifications() {
        fetch('/get_notifications')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const notifications = data.notifications;
                    // Example: Display in a notification area
                    const notificationArea = document.getElementById('notification-area');
                    notificationArea.innerHTML = '';
                    
                    notifications.forEach(notification => {
                        const notifElement = document.createElement('div');
                        notifElement.className = `notification ${notification.type}`;
                        notifElement.innerHTML = `
                            <p>${notification.message}</p>
                            <small>${new Date(notification.created_at).toLocaleString()}</small>
                        `;
                        notificationArea.appendChild(notifElement);
                    });
                }
            });
    }

    // Call this function when the dashboard loads
    document.addEventListener('DOMContentLoaded', loadNotifications);

    // Optionally, refresh notifications periodically
    setInterval(loadNotifications, 60000); // Update every minute
}); 