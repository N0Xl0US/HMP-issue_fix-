document.addEventListener('DOMContentLoaded', async () => {
    const cleanup = () => {
        // Remove event listeners
        ['weeklyView', 'monthlyView', 'yearlyView'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.removeEventListener('click', element.clickHandler);
            }
        });
    };

    // Add event listeners with stored references
    ['weeklyView', 'monthlyView', 'yearlyView'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.clickHandler = () => loadHealthData(id.replace('View', ''));
            element.addEventListener('click', element.clickHandler);
        }
    });

    // Clean up on page unload
    window.addEventListener('unload', () => {
        cleanup();
        EventManager.cleanup();
        cleanupCharts();
    });

    // Dark Mode Handling
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        const applyDarkMode = async (isDark) => {
            try {
                if (isDark) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
                await updateChartThemes(isDark);
            } catch (error) {
                console.error('Error applying dark mode:', error);
                throw error;
            }
        };

        // Load the saved dark mode preference
        const savedDarkMode = localStorage.getItem('darkMode') === 'true';
        applyDarkMode(savedDarkMode);

        // Toggle dark mode
        darkModeToggle.addEventListener('click', async () => {
            try {
                const isDark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('darkMode', isDark);
                await applyDarkMode(isDark);
            } catch (error) {
                console.error('Error toggling dark mode:', error);
                NotificationQueue.add({
                    type: 'error',
                    message: 'Failed to toggle dark mode',
                    suggestions: ['Please refresh the page and try again']
                });
            }
        });
    }

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
            const token = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const response = await fetch('/add_meal', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': token
                },
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

    
    let isLoadingHealthData = false;
    let currentHealthDataRequest = null;

    const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    };

    const debouncedLoadHealthData = debounce(loadHealthData, 300);

    async function loadHealthData(view = 'daily') {
        const validViews = ['daily', 'weekly', 'monthly', 'yearly'];
        if (!validViews.includes(view)) {
            console.error('Invalid view parameter:', view);
            return;
        }
        
        if (isLoadingHealthData) return;
        
        try {
            isLoadingHealthData = true;
            
            // Cancel previous request if exists
            if (currentHealthDataRequest) {
                currentHealthDataRequest.abort();
            }

            const controller = new AbortController();
            currentHealthDataRequest = controller;

            const response = await fetch(`/health_stats?period=${view}`, {
                signal: controller.signal
            });
            
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
            if (error.name === 'AbortError') {
                console.log('Request was cancelled');
            } else {
                console.error('Error loading health data:', error);
            }
        } finally {
            isLoadingHealthData = false;
            currentHealthDataRequest = null;
        }
    }

    async function updateCharts(data) {
        try {
            const chartElements = {
                calorieChart: document.getElementById('calorieChart'),
                sleepChart: document.getElementById('sleepChart'),
                macroChart: document.getElementById('macroChart')
            };

            // Verify all required elements exist
            for (const [key, element] of Object.entries(chartElements)) {
                if (!element) {
                    throw new Error(`Required chart element '${key}' not found`);
                }
            }

            // Destroy existing charts
            ['calorieChart', 'sleepChart', 'macroChart'].forEach(chartId => {
                if (window[chartId] instanceof Chart) {
                    window[chartId].destroy();
                }
            });

            // Format dates and extract data
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format: expected array');
            }

            // Validate date entries
            const dates = data.map(entry => {
                if (!entry.date) {
                    throw new Error('Missing date in data entry');
                }
                return new Date(entry.date).toLocaleDateString();
            });

            // Add type checking for numerical values
            const validateNumber = (value, fieldName) => {
                const num = Number(value);
                if (isNaN(num)) {
                    throw new Error(`Invalid ${fieldName}: expected number, got ${typeof value}`);
                }
                return num || 0;
            };

            const calories = data.map(entry => validateNumber(entry.total_calories, 'calories'));
            const sleepDuration = data.map(entry => validateNumber(entry.avg_sleep, 'sleep duration'));
            const sleepQuality = data.map(entry => validateNumber(entry.avg_sleep_quality, 'sleep quality'));

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
                const summaryElements = {
                    'avg-calories': Math.round(calculateAverage(calories)),
                    'avg-sleep': calculateAverage(sleepDuration, 0).toFixed(1),
                    'avg-quality': calculateAverage(sleepQuality, 0).toFixed(1)
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
            displayNotification({
                type: 'error',
                message: 'Failed to update charts',
                suggestions: ['Please refresh the page and try again']
            });
        }
    }

    function cleanupCharts() {
        const chartIds = ['calorieChart', 'sleepChart', 'macroChart'];
        chartIds.forEach(chartId => {
            if (window[chartId]) {
                window[chartId].destroy();
                window[chartId] = null;
            }
        });
    }

    // Notification System
    function displayNotification(notification) {
        if (!notification || typeof notification !== 'object') {
            console.error('Invalid notification data');
            return;
        }

        // Validate required fields
        if (!notification.message) {
            console.error('Notification message is required');
            return;
        }

        // Sanitize input
        const sanitizeHTML = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        const message = sanitizeHTML(notification.message);
        const type = notification.type || 'info';
        
        let notificationsContainer = document.querySelector('.notifications-container');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.className = 'notifications-container';
            document.body.appendChild(notificationsContainer);
        }
    
        const notifDiv = document.createElement('div');
        notifDiv.className = `notification ${type}`;
        
        const current = notification.current ? Math.round(notification.current * 10) / 10 : 0;
        const limit = notification.limit ? Math.round(notification.limit * 10) / 10 : 100;
        const percentage = limit ? Math.round((current / limit) * 100) : 0;
        
        let notifContent = `
            <div class="notification-header">
                <h4>${message}</h4>
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
        
        let timeoutId;
        
        const removeNotification = () => {
            clearTimeout(timeoutId);
            notifDiv.classList.add('notification-fade-out');
            setTimeout(() => notifDiv.remove(), 500);
        };
        
        timeoutId = setTimeout(removeNotification, 10000);
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
    

    // Function to fetch and display notifications
    async function fetchNotifications() {
        try {
            const response = await fetch('/get_notifications');
            const data = await response.json();
            
            if (data.success && data.notifications) {
                handleNewNotifications(data.notifications);
                updateNotificationArea(data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    const notificationInterval = setInterval(fetchNotifications, NOTIFICATION_CHECK_INTERVAL);

    window.addEventListener('unload', () => {
        clearInterval(notificationInterval);
        cleanup();
        EventManager.cleanup();
        cleanupCharts();
    });

    const EventManager = {
        listeners: new Map(),
        
        add(element, event, handler) {
            if (!element) return;
            
            const key = `${element.id || 'anonymous'}-${event}`;
            if (this.listeners.has(key)) {
                this.remove(element, event);
            }
            
            element.addEventListener(event, handler);
            this.listeners.set(key, { element, event, handler });
        },
        
        remove(element, event) {
            const key = `${element.id || 'anonymous'}-${event}`;
            const listener = this.listeners.get(key);
            if (listener) {
                listener.element.removeEventListener(listener.event, listener.handler);
                this.listeners.delete(key);
            }
        },
        
        cleanup() {
            this.listeners.forEach(listener => {
                this.remove(listener.element, listener.event);
            });
        }
    };

    // Add this notification queue system
    const NotificationQueue = {
        queue: [],
        isProcessing: false,
        maxNotifications: 3,
        
        async add(notification) {
            this.queue.push(notification);
            if (!this.isProcessing) {
                await this.processQueue();
            }
        },
        
        async processQueue() {
            if (this.isProcessing || this.queue.length === 0) return;
            
            this.isProcessing = true;
            
            try {
                const container = document.querySelector('.notifications-container');
                if (!container) {
                    console.error('Notifications container not found');
                    return;
                }
                
                while (this.queue.length > 0 && container.children.length < this.maxNotifications) {
                    const notification = this.queue.shift();
                    await this.displayNotification(notification);
                }
            } catch (error) {
                console.error('Error processing notification queue:', error);
            } finally {
                this.isProcessing = false;
            }
        },
        
        async displayNotification(notification) {
            return new Promise(resolve => {
                const notifDiv = createNotificationElement(notification);
                const container = document.querySelector('.notifications-container');
                container.insertBefore(notifDiv, container.firstChild);
                
                setTimeout(() => {
                    notifDiv.classList.add('notification-fade-out');
                    setTimeout(() => {
                        notifDiv.remove();
                        resolve();
                    }, 500);
                }, 5000);
            });
        }
    };

    // Add this chart configuration system
    const ChartConfigs = {
        defaultOptions: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        },
        
        getColorScheme(isDark = false) {
            return {
                grid: isDark ? '#27272a' : '#e5e7eb',
                text: isDark ? '#9ca3af' : '#374151',
                line: isDark ? '#60a5fa' : '#3b82f6'
            };
        },
        
        applyTheme(config, isDark = false) {
            const colors = this.getColorScheme(isDark);
            
            return {
                ...config,
                options: {
                    ...this.defaultOptions,
                    ...config.options,
                    scales: {
                        x: {
                            grid: { color: colors.grid },
                            ticks: { color: colors.text }
                        },
                        y: {
                            grid: { color: colors.grid },
                            ticks: { color: colors.text }
                        }
                    }
                }
            };
        }
    };
}); 